import { innstråling } from '@/engine/sol';
import type { Vær } from '@/engine';

const HOVDEN = { lat: 59.5667, lon: 7.3667 };

export type Varsel = { timer: Vær[]; oppdatert: string };

/** Timesvarsel fra Yr via Netlify-funksjonen. Kaster hvis det ikke går. */
export async function hentVarsel(): Promise<Varsel> {
  const r = await fetch('/.netlify/functions/varsel?sted=hovden');
  if (!r.ok) throw new Error(`varsel ${r.status}`);
  const d = (await r.json()) as { oppdatert: string; timer: [string, number, number, number, number, number][] };
  return {
    oppdatert: d.oppdatert,
    timer: d.timer.map(([t, temp, nedbor, rh, vind, sky]) => {
      const ts = Date.parse(t);
      return { ts, temp, nedbor, rh, vind, sw: innstråling(ts, sky, HOVDEN.lat, HOVDEN.lon) };
    }),
  };
}
