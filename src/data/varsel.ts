import { innstråling } from '@/engine/sol';
import type { Vær } from '@/engine';
import { OMRÅDER, type OmrådeId } from '@/data/omrader';

export type Varsel = { timer: Vær[]; oppdatert: string; /** Når appen hentet det (ms) */ hentet: number; /** true: lagret fra en tidligere henting, ikke ferskt */ fraCache: boolean };

const cacheNøkkel = (område: OmrådeId) => `skiglede.varsel.${område}`;
type Rå = { oppdatert: string; hentet: number; timer: [string, number, number, number, number, number][] };

const tilVarsel = (d: Rå, område: OmrådeId, fraCache: boolean): Varsel => {
  const sted = OMRÅDER[område].sted;
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
export function lesVarselCache(område: OmrådeId): Varsel | null {
  try {
    const t = globalThis.localStorage?.getItem(cacheNøkkel(område));
    return t ? tilVarsel(JSON.parse(t) as Rå, område, true) : null;
  } catch {
    return null;
  }
}

/** Timesvarsel fra Yr via Netlify-funksjonen. Kaster hvis det ikke går. Vellykket prognose lagres til bruk uten nett. */
export async function hentVarsel(område: OmrådeId = 'hovden'): Promise<Varsel> {
  const r = await fetch(`/.netlify/functions/varsel?sted=${område}`, { cache: 'no-store' });
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
