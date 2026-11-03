import { solAzimut, solHøyde } from './sol';

/** [avstand m, hellingsretning °, helning °, horisont °[16: nord, 22,5°, … medsols]] fra scripts/hent_terreng.py */
export type Terreng = [number, number, number, number[]];

/** Andel av innstrålingen som antas å være direkte sol (resten er diffus og påvirkes ikke av retning/skygge). */
export const DIREKTE = 0.7;
/** Øvre grense for hvor mye en solvendt skråning forsterker sola (sør-vendt bratt skråning ved lav sol blir ellers urimelig). */
const MAKS_FAKTOR = 2;

/** Nærmeste terrengpunkt til en avstand langs løypa. */
export function terrengVed(terreng: Terreng[] | undefined, d: number): Terreng | undefined {
  if (!terreng?.length) return undefined;
  let best = terreng[0];
  for (const t of terreng) if (Math.abs(t[0] - d) < Math.abs(best[0] - d)) best = t;
  return best;
}

function horisontI(hor: number[], az: number): number {
  const f = (((az % 360) + 360) % 360) / 22.5;
  const i = Math.floor(f);
  const w = f - i;
  return hor[i % 16] * (1 - w) + hor[(i + 1) % 16] * w;
}

/** Faktor på solvarmen (1 = flatt og åpent) og om direkte sol er blokkert av terrenget. */
export function terrengFaktor(t: Terreng | undefined, ts: number, lat: number, lon: number): { faktor: number; skygge: boolean } {
  if (!t) return { faktor: 1, skygge: false };
  const h = solHøyde(ts, lat, lon);
  if (h <= 0) return { faktor: 1, skygge: false };
  const az = solAzimut(ts, lat, lon);
  if (h < horisontI(t[3], az)) return { faktor: 1 - DIREKTE, skygge: true };
  const rad = Math.PI / 180;
  const cosInn = Math.sin(t[2] * rad) * Math.cos(h * rad) * Math.cos((az - t[1]) * rad) + Math.cos(t[2] * rad) * Math.sin(h * rad);
  const direkte = Math.min(MAKS_FAKTOR, Math.max(0, cosInn / Math.sin(h * rad)));
  return { faktor: 1 - DIREKTE + DIREKTE * direkte, skygge: false };
}
