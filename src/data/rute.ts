import type { Punkt, Terreng } from '@/engine';

export type Løype = { id: string; navn: string; type?: 'retur' | 'sloyfe'; lengde_m: number; punkter: Punkt[]; terreng?: Terreng[] };

/** Største avstand (m) mellom startpunktene for at to løyper regnes som «fra samme start». */
export const MAKS_START_AVSTAND = 300;

const meter = (a: Punkt, b: Punkt) => Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180) * 111_320, (a[1] - b[1]) * 111_320);

/** Løyper som starter ved samme sted og kan legges til turen (Galten og Lundane, Rørvikåsen og Ny Lysløype …). */
export function tilhørende(løype: Løype, alle: Løype[]): Løype[] {
  return alle.filter((l) => l.id !== løype.id && meter(l.punkter[0], løype.punkter[0]) <= MAKS_START_AVSTAND);
}

/** Rette punkter mellom a og b (hvert ~50 m), uten endepunktene. Høyde interpoleres. */
function kobling(a: Punkt, b: Punkt): Punkt[] {
  const d = meter(a, b);
  const n = Math.floor(d / 50);
  const ut: Punkt[] = [];
  for (let i = 1; i <= n; i++) {
    const f = i / (n + 1);
    ut.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, 0, 0] as Punkt);
  }
  return ut;
}

/**
 * Slår løyper fra samme start sammen til én rute: hovedløypa, så hver ekstra løype, og tilbake til start.
 * Ligger startpunktene noen meter fra hverandre, legges en rett kobling. Avstander og terreng forskyves.
 */
export function byggRute(base: Løype, ekstra: Løype[]): Løype {
  if (!ekstra.length) return base;
  const start = base.punkter[0];
  const pun: Punkt[] = base.punkter.map((p) => [...p] as Punkt);
  const terr: Terreng[] = (base.terreng ?? []).map((t) => [...t] as unknown as Terreng);
  let dist = base.punkter[base.punkter.length - 1][3];

  const legg = (pts: Punkt[], terreng: Terreng[] | undefined, offset: number) => {
    for (const p of pts) pun.push([p[0], p[1], p[2], p[3] + offset, p[4]] as Punkt);
    for (const t of terreng ?? []) terr.push([t[0] + offset, ...t.slice(1)] as unknown as Terreng);
  };
  const tilPunkt = (fra: Punkt, til: Punkt) => {
    for (const k of kobling(fra, til)) {
      dist += meter(pun[pun.length - 1], k);
      pun.push([k[0], k[1], k[2], Math.round(dist), 0] as Punkt);
    }
    dist += meter(pun[pun.length - 1], til);
  };

  for (const e of ekstra) {
    const eStart = e.punkter[0];
    const sist = pun[pun.length - 1];
    tilPunkt(sist, eStart);
    const offset = Math.round(dist);
    legg(e.punkter, e.terreng, offset);
    dist = offset + e.punkter[e.punkter.length - 1][3];
  }
  // Tilbake til start
  const sist = pun[pun.length - 1];
  tilPunkt(sist, start);
  pun.push([start[0], start[1], start[2], Math.round(dist), 0] as Punkt);

  return {
    id: [base.id, ...ekstra.map((e) => e.id)].join('+'),
    navn: [base.navn, ...ekstra.map((e) => e.navn)].join(' + '),
    lengde_m: Math.round(dist),
    punkter: pun,
    terreng: terr.length ? terr : undefined,
  };
}
