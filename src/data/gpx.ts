import type { Løype } from '@/data/rute';

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

/** Høyde og skog fra Kartverkets høydedata (maks 50 punkter per kall). Kaster hvis punktene ligger utenfor Norge. */
async function høydeOgSkog(p: { lat: number; lon: number }[]): Promise<{ z: number; skog: number }[]> {
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

/** Lager en løype i appens format fra GPX-punktene: jevne punkter, høyde og skog (Kartverket). Terreng for solskygge regnes ikke ut ennå. */
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
    if (z === undefined || !Number.isFinite(z)) throw new Error('Fikk ikke høyde for sporet. Høydedata finnes bare i Norge.');
    return [Number(x.lon.toFixed(6)), Number(x.lat.toFixed(6)), Math.round(z * 10) / 10, Math.round(x.d), hs[i]?.skog ?? 0] as Løype['punkter'][number];
  });
  return { id: `egen-${Date.now().toString(36)}`, navn, type: undefined, lengde_m: Math.round(lengde), punkter: pkt, start_lat: j[0].lat, start_lon: j[0].lon };
}
