import type { Løype } from '@/data/rute';
import type { Terreng } from '@/engine/terreng';

type Pkt = { lat: number; lon: number; ele?: number };

/** Leser punktene fra en GPX-fil (spor først, ellers rute). Ingen DOM-parser, så det virker på mobil også. */
export function lesGpx(tekst: string): { navn: string | null; punkter: Pkt[] } {
  const navn = /<name>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/name>/i.exec(tekst)?.[1]?.trim() ?? null;
  const hent = (tagg: string) => {
    const ut: Pkt[] = [];
    const re = new RegExp(`<${tagg}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tagg}>)`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(tekst))) {
      const lat = /lat\s*=\s*"([^"]+)"/i.exec(m[1])?.[1];
      const lon = /lon\s*=\s*"([^"]+)"/i.exec(m[1])?.[1];
      if (lat === undefined || lon === undefined) continue;
      const ele = m[2] ? /<ele>\s*([^<\s]+)\s*<\/ele>/i.exec(m[2])?.[1] : undefined;
      ut.push({ lat: Number(lat), lon: Number(lon), ele: ele !== undefined && Number.isFinite(Number(ele)) ? Number(ele) : undefined });
    }
    return ut.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  };
  const spor = hent('trkpt');
  return { navn, punkter: spor.length >= 2 ? spor : hent('rtept') };
}

const meter = (a: Pkt, b: Pkt) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180) * 111_320, (a.lat - b.lat) * 111_320);

/** Punkter med jevn avstand (ca. hver 50. m) langs sporet, med avstand fra start. */
function jevnt(p: Pkt[], steg = 50): { lat: number; lon: number; d: number }[] {
  const ut: { lat: number; lon: number; d: number }[] = [{ lat: p[0].lat, lon: p[0].lon, d: 0 }];
  let total = 0;
  let neste = steg;
  for (let i = 1; i < p.length; i++) {
    const seg = meter(p[i - 1], p[i]);
    while (seg > 0 && total + seg >= neste) {
      const t = (neste - total) / seg;
      ut.push({ lat: p[i - 1].lat + (p[i].lat - p[i - 1].lat) * t, lon: p[i - 1].lon + (p[i].lon - p[i - 1].lon) * t, d: neste });
      neste += steg;
    }
    total += seg;
  }
  ut.push({ lat: p[p.length - 1].lat, lon: p[p.length - 1].lon, d: total });
  return ut;
}

/** Grov avgrensning av Norge inkl. Svalbard: Kartverkets høydedata dekker bare dette. */
export function iNorge(lat: number, lon: number): boolean {
  return lat >= 57.8 && lat <= 81 && lon >= 4 && lon <= 34;
}

