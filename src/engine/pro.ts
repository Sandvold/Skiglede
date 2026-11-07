import { glideFor, type Smøresystem, SWIX } from './tabeller';
import type { Lag, SnøAnalyse, Tur } from './typer';

/**
 * Pro (konkurranse): struktur (rilljern) og glidelag. Alt her er [Forslag]: terskler er mine og skal fintunes mot loggen fra brukerne.
 * Rådene er utgangspunkt for testing på rennmorgenen, ikke fasit.
 */
export type Struktur = { navn: string; grunn: string };

/** Slipestruktur etter snøtemperatur (snitt langs løypa), snøtype og fuktighet. Fin = kald/tørr snø, grov = våt snø/sludd. */
export function anbefalStruktur(tSnitt: number, snø: Pick<SnøAnalyse, 'type' | 'skarphet' | 'regn7'>, sludd: boolean): Struktur {
  if (sludd || tSnitt >= 0 || snø.regn7 >= 5) {
    return { navn: 'Grov lineær', grunn: 'Våt snø og vann under skiene: grov struktur leder bort vannet og gir mindre sug. Ved veldig våte forhold kan et V-mønster testes.' };
  }
  if (tSnitt >= -3) {
    return { navn: 'Medium til grov lineær', grunn: 'Nær null grader og fuktig snø: medium til grov struktur. Test begge sidene av området.' };
  }
  if (snø.type === 'omdannet' && snø.skarphet >= 60 && tSnitt > -10) {
    return { navn: 'Fin til medium lineær', grunn: 'Hard omdannet snø med skarpe korn: fin til medium struktur, ikke for grov.' };
  }
  if (tSnitt <= -10) {
    return { navn: 'Fin lineær', grunn: 'Kald og tørr snø: fin struktur, grov struktur gir friksjon her.' };
  }
  return { navn: 'Medium lineær', grunn: 'Kjølig, tørr snø: universell medium struktur er et trygt utgangspunkt.' };
}

/**
 * Glidelag for konkurranse, nederst først: kald grunnsmøring, dagens glider i flere lag, og et siste topplag.
 * Glideren velges som ellers (kaldeste som passer). Tallene er [Forslag].
 */
export function proGlidelag(tur: Tur, sys: Smøresystem = SWIX): Lag[] {
  if (!sys.glider.length || !tur.seksjoner.length) return [];
  const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
  const dag = glideFor(snitt, sys);
  const grunn = sys.glider[0]; // kaldest først
  const lag: Lag[] = [];
  if (grunn.navn !== dag.navn) lag.push({ rolle: 'Grunnsmøring glid', produkt: grunn.navn, antall: '1 lag', merknad: 'Hard og kald: gir slitestyrke og fyller basen. Smelt inn, kjøl, skrap og børst.' });
  lag.push({ rolle: 'Dagens glider', produkt: dag.navn, antall: '2–3 lag', merknad: 'Smelt inn, la skiene kjøle, skrap og børst mellom hvert lag.' });
  lag.push({ rolle: 'Topplag', produkt: dag.navn, antall: '1 lag', merknad: 'Siste lag, børstes grundig. Fluorfritt. Bruk pulver eller væske i samme område hvis du har.' });
  return lag;
}
