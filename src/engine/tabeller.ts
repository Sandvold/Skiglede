// Swix-produkter med temperaturområde og fargekode.
// Områder: swixsport.com (kick wax- og klister-sidene, kontrollert 3. nov 2026) og Swix' klisterguide.
// Fargene er tilnærminger til etikettfargene (Swix navngir dem, f.eks. «Pro lys fiolett»), ikke eksakte NCS-verdier.
// Swix oppgir to områder for VP45, VP40, VP50, V40 og V45: nysnø (omr) og gammel snø (omrGammel). Resten har ett område (research nov 2026, swixsport.com og forhandlere).

export type MerkeId = 'swix' | 'toko' | 'rode' | 'skigo';

export type Produkt = {
  merke?: MerkeId; // standard: swix
  rolle?: 'binder'; // grunnvoks/binder (ingen temperaturområde)
  navn: string; // produktkode (unik på tvers av merker)
  farge: string; // Swix' fargenavn
  hex: string; // tilnærmet etikettfarge
  omr: [number, number]; // [kaldest, varmest] °C (nysnø/finkornet snø)
  omrGammel?: [number, number]; // Swix: eget område for gammel/omdannet snø (1–4 °C kaldere). Brukes automatisk når snøen er omdannet.
  linje: 'VP' | 'V' | 'K' | 'G'; // G = glider, K = klister, ellers hardvoks
  merknad?: string;
};

/** VP (Pro): rekkefølge fra kaldest til varmest. Brukes av regelmotoren. */
export const HARDVOKS: Produkt[] = [
  { navn: 'VP30', farge: 'Pro lyseblå', hex: '#8FC8F0', omr: [-16, -8], linje: 'VP' },
  { navn: 'VP40', farge: 'Pro blå', hex: '#2F6FD0', omr: [-10, -4], omrGammel: [-14, -5], linje: 'VP' },
  { navn: 'VP45', farge: 'Pro blå/fiolett', hex: '#5B63D6', omr: [-5, -1], omrGammel: [-8, -3], linje: 'VP' },
  { navn: 'VP50', farge: 'Pro lys fiolett', hex: '#B9A6E4', omr: [-3, 0], omrGammel: [-6, -1], linje: 'VP' },
  { navn: 'VP55', farge: 'Pro fiolett', hex: '#8A4FC0', omr: [-2, 1], linje: 'VP' },
  { navn: 'VP60', farge: 'Pro fiolett/rød', hex: '#B54A8E', omr: [-1, 2], linje: 'VP' },
  { navn: 'VP65', farge: 'Pro svart/rød', hex: '#6B2E3E', omr: [0, 2], linje: 'VP' },
  { navn: 'VP70', farge: 'Pro gul', hex: '#F2CF3A', omr: [0, 3], linje: 'VP' },
];

/** V-linja (Hardwax): vises i oversikten, brukes ikke av motoren ennå. */
export const V_LINJE: Produkt[] = [
  { navn: 'V05', farge: 'Polar', hex: '#DCEBF7', omr: [-25, -12], linje: 'V' },
  { navn: 'V20', farge: 'Grønn', hex: '#3DA35D', omr: [-15, -8], linje: 'V' },
  { navn: 'V30', farge: 'Blå', hex: '#3A7FDB', omr: [-10, -2], linje: 'V' },
  { navn: 'V40', farge: 'Blå Extra', hex: '#1F4FB5', omr: [-7, -1], omrGammel: [-10, -3], linje: 'V' },
  { navn: 'V45', farge: 'Fiolett Special', hex: '#7A3FB0', omr: [-3, 0], omrGammel: [-6, -2], linje: 'V' },
  { navn: 'V50', farge: 'Fiolett', hex: '#9B63CF', omr: [0, 0], linje: 'V' },
  { navn: 'V55', farge: 'Rød Special', hex: '#D0383A', omr: [0, 1], linje: 'V' },
  { navn: 'V60', farge: 'Rød/sølv', hex: '#C9A9A9', omr: [0, 3], linje: 'V' },
];

/** Binder (ingen temperaturområde, legges under dagens voks). */
export const BINDER: Produkt[] = [
  { navn: 'VG30', farge: 'Basevoks blå', hex: '#4E8FDB', omr: [0, 0], linje: 'V', rolle: 'binder', merknad: 'Bindervoks for mild snø' },
  { navn: 'VG35', farge: 'Bindervoks grønn', hex: '#3DA35D', omr: [0, 0], linje: 'V', rolle: 'binder', merknad: 'Binder for skarp/omdannet snø og lange turer' },
];