/** Høyde fra Open-Meteo (Copernicus DEM, 90 m, hele verden), maks 100 punkter per kall. null der oppslaget feiler. */
async function høyderGlobalt(p: [number, number][]): Promise<(number | null)[]> {
  const ut: (number | null)[] = [];
  for (let i = 0; i < p.length; i += 100) {
    const del = p.slice(i, i + 100);
    let z: (number | null)[] | null = null;
    for (let forsøk = 0; forsøk < 4 && !z; forsøk++) {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${del.map((x) => x[1].toFixed(5)).join(',')}&longitude=${del.map((x) => x[0].toFixed(5)).join(',')}`);
        if (!r.ok) throw new Error(String(r.status));
        z = ((await r.json()) as { elevation: (number | null)[] }).elevation;
      } catch {
        await new Promise((res) => setTimeout(res, 1000 * (forsøk + 1)));
      }
    }
    ut.push(...(z ?? del.map(() => null)));
  }
  return ut;
}

/** Høyde og skog fra Kartverkets høydedata (maks 50 punkter per kall) i Norge; utenfor Norge høyde fra global modell (skog ukjent = 0). */
async function høydeOgSkog(p: { lat: number; lon: number }[]): Promise<{ z: number; skog: number }[]> {
  const globalt = async () => (await høyderGlobalt(p.map((x) => [x.lon, x.lat]))).map((z) => ({ z: z ?? NaN, skog: 0 }));
  if (!iNorge(p[0].lat, p[0].lon)) return globalt();
  try {
    const n = await høydeOgSkogNorge(p);
    return n.some((x) => Number.isFinite(x.z)) ? n : globalt(); // grensen mot Sverige/Finland ligger innenfor avgrensningen, men Kartverket svarer ikke der
  } catch {
    return globalt();
  }
}

async function høydeOgSkogNorge(p: { lat: number; lon: number }[]): Promise<{ z: number; skog: number }[]> {
  const ut: { z: number; skog: number }[] = [];
  for (let i = 0; i < p.length; i += 50) {
    const del = p.slice(i, i + 50);
    const url = `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4326&geojson=false&punkter=${encodeURIComponent(JSON.stringify(del.map((x) => [Number(x.lon.toFixed(6)), Number(x.lat.toFixed(6))])))}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Høydedata svarte ${r.status}`);
    const j = (await r.json()) as { punkter: { z: number | null; terreng?: string }[] };
    for (const x of j.punkter) ut.push({ z: x.z ?? NaN, skog: x.terreng === 'Skog' ? 1 : 0 });
  }
  return ut;
}

const RINGER = [50, 100, 200, 400, 800, 1600, 3000];
const STEG_TERRENG = 300;
const STEG_TERRENG_UTLAND = 1000; // globalt høyde-API har mindre kvote, og 90 m-modellen gir uansett grovere terreng

/**
 * Terreng for solskygge, som scripts/hent_terreng.py men for ett punkt per 300 m: hellingsretning, helning og horisont i 16 retninger
 * (høydevinkel til terrenget ut til 3 km). Ett punkt krever 117 høydeoppslag (Kartverket, 50 per kall, noen kall samtidig). Utenfor Norge brukes global høydemodell (100 per kall) og ett punkt per km.
 * Hopper over punkter der oppslaget feiler; alt feiler = tom liste (da regnes sola uten terrengskygge).
 */
export async function terrengFor(punkter: Løype['punkter'], fremdrift?: (ferdig: number, totalt: number) => void): Promise<Terreng[]> {
  const valgt: Løype['punkter'] = [];
  const utland = punkter.length > 0 && !iNorge(punkter[0][1], punkter[0][0]);
  const steg = utland ? STEG_TERRENG_UTLAND : STEG_TERRENG;
  let neste = 0;
  for (const p of punkter) if (p[3] >= neste) { valgt.push(p); neste = p[3] + steg; }
  const rad = Math.PI / 180;
  const sett = valgt.map((p) => {
    const [lon, lat] = p;
    const dy = (m: number) => m / 111_320;
    const dx = (m: number) => m / (111_320 * Math.cos(lat * rad));
    const pts: [number, number][] = [[lon, lat], [lon, lat + dy(30)], [lon + dx(30), lat], [lon, lat - dy(30)], [lon - dx(30), lat]];
    for (let a = 0; a < 16; a++) for (const r of RINGER) pts.push([lon + dx(r * Math.sin(a * 22.5 * rad)), lat + dy(r * Math.cos(a * 22.5 * rad))]);
    return pts;
  });
  const flat = sett.flat();
  const deler: [number, number][][] = [];
  for (let i = 0; i < flat.length; i += 50) deler.push(flat.slice(i, i + 50));
  const z: (number | null)[][] = new Array(deler.length);
  let ferdig = 0;
  let neste_ = 0;
  const hentDel = async (d: [number, number][]) => {
    if (utland) return høyderGlobalt(d);
    for (let forsøk = 0; forsøk < 3; forsøk++) {
      try {
        const url = `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4326&geojson=false&punkter=${encodeURIComponent(JSON.stringify(d.map((x) => [Number(x[0].toFixed(6)), Number(x[1].toFixed(6))])))}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(String(r.status));
        return ((await r.json()) as { punkter: { z: number | null }[] }).punkter.map((x) => x.z);
      } catch {
        await new Promise((res) => setTimeout(res, 800 * (forsøk + 1)));
      }
    }
    return d.map(() => null);
  };
  const arbeider = async () => {
    while (neste_ < deler.length) {
      const i = neste_++;
      z[i] = await hentDel(deler[i]);
      fremdrift?.(++ferdig, deler.length);
    }
  };
  await Promise.all([arbeider(), arbeider(), arbeider(), arbeider()]);
  const zflat = z.flat();
  const n = sett[0]?.length ?? 0;
  const ut: Terreng[] = [];
  valgt.forEach((p, k) => {
    const zz = zflat.slice(k * n, (k + 1) * n);
    const [z0, zn, zo, zs, zv] = zz;
    if ([z0, zn, zo, zs, zv].some((v) => v === null || v === undefined)) return;
    const dzdx = ((zo as number) - (zv as number)) / 60;
    const dzdy = ((zn as number) - (zs as number)) / 60;
    const helning = Math.atan(Math.hypot(dzdx, dzdy)) / rad;
    const retning = (Math.atan2(-dzdx, -dzdy) / rad + 360) % 360;
    const hor: number[] = [];
    let q = 5;
    for (let a = 0; a < 16; a++) {
      let v = 0;
      for (const r of RINGER) {
        const h = zz[q++];
        if (h !== null && h !== undefined) v = Math.max(v, Math.atan2(h - (z0 as number), r) / rad);
      }
      hor.push(Math.round(v * 10) / 10);
    }
    ut.push([Math.round(p[3]), Math.round(retning), Math.round(helning * 10) / 10, hor]);
  });
  return ut;
}

/** Lager en løype i appens format fra GPX-punktene: jevne punkter, høyde og skog (Kartverket i Norge, global modell ellers). Terreng for solskygge hentes separat (terrengFor). */
export async function byggFraGpx(punkter: Pkt[], navn: string): Promise<Løype & { start_lat: number; start_lon: number }> {
  if (punkter.length < 2) throw new Error('Fant ikke noe spor i GPX-filen.');
  const j = jevnt(punkter);
  const lengde = j[j.length - 1].d;
  if (lengde < 500) throw new Error('Sporet er kortere enn 500 m.');
  if (lengde > 200_000) throw new Error('Sporet er lengre enn 200 km.');
  const hs = await høydeOgSkog(j);
  const pkt = j.map((x, i) => {
    const gpxH = punkter[Math.min(punkter.length - 1, Math.round((i / (j.length - 1)) * (punkter.length - 1)))].ele;
    const z = Number.isFinite(hs[i]?.z) ? hs[i].z : gpxH;
    if (z === undefined || !Number.isFinite(z)) throw new Error('Fikk ikke høyde for sporet. Høydetjenesten svarte ikke, prøv igjen om litt.');
    return [Number(x.lon.toFixed(6)), Number(x.lat.toFixed(6)), Math.round(z * 10) / 10, Math.round(x.d), hs[i]?.skog ?? 0] as Løype['punkter'][number];
  });
  return { id: `egen-${Date.now().toString(36)}`, navn, type: undefined, lengde_m: Math.round(lengde), punkter: pkt, start_lat: j[0].lat, start_lon: j[0].lon };
}
