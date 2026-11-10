// Test: feste regnes fra alt unntatt tydelig utforkjøring, og mye skygge gir råd om blandet føre.
import vaer from '../src/data/vaer-hovden.json';
import { analyserSnø, byggStabel, planTur, type Seksjon, type Vær } from '../src/engine';
import { FESTE_MIN_STIGNING } from '../src/engine/stabel';

const timer: Vær[] = (vaer.timer as any[]).map((r) => ({ ts: Date.parse(r[0]), temp: r[1], nedbor: r[2], rh: r[3], vind: r[4], sw: r[5] }));
const snø = analyserSnø(timer, Date.parse('2026-11-02T23:00:00Z'));
const ok = (b: boolean, t: string) => { if (!b) { console.log('FEIL: ' + t); process.exit(1); } console.log('ok: ' + t); };

// 20 seksjoner à 300 m: 10 flate/stigende, 10 bratt utforkjøring (−6°)
const mk = (stig: number[]): Seksjon[] => stig.map((s, i) => ({ seq: i, startM: i * 300, endM: (i + 1) * 300, h0: 800, h1: 800, hMid: 800, skog: 0, stigning: s }));
const sek = mk([...Array(10).fill(0.5), ...Array(10).fill(-6)]);
const dag = timer.filter((x) => x.ts >= Date.parse('2026-11-02T00:00:00Z') && x.ts <= Date.parse('2026-11-03T00:00:00Z'));
const tur = planTur({ seksjoner: sek, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
// flatt/stigning = varmt (−3), utforkjøring = kaldt (−9): festet skal regnes ut fra de varme
tur.seksjoner.forEach((s, i) => { s.tEff = i < 10 ? -3 : -9; });
const st = byggStabel(tur, snø, sek);
ok(st.begrunnelse[0].includes('bare der du trenger feste') && st.begrunnelse[0].includes('varm -3.0'), 'feste regnes bare fra flatt og stigning (varm = −3,0 selv om halve løypa er −9)');
ok(FESTE_MIN_STIGNING < 0 && sek.slice(10).every((s) => s.stigning < FESTE_MIN_STIGNING), 'bratt utforkjøring ligger utenfor festet');

// flatt og svake stigninger teller med: alt er ≥ −2,3° → hele løypa brukes, ingen tekst om utelatelse
const flat = mk(Array(20).fill(-1));
const tur2 = planTur({ seksjoner: flat, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
const st2 = byggStabel(tur2, snø, flat);
ok(!st2.begrunnelse[0].includes('bare der du trenger feste'), 'svak utforbakke (−1°) regnes som feste, hele løypa brukes');

// mye skygge + stort spenn gir råd
const tur3 = planTur({ seksjoner: sek, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
tur3.seksjoner.forEach((s, i) => { s.tEff = i < 10 ? -3 : -9.2; });
(tur3 as any).skyggeAndel = 0.35; (tur3 as any).tMin = -9.2; (tur3 as any).tMaks = -3;
const st3 = byggStabel(tur3, snø, sek);
ok(st3.advarsler.some((a) => a.includes('Mye skygge') && a.includes('kald base')), 'skygge 35 % og spenn 6 °C gir råd om blandet føre');
(tur3 as any).skyggeAndel = 0.25;
ok(!byggStabel(tur3, snø, sek).advarsler.some((a) => a.includes('Mye skygge')), 'skygge 25 % gir ikke rådet');
console.log('Alle sjekker OK');
