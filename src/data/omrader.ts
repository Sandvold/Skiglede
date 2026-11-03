import hovdenLøyper from '@/data/trails.json';
import osloLøyper from '@/data/trails-oslo.json';
import hovdenVær from '@/data/vaer-hovden.json';
import osloVær from '@/data/vaer-oslo.json';
import { useLagret } from '@/data/lagring';

export type OmrådeId = 'hovden' | 'oslo';

export type Område = {
  id: OmrådeId;
  navn: string;
  /** Punktet værdata og solstand gjelder for */
  sted: { lat: number; lon: number };
  /** Startvisning i oversiktskartet */
  visning: { lon: number; lat: number; z: number };
  løyper: unknown[];
  vær: { referansehoyde_m: number; timer: (string | number)[][] };
};

export const OMRÅDER: Record<OmrådeId, Område> = {
  // Visning: Hovden-sentrum med Breive, Vidmyr, Lundane og Hartevatn i bildet [Bruker].
  hovden: { id: 'hovden', navn: 'Hovden', sted: { lat: 59.5667, lon: 7.3667 }, visning: { lon: 7.3646, lat: 59.5699, z: 12 }, løyper: hovdenLøyper as unknown[], vær: hovdenVær },
  // Oslo: Nordmarka og Fossum (Eiksmarka). Værcelle 1 km ved Sognsvann/Nordmarka, 290 m.
  oslo: { id: 'oslo', navn: 'Oslo', sted: { lat: 59.98, lon: 10.65 }, visning: { lon: 10.66, lat: 59.975, z: 11 }, løyper: osloLøyper as unknown[], vær: osloVær },
};
export const OMRÅDE_IDER = Object.keys(OMRÅDER) as OmrådeId[];
export const NØKKEL_OMRÅDE = 'skiglede.omrade';

/** Valgt område, huskes på enheten. */
export function useOmråde(): [Område, (id: OmrådeId) => void] {
  const [id, sett] = useLagret<OmrådeId>(NØKKEL_OMRÅDE, 'hovden');
  return [OMRÅDER[id] ?? OMRÅDER.hovden, sett];
}
