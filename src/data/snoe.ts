import { useEffect, useState } from 'react';

import { lesAnonymt } from '@/data/neon';

/**
 * Snødybde og skiføre per løype fra seNorge (NVE og Meteorologisk institutt), en modell i 1 km-ruter som værjobben leser hvert døgn
 * (scripts/oppdater_snoe.py). Verdien gjelder cellen der løypa starter. Det er modell, ikke måling: bra til å se om det er snø og hvor,
 * mindre presis på centimeter, og den vet ikke om kunstsnø.
 */
export type Snø = { dybde: number | null; klasse: number | null };
export type SnøData = { dato: string; perLøype: Map<string, Snø>; perOmråde: Map<string, Snø> };

/** NVEs skiføre-klasse: 0 ingen snø, 1 lite/begrenset, 2 våt snø, 3 tørr snø. */
export const KLASSE_TEKST = ['ingen snø', 'lite snø', 'våt snø', 'tørr snø'] as const;
export const KLASSE_FARGE = ['#B8C4D2', '#E3A64A', '#3B82C4', '#2E8B57'] as const;

export const snøTekst = (s?: Snø | null): string => {
  if (!s || s.klasse === null || s.klasse === undefined) return '';
  const cm = s.dybde !== null && s.dybde >= 1 ? `${Math.round(s.dybde)} cm · ` : '';
  return `${cm}${KLASSE_TEKST[s.klasse] ?? ''}`;
};

/** Beste verdi i et område (flest cm, høyest klasse), så «hvor er det snø» kan sorteres. */
const bedre = (a: Snø | undefined, b: Snø): Snø => (!a ? b : { dybde: Math.max(a.dybde ?? 0, b.dybde ?? 0), klasse: Math.max(a.klasse ?? 0, b.klasse ?? 0) });

let cache: SnøData | null = null;
let henter: Promise<SnøData | null> | null = null;
let hentet = 0;
const FRISK_MS = 30 * 60_000;

async function hent(): Promise<SnøData | null> {
  const siste = await lesAnonymt<{ dato: string }>('snoe?select=dato&order=dato.desc&limit=1');
  const dato = siste[0]?.dato;
  if (!dato) return null;
  const perLøype = new Map<string, Snø>();
  const perOmråde = new Map<string, Snø>();
  for (let fra = 0; fra < 20000; fra += 1000) {
    const rader = await lesAnonymt<{ omrade: string; loype_id: string; dybde_cm: number | null; klasse: number | null }>(
      `snoe?select=omrade,loype_id,dybde_cm,klasse&dato=eq.${dato}&order=omrade.asc,loype_id.asc&limit=1000&offset=${fra}`,
    );
    for (const r of rader) {
      const s: Snø = { dybde: r.dybde_cm, klasse: r.klasse };
      perLøype.set(`${r.omrade}/${r.loype_id}`, s);
      perOmråde.set(r.omrade, bedre(perOmråde.get(r.omrade), s));
    }
    if (rader.length < 1000) break;
  }
  return { dato, perLøype, perOmråde };
}

/** Siste snødata for alle løyper (cachet i 30 minutter). Null mens de hentes eller hvis de ikke finnes. Feil gir null: snø er tillegg, ikke krav. */
export function useSnø(): SnøData | null {
  const [, tving] = useState(0);
  useEffect(() => {
    let avbrutt = false;
    if (cache && Date.now() - hentet < FRISK_MS) return;
    henter ??= hent().catch(() => null).finally(() => { henter = null; });
    henter.then((d) => {
      if (d) { cache = d; hentet = Date.now(); }
      if (!avbrutt) tving((n) => n + 1);
    });
    return () => { avbrutt = true; };
  }, []);
  return cache;
}
