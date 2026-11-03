import trails from '../src/data/trails.json';
import vaer from '../src/data/vaer-hovden.json';
import { analyserSnø, byggStabel, lagSeksjoner, planTur, type Punkt, type Vær } from '../src/engine';

const timer: Vær[] = (vaer.timer as any[]).map((r) => ({ ts: Date.parse(r[0]), temp: r[1], nedbor: r[2], rh: r[3], vind: r[4], sw: r[5] }));
const nå = timer[timer.length - 1].ts;
const snø = analyserSnø(timer, Date.parse('2026-11-02T23:00:00Z'));
console.log('snø', snø.type, Math.round(snø.skarphet), snø.sykluser.toFixed(2), snø.advarsler);
snø.dager.forEach((d) => console.log(d.dato, d.maks.toFixed(1), d.natt?.toFixed(1), d.syklus.toFixed(2)));
for (const t of trails as any[]) {
  const sek = lagSeksjoner(t.punkter as Punkt[]);
  const dag = timer.filter((x) => x.ts >= Date.parse('2026-11-02T00:00:00Z') && x.ts <= Date.parse('2026-11-03T00:00:00Z'));
  for (const tempo of [5, 9]) {
    const tur = planTur({ seksjoner: sek, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: tempo, refH: vaer.referansehoyde_m });
    const st = byggStabel(tur, snø, sek);
    console.log(`\n${t.navn} ${tempo} km/t: ${sek.length} seksj, T ${tur.tMin.toFixed(1)}..${tur.tMaks.toFixed(1)} -> ${st.type}`);
    console.log(st.lag.map((l) => `${l.rolle}:${l.produkt}(${l.antall})`).join(' | '));
  }
}
