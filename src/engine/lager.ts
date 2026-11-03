import { ALLE_PRODUKTER, BASEKLISTER, SWIX, kategori, merkeAv, produkt, glideFor, hardvoksFor, klisterFor, type Produkt, type Smøresystem } from './tabeller';
import type { Stabel } from './typer';

const senter = (p: Produkt) => (p.omr[0] + p.omr[1]) / 2;

/** Nærmeste produkt i lageret i samme kategori (samme merke først, med mindre blandMerker er satt: da velges nærmeste på tvers av merker). Ved lik avstand velges det kaldeste (gjelder alle: heller litt kaldt). */
export function alternativFraLager(navn: string, lager: string[], blandMerker = false): Produkt | undefined {
  const p = produkt(navn);
  if (!p) return undefined;
  const like = lager.map(produkt).filter((x): x is Produkt => !!x && kategori(x) === kategori(p) && (x.omr[0] === x.omr[1]) === (p.omr[0] === p.omr[1])); // baseklister/binder (uten område) byttes bare mot sin egen type
  // Samme merke først; bytter bare til annet merke når lageret ikke har noe tilsvarende fra samme merke
  const kandidater = !blandMerker && like.some((x) => merkeAv(x) === merkeAv(p)) ? like.filter((x) => merkeAv(x) === merkeAv(p)) : like;
  if (!kandidater.length) return undefined;
  const avst = (x: Produkt) => Math.abs(senter(x) - senter(p));
  return kandidater.reduce((a, b) => (avst(b) < avst(a) || (avst(b) === avst(a) && senter(b) < senter(a)) ? b : a));
}

/**
 * Tilpasser en anbefalt stabel til det brukeren faktisk har. Tomt lager betyr «ikke registrert»: ingenting endres.
 * Produkter som mangler byttes mot nærmeste i samme kategori, ellers markeres de som mangler.
 */
export function tilpassTilLager(stabel: Stabel, lager: string[], blandMerker = false): Stabel {
  if (!lager.length) return stabel;
  if (stabel.alternativ) return { ...stabel, alternativ: tilpassTilLager(stabel.alternativ, lager, blandMerker) };
  const advarsler = [...stabel.advarsler];
  const begrunnelse = [...stabel.begrunnelse];
  const lag = stabel.lag.map((l) => {
    if (lager.includes(l.produkt) || !produkt(l.produkt)) return l; // «Felle» og «Rubb» er ikke smøreprodukter
    const alt = alternativFraLager(l.produkt, lager, blandMerker);
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

const nullområde = (p: Produkt) => p.omr[0] === p.omr[1];
/** Dekker et eid produkt dette produktet? Samme kategori og temperaturområdene overlapper minst halvparten av det nye. Binder/baseklister (uten område): samme navn, eller et hvilket som helst eid binder. */
function dekkes(nytt: Produkt, eid: Produkt[]): boolean {
  return eid.some((e) => {
    if (e.navn === nytt.navn) return true;
    if (kategori(e) !== kategori(nytt)) return false;
    if (nullområde(nytt) || nullområde(e)) return kategori(nytt) === 'binder' && kategori(e) === 'binder';
    const overlapp = Math.min(e.omr[1], nytt.omr[1]) - Math.max(e.omr[0], nytt.omr[0]);
    return overlapp >= 0.5 * Math.max(nytt.omr[1] - nytt.omr[0], 1);
  });
}

export type Innkjøp = { produkt: Produkt; grunn: string };

/**
 * Forslag til innkjøp: Swix-produkter som dekker snøtemperaturene som er vanlige i området fra desember til april
 * (`vinter` = [kaldest, varmest] °C). Produkter du allerede har med overlappende område (samme kategori) foreslås ikke.
 */
export function innkjøpsforslag(vinter: [number, number], lager: string[], sys: Smøresystem = SWIX): Innkjøp[] {
  const [lo, hi] = vinter;
  const eid = lager.map(produkt).filter((x): x is Produkt => !!x);
  const behov = new Map<string, { p: Produkt; fra: number; til: number }>();
  const legg = (p: Produkt, t: number) => {
    const b = behov.get(p.navn);
    if (b) { b.fra = Math.min(b.fra, t); b.til = Math.max(b.til, t); } else behov.set(p.navn, { p, fra: t, til: t });
  };
  for (let t = lo; t <= hi + 1e-9; t += 1) {
    if (t <= 0.5) legg(sys.hardvoks[hardvoksFor(t, sys)], t); // hardvoks til rundt 0 °C
    if (t >= -5) legg(sys.klister[klisterFor(t, sys)], t); // klister brukes fra rundt −5 °C
    legg(glideFor(t, sys), t);
  }
  if (sys.binder) { legg(sys.binder.mild, lo); legg(sys.binder.skarp, lo); }
  if (sys.baseKlister) legg(sys.baseKlister, hi);
  if (sys.universalVarm) legg(sys.universalVarm, hi);
  const rekke = (p: Produkt) => ({ hard: 0, binder: 1, klister: 2, glid: 3 })[kategori(p)] * 1000 + (nullområde(p) ? -100 : (p.omr[0] + p.omr[1]) / 2);
  return [...behov.values()]
    .filter((b) => !dekkes(b.p, eid))
    .sort((a, b) => rekke(a.p) - rekke(b.p))
    .map((b) => ({
      produkt: b.p,
      grunn: nullområde(b.p) ? (b.p.merknad ?? 'Grunnlag for smøringen') : b.fra === b.til ? `Dekker ca. ${b.fra} °C` : `Dekker snø fra ca. ${b.fra} til ${b.til} °C`,
    }));
}
