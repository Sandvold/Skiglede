import { Platform } from 'react-native';

import { rpcAnonymt } from '@/data/neon';

/**
 * Anonym sidetelling, bare på web: teller antall visninger per side per døgn (tabellen sidetelling i Neon). Eneste unntak er et valgfritt «ikke tell meg»-merke på din egen enhet (se under). Ingen ID, IP eller innlogging sendes med, så du kan ikke se unike brukere, bare hvor mange visninger hver side har. Hopper over lokal utvikling
 * og nettlesere med «ikke spor» (Do Not Track). Feil ignoreres.
 *
 * Eier kan utelate seg selv: åpne siden én gang med ?ikketell=1 på hver enhet (lagrer et merke i nettleseren), og ?ikketell=0 for å telle igjen.
 */
const IKKE_TELL = 'skiglede.ikke-tell';

function ikkeTellMerke(): boolean {
  try {
    const g = globalThis as { location?: { search?: string }; localStorage?: Storage };
    const verdi = new URLSearchParams(g.location?.search ?? '').get('ikketell');
    if (verdi === '1') g.localStorage?.setItem(IKKE_TELL, '1');
    else if (verdi === '0') g.localStorage?.removeItem(IKKE_TELL);
    return g.localStorage?.getItem(IKKE_TELL) === '1';
  } catch {
    return false;
  }
}

export function tellSide(side: string): void {
  if (Platform.OS !== 'web') return;
  if (ikkeTellMerke()) return;
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