/** Klister: rekkefølge fra kaldest til varmest (senter). Brukes av regelmotoren. */
export const KLISTER: Produkt[] = [
  { navn: 'KX30', farge: 'Blå is', hex: '#3A78D6', omr: [-12, 0], linje: 'K', merknad: 'Isklister, for hard og isete bane' },
  { navn: 'KX35N', farge: 'Blå Extra', hex: '#1F4FB5', omr: [-8, 0], linje: 'K', merknad: 'Mellomlag på kald/hard bane (eldre KX35: +1/−4)' },
  { navn: 'KX45N', farge: 'Fiolett Special', hex: '#7A3FB0', omr: [-4, 1], linje: 'K', merknad: 'Mellomlag og allround' },
  { navn: 'KX40S', farge: 'Sølv', hex: '#B6BEC8', omr: [-4, 2], linje: 'K' },
  { navn: 'KX65', farge: 'Rød', hex: '#D6403A', omr: [1, 5], linje: 'K' },
  { navn: 'KX75', farge: 'Rød Extra Wet', hex: '#A81C1C', omr: [2, 15], linje: 'K', merknad: 'Våt snø og slaps' },
];

/** Øvrige klistere, bare til oversikten. */
export const KLISTER_ANDRE: Produkt[] = [
  { navn: 'KN33', farge: 'Nero', hex: '#4A4A4F', omr: [-7, 1], linje: 'K' },
  { navn: 'KX55', farge: 'Fiolett Extra', hex: '#8E5BC9', omr: [-6, 4], linje: 'K' },
  { navn: 'K21S', farge: 'Universal sølv', hex: '#C8CDD3', omr: [-5, 3], linje: 'K' },
  { navn: 'K22', farge: 'Universal VM', hex: '#D9B84A', omr: [-3, 10], linje: 'K' },
  { navn: 'KN44', farge: 'Nero', hex: '#5A5A60', omr: [-3, 5], linje: 'K', merknad: 'Racingklister for skiftende føre: tar mindre skitt og ising enn vanlige klistere og holder seg i festesonen (swixsport.com, −3…+5 °C). Ligner KN45 [Bruker]' },
];

/** Glidevoks (Swix HS, hydrokarbon uten fluor). Områder fra swixsport.com-produktsidene (HS10 0…+10, HS8 −4…+4, HS7 −8…−2, HS6 −12…−6, HS5 −18…−10). Kaldest først. */
export const GLIDER: Produkt[] = [
  { navn: 'HS5', farge: 'Turkis', hex: '#1FB5B0', omr: [-18, -10], linje: 'G' },
  { navn: 'HS6', farge: 'Blå', hex: '#2F6FD0', omr: [-12, -6], linje: 'G' },
  { navn: 'HS7', farge: 'Fiolett', hex: '#7A3FB0', omr: [-8, -2], linje: 'G' },
  { navn: 'HS8', farge: 'Rød', hex: '#D6403A', omr: [-4, 4], linje: 'G' },
  { navn: 'HS10', farge: 'Gul', hex: '#F2CF3A', omr: [0, 10], linje: 'G' },
];

export const BASEKLISTER: Produkt = { navn: 'KB20C', farge: 'Grønn base (spray)', hex: '#3DA35D', omr: [0, 0], linje: 'K', merknad: 'Baseklister, svært tynt' };

// ---------------------------------------------------------------------------------------------
// Øvrige merker. Hentet 3. nov 2026 fra produsentenes egne sider (Toko, Ski-Go-katalogen) og fra forhandleroversikter
// (Rode: skiwax.ca). Temperaturområdene er snøtemperatur slik produsent/forhandler oppgir dem, og er IKKE kontrollert mot
// etikett på boksen. Sjekk mot etiketten før smøresesongen. Bare fluorfrie produkter er med (fluor er forbudt i konkurranse).
// ---------------------------------------------------------------------------------------------
const T = (navn: string, farge: string, hex: string, omr: [number, number], linje: Produkt['linje'], merknad?: string, rolle?: 'binder'): Produkt => ({ merke: 'toko', navn, farge, hex, omr, linje, merknad, rolle });
const R = (navn: string, farge: string, hex: string, omr: [number, number], linje: Produkt['linje'], merknad?: string, rolle?: 'binder'): Produkt => ({ merke: 'rode', navn, farge, hex, omr, linje, merknad, rolle });
const S = (navn: string, farge: string, hex: string, omr: [number, number], linje: Produkt['linje'], merknad?: string, rolle?: 'binder'): Produkt => ({ merke: 'skigo', navn, farge, hex, omr, linje, merknad, rolle });

