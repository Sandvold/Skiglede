import { innstråling } from '@/engine/sol';
import type { Vær } from '@/engine';
import { OMRÅDER, type OmrådeId } from '@/data/omrader';

export type Varsel = { timer: Vær[]; oppdatert: string };

/** Timesvarsel fra Yr via Netlify-funksjonen. Kaster hvis det ikke går. */
export async function hentVarsel(område: OmrådeId = 'hovden'): Promise<Varsel> {
  const sted = OMRÅDER[område].sted;
  const r = await fetch(`/.netlify/functions/varsel?sted=${område}`);
  if (!r.ok) throw new Error(`varsel ${r.status}`);
  const d = (await r.json()) as { oppdatert: string; timer: [string, number, number, number, number, number][] };
  return {
    oppdatert: d.oppdatert,
    timer: d.timer.map(([t, temp, nedbor, rh, vind, sky]) => {
      const ts = Date.parse(t);
      return { ts, temp, nedbor, rh, vind, sw: innstråling(ts, sky, sted.lat, sted.lon) };
    }),
  };
}
