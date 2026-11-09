import { useEffect, useMemo, useState } from 'react';

import type { KartBoks } from '@/components/ski/zoomkart';
import type { NaboLøype } from '@/components/ski/oversiktskart';
import { lesAnonymt } from '@/data/neon';
import type { Område } from '@/data/omrader';

const MAKS_OMRÅDER = 20; // flest områder som hentes om gangen (jo lenger ute, jo flere ligger i bildet)
const MIN_ZOOM = 9; // lenger ute enn dette er løypene for små til å vises
const hentet = new Map<string, NaboLøype[]>(); // område → løypene (bare hovedløyper, forenklet strek), hentes én gang per økt
const underHenting = new Set<string>();

/**
 * Løyper fra områdene rundt, til oversiktskartet. Når kartet zoomes ut eller flyttes hentes forenklede streker for områdene
 * som ligger i bildet (nærmeste først), og bare de som ikke er hentet fra før.
 */
export function useNaboløyper(valgt: Område, alle: Område[], boks: KartBoks | null): NaboLøype[] {
  const [, tving] = useState(0);
  const ønsket = useMemo(() => {
    if (!boks || boks.z < MIN_ZOOM) return [];
    const mLon = (boks.øst - boks.vest) * 0.15;
    const mLat = (boks.nord - boks.sør) * 0.15;
    const senter = { lon: (boks.vest + boks.øst) / 2, lat: (boks.sør + boks.nord) / 2 };
    return alle
      .filter((o) => o.id !== valgt.id && o.visning.lon >= boks.vest - mLon && o.visning.lon <= boks.øst + mLon && o.visning.lat >= boks.sør - mLat && o.visning.lat <= boks.nord + mLat)
      .sort((a, b) => Math.hypot(a.visning.lon - senter.lon, a.visning.lat - senter.lat) - Math.hypot(b.visning.lon - senter.lon, b.visning.lat - senter.lat))
      .slice(0, MAKS_OMRÅDER)
      .map((o) => o.id);
  }, [boks, alle, valgt.id]);
  const nøkkel = ønsket.join('|');

  useEffect(() => {
    const mangler = ønsket.filter((id) => !hentet.has(id) && !underHenting.has(id));
    if (!mangler.length) return;
    mangler.forEach((id) => underHenting.add(id));
    (async () => {
      try {
        const liste = mangler.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
        const data = await lesAnonymt<{ id: string; navn: string; omrade: string; oversikt: number[][] }>(`loype?select=id,navn,omrade,oversikt&variant_av=is.null&omrade=in.(${encodeURIComponent(liste)})`);
        for (const id of mangler) hentet.set(id, []);
        for (const r of data ?? []) if (r.oversikt?.length > 1) hentet.get(r.omrade)?.push({ id: r.id, navn: r.navn, omrade: r.omrade, punkter: r.oversikt });
        tving((n) => n + 1);
      } catch {
        // uten nett vises bare områdets egne løyper; prøver igjen neste gang kartet flyttes
      } finally {
        mangler.forEach((id) => underHenting.delete(id));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nøkkel]);

  return useMemo(() => ønsket.flatMap((id) => hentet.get(id) ?? []), [nøkkel, hentet.size]); // eslint-disable-line react-hooks/exhaustive-deps
}
