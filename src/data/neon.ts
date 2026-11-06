import { createClient } from '@neon/neon-js';

// Offentlig adresse til Skiglede-databasen i Neon (uten passord). Tilgang styres av innlogging og radnivå-sikkerhet (RLS).
const NEON_URL = process.env.EXPO_PUBLIC_NEON_URL ?? 'https://ep-wandering-breeze-b90blxb5.c-7.eu-central-1.aws.neon.tech/neondb';

let klient: ReturnType<typeof createClient> | null = null;
export function neon() {
  if (!klient) klient = createClient(NEON_URL);
  return klient;
}
