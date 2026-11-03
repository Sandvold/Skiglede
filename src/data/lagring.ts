import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Smøring, Stil } from '@/engine';

// Brukerdata (smørelager og skipark) lagres foreløpig lokalt i nettleseren, per enhet. Uten innlogging er det ikke delt mellom enheter.
// Kan senere byttes mot konto og database (premium) uten å røre skjermene, siden alt går gjennom useLagret.
const minne = new Map<string, string>();
const lyttere = new Set<() => void>();

function les(nøkkel: string): string {
  try {
    return globalThis.localStorage?.getItem(nøkkel) ?? minne.get(nøkkel) ?? '';
  } catch {
    return minne.get(nøkkel) ?? '';
  }
}

function skriv(nøkkel: string, verdi: string) {
  minne.set(nøkkel, verdi);
  try {
    globalThis.localStorage?.setItem(nøkkel, verdi);
  } catch {
    // lagring blokkert (privat modus): verdien finnes i minnet så lenge siden er åpen
  }
  lyttere.forEach((l) => l());
}

const abonner = (l: () => void) => {
  lyttere.add(l);
  return () => lyttere.delete(l);
};

export function useLagret<T>(nøkkel: string, standard: T): [T, (v: T) => void] {
  const rå = useSyncExternalStore(abonner, () => les(nøkkel), () => '');
  const verdi = useMemo<T>(() => {
    if (!rå) return standard;
    try {
      return JSON.parse(rå) as T;
    } catch {
      return standard;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rå]);
  const sett = useCallback((v: T) => skriv(nøkkel, JSON.stringify(v)), [nøkkel]);
  return [verdi, sett];
}

export type Ski = { id: string; navn: string; stil: Stil; smoring?: Smøring };
export const NØKKEL_LAGER = 'skiglede.lager';
export const NØKKEL_VISNING = 'skiglede.visning';
export const NØKKEL_VALGTE = 'skiglede.valgte';
export const NØKKEL_SKIPARK = 'skiglede.skipark';
export const TOM_LISTE: never[] = [];
