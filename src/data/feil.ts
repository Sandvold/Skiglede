/**
 * Norsk feilmelding til brukeren. Rå meldinger fra server og bibliotek (engelske, tekniske) vises ikke; norske meldinger fra oss og fra
 * databasereglene («Du kan ha opptil 50 egne ruter …») slippes gjennom. Den tekniske meldingen logges i konsollen for feilsøking.
 */
export function feilTekst(e: unknown): string {
  const m = String((e as { message?: unknown })?.message ?? e ?? '').trim();
  if (!m) return 'Noe gikk galt. Prøv igjen.';
  if (/failed to fetch|networkerror|load failed|network request failed|aborted|abort|ingen svar fra databasen|timeout/i.test(m)) return 'Fikk ikke kontakt med tjenesten. Sjekk nettforbindelsen og prøv igjen.';
  if (/auth|token|jwt|not logged|unauthori[sz]ed|ikke innlogget|HTTP 40[13]\b/i.test(m)) return 'Du er logget ut. Logg inn igjen.';
  if (/[æøåÆØÅ]/.test(m) || /^(Ruten|Navnet|Du |Kunne ikke|Fikk ikke|Gi ruten)/.test(m)) return m;
  try { console.warn('[feil]', m); } catch { /* ingen konsoll */ }
  return 'Noe gikk galt. Prøv igjen.';
}
