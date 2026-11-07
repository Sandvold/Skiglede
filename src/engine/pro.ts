import { glideFor, type Smøresystem, SWIX } from './tabeller';
import type { Lag, SnøAnalyse, Tur } from './typer';

/**
 * Pro (konkurranse): struktur (rilljern) og glidelag. Alt her er [Forslag]: terskler er mine og skal fintunes mot loggen fra brukerne.
 * Rådene er utgangspunkt for testing på rennmorgenen, ikke fasit.
 */
export type Struktur = { navn: string; grunn: string; nivå: number };

/** Nivåer fra fin (0) til grov (4). Brukes til å foreslå en finere og en grovere struktur til testing. */
export const STRUKTUR_NIVÅ = ['Fin', 'Fin til medium', 'Medium', 'Medium til grov', 'Grov'] as const;

/** Struktur ett steg finere (-1) eller grovere (+1), eller null hvis det ikke finnes. */
export function nabostruktur(s: Struktur, steg: -1 | 1, stil: 'klassisk' | 'skoyting'): Struktur | null {
  const n = s.nivå + steg;
  if (n < 0 || n > 4) return null;
  return { navn: `${STRUKTUR_NIVÅ[n]} lineær`, nivå: n, grunn: steg < 0 ? 'Finere enn anbefalt: tryggere hvis snøen er tørrere enn ventet.' : stil === 'skoyting' ? 'Grovere enn anbefalt: prøv hvis snøen er våtere enn ventet.' : 'Grovere enn anbefalt: prøv hvis snøen er våtere enn ventet. Ved tvil er finere bedre enn for grovt.' };
}

/**
 * Struktur (rilljern, håndstruktur) etter snøtemperatur (snitt langs løypa), snøtype, fuktighet og stil.
 * Grunnlag: Swix' veiledning for strukturvalg (fin under ca. −7 °C; medium for skøyting opp til våt snø og for klassisk −7…0 °C; medium til grov 0…+3 °C; grov bare for våt, grovkornet snø i klassisk).
 * Grensene er likevel [Forslag] og justeres mot loggen. Håndstruktur settes sist, på rennmorgenen.
 */
export function anbefalStruktur(tSnitt: number, snø: Pick<SnøAnalyse, 'type' | 'skarphet' | 'regn7'>, sludd: boolean, stil: 'klassisk' | 'skoyting' = 'klassisk'): Struktur {
  const våt = sludd || tSnitt >= 0 || snø.regn7 >= 5;
  if (stil === 'skoyting') {
    if (våt) return { navn: 'Medium lineær, grov håndstruktur', nivå: 3, grunn: 'Våt snø: skøyting bruker sjelden grov slipestruktur. Hold medium og legg en grovere håndstruktur (rilleverktøy 1 mm) eller avtrykksverktøy over for å lede bort vann.' };
    if (tSnitt <= -7) return { navn: 'Fin lineær', nivå: 0, grunn: 'Kald, tørr snø: fin struktur. En nyslipt struktur er skarp, så rund den litt av hvis skiene er nye.' };
    return { navn: 'Medium lineær', nivå: 2, grunn: 'Medium er standard for skøyting fra ca. −7 °C og opp til våt snø.' };
  }
  if (sludd || snø.regn7 >= 5 || tSnitt > 3) {
    return { navn: 'Grov lineær', nivå: 4, grunn: 'Våt, grovkornet snø: grov struktur leder bort vannet og gir mindre sug. Ved veldig våte forhold kan medium med avtrykksverktøy testes.' };
  }
  if (tSnitt >= 0) {
    return { navn: 'Medium til grov lineær', nivå: 3, grunn: 'Rundt og like over null, fuktig snø: medium til grov struktur. Test begge sidene av området.' };
  }
  if (snø.type === 'omdannet' && snø.skarphet >= 60 && tSnitt > -7) {
    return { navn: 'Fin til medium lineær', nivå: 1, grunn: 'Hard omdannet snø med skarpe korn: fin til medium struktur, ikke for grov.' };
  }
  if (tSnitt <= -7) {
    return { navn: 'Fin lineær', nivå: 0, grunn: 'Kald og tørr snø: fin struktur, grov struktur gir friksjon her. Fin struktur brukes sjelden i klassisk, men er riktig i kulda.' };
  }
  return { navn: 'Medium lineær', nivå: 2, grunn: 'Nysnø og finkornet snø mellom −7 og 0 °C: medium er et trygt utgangspunkt i klassisk.' };
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