// Toko Nordic (toko.ch). Hardvoks X-Cold −30…−12, blå −30…−7, rød −10…−2, gul −2…0. Klister blå −30…−7, rød −8…−1, gul −2…0.
export const TOKO_HARDVOKS: Produkt[] = [
  T('Toko X-Cold', 'GripWax X-Cold', '#9FD0F0', [-30, -12], 'V'),
  T('Toko Blå', 'GripWax blå', '#2F6FD0', [-30, -7], 'V'),
  T('Toko Rød', 'GripWax rød', '#D6403A', [-10, -2], 'V'),
  T('Toko Gul', 'GripWax gul', '#F2CF3A', [-2, 0], 'V', 'Varmeste hardvoks fra Toko. Over 0 °C brukes klister'),
];
export const TOKO_BINDER = T('Toko Base grønn', 'Nordic Base Wax grønn', '#3DA35D', [0, 0], 'V', 'Grunnvoks/binder, −30…0 °C', 'binder');
export const TOKO_KLISTER: Produkt[] = [
  T('Toko Klister blå', 'Klister blå', '#2F6FD0', [-30, -7], 'K', 'Isete snø i kulde'),
  T('Toko Klister rød', 'Klister rød', '#D6403A', [-8, -1], 'K', 'Universal for midt i temperaturområdet'),
  T('Toko Klister gul', 'Klister gul', '#F2CF3A', [-2, 0], 'K', 'Våt snø nær 0 °C'),
];
export const TOKO_BASEKLISTER = T('Toko Base klister grønn', 'Base klister grønn', '#3DA35D', [0, 0], 'K', 'Baseklister (binder) under andre klistere, −30…0 °C');
export const TOKO_UNIVERSAL = T('Toko Universal klisterspray', 'KlisterSpray Universal', '#C8CDD3', [-30, 0], 'K', 'Spray, enkel å bruke ved skiftende føre');
// Performance (fluorfri, hot wax). Områder fra skimo.co og sport-conrad.com
export const TOKO_GLIDER: Produkt[] = [
  T('Toko Performance blå', 'Performance blå', '#2F6FD0', [-19, -10], 'G'),
  T('Toko Performance rød', 'Performance rød', '#D6403A', [-12, -4], 'G'),
  T('Toko Performance gul', 'Performance gul', '#F2CF3A', [-6, 0], 'G'),
];

// Rode (skiwax.ca, produktsider R-serien). P-serien er hardvoks, K-serien klister, R-serien fluorfri glider.
export const RODE_HARDVOKS: Produkt[] = [
  R('Rode P20', 'Grønn (P20)', '#3DA35D', [-15, -4], 'V'),
  R('Rode P36', 'Blå Special Multigrade (P36)', '#2F6FD0', [-12, -3], 'V'),
  R('Rode P28', 'Blå Super Weiss (P28)', '#8FC8F0', [-7, -1], 'V'),
  R('Rode P40', 'Viola (P40)', '#8A4FC0', [-4, 0], 'V'),
  R('Rode P50', 'Rossa (P50)', '#D6403A', [0, 3], 'V'),
];
export const RODE_ANDRE: Produkt[] = [
  R('Rode P32', 'Blå Super (P32)', '#3A7FDB', [-10, -1], 'V'),
  R('Rode P38', 'Blå Super Extra (P38)', '#1F4FB5', [-10, -1], 'V'),
  R('Rode P46', 'Viola Special Multigrade (P46)', '#9B63CF', [-5, 0], 'V'),
  R('Rode K46', 'Rossa Special klister (K46)', '#A81C1C', [0, 3], 'K'),
];
export const RODE_KLISTER: Produkt[] = [
  R('Rode K20', 'Blå klister (K20)', '#2F6FD0', [-7, -3], 'K'),
  R('Rode K36', 'Violet Special klister (K36)', '#7A3FB0', [-5, -1], 'K'),
  R('Rode K30', 'Violet klister (K30)', '#8A4FC0', [-3, 1], 'K'),
  R('Rode K40', 'Rossa klister (K40)', '#D6403A', [-2, 4], 'K'),
  R('Rode K52', 'Silver Extra klister (K52)', '#B6BEC8', [0, 4], 'K'),
];
export const RODE_BASEKLISTER = R('Rode K90', 'Chola binderklister (K90)', '#6B4E2E', [0, 0], 'K', 'Binder under andre klistere');
export const RODE_UNIVERSAL = R('Rode K76', 'Multigrade klister (K76)', '#D9B84A', [-6, 6], 'K', 'Universal ved skiftende føre');
export const RODE_GLIDER: Produkt[] = [
  R('Rode R20', 'R20 blå', '#2F6FD0', [-18, -8], 'G'),
  R('Rode R30', 'R30 fiolett', '#7A3FB0', [-10, -3], 'G'),
  R('Rode R40', 'R40 rød', '#D6403A', [-5, 0], 'G'),
  R('Rode R50', 'R50 gul', '#F2CF3A', [-1, 10], 'G'),
];

