import { produkt } from './tabeller';
import type { Stabel, Stil } from './typer';

/** Det som ligger på et par ski etter forrige tur. */
export type Smøring = { stil: Stil; type: Stabel['type']; lag: { rolle: string; produkt: string }[]; ts: number; turer: number };

export type Påfylling = { handling: 'ny' | 'topplag' | 'rens'; tittel: string; grunner: string[]; /** true: glideren som ligger på beholdes (ingen ny glider) */ behold?: boolean };

/** maksKaldere: hvor mye kaldere (°C, midt i området) ny voks/klister kan være enn øverste lag og fortsatt legges som tynt dekke (ca. ett trinn, Swix/Boulder Nordic: «en eller to temperaturområder»). glideMonn: slingringsmonn (°C) utenfor området til glideren som ligger på før den må byttes (bytte krever rens) [Bruker; tall Forslag]. */
export const SKIPARK = { maksTurerUtenRens: 4, maksDager: 14, maksKaldere: 3, glideMonn: 1.5 };
const DAG = 86_400_000;

const senter = (navn: string) => {
  const p = produkt(navn);
  return p ? (p.omr[0] + p.omr[1]) / 2 : 0;
};

/** Hovedproduktet i et lag-sett: dagens voks / dagens klister / glideren. */
function hoved(lag: { rolle: string; produkt: string }[]) {
  return lag.find((l) => l.rolle === 'Dagens voks' || l.rolle === 'Dagens klister' || l.rolle === 'Glider')?.produkt;
}

/** Øverste lag som er voks eller klister (ikke binder/baseklister): det nye laget legges oppå dette. */
function topp(lag: { rolle: string; produkt: string }[]) {
  for (let i = lag.length - 1; i >= 0; i--) {
    if (lag[i].rolle === 'Binder' || lag[i].rolle === 'Baseklister') continue;
    if (produkt(lag[i].produkt)) return lag[i].produkt;
  }
  return undefined;
}

/** Skal skia renses, eller kan det bare legges nye topplag? [Forslag: reglene er enkle og skal justeres mot erfaring]. */
export function vurderPåfylling(forrige: Smøring | undefined, ny: Stabel, nå: number = Date.now()): Påfylling {
  if (!forrige) return { handling: 'ny', tittel: 'Ingen lagret smøring', grunner: ['Start på ren, slipt bunn og lagre smøringen etterpå, så husker appen den til neste gang.'] };

  const rens = (...grunner: string[]) => ({ handling: 'rens' as const, tittel: 'Rens skia først', grunner });
  if (forrige.type !== ny.type) {
    const navn: Record<Stabel['type'], string> = { hardvoks: 'hardvoks', klister: 'klister', glider: 'glider', felle: 'felle', rubb: 'rubb' };
    return rens(`Forrige smøring var ${navn[forrige.type]}, nå trengs ${navn[ny.type]}. De må ikke ligge oppå hverandre.`);
  }
  if (forrige.turer >= SKIPARK.maksTurerUtenRens) return rens(`${forrige.turer} turer uten rens: lagene har bygd seg opp og griper eller glir dårligere.`);
  const dager = Math.floor((nå - forrige.ts) / DAG);
  if (dager > SKIPARK.maksDager) return rens(`Smøringen er ${dager} dager gammel.`);

  const glider = ny.type === 'glider';
  const a = glider ? hoved(forrige.lag) : topp(forrige.lag);
  const b = hoved(ny.lag);
  if (glider && a && b && a !== b) {
    // Bytte av glider krever rens. Ligger det en glider på, er det slingringsmonn før den må byttes.
    const p = produkt(a);
    const t = ny.tSnitt;
    if (p && t !== undefined && t >= p.omr[0] - SKIPARK.glideMonn && t <= p.omr[1] + SKIPARK.glideMonn) {
      return {
        handling: 'topplag',
        behold: true,
        tittel: `Behold ${a}`,
        grunner: [`${a} ligger på og passer ${p.omr[0]} til ${p.omr[1]} °C. Snøen i dag (${t.toFixed(1)} °C) er innenfor slingringsmonnet (±${SKIPARK.glideMonn} °C). Å bytte glider krever rens, så ${b} trengs ikke.`, `${forrige.turer} tur${forrige.turer === 1 ? '' : 'er'} siden sist rens (maks ${SKIPARK.maksTurerUtenRens}).`],
      };
    }
    return rens(`Å bytte glider krever rens: ${a} ligger på, nå trengs ${b}${t !== undefined ? ` (snø ${t.toFixed(1)} °C, utenfor slingringsmonnet)` : ''}.`);
  }
  let dekke = false;
  if (!glider && a && b) {
    const diff = senter(a) - senter(b);
    if (diff > SKIPARK.maksKaldere) return rens(`Nå trengs ${b}, men ${a} ligger øverst og er ${diff.toFixed(0)} °C varmere. En kaldere voks fester seg dårlig oppå en varmere.`);
    dekke = diff > 0.5;
  }
  const likt = a === b;
  const tekster: Record<Stabel['type'], string> = {
    felle: 'Felleski har ingen smøring å lagre.',
    rubb: 'Rubbski har ingen smøring å lagre.',
    hardvoks: likt ? 'Samme dagsvoks ligger på: korke og legg 1–2 nye tynne lag.' : dekke ? `Litt kaldere enn ${a} som ligger øverst: legg ${b} bare som tynt dekke og kork lett.` : `Varmere enn øverste lag (${a}): legg ${b} og eventuelt dekke rett oppå.`,
    klister: likt ? 'Samme klister ligger på: smør ett nytt tykt lag over.' : dekke ? `Litt kaldere enn ${a} som ligger øverst: ett tynt lag ${b} kan gå, men sjekk at det fester.` : `Varmere enn øverste lag (${a}): ett nytt tykt lag ${b} rett oppå.`,
    glider: 'Samme glider ligger på: børst og legg ett tynt lag.',
  };
  const tekst = tekster[ny.type];
  return {
    handling: 'topplag',
    tittel: 'Bare topplag trengs',
    grunner: [tekst, `${forrige.turer} tur${forrige.turer === 1 ? '' : 'er'} siden sist rens (maks ${SKIPARK.maksTurerUtenRens}).`],
  };
}

/** Lagret smøring etter at stabelen er lagt på. */
export function lagreSmøring(stil: Stil, stabel: Stabel, forrige: Smøring | undefined, påfylling: Påfylling, nå: number = Date.now()): Smøring {
  if (påfylling.behold && forrige) return { ...forrige, ts: nå, turer: forrige.turer + 1 }; // glideren på skia beholdes
  return {
    stil,
    type: stabel.type,
    lag: stabel.lag.map((l) => ({ rolle: l.rolle, produkt: l.produkt })),
    ts: nå,
    turer: påfylling.handling === 'topplag' && forrige ? forrige.turer + 1 : 1,
  };
}

