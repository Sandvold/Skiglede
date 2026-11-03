// OSM som grunndata for løyper, med navn fra Turrutebasen [Bruker].
// Rene funksjoner uten UI, så de kan testes (scripts/test-osm.ts).
export type LL = [number, number];

/** Rå bit fra OSM (scripts/hent_osm_loyper.mjs eller Overpass-JSON). */
export type RåBit = { id: string; osmNavn: string | null; preparering: string | null; pts: LL[] };

/** Bit med løypenavn og dekning mot løypene som allerede ligger i appen. */
export type Bit = RåBit & {
  /** Navn fra Turrutebasen hvis biten ligger langs en navngitt løype der, ellers OSM-navnet, ellers null. */
  navn: string | null;
  navnKilde: 'turrutebasen' | 'osm' | null;
  lengde_m: number;
  /** Andel (0–1) av biten som ligger innen 30 m av løypene i appen. */
  dekning: number;
  /** Navnet på løypa i appen som dekker mest, hvis minst halvparten. */
  appNavn: string | null;
};

export type NavnRef = { navn: string; biter: LL[][] };

const KOS = Math.cos((59.55 * Math.PI) / 180);
export const meter = (a: LL, b: LL) => Math.hypot((a[0] - b[0]) * KOS * 111_320, (a[1] - b[1]) * 111_320);
export const lengdeM = (pts: LL[]) => pts.slice(1).reduce((s, p, i) => s + meter(pts[i], p), 0);

/** Legger inn punkter hvert `steg` meter, så avstandstest mot punkter fungerer også ved glissen digitalisering. */
export function fortett(pts: LL[], steg = 10): LL[] {
  const ut: LL[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const n = Math.max(1, Math.ceil(meter(a, b) / steg));
    for (let k = 0; k < n; k++) ut.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  if (pts.length) ut.push(pts[pts.length - 1]);
  return ut;
}

const CELLE = 0.0006; // ca. 67 m i bredde og 34 m i lengde
class Rutenett {
  private c = new Map<string, LL[]>();
  constructor(biter: LL[][]) {
    for (const b of biter) for (const p of fortett(b)) {
      const k = `${Math.floor(p[0] / CELLE)},${Math.floor(p[1] / CELLE)}`;
      const l = this.c.get(k);
      if (l) l.push(p); else this.c.set(k, [p]);
    }
  }
  nær(p: LL, r: number): boolean {
    const x = Math.floor(p[0] / CELLE), y = Math.floor(p[1] / CELLE);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const q of this.c.get(`${x + dx},${y + dy}`) ?? []) if (meter(p, q) <= r) return true;
    }
    return false;
  }
}

/** Andel av biten (tettet) som ligger innen r meter av nettet. */
const andel = (pts: LL[], nett: Rutenett, r: number) => {
  const t = fortett(pts);
  return t.length ? t.filter((p) => nett.nær(p, r)).length / t.length : 0;
};

/** Leser scripts/hent_osm_loyper.mjs-filen (`løyper`) eller rå Overpass-JSON (`elements`). Backcountry (ikke preparert) tas ut [Bruker]. */
export function lesOsmBiter(json: any): RåBit[] {
  const ut: RåBit[] = [];
  const legg = (id: string, navn: string | null, prep: string | null, pts: LL[]) => {
    if (!pts || pts.length < 2) return;
    if ((prep ?? '').includes('backcountry')) return;
    ut.push({ id, osmNavn: navn || null, preparering: prep || null, pts });
  };
  if (Array.isArray(json?.løyper)) {
    for (const l of json.løyper) legg(l.osm, l.navn, l.preparering, l.punkter);
  } else if (Array.isArray(json?.elements)) {
    for (const el of json.elements) {
      const tags = el.tags ?? {};
      const gs: any[][] = el.type === 'way' ? [el.geometry] : (el.members ?? []).filter((m: any) => m.geometry).map((m: any) => m.geometry);
      for (const g of gs) legg(`${el.type}/${el.id}`, tags.name ?? tags['piste:name'] ?? null, tags['piste:grooming'] ?? null, (g ?? []).map((p: any) => [p.lon, p.lat] as LL));
    }
  }
  return ut;
}

export type BerikOpts = { navnRadius?: number; navnMinAndel?: number; appRadius?: number };

/**
 * Setter navn fra Turrutebasen på OSM-biter (bit som ligger minst `navnMinAndel` langs en navngitt Turrutebasen-løype),
 * og regner dekning mot løypene som allerede er i appen.
 */
export function berik(rå: RåBit[], turrutebasen: NavnRef[], iApp: NavnRef[], o: BerikOpts = {}): Bit[] {
  const { navnRadius = 25, navnMinAndel = 0.5, appRadius = 30 } = o;
  const tur = turrutebasen.filter((t) => t.navn && t.navn !== 'Ukjent').map((t) => ({ navn: t.navn, nett: new Rutenett(t.biter) }));
  const app = iApp.map((t) => ({ navn: t.navn, nett: new Rutenett(t.biter) }));
  return rå.map((b) => {
    let navn: string | null = null, navnKilde: Bit['navnKilde'] = null, best = 0;
    for (const t of tur) {
      const a = andel(b.pts, t.nett, navnRadius);
      if (a > best) { best = a; if (a >= navnMinAndel) { navn = t.navn; navnKilde = 'turrutebasen'; } }
    }
    if (!navn && b.osmNavn) { navn = b.osmNavn; navnKilde = 'osm'; }
    const tett = fortett(b.pts);
    let dekket = 0, appNavn: string | null = null, appBest = 0;
    for (const p of tett) if (app.some((t) => t.nett.nær(p, appRadius))) dekket++;
    for (const t of app) {
      const a = andel(b.pts, t.nett, appRadius);
      if (a > appBest) { appBest = a; appNavn = a >= 0.5 ? t.navn : null; }
    }
    return { ...b, navn, navnKilde, lengde_m: Math.round(lengdeM(b.pts)), dekning: tett.length ? dekket / tett.length : 0, appNavn };
  });
}

/** Mest brukte navn blant bitene (til forslag på løypenavn). */
export function vanligsteNavn(biter: Bit[]): string {
  const m = new Map<string, number>();
  for (const b of biter) if (b.navn) m.set(b.navn, (m.get(b.navn) ?? 0) + b.lengde_m);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Gruppér biter etter løypenavn (biter uten navn utelates). */
export function etterNavn(biter: Bit[]): Map<string, Bit[]> {
  const g = new Map<string, Bit[]>();
  for (const b of biter) if (b.navn) g.set(b.navn, [...(g.get(b.navn) ?? []), b]);
  return g;
}
