// PLASSHOLDERE: tallene er hentet fra forhandlersider/eldre manual og MÅ verifiseres mot
// Swix' offisielle tabell før appen brukes på ekte (åpent punkt 4 i docs/regelspesifikasjon.md).
import type { SnøType } from './typer';

export type Voks = { navn: string; ny: [number, number]; omdannet: [number, number] };

// Rekkefølge = fra kaldest til varmest. Områdene er [kaldest, varmest] i °C.
export const HARDVOKS: Voks[] = [
  { navn: 'VP30', ny: [-16, -8], omdannet: [-20, -12] },
  { navn: 'VP40', ny: [-10, -4], omdannet: [-14, -5] },
  { navn: 'VP45', ny: [-5, -1], omdannet: [-8, -3] },
  { navn: 'VP50', ny: [-3, 0], omdannet: [-6, -1] },
  { navn: 'VP55', ny: [-2, 1], omdannet: [-5, 0] },
  { navn: 'VP60', ny: [-1, 2], omdannet: [-4, -1] },
  { navn: 'VP65', ny: [0, 2], omdannet: [-4, 0] },
];

export type Klister = { navn: string; omr: [number, number] };

export const KLISTER: Klister[] = [
  { navn: 'KX30', omr: [-12, 0] },
  { navn: 'KX35', omr: [-4, 1] },
  { navn: 'KX45N', omr: [-4, 1] },
  { navn: 'KX40S', omr: [-4, 2] },
  { navn: 'KX65', omr: [1, 5] },
  { navn: 'KX75', omr: [2, 15] },
];

const senter = (r: [number, number]) => (r[0] + r[1]) / 2;

export function hardvoksFor(t: number, snø: SnøType): number {
  let best = 0;
  let bestD = Infinity;
  HARDVOKS.forEach((v, i) => {
    const r = v[snø];
    const inni = t >= r[0] && t <= r[1];
    const d = Math.abs(t - senter(r)) + (inni ? 0 : 100);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function klisterFor(t: number): number {
  let best = 0;
  let bestD = Infinity;
  KLISTER.forEach((k, i) => {
    const inni = t >= k.omr[0] && t <= k.omr[1];
    const d = Math.abs(t - senter(k.omr)) + (inni ? 0 : 100);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
