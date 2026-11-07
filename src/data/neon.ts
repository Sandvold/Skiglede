// Lastes først ved bruk: pakken må ikke kjøres ved oppstart på mobil (en feil der tok hele appen ned før noe vistes).
function createClient(...a: any[]): any {
  return require('@neon/neon-js').createClient(...a);
}

// Offentlig adresse til Skiglede-databasen i Neon (uten passord). Tilgang styres av innlogging og radnivå-sikkerhet (RLS).
const NEON_URL = process.env.EXPO_PUBLIC_NEON_URL ?? 'https://ep-wandering-breeze-b90blxb5.c-7.eu-central-1.aws.neon.tech/neondb';

let klient: any | null = null;
export function neon() {
  if (!klient) klient = createClient(NEON_URL);
  return klient;
}

let anonym: any | null = null;
/** Klient uten innlogging (anonym token), til offentlige data som værhistorikken. */
export function neonAnonym() {
  if (!anonym) anonym = createClient(NEON_URL, { auth: { allowAnonymous: true } });
  return anonym;
}
