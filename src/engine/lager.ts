import { ALLE_PRODUKTER, MERKE_IDER, SWIX, SYSTEMER, kategori, merkeAv, produkt, type MerkeId, type Produkt, type Smøresystem } from './tabeller';
import { byggSmøring } from './stabel';
import type { Seksjon, SnøAnalyse, Stabel, Stil, Tur } from './typer';

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
      advarsler.push(`Har ikke ${l.produkt}: bruker ${alt.navn} (${alt.farge}${alt.omr[0] === alt.omr[1] ? '' : `, ${alt.omr[0]} til ${alt.omr[1]} °C`}) i stedet.`);
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
const eide = (lager: string[]) => lager.map(produkt).filter((x): x is Produkt => !!x);

/** Smøresystemet til ett merke begrenset til det som ligger i lageret. null når lageret ikke har noe fra merket. */
export function systemFraLager(id: MerkeId, lager: string[]): Smøresystem | null {
  const sys = SYSTEMER[id];
  const har = (p?: Produkt) => (p && lager.includes(p.navn) ? p : undefined);
  const filtrer = (l: Produkt[]) => l.filter((p) => lager.includes(p.navn));
  const hardvoks = filtrer(sys.hardvoks);
  const klister = filtrer(sys.klister);
  const glider = filtrer(sys.glider);
  if (!hardvoks.length && !klister.length && !glider.length) return null;
  const mild = har(sys.binder?.mild);
  const skarp = har(sys.binder?.skarp);
  const binder = mild || skarp ? { mild: (mild ?? skarp)!, skarp: (skarp ?? mild)! } : undefined;
  return {
    ...sys,
    hardvoks, klister, glider, binder,
    baseKlister: har(sys.baseKlister), isKlister: har(sys.isKlister),
    universalVarm: har(sys.universalVarm), universalKald: har(sys.universalKald),
    sluddKald: har(sys.sluddKald), sluddVarm: har(sys.sluddVarm),
  };
}

/** Swix-systemet med glideren byttet ut med de glidevoksene du har (alle merker, Swix først). Uten egne glidere beholdes Swix. */
export function glideSystemFraLager(lager: string[]): Smøresystem {
  if (!lager.length) return SWIX;
  for (const id of MERKE_IDER) {
    const g = SYSTEMER[id].glider.filter((p) => lager.includes(p.navn));
    if (g.length) return { ...SWIX, glider: g };
  }
  return SWIX;
}

const KATEGORI_NAVN: Record<Stabel['type'], string> = { hardvoks: 'hardvoks', klister: 'klister', glider: 'glidevoks', felle: 'glidevoks', rubb: 'glidevoks' };
const dagens = (st: Stabel) => st.lag.find((l) => ['Dagens voks', 'Dagens klister', 'Glider'].includes(l.rolle))?.produkt;

/**
 * Smøring tilpasset lageret. Anbefalingen bygges ferdig fra ETT merke (Swix hvis du har noe passende derfra, ellers det merket du har mest av),
 * slik at lagene henger sammen og alle produkter hører til samme system. Andre merker du har som kan brukes nevnes som alternativ.
 * Tomt lager = «ikke registrert»: ren Swix-anbefaling.
 */
export function byggMedLager(stil: Stil, tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett: boolean, lager: string[]): Stabel {
  const ideal = byggSmøring(stil, tur, snø, seksjoner, lett, SWIX);
  if (!lager.length) return ideal;
  const trengs = KATEGORI_NAVN[ideal.type];
  const alle = MERKE_IDER.map((id) => ({ id, sys: systemFraLager(id, lager) })).filter((x): x is { id: MerkeId; sys: Smøresystem } => !!x.sys);
  const glideListe = glideSystemFraLager(lager).glider;
  const bruker = (x: { sys: Smøresystem }) => (ideal.type === 'hardvoks' ? x.sys.hardvoks.length : ideal.type === 'klister' ? x.sys.klister.length : x.sys.glider.length || (ideal.type === 'glider' ? 0 : 1));
  const brukbare = alle.filter((x) => bruker(x) > 0);
  // Swix først hvis brukbart, ellers flest relevante produkter
  const rekke = [...brukbare].sort((a, b) => (a.id === 'swix' ? -1 : b.id === 'swix' ? 1 : bruker(b) - bruker(a)));
  if (!rekke.length) {
    return { ...ideal, advarsler: [...ideal.advarsler, `Du har ingen ${trengs} i smørelageret. Anbefalingen er fra Swix: kjøp inn eller bruk det du har av annet.`] };
  }
  // Bygg fra hvert brukbart merke. Glidesonen kan hentes fra et annet merke.
  const bygg = (x: { id: MerkeId; sys: Smøresystem }) => {
    const sys = { ...x.sys, glider: x.sys.glider.length ? x.sys.glider : glideListe };
    const st = byggSmøring(stil, tur, snø, seksjoner, lett, sys);
    if (st.alternativ) st.alternativ = byggMedLager('klassisk', tur, snø, seksjoner, lett, lager);
    return st;
  };
  const primær = rekke[0];
  const st = bygg(primær);
  const alt: string[] = [];
  for (const x of rekke.slice(1)) {
    const a = dagens(bygg(x));
    if (a) alt.push(`${x.sys.navn}: ${a}`);
  }
  const mål = dagens(ideal);
  const mitt = dagens(st);
  const advarsler = [...st.advarsler];
  // [Bruker] KX30 og KX35N fungerer nesten likt: bytte mellom dem gir ingen advarsel.
  const lik = (x: string, y: string) => [x, y].every((n) => n === 'KX30' || n === 'KX35N');
  if (mål && mitt && mål !== mitt && !lik(mål, mitt)) advarsler.push(`Anbefalt er ${mål}, men du har den ikke: bruker ${mitt} i stedet.`);
  const begrunnelse = [...st.begrunnelse, `Smøringen er bygget av ${primær.sys.navn}-produktene i smørelageret ditt (ett merke, slik at lagene henger sammen).`];
  return { ...st, advarsler, begrunnelse, alternativer: alt.length ? alt : undefined };
}

