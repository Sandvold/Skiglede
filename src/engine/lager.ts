import { ALLE_PRODUKTER, kategori, merkeAv, produkt, type Produkt } from './tabeller';
import type { Stabel } from './typer';

const senter = (p: Produkt) => (p.omr[0] + p.omr[1]) / 2;

/** Nærmeste produkt i lageret i samme kategori. Ved lik avstand velges det kaldeste (gjelder alle: heller litt kaldt). */
export function alternativFraLager(navn: string, lager: string[]): Produkt | undefined {
  const p = produkt(navn);
  if (!p) return undefined;
  const like = lager.map(produkt).filter((x): x is Produkt => !!x && kategori(x) === kategori(p));
  // Samme merke først; bytter bare til annet merke når lageret ikke har noe tilsvarende fra samme merke
  const kandidater = like.some((x) => merkeAv(x) === merkeAv(p)) ? like.filter((x) => merkeAv(x) === merkeAv(p)) : like;
  if (!kandidater.length) return undefined;
  const avst = (x: Produkt) => Math.abs(senter(x) - senter(p));
  return kandidater.reduce((a, b) => (avst(b) < avst(a) || (avst(b) === avst(a) && senter(b) < senter(a)) ? b : a));
}

/**
 * Tilpasser en anbefalt stabel til det brukeren faktisk har. Tomt lager betyr «ikke registrert»: ingenting endres.
 * Produkter som mangler byttes mot nærmeste i samme kategori, ellers markeres de som mangler.
 */
export function tilpassTilLager(stabel: Stabel, lager: string[]): Stabel {
  if (!lager.length) return stabel;
  if (stabel.alternativ) return { ...stabel, alternativ: tilpassTilLager(stabel.alternativ, lager) };
  const advarsler = [...stabel.advarsler];
  const begrunnelse = [...stabel.begrunnelse];
  const lag = stabel.lag.map((l) => {
    if (lager.includes(l.produkt) || !produkt(l.produkt)) return l; // «Felle» og «Rubb» er ikke smøreprodukter
    const alt = alternativFraLager(l.produkt, lager);
    if (alt) {
      advarsler.push(`Har ikke ${l.produkt}: bruker ${alt.navn} (${alt.farge}, ${alt.omr[0]} til ${alt.omr[1]} °C) i stedet.`);
      return { ...l, produkt: alt.navn, merknad: `Erstatter ${l.produkt} som ikke ligger i lageret. ${l.merknad ?? ''}`.trim() };
    }
    advarsler.push(`Har ikke ${l.produkt}, og lageret har ingen tilsvarende. Kjøp inn eller dropp laget.`);
    return { ...l, merknad: `Mangler i lageret. ${l.merknad ?? ''}`.trim() };
  });
  if (lag.some((l, i) => l.produkt !== stabel.lag[i].produkt)) begrunnelse.push('Smøringen er tilpasset smørelageret ditt.');
  return { ...stabel, lag, advarsler, begrunnelse };
}

/** Navn på alle produkter, for lagerlisten. */
export const ALLE_NAVN = ALLE_PRODUKTER.map((p) => p.navn);
