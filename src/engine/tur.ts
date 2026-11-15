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
/** Skygge må dekke minst så stor andel av løypa for å telle i temperaturene [Bruker]. */
export const SKYGGE_MIN_ANDEL = 0.1;
/**
 * Utstråling: på stille, tørre morgener og kvelder uten sol er snøen kaldere enn lufta (på klare, vindstille netter 3–6 °C i tørre innlandsstrøk, fordi snø stråler ut nesten som et sort legeme).
 * 2 m-temperaturen sier ikke hvor langt snøoverflaten ligger under lufta; det avgjør skydekket. Derfor brukes skydekke når vi har det (Yr-prognosen), ellers vind og fuktighet som indikator.
 * Uten skydekke (observert historikk): ekstremt stille og tørt (< 1,5 m/s, RH < 0,7) −3,5 °C, stille og tørt −2 °C, litt vind −1 °C [Forslag, justeres mot erfaring og smøreloggen].
 * Med skydekke N (0–1): vinden setter taket (< 1,5 m/s 3,5 °C, < 2,5 m/s 2,5, < 4 m/s 1,5, < 6 m/s 0,5), og skyer demper med (1 − N²): helt overskyet = ingen utstråling [Forslag].
 * Gjelder uten sol (< 100 W/m²) og når lufta er høyst +2,5 °C: skare kan dannes på klare kvelder selv med litt pluss i lufta [Gemini-research, ikke verifisert mot måling].
 */
export const UTSTRÅLING = { maksSol: 100, stille: 2.5, litVind: 4, tørrRh: 0.8, middelRh: 0.88, kjøl: 2, litKjøl: 1, maksLuft: 2.5, ekstremVind: 1.5, ekstremRh: 0.7, ekstremKjøl: 3.5, skyTak: [[1.5, 3.5], [2.5, 2.5], [4, 1.5], [6, 0.5]] as [number, number][] };
export function utstråling(v: { temp: number; rh: number; vind: number; sky?: number }, swWm2: number): number {
  if (swWm2 >= UTSTRÅLING.maksSol || v.temp > UTSTRÅLING.maksLuft) return 0;
  if (v.sky !== undefined) {
    const tak = UTSTRÅLING.skyTak.find(([grense]) => v.vind < grense)?.[1] ?? 0;
    const N = Math.min(1, Math.max(0, v.sky));
    return -tak * (1 - N * N);
  }
  if (v.vind < UTSTRÅLING.ekstremVind && v.rh < UTSTRÅLING.ekstremRh) return -UTSTRÅLING.ekstremKjøl;
  if (v.vind < UTSTRÅLING.stille && v.rh < UTSTRÅLING.tørrRh) return -UTSTRÅLING.kjøl;
  if (v.vind < UTSTRÅLING.litVind && v.rh < UTSTRÅLING.middelRh) return -UTSTRÅLING.litKjøl;
  return 0;
}
/**
 * °C ekstra «snøtemperatur» ved 500 W/m² uten skygge [Forslag]. Avhenger av albedo: nysnø reflekterer ca. 80–90 % og tar opp lite, gammel/omdannet snø reflekterer ca. 45–70 %
 * (kilder: bl.a. tabeller over snøalbedo, Journal of Glaciology) og tar opp ca. 2–3 ganger så mye. Omdannet: 3,5 (nedre ende av Gemini-forslaget 3,5–4, kalibreres mot smøreloggen).
 */
export const SOL_GRAD_PER_500W = 2.0; // nysnø og finkornet
export const SOL_GRAD_OMDANNET_PER_500W = 3.5;
export const solGrad = (snøType?: 'ny' | 'omdannet') => (snøType === 'omdannet' ? SOL_GRAD_OMDANNET_PER_500W : SOL_GRAD_PER_500W);

