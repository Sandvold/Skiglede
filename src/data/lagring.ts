import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { type Smøring, type Stil, type Temperatursone } from '@/engine';

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

/** Lyttere for synk mot konto (premium): får beskjed om hver lagring som kommer fra brukeren. */
const skriveLyttere = new Set<(nøkkel: string, verdi: string) => void>();
export const påSkriv = (f: (nøkkel: string, verdi: string) => void) => {
  skriveLyttere.add(f);
  return () => skriveLyttere.delete(f);
};
/** Skriver uten å varsle synk (brukes når data kommer fra kontoen). */
export function skrivFraKonto(nøkkel: string, verdi: string) {
  skriv(nøkkel, verdi, false);
}
export const lesLokal = les;

/** Nøkler som hører til brukerens egne data og synkes til kontoen for premium-brukere. */
export const erBrukerdata = (n: string) =>
  /^skiglede\.(lager|skipark|valgte|steder|sted|standardsted|stedomrader|stedpos|brukLager|favoritter|ui)(\.|$)/.test(n);

function skriv(nøkkel: string, verdi: string, varsle = true) {
  minne.set(nøkkel, verdi);
  try {
    globalThis.localStorage?.setItem(nøkkel, verdi);
  } catch {
    // lagring blokkert (privat modus): verdien finnes i minnet så lenge siden er åpen
  }
  lyttere.forEach((l) => l());
  if (varsle) skriveLyttere.forEach((f) => f(nøkkel, verdi));
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
export const NØKKEL_BRUK_LAGER = 'skiglede.brukLager';

// ---- Steder: egne smørelager, skipark og valgte ski per sted (f.eks. fjellet og hjemme). Uten ekstra steder er alt samlet på «Standard». ----
export type Sted = { id: string; navn: string };
export const NØKKEL_STEDER = 'skiglede.steder';
export const NØKKEL_AKTIVT_STED = 'skiglede.sted';
export const NØKKEL_STANDARDSTED = 'skiglede.standardsted';
/** Hvilket område hvert sted hører til: { stedId: områdeId }. Når området byttes, byttes også sted til det som hører til området. */
export const NØKKEL_STEDOMRÅDER = 'skiglede.stedomrader';
/** Standardstedet har tom id, så data lagret før steder fantes (uendrede nøkler) hører til det. */
/** Posisjon per sted: { stedId: {lat, lon} }. Brukes til å velge sted automatisk når du er innen 10 km. */
export const NØKKEL_STEDPOS = 'skiglede.stedpos';
const stedNøkkel = (base: string, id: string) => (id ? `${base}.${id}` : base);
const STEDDATA = [NØKKEL_LAGER, NØKKEL_SKIPARK, NØKKEL_VALGTE];

export function useSteder() {
  const [ekstra, setEkstra] = useLagret<Sted[]>(NØKKEL_STEDER, TOM_LISTE);
  const [aktivRå, setAktiv] = useLagret<string>(NØKKEL_AKTIVT_STED, '');
  const [standardnavn, setStandardnavn] = useLagret<string>(NØKKEL_STANDARDSTED, 'Standard');
  const [lenker, setLenker] = useLagret<Record<string, string>>(NØKKEL_STEDOMRÅDER, {});
  const [stedpos, setStedpos] = useLagret<Record<string, { lat: number; lon: number }>>(NØKKEL_STEDPOS, {});
  const steder: Sted[] = [{ id: '', navn: standardnavn || 'Standard' }, ...ekstra];
  const aktiv = steder.some((s) => s.id === aktivRå) ? aktivRå : '';
  return {
    steder,
    aktiv,
    velg: setAktiv,
    /** Lagret posisjon for stedet (brukes til automatisk valg innen 10 km). */
    posFor: (id: string) => stedpos[id] ?? null,
    settPos(id: string, p: { lat: number; lon: number }) {
      setStedpos({ ...stedpos, [id]: p });
    },
    /** Området stedet hører til ('' = ingen). */
    områdeFor: (id: string) => lenker[id] ?? '',
    /** Knytter stedet til et område. Hvert område har ett sted, så andre steder som var knyttet dit slippes. */
    knytt(id: string, områdeId: string) {
      const ny = Object.fromEntries(Object.entries(lenker).filter(([sid, o]) => sid !== id && o !== områdeId));
      if (områdeId) ny[id] = områdeId;
      setLenker(ny);
    },
    leggTil(navn: string, områdeId?: string, pos?: { lat: number; lon: number } | null) {
      const id = `s${Date.now().toString(36)}`;
      setEkstra([...ekstra, { id, navn: navn.trim() }]);
      if (pos) setStedpos({ ...stedpos, [id]: pos });
      if (områdeId) setLenker({ ...Object.fromEntries(Object.entries(lenker).filter(([, o]) => o !== områdeId)), [id]: områdeId });
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
      setLenker(Object.fromEntries(Object.entries(lenker).filter(([sid]) => sid !== id)));
      setStedpos(Object.fromEntries(Object.entries(stedpos).filter(([sid]) => sid !== id)));
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

const lesListe = <T,>(nøkkel: string): T[] => {
  try {
    const v = JSON.parse(les(nøkkel) || '[]');
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

/** Flytter et par ski (med lagret smøring) fra ett sted til et annet. Paret tas også ut av valgte ski på det gamle stedet. */
export function flyttSki(skiId: string, fraId: string, tilId: string) {
  if (fraId === tilId) return;
  const fra = lesListe<Ski>(stedNøkkel(NØKKEL_SKIPARK, fraId));
  const ski = fra.find((s) => s.id === skiId);
  if (!ski) return;
  skriv(stedNøkkel(NØKKEL_SKIPARK, fraId), JSON.stringify(fra.filter((s) => s.id !== skiId)));
  skriv(stedNøkkel(NØKKEL_VALGTE, fraId), JSON.stringify(lesListe<string>(stedNøkkel(NØKKEL_VALGTE, fraId)).filter((v) => v !== skiId)));
  skriv(stedNøkkel(NØKKEL_SKIPARK, tilId), JSON.stringify([...lesListe<Ski>(stedNøkkel(NØKKEL_SKIPARK, tilId)), ski]));
}

/** Flytter et smøreprodukt fra lageret på ett sted til lageret på et annet. */
export function flyttProdukt(navn: string, fraId: string, tilId: string) {
  if (fraId === tilId) return;
  const fra = lesListe<string>(stedNøkkel(NØKKEL_LAGER, fraId));
  if (!fra.includes(navn)) return;
  skriv(stedNøkkel(NØKKEL_LAGER, fraId), JSON.stringify(fra.filter((n) => n !== navn)));
  const til = lesListe<string>(stedNøkkel(NØKKEL_LAGER, tilId));
  if (!til.includes(navn)) skriv(stedNøkkel(NØKKEL_LAGER, tilId), JSON.stringify([...til, navn]));
}

/** Smørelageret på alle steder: sted-id → produktnavn. Brukes til å vise hvor hvert produkt står. */
export function useAlleLagre(): Record<string, string[]> {
  const [ekstra] = useLagret<Sted[]>(NØKKEL_STEDER, TOM_LISTE);
  const ider = ['', ...ekstra.map((s) => s.id)];
  const rå = useSyncExternalStore(abonner, () => ider.map((id) => les(stedNøkkel(NØKKEL_LAGER, id)) || '[]').join('|'), () => '');
  return useMemo(() => {
    const deler = rå ? rå.split('|') : [];
    const ut: Record<string, string[]> = {};
    ider.forEach((id, i) => {
      try {
        ut[id] = JSON.parse(deler[i] || '[]');
      } catch {
        ut[id] = [];
      }
    });
    return ut;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rå]);
}

/** Bytter aktivt sted til stedet som hører til området (om noe er knyttet dit). Kalles når området endres. */
export function byttStedForOmråde(områdeId: string) {
  let lenker: Record<string, string> = {};
  try {
    lenker = JSON.parse(les(NØKKEL_STEDOMRÅDER) || '{}');
  } catch {
    return;
  }
  const treff = Object.keys(lenker).find((sid) => lenker[sid] === områdeId);
  if (treff === undefined) return;
  const nå = (() => {
    try {
      return JSON.parse(les(NØKKEL_AKTIVT_STED) || '""') as string;
    } catch {
      return '';
    }
  })();
  if (nå !== treff) skriv(NØKKEL_AKTIVT_STED, JSON.stringify(treff));
}

/** Sist behandlede område + koblinger, så vi bare bytter sted når området eller koblingene endres (ikke ved hver sidevisning). */
let sistOmråde = '';
export function useStedFølgerOmråde(områdeId: string) {
  const [lenkerRå] = useLagret<Record<string, string>>(NØKKEL_STEDOMRÅDER, {});
  const nøkkel = `${områdeId}|${JSON.stringify(lenkerRå)}`;
  useEffect(() => {
    if (sistOmråde === nøkkel) return;
    sistOmråde = nøkkel;
    byttStedForOmråde(områdeId);
  }, [nøkkel, områdeId]);
}
