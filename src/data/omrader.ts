import hovdenLøyper from '@/data/trails.json';
import nordmarkaLøyper from '@/data/trails-nordmarka.json';
import baerumLøyper from '@/data/trails-baerumsmarka.json';
import hovdenVær from '@/data/vaer-hovden.json';
import nordmarkaVær from '@/data/vaer-nordmarka.json';
import baerumVær from '@/data/vaer-baerumsmarka.json';
import { useEffect, useState } from 'react';
import { useLagret } from '@/data/lagring';
import { neonAnonym } from '@/data/neon';

export type OmrådeId = 'hovden' | 'baerumsmarka' | 'nordmarka';

export type Område = {
  id: OmrådeId;
  navn: string;
  /** Punktet værdata og solstand gjelder for */
  sted: { lat: number; lon: number };
  /** Startvisning i oversiktskartet */
  visning: { lon: number; lat: number; z: number };
  løyper: unknown[];
  vær: { referansehoyde_m: number; timer: (string | number)[][] };
  /** Vanlig snøtemperatur (°C) i løypene fra desember til april, til innkjøpsforslag. Anslag [Forslag], ikke målt klimatologi. */
  vinter: [number, number];
};

export const OMRÅDER: Record<OmrådeId, Område> = {
  // Visning: Hovden-sentrum med Breive, Vidmyr, Lundane og Hartevatn i bildet [Bruker].
  hovden: { id: 'hovden', navn: 'Hovden', sted: { lat: 59.5667, lon: 7.3667 }, visning: { lon: 7.3646, lat: 59.5699, z: 12 }, løyper: hovdenLøyper as unknown[], vær: hovdenVær, vinter: [-18, 1] },
  // Bærumsmarka: Fossum, Eineåsen og nettet vest for Sørkedalen. Værcelle 1 km ved Østernvann, 228 m.
  baerumsmarka: { id: 'baerumsmarka', navn: 'Bærumsmarka', sted: { lat: 59.955, lon: 10.52 }, visning: { lon: 10.54, lat: 59.955, z: 11 }, løyper: baerumLøyper as unknown[], vær: baerumVær, vinter: [-12, 2] },
  // Nordmarka: Sognsvann, Frognerseteren, Holmenkollen og Kikutstua. Værcelle 1 km ved Nordmarka, 290 m.
  nordmarka: { id: 'nordmarka', navn: 'Nordmarka', sted: { lat: 59.98, lon: 10.65 }, visning: { lon: 10.66, lat: 59.975, z: 11 }, løyper: nordmarkaLøyper as unknown[], vær: nordmarkaVær, vinter: [-12, 2] },
};
export const OMRÅDE_IDER = Object.keys(OMRÅDER) as OmrådeId[];
export const NØKKEL_OMRÅDE = 'skiglede.omrade';

/** Valgt område, huskes på enheten. */
export function useOmråde(): [Område, (id: OmrådeId) => void] {
  const [id, sett] = useLagret<string>(NØKKEL_OMRÅDE, 'hovden');
  // «oslo» het området før Nordmarka og Bærumsmarka ble delt
  return [OMRÅDER[(id === 'oslo' ? 'nordmarka' : id) as OmrådeId] ?? OMRÅDER.hovden, sett as (id: OmrådeId) => void];
}

type Værdata = Område['vær'];
const friskVær = new Map<string, Værdata>();

/** Værhistorikk for området: ferdig innebygd kopi først, byttes mot siste fra databasen (oppdateres hver natt uten nytt bygg). */
export function useVær(o: Område): Værdata {
  const [, tving] = useState(0);
  useEffect(() => {
    if (friskVær.has(o.id)) return;
    let avbrutt = false;
    (async () => {
      try {
        const { data } = await neonAnonym().from('vaer').select('referansehoyde_m, timer, oppdatert').eq('omrade', o.id).maybeSingle();
        const timer = data?.timer as (string | number)[][] | undefined;
        if (!avbrutt && timer?.length && Date.parse(String(data.oppdatert)) > Date.now() - 4 * 86400_000) {
          friskVær.set(o.id, { referansehoyde_m: data.referansehoyde_m, timer });
          tving((n) => n + 1);
        }
      } catch {
        // uten nett eller database brukes den innebygde kopien
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [o.id]);
  return friskVær.get(o.id) ?? o.vær;
}
