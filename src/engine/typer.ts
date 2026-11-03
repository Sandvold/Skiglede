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

export type SnøAnalyse = {
  type: SnøType;
  skarphet: number; // 0-100
  sykluser: number; // vektet sum
  snøfall48: number; // mm (nedbør ved <= 0,5 °C)
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
  tMin: number;
  tMaks: number;
  /** Største temperaturutslag i lufta fra 3 t før til 3 t etter turen (°C). Stort = skiftende vær. */
  variasjon: number;
  /** Nedbør i grenseland (−1…+3,5 °C) rundt turen: sludd eller bløt snø. */
  sludd: boolean;
};

export type Lag = { rolle: string; produkt: string; antall: string; merknad?: string };

export type Stabel = {
  type: 'hardvoks' | 'klister' | 'glider';
  lag: Lag[]; // nederst først
  begrunnelse: string[];
  advarsler: string[];
};

export type Stil = 'klassisk' | 'skoyting';
