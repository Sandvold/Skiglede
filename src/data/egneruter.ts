import { useMemo } from 'react';

import { registrerLøype, type LøypeInfo } from '@/data/loyper';
import { useMineRuter, type MinRute } from '@/data/minerute';
import { useOmråder, type Område } from '@/data/omrader';
import { usePremium } from '@/data/premium';

const MAKS_KM = 60; // samme grense som for renn: lenger unna har vi ikke værdata som passer

const km = (lat: number, lon: number, o: Område) => Math.hypot((o.sted.lat - lat) * 111, (o.sted.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180));

/**
 * Egne GPX-ruter (og ruter andre har delt fra et kjent utfartssted) som ligger i dette området: nærmeste område med værdata, innen 60 km.
 * Rutene gjøres om til vanlige løyper (samme liste som resten), så smøreguiden fungerer likt. Alt er regnet ut ved opplasting.
 */
export function useEgneRuterIOmråde(område: Område) {
  const { bruker } = usePremium();
  const mine = useMineRuter(!!bruker);
  const alle = useOmråder();
  const ruter = useMemo(() => {
    return mine.ruter.filter((r) => {
      const nærmest = [...alle].sort((a, b) => km(r.start_lat, r.start_lon, a) - km(r.start_lat, r.start_lon, b))[0];
      return nærmest?.id === område.id && km(r.start_lat, r.start_lon, område) <= MAKS_KM;
    });
  }, [mine.ruter, alle, område]);
  const infos = useMemo(() => ruter.map((r) => tilInfo(r, område.id, bruker?.id)), [ruter, område.id, bruker?.id]);
  return { mine, ruter, infos, bruker };
}

function tilInfo(r: MinRute, område: string, meg?: string): LøypeInfo {
  const id = `egen-${r.id}`;
  const oppdatert = 'egen';
  const eier = !r.user_id || r.user_id === meg;
  const navn = `${r.navn} (${eier ? 'din rute' : 'delt rute'})`;
  registrerLøype(område, { id, navn, lengde_m: r.lengde_m, punkter: r.punkter, terreng: r.terreng ?? undefined, oppdatert });
  const steg = Math.max(1, Math.floor(r.punkter.length / 90));
  const oversikt = r.punkter.filter((_, i) => i % steg === 0 || i === r.punkter.length - 1).map((p) => [p[0], p[1]]);
  return { id, navn, lengde_m: r.lengde_m, start: [r.punkter[0][0], r.punkter[0][1], r.punkter[0][2]], oversikt, oppdatert };
}
