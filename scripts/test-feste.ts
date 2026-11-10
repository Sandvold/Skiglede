// Test: feste regnes fra flatt og stigninger (ikke nedoverbakker, selv svake), og mye skygge gir råd om blandet føre.
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
ok(sek.slice(10).every((s) => s.stigning < FESTE_MIN_STIGNING) && sek.slice(0, 10).every((s) => s.stigning >= FESTE_MIN_STIGNING), 'nedoverbakke ligger utenfor festet, stigning inni');

// svak utforbakke (−0,3° ≈ −0,5 %) er IKKE feste (man staker), mens flatt (0°) og svak stigning (0,3°) er det
const svak = mk([...Array(10).fill(0), ...Array(5).fill(0.3), ...Array(5).fill(-0.3)]);
const tur2 = planTur({ seksjoner: svak, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
tur2.seksjoner.forEach((s, i) => { s.tEff = i < 15 ? -3 : -9; });
const st2 = byggStabel(tur2, snø, svak);
ok(st2.begrunnelse[0].includes('75 % av løypa') && st2.begrunnelse[0].includes('varm -3.0'), 'flatt og svak stigning teller (75 %), svak utforbakke utelates');
// nesten bare nedoverbakke (under 20 % feste): hele løypa brukes
const ned = mk([...Array(2).fill(0.5), ...Array(18).fill(-0.5)]);
const tur2b = planTur({ seksjoner: ned, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
ok(!byggStabel(tur2b, snø, ned).begrunnelse[0].includes('bare der du trenger feste'), 'under 20 % feste: hele løypa brukes');

// mye skygge + stort spenn gir råd
const tur3 = planTur({ seksjoner: sek, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
tur3.seksjoner.forEach((s, i) => { s.tEff = i < 10 ? -3 : -9.2; });
(tur3 as any).skyggeAndel = 0.35; (tur3 as any).tMin = -9.2; (tur3 as any).tMaks = -3;
const st3 = byggStabel(tur3, snø, sek);
ok(st3.advarsler.some((a) => a.includes('Mye skygge') && a.includes('kald base')), 'skygge 35 % og spenn 6 °C gir råd om blandet føre');
(tur3 as any).skyggeAndel = 0.25;
ok(byggStabel(tur3, snø, sek).advarsler.some((a) => a.includes('Mye skygge')), 'skygge 25 % gir rådet (grensen er fra 25 %)');
(tur3 as any).skyggeAndel = 0.24;
ok(!byggStabel(tur3, snø, sek).advarsler.some((a) => a.includes('Mye skygge')), 'skygge 24 % gir ikke rådet');
console.log('Alle sjekker OK');

// Mellomlag under varmere dagsvoks for alle merker [Bruker], og Enkel = bare dagens smøring
(async () => {
  const { SWIX, TOKO, RODE, SKIGO, forenklet } = await import('../src/engine') as any;
  const varm = mk(Array(20).fill(0.5));
  const mildSnø = { ...snø, type: 'ny' as const, skarphet: 10 };
  const bygg = (sys: any, temp: number, lett = false) => {
    const t = planTur({ seksjoner: varm, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 7, refH: 800 });
    t.seksjoner.forEach((s) => { s.tEff = temp; });
    return byggStabel(t, mildSnø, varm, lett, sys);
  };
  const vis = (st: any) => st.lag.map((l: any) => `${l.rolle}:${l.produkt}(${l.antall})`).join(' | ');
  const bunn = (st: any) => st.lag.filter((l: any) => l.rolle.startsWith('Base') || l.rolle === 'Binder').map((l: any) => l.produkt);
  const swix = bygg(SWIX, -0.5); console.log('Swix  ', vis(swix));
  ok(swix.lag.some((l: any) => l.rolle === 'Base (blå extra)' && l.produkt === 'VP45'), 'Swix: blå extra (VP45) er mellomlaget under varmere voks');
  const swixVarm = bygg(SWIX, 1);
  ok(bunn(swixVarm).join() === 'VG35,VP45,VP55', 'Swix varmt: blå extra + violett-trinn som andre mellomlag');
  const swixBlå = bygg(SWIX, -3);
  ok(swixBlå.lag.some((l: any) => l.produkt === 'VP40' && l.rolle === 'Base (mellomlag)'), 'Swix: dagsvoks blå extra gir kaldere voks (VP40) som mellomlag');
  ok(bunn(swix).join() === 'VG35,VP45', 'Swix: binder, kaldere voks (VP45, tilsvarer blå extra) under VP55');
  const rode = bygg(RODE, -1); console.log('Rode  ', vis(rode));
  ok(rode.lag.some((l: any) => l.produkt === 'Rode P28' && l.rolle === 'Base (mellomlag)'), 'Rode: kaldere voks (P28) som mellomlag under Viola');
  const toko = bygg(TOKO, -1); console.log('Toko  ', vis(toko));
  ok(toko.lag.some((l: any) => l.rolle === 'Base (mellomlag)' && l.produkt === 'Toko Rød'), 'Toko: kaldere voks (Rød) som mellomlag under Gul');
  const skigo = bygg(SKIGO, -1); console.log('Skigo ', vis(skigo));
  ok(skigo.lag.some((l: any) => l.rolle === 'Base (mellomlag)'), 'Ski Go: kaldere voks som mellomlag');
  ok(!bygg(SWIX, -0.5, true).lag.some((l: any) => l.produkt === 'VP45'), 'Trening: ingen mellomlag');
  const enkel = forenklet(swix);
  ok(enkel.lag.every((l: any) => ['Dagens voks', 'Dagens klister', 'Glider', 'Festesone'].includes(l.rolle) || l.rolle.startsWith('Glidesone')), 'Enkel: bare dagens smøring (og glidesone), ingen base/mellomlag');
  console.log('Mellomlag OK');
})();
