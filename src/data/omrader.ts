import hovdenVær from '@/data/vaer-hovden.json';
import nordmarkaVær from '@/data/vaer-nordmarka.json';
import baerumVær from '@/data/vaer-baerumsmarka.json';
import { useEffect, useState } from 'react';
import { useLagret } from '@/data/lagring';
import { neonAnonym } from '@/data/neon';

export type OmrådeId = string;

export type Område = {
  id: OmrådeId;
  navn: string;
  /** Punktet værdata og solstand gjelder for */
  sted: { lat: number; lon: number };
  /** Høyde (m) værpunktet og temperaturene gjelder for */
  hoyde: number;
  /** Startvisning i oversiktskartet */
  visning: { lon: number; lat: number; z: number };
  vær: { referansehoyde_m: number; timer: (string | number)[][] };
  /** Vanlig snøtemperatur (°C) i løypene fra desember til april, til innkjøpsforslag. Anslag [Forslag], ikke målt klimatologi. */
  vinter: [number, number];
};

// Innebygd reserve hvis databasen ikke svarer. Områdene ligger ellers i tabellen `omrade` i Neon (legg til nye der, ikke her).
const INNEBYGD: Område[] = [
  // Visning: Hovden-sentrum med Breive, Vidmyr, Lundane og Hartevatn i bildet [Bruker].
  { id: 'hovden', navn: 'Hovden', sted: { lat: 59.5667, lon: 7.3667 }, hoyde: 838, visning: { lon: 7.3646, lat: 59.5699, z: 12 }, vær: hovdenVær, vinter: [-18, 1] },
  // Bærumsmarka: Fossum, Eineåsen og nettet vest for Sørkedalen. Værcelle 1 km ved Østernvann, 228 m.
  { id: 'baerumsmarka', navn: 'Bærumsmarka', sted: { lat: 59.955, lon: 10.52 }, hoyde: 228, visning: { lon: 10.54, lat: 59.955, z: 11 }, vær: baerumVær, vinter: [-12, 2] },
  // Nordmarka: Sognsvann, Frognerseteren, Holmenkollen og Kikutstua. Værcelle 1 km ved Nordmarka, 290 m.
  { id: 'nordmarka', navn: 'Nordmarka', sted: { lat: 59.98, lon: 10.65 }, hoyde: 290, visning: { lon: 10.66, lat: 59.975, z: 11 }, vær: nordmarkaVær, vinter: [-12, 2] },
];
const INNEBYGD_VÆR = Object.fromEntries(INNEBYGD.map((o) => [o.id, o.vær]));
export const NØKKEL_OMRÅDE = 'skiglede.omrade';
const NØKKEL_OMRÅDER_CACHE = 'skiglede.cache.omrader';

type OmrådeRad = { id: string; navn: string; lat: number; lon: number; vis_lon: number; vis_lat: number; vis_z: number; vinter_min: number; vinter_max: number; ref_hoyde_m: number };
const tilOmråde = (r: OmrådeRad): Område => ({
  id: r.id, navn: r.navn, sted: { lat: r.lat, lon: r.lon }, hoyde: r.ref_hoyde_m, visning: { lon: r.vis_lon, lat: r.vis_lat, z: r.vis_z }, vinter: [r.vinter_min, r.vinter_max],
  vær: INNEBYGD_VÆR[r.id] ?? { referansehoyde_m: r.ref_hoyde_m, timer: [] }, // nye områder har ingen innebygd værhistorikk, den kommer fra databasen
});

let områdeliste: Område[] | null = null;
let områdeHenting: Promise<void> | null = null;
const områdeLyttere = new Set<() => void>();
function lastOmråder() {
  if (områdeHenting) return;
  områdeHenting = (async () => {
    try {
      const { data, error } = await neonAnonym().from('omrade').select('*').order('rekkefolge').order('navn');
      if (error) throw error;
      if (data?.length) {
        områdeliste = (data as OmrådeRad[]).map(tilOmråde);
        lagreOmråderLokalt(data as OmrådeRad[]);
        områdeLyttere.forEach((f) => f());
      }
    } catch {
      områdeHenting = null; // prøv igjen neste gang
    }
  })();
}
function lagreOmråderLokalt(rader: OmrådeRad[]) {
  try {
    globalThis.localStorage?.setItem(NØKKEL_OMRÅDER_CACHE, JSON.stringify(rader));
  } catch {
    // lagring blokkert
  }
}
function lesOmråderLokalt(): Område[] | null {
  try {
    const t = globalThis.localStorage?.getItem(NØKKEL_OMRÅDER_CACHE);
    const rader = t ? (JSON.parse(t) as OmrådeRad[]) : null;
    return rader?.length ? rader.map(tilOmråde) : null;
  } catch {
    return null;
  }
}

/** Alle områder: lagret kopi (eller innebygd) med en gang, og siste fra databasen så snart den svarer. */
export function useOmråder(): Område[] {
  const [, tving] = useState(0);
  useEffect(() => {
    const f = () => tving((n) => n + 1);
    områdeLyttere.add(f);
    if (!områdeliste) {
      const lagret = lesOmråderLokalt();
      if (lagret) {
        områdeliste = lagret;
        f();
      }
    }
    lastOmråder();
    return () => {
      områdeLyttere.delete(f);
    };
  }, []);
  return områdeliste ?? INNEBYGD;
}