export type Innkjøp = { produkt: Produkt; grunn: string };

/**
 * Forslag til innkjøp: Swix-produkter for HULL i dekningen. Et hull er et temperaturområde (innenfor det som er vanlig i området fra desember til april,
 * `vinter` = [kaldest, varmest] °C) der ingen av produktene du har (uansett merke) dekker temperaturen. Foreslår så få Swix-produkter som mulig per hull.
 * Binder og baseklister foreslås bare hvis du ikke har noen.
 */
export function innkjøpsforslag(vinter: [number, number], lager: string[], sys: Smøresystem = SWIX): Innkjøp[] {
  const [lo, hi] = vinter;
  const eid = eide(lager);
  const ut: Innkjøp[] = [];
  const temps = (a: number, b: number) => {
    const t: number[] = [];
    for (let x = Math.ceil(a); x <= b + 1e-9; x += 1) t.push(x);
    return t;
  };
  const dekker = (p: Produkt, t: number) => t >= p.omr[0] - 0.01 && t <= p.omr[1] + 0.01;
  const hull = (kandidater: Produkt[], eidKat: Produkt[], tider: number[], tekst: (a: number, b: number) => string) => {
    let udekket = tider.filter((t) => !eidKat.some((p) => dekker(p, t)));
    while (udekket.length) {
      // produktet som dekker flest av de udekkede temperaturene
      let best: Produkt | null = null;
      let bestN = 0;
      for (const p of kandidater) {
        const n = udekket.filter((t) => dekker(p, t)).length;
        if (n > bestN || (n === bestN && best && n > 0 && (p.omr[0] + p.omr[1]) / 2 < (best.omr[0] + best.omr[1]) / 2)) {
          best = p;
          bestN = n;
        }
      }
      if (!best || !bestN) break;
      const dekket = udekket.filter((t) => dekker(best!, t));
      ut.push({ produkt: best, grunn: tekst(Math.min(...dekket), Math.max(...dekket)) });
      udekket = udekket.filter((t) => !dekker(best!, t));
    }
  };
  const område = (a: number, b: number) => (a === b ? `Hull ved ca. ${a} °C` : `Hull fra ca. ${a} til ${b} °C`);
  hull(sys.hardvoks, eid.filter((p) => kategori(p) === 'hard'), temps(lo, Math.min(hi, 0)), område);
  hull(sys.klister, eid.filter((p) => kategori(p) === 'klister' && !nullområde(p)), temps(Math.max(lo, -5), hi), område);
  hull(sys.glider, eid.filter((p) => kategori(p) === 'glid'), temps(lo, hi), område);
  if (sys.binder && !eid.some((p) => kategori(p) === 'binder')) ut.push({ produkt: sys.binder.skarp, grunn: 'Du har ingen binder: grunnlaget under hardvoksen' });
  if (sys.baseKlister && !eid.some((p) => kategori(p) === 'klister' && nullområde(p))) ut.push({ produkt: sys.baseKlister, grunn: 'Du har ingen baseklister: grunnlaget under klister' });
  const rekke = (p: Produkt) => ({ hard: 0, binder: 1, klister: 2, glid: 3 })[kategori(p)] * 1000 + (nullområde(p) ? -100 : (p.omr[0] + p.omr[1]) / 2);
  return ut.sort((a, b) => rekke(a.produkt) - rekke(b.produkt));
}