// Ski-Go (Ski-Go-katalogen, nordicx.com, skiwax.ca). XC-linja er fluorfri.
export const SKIGO_HARDVOKS: Produkt[] = [
  S('Skigo XC grønn', 'XC kickwax grønn', '#3DA35D', [-20, -7], 'V'),
  S('Skigo XC blå', 'XC kickwax blå', '#2F6FD0', [-10, -3], 'V'),
  S('Skigo XC fiolett', 'XC kickwax fiolett', '#8A4FC0', [-9, -1], 'V'),
  S('Skigo XC rød', 'XC kickwax rød', '#D6403A', [-2, 0], 'V'),
  S('Skigo XC oransje', 'XC kickwax oransje', '#F08A2E', [-2, 3], 'V'),
  S('Skigo XC gul', 'XC kickwax gul', '#F2CF3A', [-1, 5], 'V'),
];
export const SKIGO_BINDER = S('Skigo XC Base', 'XC kickwax base', '#3DA35D', [0, 0], 'V', 'Binder, temperaturområde er ikke oppgitt', 'binder');
export const SKIGO_KLISTER: Produkt[] = [
  S('Skigo XC klister blå', 'XC klister blå', '#2F6FD0', [-10, -2], 'K'),
  S('Skigo XC klister fiolett', 'XC klister fiolett', '#8A4FC0', [-4, 3], 'K'),
  S('Skigo XC klister sølv', 'XC klister sølv', '#B6BEC8', [-1, 3], 'K'),
  S('Skigo XC klister rød', 'XC klister rød', '#D6403A', [1, 5], 'K'),
  S('Skigo XC klister oransje', 'XC klister oransje', '#F08A2E', [3, 10], 'K'),
];
export const SKIGO_UNIVERSAL = S('Skigo XC klister universal', 'XC klister universal', '#D9B84A', [-4, 3], 'K', 'Universal ved skiftende føre');
// Glider XC (paraffin, fluorfri). Fiolett og grønn XC-glider mangler oppgitt område og er ikke med.
export const SKIGO_GLIDER: Produkt[] = [
  S('Skigo XC glider blå', 'XC glider blå', '#2F6FD0', [-13, -3], 'G', 'Produktsiden oppgir både −3…−13 og −3…−10 °C'),
  S('Skigo XC glider rød', 'XC glider rød', '#D6403A', [-5, -1], 'G'),
  S('Skigo XC glider gul', 'XC glider gul', '#F2CF3A', [-1, 20], 'G'),
];

/** Et merkes smøresystem: produktlistene regelmotoren bruker, og hvilke produkter som fyller hvilke roller. Mangler en rolle, hopper motoren over det laget. */
export type Smøresystem = {
  id: MerkeId;
  navn: string;
  /** Kaldest først */
  hardvoks: Produkt[];
  /** Kaldest først */
  klister: Produkt[];
  /** Kaldest først */
  glider: Produkt[];
  binder?: { mild: Produkt; skarp: Produkt };
  baseKlister?: Produkt;
  /** [Bruker] Blå extra-voksen som mellomlag under varmere dagsvoks, i prioritert rekkefølge (første du har brukes). Mangler merket en slik, brukes nærmeste kaldere hardvoks som mellomlag. */
  blåExtra?: Produkt[];
  isKlister?: Produkt;
  universalVarm?: Produkt;
  universalKald?: Produkt;
  sluddKald?: Produkt;
  sluddVarm?: Produkt;
  /** [Bruker] Har du KN44 (Nero) i lageret, brukes den ved skiftende vær i stedet for universalklister: den iser mindre og tåler varierende vær bedre. Settes av systemFraLager. */
  foretrekkNero?: boolean;
  /** Navn på klister brukt som mellomlag (kald, mild). Mangler i lista = ingen mellomlag */
  mellomKlister?: [string, string];
  /** Klister som brukes som ett tykt lag alene, uten mellomlag */
  utenMellomlag: string[];
  ising: string;
  kilde: string;
  /** Områdene som vises i temperaturoversikten */
  oversikt: { tittel: string; liste: Produkt[] }[];
};

