import { produkt } from './tabeller';
import type { Stabel, Stil } from './typer';

/** Det som ligger på et par ski etter forrige tur. */
export type Smøring = { stil: Stil; type: Stabel['type']; lag: { rolle: string; produkt: string }[]; ts: number; turer: number };

export type Påfylling = { handling: 'ny' | 'topplag' | 'rens'; tittel: string; grunner: string[] };

export const SKIPARK = { maksTurerUtenRens: 4, maksDager: 14 };
const DAG = 86_400_000;

const senter = (navn: string) => {
  const p = produkt(navn);
  return p ? (p.omr[0] + p.omr[1]) / 2 : 0;
};

/** Hovedproduktet i et lag-sett: dagens voks / dagens klister / glideren. */
function hoved(lag: { rolle: string; produkt: string }[]) {
  return lag.find((l) => l.rolle === 'Dagens voks' || l.rolle === 'Dagens klister' || l.rolle === 'Glider')?.produkt;
}

/** Skal skia renses, eller kan det bare legges nye topplag? [Forslag: reglene er enkle og skal justeres mot erfaring]. */
export function vurderPåfylling(forrige: Smøring | undefined, ny: Stabel, nå: number = Date.now()): Påfylling {
  if (!forrige) return { handling: 'ny', tittel: 'Ingen lagret smøring', grunner: ['Start på ren, slipt bunn og lagre smøringen etterpå, så husker appen den til neste gang.'] };

  const rens = (...grunner: string[]) => ({ handling: 'rens' as const, tittel: 'Rens skia først', grunner });
  if (forrige.type !== ny.type) {
    const navn = { hardvoks: 'hardvoks', klister: 'klister', glider: 'glider' };
    return rens(`Forrige smøring var ${navn[forrige.type]}, nå trengs ${navn[ny.type]}. De må ikke ligge oppå hverandre.`);
  }
  if (forrige.turer >= SKIPARK.maksTurerUtenRens) return rens(`${forrige.turer} turer uten rens: lagene har bygd seg opp og griper eller glir dårligere.`);
  const dager = Math.floor((nå - forrige.ts) / DAG);
  if (dager > SKIPARK.maksDager) return rens(`Smøringen er ${dager} dager gammel.`);

  const a = hoved(forrige.lag);
  const b = hoved(ny.lag);
  if (a && b && senter(b) < senter(a) - 0.5) {
    return rens(`Nå trengs ${b} (kaldere enn ${a} som ligger på). En kaldere voks fester seg dårlig oppå en varmere.`);
  }
  const likt = a === b;
  const tekst = {
    hardvoks: likt ? 'Samme dagsvoks ligger på: korke og legg 1–2 nye tynne lag.' : `Varmere enn forrige (${a}): legg ${b} og eventuelt dekke rett oppå.`,
    klister: likt ? 'Samme klister ligger på: smør ett nytt tykt lag over.' : `Varmere enn forrige (${a}): ett nytt tykt lag ${b} rett oppå.`,
    glider: likt ? 'Samme glider ligger på: børst og legg ett tynt lag.' : `Varmere enn forrige (${a}): legg ${b} oppå uten å rense.`,
  }[ny.type];
  return {
    handling: 'topplag',
    tittel: 'Bare topplag trengs',
    grunner: [tekst, `${forrige.turer} tur${forrige.turer === 1 ? '' : 'er'} siden sist rens (maks ${SKIPARK.maksTurerUtenRens}).`],
  };
}

/** Lagret smøring etter at stabelen er lagt på. */
export function lagreSmøring(stil: Stil, stabel: Stabel, forrige: Smøring | undefined, påfylling: Påfylling, nå: number = Date.now()): Smøring {
  return {
    stil,
    type: stabel.type,
    lag: stabel.lag.map((l) => ({ rolle: l.rolle, produkt: l.produkt })),
    ts: nå,
    turer: påfylling.handling === 'topplag' && forrige ? forrige.turer + 1 : 1,
  };
}

