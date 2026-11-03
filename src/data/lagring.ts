import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { MERKE_IDER, SYSTEMER, type MerkeId, type Smøresystem, type Smøring, type Stil, type Temperatursone } from '@/engine';

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

export type Ski = { id: string; navn: string; stil: Stil; /** Temperatursonen skiene (slipen/strukturen) er laget for */ sone?: Temperatursone; smoring?: Smøring };
export const NØKKEL_LAGER = 'skiglede.lager';
export const NØKKEL_VISNING = 'skiglede.visning';
export const NØKKEL_VALGTE = 'skiglede.valgte';
export const NØKKEL_SKIPARK = 'skiglede.skipark';
export const TOM_LISTE: never[] = [];
export const NØKKEL_MERKE = 'skiglede.merke';
export const NØKKEL_BRUK_LAGER = 'skiglede.brukLager';

/** Valgt smøremerke (Swix er standard). Ugyldig lagret verdi gir Swix. */
export function useMerke(): [Smøresystem, (id: MerkeId) => void] {
  const [id, sett] = useLagret<string>(NØKKEL_MERKE, 'swix');
  const gyldig = (MERKE_IDER as string[]).includes(id) ? (id as MerkeId) : 'swix';
  return [SYSTEMER[gyldig], sett];
}

// ---- Steder: egne smørelager, skipark og valgte ski per sted (f.eks. fjellet og hjemme). Uten ekstra steder er alt samlet på «Standard». ----
export type Sted = { id: string; navn: string };
export const NØKKEL_STEDER = 'skiglede.steder';
export const NØKKEL_AKTIVT_STED = 'skiglede.sted';
export const NØKKEL_STANDARDSTED = 'skiglede.standardsted';
/** Standardstedet har tom id, så data lagret før steder fantes (uendrede nøkler) hører til det. */
const stedNøkkel = (base: string, id: string) => (id ? `${base}.${id}` : base);
const STEDDATA = [NØKKEL_LAGER, NØKKEL_SKIPARK, NØKKEL_VALGTE];

export function useSteder() {
  const [ekstra, setEkstra] = useLagret<Sted[]>(NØKKEL_STEDER, TOM_LISTE);
  const [aktivRå, setAktiv] = useLagret<string>(NØKKEL_AKTIVT_STED, '');
  const [standardnavn, setStandardnavn] = useLagret<string>(NØKKEL_STANDARDSTED, 'Standard');
  const steder: Sted[] = [{ id: '', navn: standardnavn || 'Standard' }, ...ekstra];
  const aktiv = steder.some((s) => s.id === aktivRå) ? aktivRå : '';
  return {
    steder,
    aktiv,
    velg: setAktiv,
    leggTil(navn: string) {
      const id = `s${Date.now().toString(36)}`;
      setEkstra([...ekstra, { id, navn: navn.trim() }]);
      setAktiv(id);
    },
    gi_nytt_navn(id: string, navn: string) {
      if (!navn.trim()) return;
      if (!id) setStandardnavn(navn.trim());
      else setEkstra(ekstra.map((s) => (s.id === id ? { ...s, navn: navn.trim() } : s)));
    },
    fjern(id: string) {
      if (!id) return; // standardstedet kan ikke fjernes
      STEDDATA.forEach((b) => skriv(stedNøkkel(b, id), ''));
      setEkstra(ekstra.filter((s) => s.id !== id));
      setAktiv('');
    },
  };
}

/** Som useLagret, men data hører til aktivt sted (lager, skipark, valgte ski). */
export function useStedData<T>(base: string, standard: T): [T, (v: T) => void] {
  const [aktiv] = useLagret<string>(NØKKEL_AKTIVT_STED, '');
  const [ekstra] = useLagret<Sted[]>(NØKKEL_STEDER, TOM_LISTE);
  const gyldig = ekstra.some((s) => s.id === aktiv) ? aktiv : '';
  return useLagret<T>(stedNøkkel(base, gyldig), standard);
}
