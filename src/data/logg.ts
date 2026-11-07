import { useCallback, useEffect, useState } from 'react';

import { neon } from '@/data/neon';

/** Vurdering av feste: −2 veldig bakglatt (for kald smøring) … 0 god … +2 mye klabb (for varm, eller klister på tørr snø). */
export const GREP_VALG = [
  { v: -2, tekst: 'Veldig bakglatt', hint: 'for kald smøring' },
  { v: -1, tekst: 'Litt bakglatt', hint: '' },
  { v: 0, tekst: 'God', hint: '' },
  { v: 1, tekst: 'Litt klabete', hint: '' },
  { v: 2, tekst: 'Mye klabb', hint: 'for varm, eller klister på tørr snø' },
] as const;
/** Vurdering av glid: −1 tregt, 0 OK, +1 fort. */
export const GLID_VALG = [
  { v: -1, tekst: 'Tregt' },
  { v: 0, tekst: 'OK' },
  { v: 1, tekst: 'Fort' },
] as const;
export const grepTekst = (v: number | null) => GREP_VALG.find((g) => g.v === v)?.tekst ?? '–';
export const glidTekst = (v: number | null) => GLID_VALG.find((g) => g.v === v)?.tekst ?? '–';

export type Logg = {
  id: string;
  tid: string;
  omrade: string | null;
  loype_id: string | null;
  loype_navn: string | null;
  stil: string | null;
  ski_navn: string | null;
  produkter: { rolle: string; produkt: string }[] | null;
  /** Det modellen mente da: snøtemperatur (snitt, min, maks), skarphet, snøtype, sludd, anbefalt. */
  modell: Record<string, unknown> | null;
  grep: number | null;
  glid: number | null;
  snotemp_malt: number | null;
  lufttemp_malt: number | null;
  kommentar: string | null;
};
export type NyLogg = Omit<Logg, 'id' | 'tid'>;

export async function lagreLogg(rad: NyLogg): Promise<string | null> {
  const { error } = await neon().from('smoring_logg').insert(rad);
  return error ? error.message ?? 'Kunne ikke lagre' : null;
}

export function useLoggliste(på: boolean) {
  const [liste, setListe] = useState<Logg[] | null>(null);
  const [feil, setFeil] = useState('');
  const last = useCallback(async () => {
    const { data, error } = await neon().from('smoring_logg').select('*').order('tid', { ascending: false }).limit(200);
    if (error) setFeil(error.message ?? 'Kunne ikke hente loggen');
    else { setFeil(''); setListe((data ?? []) as Logg[]); }
  }, []);
  useEffect(() => { if (på) void last(); }, [på, last]);
  const slett = useCallback(async (id: string) => {
    await neon().from('smoring_logg').delete().eq('id', id);
    void last();
  }, [last]);
  return { liste, feil, last, slett };
}