export const SWIX: Smøresystem = {
  id: 'swix', navn: 'Swix',
  hardvoks: [V_LINJE[0], ...HARDVOKS], // V05 Polar som kaldeste (under −16 °C)
  klister: KLISTER, glider: GLIDER,
  binder: { mild: BINDER[0], skarp: BINDER[1] },
  baseKlister: BASEKLISTER, isKlister: KLISTER[0],
  blåExtra: [HARDVOKS.find((p) => p.navn === 'VP45')!, V_LINJE.find((p) => p.navn === 'V40')!],
  universalVarm: KLISTER_ANDRE[3], universalKald: KLISTER_ANDRE[2],
  sluddKald: KLISTER_ANDRE[0], sluddVarm: KLISTER_ANDRE[4],
  mellomKlister: ['KX35N', 'KX45N'], utenMellomlag: ['KX45N', 'KX35N'],
  ising: 'Minst tre tynne lag hardvoks over klisteren (Swix: VP40–VP55, litt hardere enn temperaturen tilsier).',
  kilde: 'swixsport.com, kontrollert 3. nov 2026.',
  oversikt: [
    { tittel: 'Hardvoks VP (Pro)', liste: HARDVOKS },
    { tittel: 'Hardvoks V', liste: V_LINJE },
    { tittel: 'Binder og baseklister', liste: [...BINDER, BASEKLISTER] },
    { tittel: 'Klister', liste: KLISTER },
    { tittel: 'Andre klistere', liste: KLISTER_ANDRE },
    { tittel: 'Glidevoks (skøyting)', liste: GLIDER },
  ],
};

export const TOKO: Smøresystem = {
  id: 'toko', navn: 'Toko',
  hardvoks: TOKO_HARDVOKS, klister: TOKO_KLISTER, glider: TOKO_GLIDER,
  binder: { mild: TOKO_BINDER, skarp: TOKO_BINDER },
  baseKlister: TOKO_BASEKLISTER, isKlister: TOKO_KLISTER[0],
  universalVarm: TOKO_UNIVERSAL, universalKald: TOKO_UNIVERSAL,
  utenMellomlag: [],
  ising: 'Minst tre tynne lag hardvoks over klisteren, litt hardere enn temperaturen tilsier.',
  kilde: 'toko.ch og forhandlere, hentet 3. nov 2026. Ikke kontrollert mot etikett.',
  oversikt: [
    { tittel: 'Hardvoks (GripWax)', liste: [...TOKO_HARDVOKS, TOKO_BINDER] },
    { tittel: 'Klister', liste: [...TOKO_KLISTER, TOKO_BASEKLISTER, TOKO_UNIVERSAL] },
    { tittel: 'Glidevoks Performance (fluorfri)', liste: TOKO_GLIDER },
  ],
};

export const RODE: Smøresystem = {
  id: 'rode', navn: 'Rode',
  hardvoks: RODE_HARDVOKS, klister: RODE_KLISTER, glider: RODE_GLIDER,
  baseKlister: RODE_BASEKLISTER,
  blåExtra: [RODE_ANDRE.find((p) => p.navn === 'Rode P38')!], // Blå Super Extra (P38)
  universalVarm: RODE_UNIVERSAL, universalKald: RODE_UNIVERSAL,
  utenMellomlag: [],
  ising: 'Minst tre tynne lag hardvoks over klisteren, litt hardere enn temperaturen tilsier.',
  kilde: 'skiwax.ca (Rode-oversikt og produktsider), hentet 3. nov 2026. Ikke kontrollert mot etikett.',
  oversikt: [
    { tittel: 'Hardvoks (P-serien)', liste: [...RODE_HARDVOKS, ...RODE_ANDRE.filter((p) => p.linje === 'V')] },
    { tittel: 'Klister (K-serien)', liste: [...RODE_KLISTER, ...RODE_ANDRE.filter((p) => p.linje === 'K'), RODE_BASEKLISTER, RODE_UNIVERSAL] },
    { tittel: 'Glidevoks R-serien (fluorfri)', liste: RODE_GLIDER },
  ],
};