export const NØKKEL_FAVORITTER = 'skiglede.favoritter';
const NØKKEL_POS = 'skiglede.cache.posisjon';

// ---- Posisjon: brukes til å velge nærmeste område når du ikke har valgt selv ----
export type Pos = { lat: number; lon: number };
let posisjon: Pos | null = null; // leses fra enheten først etter første visning, så side og klient er like ved oppstart
let posForespurt = false;
const posLyttere = new Set<() => void>();
function hentPosisjon() {
  if (posForespurt || typeof navigator === 'undefined' || !navigator.geolocation) return;
  posForespurt = true;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      posisjon = { lat: p.coords.latitude, lon: p.coords.longitude };
      try {
        globalThis.localStorage?.setItem(NØKKEL_POS, JSON.stringify(posisjon));
      } catch {
        // lagring blokkert
      }
      posLyttere.forEach((f) => f());
    },
    () => {}, // nektet eller utilgjengelig: da brukes favoritt eller første område
    { timeout: 8000, maximumAge: 3_600_000 },
  );
}
export function usePosisjon(spør: boolean): Pos | null {
  const [, tving] = useState(0);
  useEffect(() => {
    const f = () => tving((n) => n + 1);
    posLyttere.add(f);
    if (!posisjon) {
      try {
        const t = globalThis.localStorage?.getItem(NØKKEL_POS);
        if (t) {
          posisjon = JSON.parse(t) as Pos;
          posLyttere.forEach((g) => g());
        }
      } catch {
        // ingen lagret posisjon
      }
    }
    if (spør) hentPosisjon();
    return () => {
      posLyttere.delete(f);
    };
  }, [spør]);
  return posisjon;
}

/** Luftlinje i km. */
export function avstandKm(a: Pos, b: Pos) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
export const avstandTil = (o: Område, p: Pos | null) => (p ? avstandKm(p, { lat: o.visning.lat, lon: o.visning.lon }) : null);

/** Favorittene øverst, så resten. Innen hver gruppe nærmest først når posisjonen er kjent, ellers som i tabellen. */
export function sorterOmråder(liste: Område[], p: Pos | null, fav: string[]): Område[] {
  const d = (o: Område) => avstandTil(o, p) ?? 0;
  const innen = (l: Område[]) => (p ? [...l].sort((x, y) => d(x) - d(y)) : l);
  return [...innen(liste.filter((o) => fav.includes(o.id))), ...innen(liste.filter((o) => !fav.includes(o.id)))];
}

/** Favoritter (område-id-er), huskes på enheten. */
export function useFavoritter(): [string[], (id: string) => void] {
  const [fav, sett] = useLagret<string[]>(NØKKEL_FAVORITTER, []);
  return [fav, (id) => sett(fav.includes(id) ? fav.filter((f) => f !== id) : [...fav, id])];
}

/** Valgt område. Uten eget valg brukes nærmeste område (etter posisjon), ellers første favoritt eller første i lista. Eget valg huskes på enheten; tom id = nærmeste. */
export function useOmråde(): [Område, (id: OmrådeId) => void, { automatisk: boolean; nærmeste: Område }] {
  const [id, sett] = useLagret<string>(NØKKEL_OMRÅDE, '');
  const [fav] = useLagret<string[]>(NØKKEL_FAVORITTER, []);
  const liste = useOmråder();
  const p = usePosisjon(!id);
  // «oslo» het området før Nordmarka og Bærumsmarka ble delt
  const valgt = liste.find((o) => o.id === (id === 'oslo' ? 'nordmarka' : id));
  const nærmeste = p ? [...liste].sort((x, y) => avstandKm(p, { lat: x.visning.lat, lon: x.visning.lon }) - avstandKm(p, { lat: y.visning.lat, lon: y.visning.lon }))[0] : sorterOmråder(liste, null, fav)[0];
  return [valgt ?? nærmeste, sett as (id: OmrådeId) => void, { automatisk: !valgt, nærmeste }];
}

type Værdata = Område['vær'];
const friskVær = new Map<string, Værdata>();

/** Værhistorikk for området: ferdig innebygd kopi først, byttes mot siste fra databasen (oppdateres hver natt uten nytt bygg). */
export function useVær(o: Område): Værdata {
  const [, tving] = useState(0);
  useEffect(() => {
    if (friskVær.has(o.id)) return;
    let avbrutt = false;
    (async () => {
      try {
        const { data } = await neonAnonym().from('vaer').select('referansehoyde_m, timer, oppdatert').eq('omrade', o.id).maybeSingle();
        const timer = data?.timer as (string | number)[][] | undefined;
        if (!avbrutt && timer?.length && Date.parse(String(data.oppdatert)) > Date.now() - 4 * 86400_000) {
          friskVær.set(o.id, { referansehoyde_m: data.referansehoyde_m, timer });
          tving((n) => n + 1);
        }
      } catch {
        // uten nett eller database brukes den innebygde kopien
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [o.id]);
  return friskVær.get(o.id) ?? o.vær;
}
