import { Platform } from 'react-native';

import { rpcAnonymt } from '@/data/neon';

/**
 * Anonym sidetelling, bare på web: teller antall visninger per side per døgn (tabellen sidetelling i Neon). Ingenting lagres på enheten,
 * ingen ID, IP eller innlogging sendes med, så du kan ikke se unike brukere, bare hvor mange visninger hver side har. Hopper over lokal utvikling
 * og nettlesere med «ikke spor» (Do Not Track). Feil ignoreres.
 */
export function tellSide(side: string): void {
  if (Platform.OS !== 'web') return;
  try {
    const g = globalThis as { location?: { hostname?: string }; navigator?: { doNotTrack?: string | null } };
    const vert = g.location?.hostname ?? '';
    if (!vert || vert === 'localhost' || vert === '127.0.0.1' || vert.endsWith('.localhost')) return;
    if (g.navigator?.doNotTrack === '1') return;
  } catch {
    return;
  }
  rpcAnonymt('tell_side', { p_side: side }).catch(() => undefined);
}
