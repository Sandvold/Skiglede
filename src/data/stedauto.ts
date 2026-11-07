import { useEffect, useSyncExternalStore } from 'react';

import { useSteder } from '@/data/lagring';
import { avstandKm, usePosisjon, useOmråder } from '@/data/omrader';

/** Radius rundt et sted der det velges automatisk. */
export const STED_RADIUS_KM = 10;

// 'ukjent' = ingen posisjon ennå, 'inne' = innen radius av et sted, 'utenfor' = mer enn 10 km fra alle steder.
type Status = { tilstand: 'ukjent' | 'inne' | 'utenfor'; km?: number };
let status: Status = { tilstand: 'ukjent' };
const lyttere = new Set<() => void>();
const sett = (s: Status) => {
  if (s.tilstand === status.tilstand && s.km === status.km) return;
  status = s;
  lyttere.forEach((f) => f());
};
export const useStedStatus = (): Status => useSyncExternalStore((f) => { lyttere.add(f); return () => { lyttere.delete(f); }; }, () => status, () => status);

/**
 * Velger sted automatisk etter posisjon: det nærmeste stedet innen 10 km blir aktivt. Utenfor radius beholdes valget, og brukeren
 * velger selv smøring fra et lager eller ski fra et av stedene. Sted uten egen posisjon bruker området det er knyttet til (eldre koblinger).
 * Kalles ett sted (i toppen av siden); kjører når posisjon eller steder endres, ikke ved hver visning.
 */
export function useStedFølgerPosisjon() {
  const pos = usePosisjon(true);
  const områder = useOmråder();
  const { steder, posFor, velg, aktiv, områdeFor } = useSteder();
  const nøkkel = JSON.stringify([pos, steder.map((s) => [s.id, posFor(s.id), områdeFor(s.id)])]);
  useEffect(() => {
    if (!pos) return;
    let best: { id: string; km: number } | null = null;
    for (const s of steder) {
      const o = områder.find((x) => x.id === områdeFor(s.id));
      const p = posFor(s.id) ?? (o ? { lat: o.visning.lat, lon: o.visning.lon } : null);
      if (!p) continue;
      const km = avstandKm(pos, p);
      if (!best || km < best.km) best = { id: s.id, km };
    }
    if (best && best.km <= STED_RADIUS_KM) {
      sett({ tilstand: 'inne', km: Math.round(best.km * 10) / 10 });
      if (best.id !== aktiv) velg(best.id);
    } else {
      sett({ tilstand: 'utenfor', km: best ? Math.round(best.km) : undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nøkkel]);
}
