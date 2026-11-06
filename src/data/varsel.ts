import { innstråling } from '@/engine/sol';
import type { Vær } from '@/engine';
import type { Område } from '@/data/omrader';

export type Varsel = { timer: Vær[]; oppdatert: string; /** Når appen hentet det (ms) */ hentet: number; /** true: lagret fra en tidligere henting, ikke ferskt */ fraCache: boolean };

const cacheNøkkel = (område: Område) => `skiglede.varsel.${område.id}`;
type Rå = { oppdatert: string; hentet: number; timer: [string, number, number, number, number, number][] };

const tilVarsel = (d: Rå, område: Område, fraCache: boolean): Varsel => {
  const sted = område.sted;
  return {
    oppdatert: d.oppdatert,
    hentet: d.hentet,
    fraCache,
    timer: d.timer.map(([t, temp, nedbor, rh, vind, sky]) => {
      const ts = Date.parse(t);
      return { ts, temp, nedbor, rh, vind, sw: innstråling(ts, sky, sted.lat, sted.lon) };
    }),
  };
};

/** Siste vellykkede prognose lagret på enheten (uten nett i skibilen), eller null. */
export function lesVarselCache(område: Område): Varsel | null {
  try {
    const t = globalThis.localStorage?.getItem(cacheNøkkel(område));
    return t ? tilVarsel(JSON.parse(t) as Rå, område, true) : null;
  } catch {
    return null;
  }
}

/** Timesvarsel fra Yr via Netlify-funksjonen. Kaster hvis det ikke går. Vellykket prognose lagres til bruk uten nett. */
export async function hentVarsel(område: Område): Promise<Varsel> {
  const r = await fetch(`/.netlify/functions/varsel?lat=${område.sted.lat}&lon=${område.sted.lon}&hoyde=${område.hoyde}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`varsel ${r.status}`);
  const d = (await r.json()) as { oppdatert: string; timer: Rå['timer'] };
  const rå: Rå = { oppdatert: d.oppdatert, hentet: Date.now(), timer: d.timer };
  try {
    globalThis.localStorage?.setItem(cacheNøkkel(område), JSON.stringify(rå));
  } catch {
    // lagring blokkert: prognosen brukes bare nå
  }
  return tilVarsel(rå, område, false);
}