export const SKIGO: Smøresystem = {
  id: 'skigo', navn: 'Ski Go',
  hardvoks: SKIGO_HARDVOKS, klister: SKIGO_KLISTER, glider: SKIGO_GLIDER,
  binder: { mild: SKIGO_BINDER, skarp: SKIGO_BINDER },
  universalVarm: SKIGO_UNIVERSAL, universalKald: SKIGO_UNIVERSAL,
  utenMellomlag: [],
  ising: 'Minst tre tynne lag hardvoks over klisteren, litt hardere enn temperaturen tilsier.',
  kilde: 'Ski-Go-katalogen (skigo.se), nordicx.com og skiwax.ca, hentet 3. nov 2026. Ikke kontrollert mot etikett.',
  oversikt: [
    { tittel: 'Hardvoks (XC kickwax)', liste: [...SKIGO_HARDVOKS, SKIGO_BINDER] },
    { tittel: 'Klister (XC)', liste: [...SKIGO_KLISTER, SKIGO_UNIVERSAL] },
    { tittel: 'Glidevoks XC (fluorfri)', liste: SKIGO_GLIDER },
  ],
};

export const SYSTEMER: Record<MerkeId, Smøresystem> = { swix: SWIX, toko: TOKO, rode: RODE, skigo: SKIGO };
export const MERKE_IDER = Object.keys(SYSTEMER) as MerkeId[];
export const merkeAv = (p: Produkt): MerkeId => p.merke ?? 'swix';

const SWIX_ALLE: Produkt[] = [...HARDVOKS, ...V_LINJE, ...BINDER, ...KLISTER, ...KLISTER_ANDRE, BASEKLISTER, ...GLIDER];
/** Alle produkter på tvers av merker. Navnene er unike. */
export const ALLE_PRODUKTER: Produkt[] = [
  ...SWIX_ALLE,
  ...Object.values(SYSTEMER).filter((s) => s.id !== 'swix').flatMap((s) => s.oversikt.flatMap((g) => g.liste)),
  ...RODE_ANDRE.filter((p) => !Object.values(SYSTEMER).some((s) => s.oversikt.some((g) => g.liste.includes(p)))),
];
export const produkt = (navn: string) => ALLE_PRODUKTER.find((p) => p.navn === navn);
/** Produkter for ett merke (til lagerlisten) */
export const produkterFor = (id: MerkeId) => ALLE_PRODUKTER.filter((p) => merkeAv(p) === id);

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

/** Hardvokslisten med riktig område for snøen: gammel/omdannet snø bruker `omrGammel` der Swix oppgir det. */
export const hardvoksForSnø = (sys: Smøresystem, omdannet: boolean): Produkt[] => (omdannet ? sys.hardvoks.map((p) => (p.omrGammel ? { ...p, omr: p.omrGammel } : p)) : sys.hardvoks);
export const hardvoksFor = (t: number, sys: Smøresystem = SWIX) => nærmeste(sys.hardvoks, t);
export const klisterFor = (t: number, sys: Smøresystem = SWIX) => nærmeste(sys.klister, t);

/**
 * Glider for en snøtemperatur. Glidere overlapper; da velges den kaldeste som passer («heller hakket kaldt enn varmt») [Bruker].
 * Utenfor området brukes ytterkantene.
 */
export function glideFor(t: number, sys: Smøresystem = SWIX): Produkt {
  const G = sys.glider;
  const passer = G.filter((g) => t >= g.omr[0] && t <= g.omr[1]);
  if (passer.length) return passer.reduce((a, b) => (senter(a.omr) <= senter(b.omr) ? a : b));
  return t < G[0].omr[0] ? G[0] : G[G.length - 1];
}

export type Kategori = 'hard' | 'binder' | 'klister' | 'glid';
export function kategori(p: Produkt): Kategori {
  if (p.linje === 'G') return 'glid';
  if (p.linje === 'K') return 'klister';
  return p.rolle === 'binder' ? 'binder' : 'hard';
}
