import { HOVDEN, solHøyde } from './sol';
import { terrengFaktor, terrengVed, type Terreng } from './terreng';
import type { Punkt, Seksjon, SeksjonVær, Tur, Vær } from './typer';

export const LAPSE = 0.006; // °C per meter (0,6 per 100 m) [Forslag]
/** Hvor mye full skog demper sola, avhengig av solhøyde: lav sol går skrått gjennom kronene, høy sol slipper gjennom [Forslag]. */
export const SKOG_DEMP = { lav: 0.75, høy: 0.45, hLav: 10, hHøy: 40 };
export function skogDemping(solH: number): number {
  const f = Math.min(1, Math.max(0, (solH - SKOG_DEMP.hLav) / (SKOG_DEMP.hHøy - SKOG_DEMP.hLav)));
  return SKOG_DEMP.lav + f * (SKOG_DEMP.høy - SKOG_DEMP.lav);
}
export const SOL_GRAD_PER_500W = 2.0; // °C ekstra «snøtemperatur» ved 500 W/m² uten skygge [Forslag]

/** Lengdevektet persentil (p 0–1): lange strekk teller mer enn korte. */
export function vektetPersentil(v: number[], vekt: number[], p: number): number {
  const rad = v.map((x, i) => ({ x, w: vekt[i] })).sort((a, b) => a.x - b.x);
  const sum = rad.reduce((a, r) => a + r.w, 0);
  let akk = 0;
  for (const r of rad) {
    akk += r.w;
    if (akk >= p * sum) return r.x;
  }
  return rad[rad.length - 1].x;
}

export function lagSeksjoner(p: Punkt[], lengde = 250): Seksjon[] {
  const ut: Seksjon[] = [];
  let i = 0;
  while (i < p.length - 1) {
    let j = i;
    while (j < p.length - 1 && p[j][3] - p[i][3] < lengde) j++;
    const L = p[j][3] - p[i][3];
    if (L < lengde / 3 && ut.length) {
      const s = ut[ut.length - 1];
      const pts = p.slice(s.startM === 0 && ut.length === 1 ? 0 : p.findIndex((q) => q[3] >= s.startM), j + 1);
      s.endM = p[j][3];
      s.h1 = p[j][2];
      s.hMid = (s.h0 + s.h1) / 2;
      s.skog = pts.reduce((a, q) => a + q[4], 0) / pts.length;
    } else {
      const pts = p.slice(i, j + 1);
      ut.push({
        seq: ut.length,
        startM: p[i][3],
        endM: p[j][3],
        h0: p[i][2],
        h1: p[j][2],
        hMid: pts.reduce((a, q) => a + q[2], 0) / pts.length,
        skog: pts.reduce((a, q) => a + q[4], 0) / pts.length,
        stigning: (Math.atan2(p[j][2] - p[i][2], L) * 180) / Math.PI,
      });
    }
    i = j;
  }
  return ut;
}

/** Lineær interpolasjon mellom timesverdier. */
export function værVed(timer: Vær[], ts: number): Vær {
  const k = timer.findIndex((x) => x.ts >= ts);
  if (k <= 0) return timer[Math.max(0, k)] ?? timer[timer.length - 1];
  const a = timer[k - 1];
  const b = timer[k];
  const f = (ts - a.ts) / (b.ts - a.ts || 1);
  const m = (x: number, y: number) => x + f * (y - x);
  return { ts, temp: m(a.temp, b.temp), nedbor: m(a.nedbor, b.nedbor), rh: m(a.rh, b.rh), vind: m(a.vind, b.vind), sw: m(a.sw, b.sw) };
}

export function planTur(args: {
  seksjoner: Seksjon[];
  timer: Vær[]; // timesverdier for turdagen (observert døgn eller prognose)
  startTs: number;
  tempoKmt: number;
  refH: number;
  terreng?: Terreng[]; // hellingsretning og horisont langs løypa (hent_terreng.py)
  sted?: { lat: number; lon: number };
}): Tur {
  const { seksjoner, timer, startTs, tempoKmt, refH, terreng, sted = HOVDEN } = args;
  const ms = (m: number) => (m / 1000 / tempoKmt) * 3600_000;
  const ut: SeksjonVær[] = seksjoner.map((s) => {
    const tid = startTs + ms((s.startM + s.endM) / 2);
    const v = værVed(timer, tid);
    const tLuft = v.temp + (refH - s.hMid) * LAPSE;
    const sw = Math.max(0, v.sw) / 3600; // J/m² per time -> W/m²
    // Skog demper sola. Terrenget gir skygge (horisonten) og retning (sør-vendt får mer, nord-vendt mindre).
    const tf = terrengFaktor(terrengVed(terreng, (s.startM + s.endM) / 2), tid, sted.lat, sted.lon);
    const sol = (1 - skogDemping(solHøyde(tid, sted.lat, sted.lon)) * s.skog) * tf.faktor;
    return { seq: s.seq, tid, tLuft, sw, sol, skygge: tf.skygge, tEff: tLuft + SOL_GRAD_PER_500W * (sw / 500) * sol };
  });
  const t = ut.map((x) => x.tEff);
  const lengder = seksjoner.map((x) => x.endM - x.startM);
  const totalM = lengder.reduce((a, b) => a + b, 0);
  const skyggeM = lengder.reduce((a, l, i) => a + (ut[i].skygge ? l : 0), 0);
  const sluttTs = startTs + ms(seksjoner[seksjoner.length - 1].endM);
  const vindu = timer.filter((x) => x.ts >= startTs - 3 * 3600_000 && x.ts <= sluttTs + 3 * 3600_000);
  const lufttemp = vindu.map((x) => x.temp);
  const variasjon = lufttemp.length ? Math.max(...lufttemp) - Math.min(...lufttemp) : 0;
  const sludd = vindu.some((x) => x.nedbor >= 0.3 && x.temp >= -1 && x.temp <= 3.5);
  return {
    startTs,
    sluttTs,
    tempoKmt,
    seksjoner: ut,
    tMin: vektetPersentil(t, lengder, 0.05), // 5./95. persentil etter lengde: korte partier avgjør ikke [Bruker]
    tMaks: vektetPersentil(t, lengder, 0.95),
    tMinRå: Math.min(...t),
    tMaksRå: Math.max(...t),
    skyggeAndel: totalM ? skyggeM / totalM : 0,
    variasjon,
    luftMin: lufttemp.length ? Math.min(...lufttemp) : Math.min(...t),
    sludd,
  };
}
