import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { erBrukerdata, lesLokal, påSkriv, skrivFraKonto } from '@/data/lagring';
import { neon } from '@/data/neon';

type Bruker = { id: string; epost: string; navn: string };
type Tilstand = {
  /** false mens vi sjekker om noen er logget inn */
  klar: boolean;
  pågår: boolean;
  bruker: Bruker | null;
  premium: boolean;
  /** Pro (konkurranse) bygger på premium. */
  pro: boolean;
  feil: string;
  loggInnMedGoogle: () => Promise<void>;
  loggUt: () => Promise<void>;
  /** Midlertidig bryter mellom premium og vanlig (ingen ekte betaling ennå). */
  byttPremium: () => Promise<void>;
  /** Midlertidig bryter for pro (kun for premium, ingen betaling ennå). */
  byttPro: () => Promise<void>;
};

const Ctx = createContext<Tilstand | null>(null);
const LOKAL_NØKLER = () => {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return [];
    const n: string[] = [];
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k) n.push(k); } // fungerer både i nettleser og med expo-sqlite på Android
    return n.filter(erBrukerdata);
  } catch {
    return [];
  }
};

/** Norsk feilmelding: nettfeil fra nettleseren («Failed to fetch») vises ikke rått. */
const feilTekst = (e: unknown): string => {
  const m = String((e as Error)?.message ?? e);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(m) ? 'Fikk ikke kontakt med innloggingen. Sjekk nettforbindelsen.' : m;
};

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [klar, setKlar] = useState(false);
  const [bruker, setBruker] = useState<Bruker | null>(null);
  const [premium, setPremium] = useState(false);
  const [proFlagg, setPro] = useState(false);
  const [feil, setFeil] = useState('');
  const [pågår, setPågår] = useState(false);
  const synket = useRef(false);

  const hent = useCallback(async () => {
    try {
      const { data } = await neon().auth.getSession();
      const u = data?.user;
      if (!u) {
        setBruker(null);
        setPremium(false);
        setPro(false);
        return;
      }
      setBruker({ id: u.id, epost: u.email, navn: u.name ?? u.email });
      const db = neon();
      let { data: rad, error: profilFeil } = await db.from('profil').select('premium, pro').maybeSingle();
      if (profilFeil) throw profilFeil; // ikke sett premium til av når profilen bare ikke kunne leses
      if (!rad) {
        await db.from('profil').insert({});
        rad = { premium: false, pro: false };
      }
      setPremium(!!rad.premium);
      setPro(!!rad.pro);
    } catch (e) {
      setFeil(feilTekst(e));
    } finally {
      setKlar(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- henter innlogging og profil ved oppstart
    hent();
  }, [hent]);

  // Mobil: retur-ruten /auth oppretter økta utenfor denne komponenten og sier fra her.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    return require('@/data/native-konto').påØkt(() => hent());
  }, [hent]);

  // Synk: ved innlogging som premium hentes data fra kontoen (kontoen vinner), og er kontoen tom lastes lokale data opp.
  useEffect(() => {
    if (!bruker || !premium || synket.current) return;
    synket.current = true;
    (async () => {
      try {
        const db = neon();
        const { data: rader, error } = await db.from('brukerdata').select('nokkel, verdi');
        if (error) throw error;
        const server = new Map<string, string>((rader ?? []).map((r: { nokkel: string; verdi: unknown }) => [r.nokkel, JSON.stringify(r.verdi)]));
        server.forEach((v, n) => skrivFraKonto(n, v));
        const opp = LOKAL_NØKLER().filter((n) => !server.has(n) && lesLokal(n));
        if (opp.length) {
          const { error: oppFeil } = await db.from('brukerdata').upsert(opp.map((n) => ({ nokkel: n, verdi: JSON.parse(lesLokal(n)), oppdatert: new Date().toISOString() })), { onConflict: 'user_id,nokkel' });
          if (oppFeil) throw oppFeil;
        }
      } catch (e) {
        synket.current = false;
        setFeil(`Synk feilet: ${feilTekst(e)}`);
      }
    })();
  }, [bruker, premium]);

  // Hver lagring fra brukeren sendes til kontoen (samles opp i 800 ms).
  useEffect(() => {
    if (!bruker || !premium) return;
    const kø = new Map<string, string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = async () => {
      const biter = [...kø.entries()];
      kø.clear();
      try {
        const db = neon();
        const tomme = biter.filter(([, v]) => !v).map(([n]) => n);
        const fulle = biter.filter(([, v]) => v);
        if (fulle.length) {
          const { error } = await db.from('brukerdata').upsert(fulle.map(([n, v]) => ({ nokkel: n, verdi: JSON.parse(v), oppdatert: new Date().toISOString() })), { onConflict: 'user_id,nokkel' });
          if (error) throw error;
        }
        if (tomme.length) {
          const { error } = await db.from('brukerdata').delete().in('nokkel', tomme);
          if (error) throw error;
        }
      } catch (e) {
        setFeil(`Synk feilet: ${feilTekst(e)}`);
      }
    };
    const av = påSkriv((n, v) => {
      if (!erBrukerdata(n)) return;
      kø.set(n, v);
      clearTimeout(timer);
      timer = setTimeout(send, 800);
    });
    return () => {
      av();
      clearTimeout(timer);
    };
  }, [bruker, premium]);

  const loggInnMedGoogle = useCallback(async () => {
    setFeil('');
    if (Platform.OS !== 'web') {
      try {
        setPågår(true);
        const melding = await require('@/data/native-konto').loggInnNativt();
        if (melding) setFeil(melding);
        await hent();
      } catch (e) {
        setFeil(feilTekst(e));
      } finally {
        setPågår(false);
      }
      return;
    }
    const tilbake = typeof window !== 'undefined' ? window.location.origin + (process.env.EXPO_BASE_URL ?? '') + '/' : undefined;
    const { error } = await neon().auth.signIn.social({ provider: 'google', callbackURL: tilbake });
    if (error) setFeil(error.message ?? 'Innlogging feilet');
  }, [hent]);

  const loggUt = useCallback(async () => {
    try {
      await neon().auth.signOut();
    } catch (e) {
      setFeil(`Utlogging: ${feilTekst(e)}`);
    }
    synket.current = false;
    setBruker(null);
    setPremium(false);
    setPro(false);
  }, []);

  const byttPremium = useCallback(async () => {
    if (!bruker) return;
    const ny = !premium;
    const { error } = await neon().from('profil').upsert({ premium: ny, ...(ny ? {} : { pro: false }), oppdatert: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) setFeil(error.message);
    else {
      setPremium(ny);
      if (!ny) setPro(false);
    }
  }, [bruker, premium]);

  const byttPro = useCallback(async () => {
    if (!bruker) return;
    const ny = !(premium && proFlagg);
    // Pro bygger på premium: slås pro på, slås premium på samtidig.
    const { error } = await neon().from('profil').upsert({ pro: ny, ...(ny ? { premium: true } : {}), oppdatert: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) setFeil(error.message);
    else {
      setPro(ny);
      if (ny) setPremium(true);
    }
  }, [bruker, premium, proFlagg]);

  const pro = premium && proFlagg;

  const verdi = useMemo(() => ({ klar, bruker, premium, pro, feil, pågår, loggInnMedGoogle, loggUt, byttPremium, byttPro }), [klar, bruker, premium, pro, feil, pågår, loggInnMedGoogle, loggUt, byttPremium, byttPro]);
  return <Ctx.Provider value={verdi}>{children}</Ctx.Provider>;
}

export function usePremium(): Tilstand {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePremium må brukes inni PremiumProvider');
  return c;
}
