import type { Stil } from '@/engine';

// Vanlige langrennsski fra mellomklasse til premium/konkurranse, til forslag når man legger inn ski. Ikke en komplett katalog:
// bare de mest brukte modellene, og få varianter av hver serie. Skriv egne navn hvis modellen din mangler.
// Kilde: xc-ski.de-testen 26/27 (kategoriene Race/Performance/Sport) pluss vanlige modeller fra produsentene. Stil er klassisk (voks/klister),
// felleski (Skin/Crown/R-Skin/Skintec/eSKIN) eller skøyting. Modellåret er ikke med, og noen modeller kan ha skiftet navn eller utgått.
export type SkiModell = { merke: string; modell: string; stil: Stil };

const m = (merke: string, stil: Stil, ...modeller: string[]): SkiModell[] => modeller.map((modell) => ({ merke, modell, stil }));

export const SKIMODELLER: SkiModell[] = [
  // Fischer
  ...m('Fischer', 'skoyting', 'Speedmax 100 HE Skate Plus', 'Speedmax 80 Skate Plus', 'Speedpro 70 Skate', 'Carbonlite Skate Plus', 'RCS Skate'),
  ...m('Fischer', 'felle', 'Twin Skin Speedmax 90', 'Twin Skin Speedmax 80', 'Twin Skin Pro', 'Sport Crown EF'),
  ...m('Fischer', 'klassisk', 'Speedmax Classic Plus', 'Carbonlite Classic Plus', 'RCS Classic'),
  // Madshus
  ...m('Madshus', 'skoyting', 'Redline 3.0 Skate', 'Race Pro Skate', 'Race Speed Skate', 'Nanosonic Carbon Skate'),
  ...m('Madshus', 'felle', 'Race Pro Skin', 'Race Speed Skin', 'Redline 3.0 Skin'),
  ...m('Madshus', 'klassisk', 'Redline 3.0 Classic', 'Nanosonic Carbon Classic'),
  // Rossignol
  ...m('Rossignol', 'skoyting', 'X-IUM Skating WCS+', 'X-IUM Skating Premium+ SX', 'X-IUM Skating', 'Delta Comp Skating', 'Delta Sport Skating'),
  ...m('Rossignol', 'felle', 'X-IUM Premium+ R-Skin', 'X-IUM R-Skin', 'Delta Comp R-Skin', 'Delta Sport R-Skin'),
  ...m('Rossignol', 'klassisk', 'X-IUM Premium+ Classic', 'Delta Comp Classic'),
  // Atomic
  ...m('Atomic', 'skoyting', 'Redster S9 Carbon', 'Redster S9', 'Redster S7', 'Redster S5'),
  ...m('Atomic', 'felle', 'Redster C9 Skintec', 'Redster C8 Skintec', 'Redster C5 Skintec'),
  ...m('Atomic', 'klassisk', 'Redster C9 Carbon Classic'),
  // Salomon
  ...m('Salomon', 'skoyting', 'S/Lab Equipe SK Uni Warm', 'Equipe Pro SK', 'RS 10'),
  ...m('Salomon', 'felle', 'S/Race eSkin Soft', 'RC10 eSkin Soft', 'Equipe Pro Skin Soft'),
  ...m('Salomon', 'klassisk', 'S/Lab Equipe Classic'),
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9æøå]+/g, ' ').trim();

/** Forslag mens man skriver: alle ordene man har skrevet må finnes i «Merke Modell» (rekkefølge og skilletegn spiller ingen rolle). */
export function foreslåSki(tekst: string, maks = 6): { navn: string; stil: Stil }[] {
  const ord = norm(tekst).split(' ').filter(Boolean);
  if (!ord.length) return [];
  return SKIMODELLER.map((x) => ({ navn: `${x.merke} ${x.modell}`, stil: x.stil }))
    .filter((x) => {
      const n = norm(x.navn);
      const ordN = n.split(' ');
      // hvert skrevne ord må være begynnelsen av et ord i navnet
      return ord.every((o) => ordN.some((w) => w.startsWith(o)));
    })
    .filter((x) => norm(x.navn) !== norm(tekst))
    .slice(0, maks);
}