/** Lengdevektet persentil (p 0–1): lange strekk teller mer enn korte. */
export function vektetPersentil(v: number[], vekt: number[], p: number): number {
  const rad = v.map((x, i) => ({ x, w: vekt[i] })).sort((a, b) => a.x - b.x);
  const sum = rad.reduce((a, r) => a + r.w, 0);
  let akk = 0;
  for (const r of rad) {
    akk += r.w;
    if (akk > p * sum) return r.x; // strengt større: nøyaktig p % av lengden teller ikke
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
  if (k === -1) return timer[timer.length - 1]; // etter siste time: bruk siste kjente
  if (k === 0) return timer[0];
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
  snøType?: 'ny' | 'omdannet'; // styrer soltillegget (albedo). Uten: nysnø-verdien
}): Tur {
  const { seksjoner, timer, startTs, tempoKmt, refH, terreng, sted = HOVDEN, snøType } = args;
  if (!seksjoner.length) throw new Error('planTur: løypa har ingen seksjoner (under to punkter)');
  if (!timer.length) throw new Error('planTur: ingen værtimer å regne på');
  const ms = (m: number) => (m / 1000 / tempoKmt) * 3600_000;
  const lengder = seksjoner.map((x) => x.endM - x.startM);
  const totalM = lengder.reduce((a, b) => a + b, 0);
  const lagUt = (ignorerSkygge: boolean): SeksjonVær[] =>
    seksjoner.map((s) => {
      const tid = startTs + ms((s.startM + s.endM) / 2);
      const v = værVed(timer, tid);
      const tLuft = v.temp + (refH - s.hMid) * LAPSE;
      const sw = Math.max(0, v.sw) / 3600; // J/m² per time -> W/m²
      // Skog demper sola. Terrenget gir skygge (horisonten) og retning (sør-vendt får mer, nord-vendt mindre).
      const tf = terrengFaktor(terrengVed(terreng, (s.startM + s.endM) / 2), tid, sted.lat, sted.lon, ignorerSkygge);
      const sol = (1 - skogDemping(solHøyde(tid, sted.lat, sted.lon)) * s.skog) * tf.faktor;
      return { seq: s.seq, tid, tLuft, sw, sol, skygge: tf.skygge, tEff: tLuft + utstråling(v, sw) + solGrad(snøType) * (sw / 500) * sol };
    });
  const skyggeAndelAv = (u: SeksjonVær[]) => (totalM ? lengder.reduce((a, l, i) => a + (u[i].skygge ? l : 0), 0) / totalM : 0);
  // Skygge teller bare med når den dekker minst 10 % av løypa [Bruker]; ellers regnes sola som uhindret.
  let ut = lagUt(false);
  const skyggeAndel = skyggeAndelAv(ut);
  const skyggeIgnorert = skyggeAndel > 0 && skyggeAndel < SKYGGE_MIN_ANDEL;
  if (skyggeIgnorert) ut = lagUt(true);
  const t = ut.map((x) => x.tEff);
  const sluttTs = startTs + ms(seksjoner[seksjoner.length - 1].endM);
  const vindu = timer.filter((x) => x.ts >= startTs - 3 * 3600_000 && x.ts <= sluttTs + 3 * 3600_000);
  const lufttemp = vindu.map((x) => x.temp);
  const variasjon = lufttemp.length ? Math.max(...lufttemp) - Math.min(...lufttemp) : 0;
  const etterStart = vindu.filter((x) => x.ts >= startTs).sort((a, b) => a.ts - b.ts);
  const luftStart = etterStart.length ? etterStart[0].temp : lufttemp[0] ?? 0;
  const luftSlutt = etterStart.length ? etterStart[etterStart.length - 1].temp : luftStart;
  const luftTrend = luftSlutt - luftStart;
  // Det fryser på når lufta faller minst 1,5 °C mot minusgrader under turen [Forslag]
  const fryserPå = etterStart.length > 1 && luftTrend <= -1.5 && Math.min(...etterStart.map((x) => x.temp)) < -1;
  const sludd = vindu.some((x) => x.nedbor >= 0.3 && x.temp >= -1 && x.temp <= 3.5);
  return {
    startTs,
    sluttTs,
    tempoKmt,
    seksjoner: ut,
    tMin: vektetPersentil(t, lengder, 0.05), // 5./95. persentil etter lengde: korte partier avgjør ikke [Bruker]
    tMaks: -vektetPersentil(t.map((x) => -x), lengder, 0.05), // speilet, så 5 % i hver ende behandles likt
    tMinRå: Math.min(...t),
    tMaksRå: Math.max(...t),
    skyggeAndel,
    skyggeIgnorert,
    variasjon,
    luftMin: lufttemp.length ? Math.min(...lufttemp) : Math.min(...t),
    luftTrend,
    fryserPå,
    sludd,
  };
}
