// Innlogging og kontodata på mobil (Android/iOS). Neon-biblioteket bygger på nettleser (omdirigering og informasjonskapsler)
// og feiler i React Native, så her gjøres det samme med vanlig fetch. Informasjonskapslene ligger i telefonens egen kapselpott.
import * as WebBrowser from 'expo-web-browser';
import { AUTH_URL, DATA_API_URL } from '@/data/neon';

const ORIGIN = 'https://skiglede.netlify.app';
const TILBAKE_SIDE = 'https://sandvold.github.io/Skiglede/';
const APP_TILBAKE = 'skiglede://auth';

type Økt = { token: string; bruker: { id: string; email: string; name?: string } };
let økt: Økt | null = null;

async function json(svar: Response, trinn: string): Promise<any> {
  const t = await svar.text();
  if (!svar.ok) throw new Error(`[${trinn}] HTTP ${svar.status}: ${t.slice(0, 160)}`);
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    throw new Error(`[${trinn}] ugyldig svar: ${t.slice(0, 80)}`);
  }
}

async function auth(sti: string, init: RequestInit = {}, trinn = sti) {
  const svar = await fetch(`${AUTH_URL}${sti}`, {
    ...init,
    headers: { Accept: 'application/json', Origin: ORIGIN, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as object) },
  });
  return json(svar, trinn);
}

function lesØkt(d: any): Økt | null {
  const token = d?.session?.token ?? d?.token;
  const u = d?.user;
  if (!token || !u) return null;
  return { token, bruker: { id: u.id, email: u.email, name: u.name } };
}

/** Henter eksisterende økt fra telefonens kapsler (tom hvis ikke innlogget). */
async function hentØkt(verifier?: string): Promise<Økt | null> {
  const d = await auth(`/get-session${verifier ? `?neon_auth_session_verifier=${encodeURIComponent(verifier)}` : ''}`, {}, 'økt');
  return lesØkt(d);
}

export async function loggInnNativt(): Promise<string | void> {
  try {
    WebBrowser.dismissBrowser();
  } catch {
    // ingen åpen nettleser
  }
  const start = await auth('/sign-in/social', { method: 'POST', body: JSON.stringify({ provider: 'google', callbackURL: TILBAKE_SIDE, disableRedirect: true }) }, 'start');
  if (!start?.url) throw new Error('[start] fikk ingen innloggingsadresse');
  const r = await WebBrowser.openAuthSessionAsync(start.url, APP_TILBAKE);
  if (r.type !== 'success') return `Innloggingen ble ikke fullført (${r.type}).`;
  const q = r.url.split('?')[1] ?? '';
  const verifier = new URLSearchParams(q).get('neon_auth_session_verifier');
  if (!verifier) throw new Error(`[retur] mangler verifier i ${r.url.slice(0, 80)}`);
  const o = await hentØkt(verifier);
  if (!o) throw new Error('[økt] ingen økt etter innlogging');
  økt = o;
}

export async function loggUtNativt(): Promise<void> {
  try {
    await auth('/sign-out', { method: 'POST', body: '{}' }, 'utlogging');
  } finally {
    økt = null;
  }
}

async function gjeldendeØkt(): Promise<Økt | null> {
  if (!økt) økt = await hentØkt().catch(() => null);
  return økt;
}

type Svar = { data: any; error: { message: string } | null };

/** Minimal PostgREST-bygger med samme form som biblioteket (from/select/insert/upsert/delete/eq/in/order/limit/maybeSingle). */
class Spørring implements PromiseLike<Svar> {
  private metode = 'GET';
  private kropp: unknown;
  private params: string[] = [];
  private prefer: string[] = [];
  private enkelt = false;
  constructor(private tabell: string) {}
  select(kol = '*') {
    this.params.push(`select=${encodeURIComponent(kol)}`);
    return this;
  }
  insert(rader: unknown) {
    this.metode = 'POST';
    this.kropp = rader;
    return this;
  }
  upsert(rader: unknown, o?: { onConflict?: string }) {
    this.metode = 'POST';
    this.kropp = rader;
    this.prefer.push('resolution=merge-duplicates');
    if (o?.onConflict) this.params.push(`on_conflict=${encodeURIComponent(o.onConflict)}`);
    return this;
  }
  delete() {
    this.metode = 'DELETE';
    return this;
  }
  eq(k: string, v: unknown) {
    this.params.push(`${k}=eq.${encodeURIComponent(String(v))}`);
    return this;
  }
  in(k: string, v: unknown[]) {
    this.params.push(`${k}=in.(${v.map((x) => encodeURIComponent(String(x))).join(',')})`);
    return this;
  }
  order(k: string, o?: { ascending?: boolean }) {
    this.params.push(`order=${k}.${o?.ascending === false ? 'desc' : 'asc'}`);
    return this;
  }
  limit(n: number) {
    this.params.push(`limit=${n}`);
    return this;
  }
  maybeSingle() {
    this.enkelt = true;
    return this;
  }
  private async kjør(): Promise<Svar> {
    try {
      const o = await gjeldendeØkt();
      if (!o) throw new Error('ikke innlogget');
      const headers: Record<string, string> = { Authorization: `Bearer ${o.token}`, Accept: 'application/json' };
      if (this.kropp !== undefined) headers['Content-Type'] = 'application/json';
      if (this.metode !== 'GET') this.prefer.push('return=minimal');
      if (this.prefer.length) headers.Prefer = this.prefer.join(',');
      const q = this.params.length ? `?${this.params.join('&')}` : '';
      const svar = await fetch(`${DATA_API_URL}/${this.tabell}${q}`, { method: this.metode, headers, body: this.kropp === undefined ? undefined : JSON.stringify(this.kropp) });
      const t = await svar.text();
      if (!svar.ok) return { data: null, error: { message: `HTTP ${svar.status}: ${t.slice(0, 160)}` } };
      const d = t ? JSON.parse(t) : null;
      return { data: this.enkelt ? (Array.isArray(d) ? d[0] ?? null : d) : d, error: null };
    } catch (e) {
      return { data: null, error: { message: String((e as Error)?.message ?? e) } };
    }
  }
  then<A = Svar, B = never>(ok?: ((v: Svar) => A | PromiseLike<A>) | null, feil?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return this.kjør().then(ok, feil);
  }
}

export const nativKlient = {
  from: (tabell: string) => new Spørring(tabell),
  auth: {
    getSession: async () => {
      const o = await gjeldendeØkt();
      return { data: o ? { user: o.bruker, session: { token: o.token } } : { user: null, session: null }, error: null };
    },
    signOut: loggUtNativt,
  },
};
