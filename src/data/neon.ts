import { Platform } from 'react-native';
// Lastes først ved bruk: pakken må ikke kjøres ved oppstart på mobil (en feil der tok hele appen ned før noe vistes).
function createClient(...a: any[]): any {
  return require('@neon/neon-js').createClient(...a);
}

// Offentlig adresse til Skiglede-databasen i Neon (uten passord). Tilgang styres av innlogging og radnivå-sikkerhet (RLS).
const NEON_URL = process.env.EXPO_PUBLIC_NEON_URL ?? 'https://ep-wandering-breeze-b90blxb5.c-7.eu-central-1.aws.neon.tech/neondb';

let klient: any | null = null;
export function neon() {
  if (!klient) klient = Platform.OS === 'web' ? createClient(NEON_URL) : require('@/data/native-konto').nativKlient;
  return klient;
}

let anonym: any | null = null;
/** Klient uten innlogging (anonym token), til offentlige data som værhistorikken. */
export function neonAnonym() {
  if (!anonym) anonym = createClient(NEON_URL, { auth: { allowAnonymous: true } });
  return anonym;
}

/** Data-API-adressen (samme avledning som biblioteket gjør). */
export const DATA_API_URL = (() => {
  const m = /^(https?:\/\/)([^./]+)\.(.+?)(\/[^?#]*)?$/.exec(NEON_URL);
  return m ? `${m[1]}${m[2]}.apirest.${m[3]}${(m[4] ?? '').replace(/\/+$/, '')}/rest/v1` : NEON_URL;
})();

/**
 * Enkel lesing av offentlige data uten postgrest-biblioteket: token fra anonym innlogging, så vanlig fetch mot Data API-et.
 * Brukes der biblioteket feiler på mobil. `steg` fylles ut slik at en feil sier hvor den skjedde.
 */
export const AUTH_URL = (() => {
  const m = /^(https?:\/\/)([^./]+)\.(.+?)(\/[^?#]*)?$/.exec(NEON_URL);
  return m ? `${m[1]}${m[2]}.neonauth.${m[3]}${(m[4] ?? '').replace(/\/+$/, '')}/auth` : NEON_URL;
})();

/** fetch med tidsavbrudd (12 s), så «Henter …» ikke henger for alltid ved dårlig dekning. */
async function fetchFrist(url: string, init?: RequestInit, ms = 12_000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new Error(`Ingen svar fra databasen innen ${ms / 1000} sekunder`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

let _tok: { token: string; exp: number } | null = null;
/** Anonym JWT hentet med vanlig fetch (biblioteket bygger feil adresse på Android: HTTP 404). Hurtigbufret til like før utløp. */
async function anonymToken(): Promise<string> {
  if (_tok && _tok.exp > Date.now() / 1000 + 60) return _tok.token;
  const svar = await fetchFrist(`${AUTH_URL}/token/anonymous`, { headers: { Accept: 'application/json' } });
  const tekst = await svar.text();
  if (!svar.ok) throw new Error(`token HTTP ${svar.status}: ${tekst.slice(0, 120)}`);
  const j = JSON.parse(tekst) as { token: string; expires_at: number };
  _tok = { token: j.token, exp: j.expires_at };
  return j.token;
}

export async function lesAnonymt<T = unknown>(spørring: string, steg?: { t: string }): Promise<T[]> {
  const sett = (t: string) => { if (steg) steg.t = t; };
  sett('token');
  const token = await anonymToken();
  sett('fetch');
  const svar = await fetchFrist(`${DATA_API_URL}/${spørring}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  sett('tekst');
  const tekst = await svar.text();
  if (!svar.ok) throw new Error(`HTTP ${svar.status}: ${tekst.slice(0, 200)}`);
  sett('json');
  return JSON.parse(tekst) as T[];
}

/** Kaller en databasefunksjon (rpc) anonymt. Brukes til sidetellingen; feil ignoreres av kalleren. */
export async function rpcAnonymt(funksjon: string, args: Record<string, unknown>): Promise<void> {
  const token = await anonymToken();
  await fetchFrist(`${DATA_API_URL}/rpc/${funksjon}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
}
