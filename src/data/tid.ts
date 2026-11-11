import type { Område } from '@/data/omrader';
import type { Vær } from '@/engine';

/** Dato (ÅÅÅÅ-MM-DD) i Oslo, `dager` frem i tid. Regnes på kalenderdatoen (ikke 24-timers sprang), så klokkeskifte ikke gir feil dag. */
export const osloDato = (dager: number): string => {
  const idag = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(Date.now());
  return new Date(Date.parse(`${idag}T12:00:00Z`) + dager * 86400_000).toISOString().slice(0, 10);
};

/** UTC-tidspunkt for lokalt Oslo-klokkeslett (time kan ha desimaler, 10.5 = 10:30) på en dato (håndterer sommer-/vintertid). */
export function osloTs(dato: string, time: number): number {
  const hh = Math.floor(time);
  const mm = Math.round((time - hh) * 60);
  const lokalSomUtc = Date.parse(`${dato}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  for (const off of [1, 2]) {
    const ts = lokalSomUtc - off * 3600_000;
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', hourCycle: 'h23' }).format(ts));
    if (h === hh) return ts;
  }
  return lokalSomUtc - 3600_000;
}

/** Værrader fra databasen/den innebygde filen til motorens format. */
export const timerI = (v: Område['vær']): Vær[] =>
  v.timer.map((r) => ({ ts: Date.parse(r[0] as string), temp: r[1] as number, nedbor: r[2] as number, rh: r[3] as number, vind: r[4] as number, sw: r[5] as number }));
