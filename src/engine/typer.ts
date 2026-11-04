export type Vær = {
  ts: number; // ms siden epoch (UTC)
  temp: number; // °C i 1 km-cellen (referansehøyde)
  nedbor: number; // mm/time
  rh: number; // 0-1
  vind: number; // m/s
  sw: number; // J/m² per time (kortbølget innstråling)
};

/** [lon, lat, høyde m, avstand m, skog 0/1] */
export type Punkt = [number, number, number, number, number];

export type Seksjon = {
  seq: number;
  startM: number;
  endM: number;
  h0: number;
  h1: number;
  hMid: number;
  skog: number; // 0-1
  stigning: number; // grader
};

export type SnøType = 'ny' | 'omdannet';

export type DagsRad = { dato: string; maks: number; natt: number | null; syklus: number };

/** Sist kjente snøstatus, lagres av appen så skorpa huskes etter at beviset er eldre enn værvinduet. */
export type SnøStatus = { type: SnøType; skarphet: number; /** tidspunkt (ms) statusen sist ble bekreftet */ ts: number };

export type SnøAnalyse = {
  status: SnøStatus;
  type: SnøType;
  skarphet: number; // 0-100
  sykluser: number; // vektet sum
  snøfall48: number; // mm (nedbør ved <= 0,5 °C)
  nysnøOppå: number; // mm snø (≈ cm) som ligger oppå den nyeste skorpa; 1 mm nedbør ≈ 1 cm nysnø
  regn7: number; // mm (nedbør ved > 0,5 °C)
  snittTemp7: number;
  dager: DagsRad[];
  forklaring: string[];
  advarsler: string[];
};

export type SeksjonVær = {
  seq: number;
  tid: number;
  tLuft: number;
  tEff: number;
  sw: number; // W/m²
  sol: number; // eksponering for sol: 1 = åpent og flatt, lavere med skog/skygge, opptil 2 mot sør
  skygge: boolean; // direkte sol blokkert av terrenget
};

export type Tur = {
  startTs: number;
  sluttTs: number;
  tempoKmt: number;
  seksjoner: SeksjonVær[];
  /** Kaldeste/varmeste snøtemperatur langs løypa: 5./95. persentil etter lengde, så korte partier ikke avgjør. */
  tMin: number;
  tMaks: number;
  /** Absolutt kaldeste/varmeste bit (250 m), kun til visning. */
  tMinRå: number;
  tMaksRå: number;
  /** Andel av løypa (0–1) som ligger i terrengskygge når den gås. */
  skyggeAndel: number;
  /** true når skyggen var under 10 % av løypa og derfor ikke er regnet med i temperaturene. */
  skyggeIgnorert: boolean;
  /** Største temperaturutslag i lufta fra 3 t før til 3 t etter turen (°C). Stort = skiftende vær. */
  variasjon: number;
  /** Laveste lufttemperatur fra 3 t før til 3 t etter turen (°C). */
  luftMin: number;
  /** Nedbør i grenseland (−1…+3,5 °C) rundt turen: sludd eller bløt snø. */
  sludd: boolean;
};

export type Lag = { rolle: string; produkt: string; antall: string; merknad?: string };

export type Stabel = {
  type: 'hardvoks' | 'klister' | 'glider' | 'felle' | 'rubb';
  lag: Lag[]; // nederst først
  begrunnelse: string[];
  advarsler: string[];
  /** false når skityper ikke passer føret (rubb). Da ligger anbefalt alternativ i `alternativ`. */
  egnet?: boolean;
  alternativ?: Stabel;
  /** Tilsvarende dagens smøring med andre merker du har i lageret, f.eks. «Toko: Toko Rød». */
  alternativer?: string[];
  /** Snøtemperatur (snitt langs turen), brukt til å vurdere om en glider som allerede ligger på kan beholdes. */
  tSnitt?: number;
};

/** Type ski: klassisk (voks/klister), felleski, rubbski (smørefri med oppbørstet festesone) eller skøyting. */
export type Stil = 'klassisk' | 'felle' | 'rubb' | 'skoyting';
