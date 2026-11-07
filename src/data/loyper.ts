import { useEffect, useRef, useState } from 'react';

import { lesLokal, skrivFraKonto } from '@/data/lagring';
import { neonAnonym } from '@/data/neon';
import type { Løype } from '@/data/rute';

/** Lett løypeinfo til oversiktskart og lister. Hele løypa (punkter og terreng) hentes først når den åpnes. */
export type LøypeInfo = { id: string; navn: string; type?: 'retur' | 'sloyfe'; lengde_m: number; variantAv?: string; start: number[]; oversikt: number[][]; oppdatert: string };

const listeNøkkel = (o: string) => `skiglede.cache.loypeliste.${o}`;
const løypeNøkkel = (o: string, id: string) => `skiglede.cache.loype.${o}.${id}`;
const lesJson = <T,>(n: string): T | null => {
  try {
    const t = lesLokal(n);
    return t ? (JSON.parse(t) as T) : null;
  } catch {
    return null;
  }
};
// Lagres lokalt (ikke synket til kontoen) så løypene vises med en gang neste gang, også uten nett.
const lagreLokalt = (n: string, v: unknown) => {
  try {
    skrivFraKonto(n, JSON.stringify(v));
  } catch {
    // lagring full eller blokkert: det går fint, da hentes den på nytt
  }
};

const lister = new Map<string, LøypeInfo[]>();
const full = new Map<string, Løype & { oppdatert: string }>();

/** Løypene i et område (lett). Viser lagret kopi umiddelbart og oppdaterer fra databasen. */
export function useLøypeliste(område: string): { liste: LøypeInfo[] | null; feil: boolean } {
  const [, tving] = useState(0);
  const [feil, setFeil] = useState(false);
  useEffect(() => {
    let avbrutt = false;
    if (!lister.has(område)) {
      const lagret = lesJson<LøypeInfo[]>(listeNøkkel(område));
      if (lagret) {
        lister.set(område, lagret);
        tving((n) => n + 1);
      }
    }
    (async () => {
      try {
        const { data, error } = await neonAnonym().from('loype').select('id, navn, type, lengde_m, variant_av, start, oversikt, oppdatert').eq('omrade', område).order('navn');
        if (error) throw error;
        const liste: LøypeInfo[] = (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string, navn: r.navn as string, type: (r.type as LøypeInfo['type']) ?? undefined, lengde_m: r.lengde_m as number,
          variantAv: (r.variant_av as string | null) ?? undefined, start: r.start as number[], oversikt: r.oversikt as number[][], oppdatert: String(r.oppdatert),
        }));
        if (avbrutt) return;
        lister.set(område, liste);
        lagreLokalt(listeNøkkel(område), liste);
        setFeil(false);
        tving((n) => n + 1);
      } catch {
        if (!avbrutt) setFeil(true);
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [område]);
  return { liste: lister.get(område) ?? null, feil };
}

/** Hele løyper (punkter og terreng) for de gitte id-ene. Hentes bare når de trengs, og lagres på enheten. */
const løypeFeil = new Map<string, string>();
/** Siste feil når en løype ikke kunne hentes (vises på skjermen i stedet for at den bare henger på «Henter …»). */
export const løypeFeilFor = (område: string, id: string) => løypeFeil.get(`${område}/${id}`) ?? '';
const vent = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useLøyper(område: string, info: LøypeInfo[] | null, ids: string[], forsøk = 0): Løype[] {
  const [, tving] = useState(0);
  const nøkkel = ids.join('|');
  const iHenting = useRef(new Set<string>());
  useEffect(() => {
    if (!info) return;
    const mangler: string[] = [];
    for (const id of ids) {
      const i = info.find((l) => l.id === id);
      if (!i) continue;
      const k = `${område}/${id}`;
      let nå = full.get(k);
      if (!nå) {
        const lagret = lesJson<Løype & { oppdatert: string }>(løypeNøkkel(område, id));
        if (lagret) {
          full.set(k, lagret);
          nå = lagret;
        }
      }
      if ((!nå || nå.oppdatert !== i.oppdatert) && !iHenting.current.has(k)) mangler.push(id);
    }
    tving((n) => n + 1);
    if (!mangler.length) return;
    mangler.forEach((id) => iHenting.current.add(`${område}/${id}`));
    (async () => {
      try {
        // Tre forsøk: første kall etter oppstart kan feile mens den anonyme innloggingen settes opp.
        let data: unknown[] | null = null;
        let sisteFeil = '';
        let trinn = '';
        for (let n = 0; n < 3 && !data; n++) {
          if (n) await vent(1000 * n);
          try {
            // Én forespørsel per løype (ikke .in): enklest mulig kall, og feilen peker på riktig løype.
            const rader: unknown[] = [];
            for (const id of mangler) {
              // Trinn for trinn, så feilmeldingen sier hvilket kall som feiler (Hermes gir ingen stack i release).
              trinn = 'klient';
              const k = neonAnonym();
              trinn = 'from';
              const t = k.from('loype');
              trinn = 'select';
              const q = t.select('id, data, oppdatert');
              trinn = 'eq omrade';
              const q2 = q.eq('omrade', område);
              trinn = 'eq id';
              const q3 = q2.eq('id', id);
              trinn = 'henter';
              const svar = await q3;
              trinn = 'svar';
              if (svar.error) throw svar.error;
              for (const r of (svar.data ?? []) as unknown[]) rader.push(r);
            }
            data = rader;
          } catch (e) {
            const er = e as Error;
            sisteFeil = `[${trinn}] ${String(er?.message ?? e)}`;
          }
        }
        if (!data) {
          mangler.forEach((id) => løypeFeil.set(`${område}/${id}`, sisteFeil || 'ukjent feil'));
        } else {
          mangler.forEach((id) => løypeFeil.delete(`${område}/${id}`));
          for (const r of data as { id: string; data: { punkter: Løype['punkter']; terreng?: Løype['terreng'] }; oppdatert: string }[]) {
            const i = info.find((l) => l.id === r.id)!;
            const l = { id: i.id, navn: i.navn, type: i.type, lengde_m: i.lengde_m, variantAv: i.variantAv, punkter: r.data.punkter, terreng: r.data.terreng, oppdatert: String(r.oppdatert) };
            full.set(`${område}/${r.id}`, l);
            lagreLokalt(løypeNøkkel(område, r.id), l);
          }
          // Ikke i databasen (ennå)? Si det i stedet for å henge.
          mangler.filter((id) => !(data as { id: string }[]).some((r) => r.id === id)).forEach((id) => løypeFeil.set(`${område}/${id}`, 'løypa finnes ikke i databasen'));
        }
      } catch (e) {
        mangler.forEach((id) => løypeFeil.set(`${område}/${id}`, `behandling: ${String((e as Error)?.message ?? e)}`));
      } finally {
        mangler.forEach((id) => iHenting.current.delete(`${område}/${id}`));
        tving((n) => n + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [område, info, nøkkel, forsøk]);
  return ids.map((id) => full.get(`${område}/${id}`)).filter((l): l is Løype & { oppdatert: string } => !!l);
}
