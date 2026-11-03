// Swix-produkter med temperaturområde og fargekode.
// Områder: swixsport.com (kick wax- og klister-sidene, kontrollert 3. nov 2026) og Swix' klisterguide.
// Fargene er tilnærminger til etikettfargene (Swix navngir dem, f.eks. «Pro Light Violet»), ikke eksakte NCS-verdier.
// Swix oppgir ett område per voks. Eventuell egen kolonne for omdannet snø er ikke verifisert og brukes ikke.

export type Produkt = {
  navn: string; // produktkode
  farge: string; // Swix' fargenavn
  hex: string; // tilnærmet etikettfarge
  omr: [number, number]; // [kaldest, varmest] °C
  linje: 'VP' | 'V' | 'K';
  merknad?: string;
};

/** VP (Pro): rekkefølge fra kaldest til varmest. Brukes av regelmotoren. */
export const HARDVOKS: Produkt[] = [
  { navn: 'VP30', farge: 'Pro Light Blue', hex: '#8FC8F0', omr: [-16, -8], linje: 'VP' },
  { navn: 'VP40', farge: 'Pro Blue', hex: '#2F6FD0', omr: [-10, -4], linje: 'VP' },
  { navn: 'VP45', farge: 'Pro Blue/Violet', hex: '#5B63D6', omr: [-5, -1], linje: 'VP' },
  { navn: 'VP50', farge: 'Pro Light Violet', hex: '#B9A6E4', omr: [-3, 0], linje: 'VP' },
  { navn: 'VP55', farge: 'Pro Violet', hex: '#8A4FC0', omr: [-2, 1], linje: 'VP' },
  { navn: 'VP60', farge: 'Pro Violet/Red', hex: '#B54A8E', omr: [-1, 2], linje: 'VP' },
  { navn: 'VP65', farge: 'Pro Black/Red', hex: '#6B2E3E', omr: [0, 2], linje: 'VP' },
  { navn: 'VP70', farge: 'Pro Yellow', hex: '#F2CF3A', omr: [0, 3], linje: 'VP' },
];

/** V-linja (Hardwax): vises i oversikten, brukes ikke av motoren ennå. */
export const V_LINJE: Produkt[] = [
  { navn: 'V05', farge: 'Polar', hex: '#DCEBF7', omr: [-25, -12], linje: 'V' },
  { navn: 'V20', farge: 'Green', hex: '#3DA35D', omr: [-15, -8], linje: 'V' },
  { navn: 'V30', farge: 'Blue', hex: '#3A7FDB', omr: [-10, -2], linje: 'V' },
  { navn: 'V40', farge: 'Blue Extra', hex: '#1F4FB5', omr: [-7, -1], linje: 'V' },
  { navn: 'V45', farge: 'Violet Special', hex: '#7A3FB0', omr: [-3, 0], linje: 'V' },
  { navn: 'V50', farge: 'Violet', hex: '#9B63CF', omr: [0, 0], linje: 'V' },
  { navn: 'V55', farge: 'Red Special', hex: '#D0383A', omr: [0, 1], linje: 'V' },
  { navn: 'V60', farge: 'Red/Silver', hex: '#C9A9A9', omr: [0, 3], linje: 'V' },
];

/** Binder (ingen temperaturområde, legges under dagens voks). */
export const BINDER: Produkt[] = [
  { navn: 'VG30', farge: 'Base Wax Blue', hex: '#4E8FDB', omr: [0, 0], linje: 'V', merknad: 'Bindervoks for mild snø' },
  { navn: 'VG35', farge: 'Base Binder Green', hex: '#3DA35D', omr: [0, 0], linje: 'V', merknad: 'Binder for skarp/omdannet snø og lange turer' },
];

/** Klister: rekkefølge fra kaldest til varmest (senter). Brukes av regelmotoren. */
export const KLISTER: Produkt[] = [
  { navn: 'KX30', farge: 'Blue Ice', hex: '#3A78D6', omr: [-12, 0], linje: 'K', merknad: 'Isklister, for hard og isete bane' },
  { navn: 'KX35N', farge: 'Blue Extra', hex: '#1F4FB5', omr: [-8, 0], linje: 'K', merknad: 'Mellomlag på kald/hard bane (eldre KX35: +1/−4)' },
  { navn: 'KX45N', farge: 'Violet Special', hex: '#7A3FB0', omr: [-4, 1], linje: 'K', merknad: 'Mellomlag og allround' },
  { navn: 'KX40S', farge: 'Silver', hex: '#B6BEC8', omr: [-4, 2], linje: 'K' },
  { navn: 'KX65', farge: 'Red', hex: '#D6403A', omr: [1, 5], linje: 'K' },
  { navn: 'KX75', farge: 'Red Extra Wet', hex: '#A81C1C', omr: [2, 15], linje: 'K', merknad: 'Våt snø og slaps' },
];

/** Øvrige klistere, bare til oversikten. */
export const KLISTER_ANDRE: Produkt[] = [
  { navn: 'KN33', farge: 'Nero', hex: '#4A4A4F', omr: [-7, 1], linje: 'K' },
  { navn: 'KX55', farge: 'Violet Extra', hex: '#8E5BC9', omr: [-6, 4], linje: 'K' },
  { navn: 'K21S', farge: 'Universal Silver', hex: '#C8CDD3', omr: [-5, 3], linje: 'K' },
  { navn: 'K22', farge: 'Universal VM', hex: '#D9B84A', omr: [-3, 10], linje: 'K' },
  { navn: 'KN44', farge: 'Nero', hex: '#5A5A60', omr: [-3, 5], linje: 'K' },
];

export const BASEKLISTER: Produkt = { navn: 'KB20C', farge: 'Green Base (spray)', hex: '#3DA35D', omr: [0, 0], linje: 'K', merknad: 'Baseklister, svært tynt' };

export const ALLE_PRODUKTER: Produkt[] = [...HARDVOKS, ...V_LINJE, ...BINDER, ...KLISTER, ...KLISTER_ANDRE, BASEKLISTER];
export const produkt = (navn: string) => ALLE_PRODUKTER.find((p) => p.navn === navn);

const senter = (r: [number, number]) => (r[0] + r[1]) / 2;

function nærmeste(liste: Produkt[], t: number): number {
  let best = 0;
  let bestD = Infinity;
  liste.forEach((v, i) => {
    const inni = t >= v.omr[0] && t <= v.omr[1];
    const d = Math.abs(t - senter(v.omr)) + (inni ? 0 : 100);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export const hardvoksFor = (t: number) => nærmeste(HARDVOKS, t);
export const klisterFor = (t: number) => nærmeste(KLISTER, t);
