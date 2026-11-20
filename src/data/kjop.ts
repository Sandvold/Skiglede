// Kjøp av Pro og Premium via RevenueCat (Google Play / App Store). Bare på mobil: på web finnes ingen kjøp.
// Pakken lastes først ved bruk (den er skrevet for native og skal ikke ta ned web eller oppstart).
// Tilgangen avgjøres på serveren: RevenueCat kaller webhooken `rcwebhook` (Neon Function), som oppdaterer `profil`.
// Appen leser `profil` på nytt etter kjøp. appUserID i RevenueCat er Neon-bruker-ID-en.
import { Platform } from 'react-native';

/** Offentlig SDK-nøkkel fra RevenueCat (Project → API keys → Google Play). Tom = kjøp er ikke koblet til ennå. */
export const RC_ANDROID_KEY = 'goog_vsFogJuiFtTJRRYAjMskvmGnVee'; // offentlig SDK-nøkkel (kan ligge i appen)
export const RC_IOS_KEY = 'appl_XcNbetbNJIjBvyUEkeQtZWmSFFf';

export type Pakke = { id: string; nivå: 'pro' | 'premium'; tittel: string; pris: string };

const nøkkel = () => (Platform.OS === 'android' ? RC_ANDROID_KEY : Platform.OS === 'ios' ? RC_IOS_KEY : '');
export const kjøpTilgjengelig = () => Platform.OS !== 'web' && !!nøkkel();

let konfigurert = false;
let bruker: string | null = null;
let pakker = new Map<string, any>();

function sdk(): any {
  return require('react-native-purchases').default;
}

/** Kobler RevenueCat til denne brukeren (kalles ved innlogging). Trygt å kalle flere ganger. */
export async function kjøpLoggInn(brukerId: string): Promise<void> {
  if (!kjøpTilgjengelig()) return;
  const P = sdk();
  if (!konfigurert) {
    P.configure({ apiKey: nøkkel(), appUserID: brukerId });
    konfigurert = true;
    bruker = brukerId;
    return;
  }
  if (bruker !== brukerId) {
    await P.logIn(brukerId);
    bruker = brukerId;
  }
}

export async function kjøpLoggUt(): Promise<void> {
  if (!konfigurert || !bruker) return;
  bruker = null;
  try {
    await sdk().logOut();
  } catch {
    // var allerede anonym
  }
}

function nivåFra(produktId: string): 'pro' | 'premium' | null {
  const id = produktId.toLowerCase();
  if (id.includes('premium')) return 'premium';
  if (id.includes('pro')) return 'pro';
  return null;
}

/** Årsabonnementene som er satt opp i gjeldende «offering», med pris slik butikken viser den. */
export async function hentPakker(): Promise<Pakke[]> {
  if (!konfigurert) return [];
  const o = await sdk().getOfferings();
  const liste: any[] = o?.current?.availablePackages ?? [];
  pakker = new Map();
  const ut: Pakke[] = [];
  for (const p of liste) {
    const nivå = nivåFra(String(p.product?.identifier ?? ''));
    if (!nivå) continue;
    pakker.set(p.identifier, p);
    ut.push({ id: p.identifier, nivå, tittel: nivå === 'premium' ? 'Premium' : 'Pro', pris: `${p.product.priceString} per år` });
  }
  return ut.sort((a, b) => (a.nivå === b.nivå ? 0 : a.nivå === 'pro' ? -1 : 1));
}

/** Starter kjøpet i butikken. Returnerer feiltekst, eller null ved suksess (også når brukeren avbryter: da er det ingen feil). */
export async function kjøp(pakkeId: string): Promise<string | null> {
  const p = pakker.get(pakkeId);
  if (!p) return 'Fant ikke abonnementet. Prøv igjen.';
  try {
    await sdk().purchasePackage(p);
    return null;
  } catch (e: any) {
    if (e?.userCancelled) return null;
    return e?.message ? String(e.message) : 'Kjøpet feilet.';
  }
}

export async function gjenopprett(): Promise<string | null> {
  if (!konfigurert) return 'Kjøp er ikke klart ennå.';
  try {
    await sdk().restorePurchases();
    return null;
  } catch (e: any) {
    return e?.message ? String(e.message) : 'Kunne ikke gjenopprette kjøp.';
  }
}
