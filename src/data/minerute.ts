import { useCallback, useEffect, useState } from 'react';

import type { Løype } from '@/data/rute';
import type { Terreng } from '@/engine/terreng';
import { neon } from '@/data/neon';

export type MinRute = { id: string; navn: string; lengde_m: number; punkter: Løype['punkter']; start_lat: number; start_lon: number; terreng?: Terreng[] | null; delt?: boolean; user_id?: string };

/** Dine egne ruter (GPX). Lagres på kontoen din i Neon og er bare synlige for deg (radnivå-sikkerhet). Å laste opp krever pro. */
export function useMineRuter(innlogget: boolean) {
  const [ruter, setRuter] = useState<MinRute[]>([]);
  const [feil, setFeil] = useState('');
  const last = useCallback(async () => {
    if (!innlogget) return;
    const { data, error } = await neon().from('bruker_rute').select('id, navn, lengde_m, punkter, start_lat, start_lon, terreng, delt, user_id').order('opprettet', { ascending: false });
    if (error) setFeil(error.message);
    else {
      setFeil('');
      setRuter((data ?? []) as MinRute[]);
    }
  }, [innlogget]);
  useEffect(() => {
    last();
  }, [last]);
  return {
    ruter,
    feil,
    last,
    async lagre(l: Løype & { start_lat: number; start_lon: number }, stil: string, delt = false): Promise<string | null> {
      const { error } = await neon().from('bruker_rute').insert({ navn: l.navn, lengde_m: l.lengde_m, punkter: l.punkter, start_lat: l.start_lat, start_lon: l.start_lon, stil, terreng: l.terreng ?? null, delt });
      if (error) return error.message;
      await last();
      return null;
    },
    async delMed(id: string, delt: boolean) {
      await neon().from('bruker_rute').update({ delt }).eq('id', id);
      await last();
    },
    async slett(id: string) {
      await neon().from('bruker_rute').delete().eq('id', id);
      await last();
    },
  };
}

/**
 * Været for akkurat denne ruten: 14 døgn historikk fra MET Nordic (via Open-Meteo), regnet for rutens start. Prognosen kommer fra MET direkte (hentVarsel).
 * Samme format som områdenes værhistorikk. Open-Meteo er gratis til ikke-kommersiell bruk; ved betalte kunder trengs avtale eller en annen kilde.
 */
export async function hentRutevær(lat: number, lon: number): Promise<{ referansehoyde_m: number; timer: (string | number)[][] }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m,shortwave_radiation&past_days=14&forecast_days=1&models=metno_nordic&wind_speed_unit=ms&timezone=UTC`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Værtjenesten svarte ${r.status}`);
  const j = (await r.json()) as { elevation?: number; hourly?: { time: string[]; temperature_2m: (number | null)[]; precipitation: (number | null)[]; relative_humidity_2m: (number | null)[]; wind_speed_10m: (number | null)[]; shortwave_radiation: (number | null)[] } };
  const h = j.hourly;
  if (!h) throw new Error('Fikk ikke værdata for ruten.');
  const timer: (string | number)[][] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.temperature_2m[i];
    if (t === null || t === undefined) continue;
    if (Date.parse(`${h.time[i]}:00Z`) > Date.now()) break; // fremtiden hentes fra MET
    timer.push([`${h.time[i]}:00Z`, t, h.precipitation[i] ?? 0, (h.relative_humidity_2m[i] ?? 0) / 100, h.wind_speed_10m[i] ?? 0, (h.shortwave_radiation[i] ?? 0) * 3600]);
  }
  return { referansehoyde_m: j.elevation ?? 0, timer };
}

/** Lagret værhistorikk for en delt rute (MET Nordic Analysis, oppdatert hver fjerde time fra opplasting), eller null hvis den ikke finnes ennå. */
export async function hentLagretRutevær(ruteId: string): Promise<{ referansehoyde_m: number; timer: (string | number)[][] } | null> {
  const { data, error } = await neon().from('rute_vaer').select('referansehoyde_m, timer').eq('rute_id', ruteId).maybeSingle();
  if (error || !data) return null;
  const d = data as { referansehoyde_m: number; timer: (string | number)[][] };
  return d.timer?.length >= 14 * 24 * 0.9 ? d : null;
}
