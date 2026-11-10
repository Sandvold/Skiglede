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

/**
 * Timesvarsel direkte fra MET (Yr, locationforecast), både i app og på nett: MET tillater kall fra nettlesere (CORS) og trenger ingen egen tjener.
 * MET ber om identifiserbar User-Agent: appen sender den, nettlesere kan ikke sette den (MET ser Origin/Referer i stedet).
 * Data: MET Norway, CC BY 4.0 / NLOD. Kaster hvis det ikke går. Vellykket prognose lagres til bruk uten nett.
 */
export async function hentVarsel(område: Område): Promise<Varsel> {
  const lat = Math.round(område.sted.lat * 100) / 100;
  const lon = Math.round(område.sted.lon * 100) / 100;
  const hoyde = Math.round(område.hoyde || 0);
  const erNett = typeof document !== 'undefined';
  const avbryt = new AbortController();
  const frist = setTimeout(() => avbryt.abort(), 10_000); // ingen evig «Henter …»
  let r: Response;
  try {
    r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}&altitude=${hoyde}`, erNett ? { signal: avbryt.signal } : { signal: avbryt.signal, headers: { 'User-Agent': 'Skiglede/0.1 github.com/Sandvold/Skiglede' } });
  } finally {
    clearTimeout(frist);
  }
  if (!r.ok) throw new Error(`MET svarte ${r.status}`);
  const j = (await r.json()) as { properties: { meta: { updated_at: string }; timeseries: { time: string; data: { instant: { details: Record<string, number> }; next_1_hours?: { details: { precipitation_amount?: number } } } }[] } };
  const timer: Rå['timer'] = [];
  for (const t of j.properties.timeseries) {
    const n1 = t.data.next_1_hours; // bare de første ca. 2,5 døgnene har timesverdier
    if (!n1) continue;
    const i = t.data.instant.details;
    timer.push([t.time, i.air_temperature, n1.details.precipitation_amount ?? 0, (i.relative_humidity ?? 0) / 100, i.wind_speed ?? 0, i.cloud_area_fraction ?? 0] as Rå['timer'][number]);
  }
  const d = { oppdatert: j.properties.meta.updated_at, timer };
  const rå: Rå = { oppdatert: d.oppdatert, hentet: Date.now(), timer: d.timer };
  try {
    globalThis.localStorage?.setItem(cacheNøkkel(område), JSON.stringify(rå));
  } catch {
    // lagring blokkert: prognosen brukes bare nå
  }
  return tilVarsel(rå, område, false);
}
