// Tester for: utstråling med skydekke, soltillegg etter snøtype (albedo), solskorpe ned til −5 °C på omdannet snø,
// vindkjøling til og med mars, salt-advarsel og merketabeller (Rode-tillegg, Toko mellomlag).
import trails from '../src/data/trails.json';
import vaer from '../src/data/vaer-hovden.json';
import { analyserSnø, byggMedLager, byggSmøring, lagSeksjoner, planTur, medUnderlag, INGEN_UNDERLAG, type Punkt, type Vær, type Underlag } from '../src/engine';
import { utstråling, solGrad, SOL_GRAD_PER_500W, SOL_GRAD_OMDANNET_PER_500W } from '../src/engine/tur';
import { SNØ } from '../src/engine/snø';
import { SYSTEMER, produkt, RODE } from '../src/engine/tabeller';

let feil = 0;
const ok = (b: boolean, t: string) => { if (!b) { feil++; console.log('FEIL:', t); } else console.log('ok:', t); };
const nær = (a: number, b: number, d = 0.01) => Math.abs(a - b) <= d;

// --- utstråling
const v = (vind: number, rh: number, sky?: number) => ({ temp: -3, rh, vind, sky });
ok(utstråling(v(1, 0.6), 0) === -3.5, 'uten sky: ekstremt stille og tørt gir −3,5');
ok(utstråling(v(2, 0.75), 0) === -2, 'uten sky: stille og tørt gir −2 (som før)');
ok(utstråling(v(3, 0.85), 0) === -1, 'uten sky: litt vind gir −1 (som før)');
ok(utstråling(v(5, 0.6), 0) === 0, 'uten sky: vind ≥ 4 gir 0');
ok(utstråling(v(1, 0.6, 0), 0) === -3.5, 'klar himmel og vindstille: −3,5');
ok(utstråling(v(1, 0.6, 1), 0) === 0, 'helt overskyet: ingen utstråling');
ok(nær(utstråling(v(2, 0.6, 0.5), 0), -2.5 * 0.75), 'halv sky og litt vind: −2,5 × 0,75');
ok(utstråling(v(1, 0.6, 0), 150) === 0, 'sol over 100 W/m²: ingen utstråling');
ok(utstråling({ temp: 2.4, rh: 0.6, vind: 1, sky: 0 }, 0) === -3.5, 'luft +2,4 °C: utstråling teller (grense +2,5)');
ok(utstråling({ temp: 3, rh: 0.6, vind: 1, sky: 0 }, 0) === 0, 'luft +3 °C: ingen utstråling');

// --- soltillegg etter snøtype
ok(solGrad() === SOL_GRAD_PER_500W && solGrad('ny') === 2 && solGrad('omdannet') === SOL_GRAD_OMDANNET_PER_500W && SOL_GRAD_OMDANNET_PER_500W === 3.5, 'soltillegg 2,0 for nysnø og 3,5 for omdannet');
const timer: Vær[] = (vaer.timer as any[]).map((r) => ({ ts: Date.parse(r[0]), temp: r[1], nedbor: r[2], rh: r[3], vind: r[4], sw: r[5] }));
const sek = lagSeksjoner((trails as any[])[0].punkter as Punkt[]);
// Konstruert solrik formiddag med kald luft: tEff skal være høyere på omdannet enn på nysnø, og lik uten sol
const start = Date.parse('2026-03-10T10:00:00Z');
const dagMed = (sw: number): Vær[] => Array.from({ length: 12 }, (_, i) => ({ ts: start - 3 * 3600_000 + i * 3600_000, temp: -4, nedbor: 0, rh: 0.7, vind: 1, sw }));
const kjør = (sw: number, snøType?: 'ny' | 'omdannet') => planTur({ seksjoner: sek, timer: dagMed(sw), startTs: start, tempoKmt: 7, refH: 800, snøType });
const sn = (t: ReturnType<typeof kjør>) => t.seksjoner.reduce((a, x) => a + x.tEff, 0) / t.seksjoner.length;
const solrikNy = sn(kjør(500 * 3600, 'ny')), solrikOmd = sn(kjør(500 * 3600, 'omdannet')), mørk = [sn(kjør(0, 'ny')), sn(kjør(0, 'omdannet'))];
ok(solrikOmd > solrikNy + 0.5, `omdannet snø blir varmere i sol enn nysnø (${solrikOmd.toFixed(2)} mot ${solrikNy.toFixed(2)})`);
ok(nær(mørk[0], mørk[1], 1e-9), 'uten sol er snøtypen uten betydning');

// --- solskorpe til −5 °C kun på omdannet snø, og vindkjøling i mars
const DAG = 86_400_000;
const nå = Date.parse('2026-03-20T20:00:00Z');
/** Én mild, solrik dag og kald natt gjentatt: maks −4 °C, sol 650 W/m², stille. */
const lagUke = (maks: number, sol: number, vind: number, rh: number, mnd?: number): Vær[] => {
  const ut: Vær[] = [];
  for (let d = 14; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const ts = Math.floor((nå - d * DAG) / DAG) * DAG + h * 3600_000;
      const dagTime = h >= 8 && h <= 16;
      ut.push({ ts, temp: dagTime ? maks : -10, nedbor: 0, rh, vind, sw: dagTime ? sol * 3600 : 0 });
    }
  }
  void mnd;
  return ut;
};
// Å ha en kjent omdannet snø: bruk forrige-status = omdannet (skorpa varer), ellers ingen tegn
const omd = { type: 'omdannet' as const, skarphet: 60, ts: nå - 10 * DAG };
// Uten tegn på omdanning (ingen forrige): −4 °C maks teller IKKE som sol-smelting (grense −3)
const utenTegn = analyserSnø(lagUke(-4, 650, 1, 0.7), nå, null);
ok(utenTegn.type === 'ny', 'nysnø: maks −4 °C med sol gir ikke solskorpe (grense −3 °C)');
const medForrige = analyserSnø(lagUke(-4, 650, 1, 0.7), nå, omd);
ok(medForrige.type === 'omdannet', 'omdannet fra før blir stående');
ok(medForrige.skarphet >= omd.skarphet, 'skarphet faller ikke');
ok(SNØ.solMinTempOmdannet === -5 && SNØ.solMinTemp === -3, 'grenser: −3 °C for ikke-omdannet, −5 °C for omdannet');
const tidligere = SNØ.solMinTempOmdannet;
SNØ.solMinTempOmdannet = SNØ.solMinTemp; // uten utvidelsen
const utenUtvidelse = analyserSnø(lagUke(-4, 650, 1, 0.7), nå, omd);
SNØ.solMinTempOmdannet = tidligere;
ok(medForrige.sykluser > utenUtvidelse.sykluser, `omdannet snø: solskorpe ved maks −4 °C gir flere sykluser (${medForrige.sykluser.toFixed(2)} mot ${utenUtvidelse.sykluser.toFixed(2)} uten utvidelse)`);
const kaldere = analyserSnø(lagUke(-6, 650, 1, 0.7), nå, omd);
ok(kaldere.sykluser <= medForrige.sykluser && nær(kaldere.sykluser, utenUtvidelse.sykluser, 1e-9) , 'maks −6 °C gir fortsatt ingen solskorpe (under −5 °C)');
ok(SNØ.vindMåneder.includes(3) && !SNØ.vindMåneder.includes(4), 'vindkjøling gjelder til og med mars');

// --- salt-advarsel
const dag = timer.filter((x) => x.ts >= Date.parse('2026-11-02T09:00:00Z') - 3 * 3600_000 && x.ts <= Date.parse('2026-11-02T09:00:00Z') + 12 * 3600_000);
const tur = planTur({ seksjoner: sek, timer: dag, startTs: Date.parse('2026-11-02T09:00:00Z'), tempoKmt: 6, refH: vaer.referansehoyde_m });
const natur = { ...analyserSnø(timer, Date.parse('2026-11-02T09:00:00Z')), type: 'omdannet' as const, skarphet: 80 };
const st = byggSmøring('klassisk', tur, natur, sek, false, SYSTEMER.swix);
const saltU: Underlag = { kunstsnø: { på: false, del: 'hele' }, salt: { på: true, del: 'hele' } };
ok(medUnderlag(st, saltU, tur).advarsler.some((x) => x.includes('vaskes ut')), 'salt gir advarsel om at saltet vaskes ut');
ok(!medUnderlag(st, INGEN_UNDERLAG, tur).advarsler.some((x) => x.includes('vaskes ut')), 'uten salt ingen slik advarsel');

// --- merketabeller
for (const n of ['Rode P10', 'Rode P15', 'Rode P30', 'Rode P34', 'Rode P42', 'Rode P52', 'Rode P60', 'Rode P70']) ok(!!produkt(n), `${n} finnes`);
ok(produkt('Rode P42')!.omr[0] === -3 && produkt('Rode P42')!.omr[1] === 1, 'Rode P42 −3…+1');
ok(produkt('Rode P70')!.rolle === 'binder' && RODE.binder?.mild.navn === 'Rode P70', 'Rode har binder P70');
ok(SYSTEMER.toko.blåExtra?.[0].navn === 'Toko Rød', 'Toko: mellomlaget er Toko Rød, ikke Toko Blå');
// Hele stabelen for hvert merke skal fortsatt bygges for et par temperaturer uten å kræsje, og Toko Gul får Toko Rød under seg
for (const id of ['swix', 'toko', 'rode', 'skigo'] as const) {
  for (const dTemp of [-12, -5, -1, 0.5]) {
    const t2 = { ...tur, tMin: dTemp - 1, tMaks: dTemp + 1, tMinRå: dTemp - 1, tMaksRå: dTemp + 1, seksjoner: tur.seksjoner.map((x) => ({ ...x, tEff: dTemp, tLuft: dTemp })) };
    let ok2 = true;
    try { byggSmøring('klassisk', t2, { ...natur, type: dTemp > -0.5 ? 'omdannet' : 'ny', skarphet: 40 }, sek, false, SYSTEMER[id]); } catch { ok2 = false; }
    if (!ok2) { feil++; console.log('FEIL: kræsj', id, dTemp); }
  }
}
const tGul = { ...tur, tMin: -1.5, tMaks: -0.5, tMinRå: -1.5, tMaksRå: -0.5, seksjoner: tur.seksjoner.map((x) => ({ ...x, tEff: -1, tLuft: -1 })) };
const tokoSt = byggSmøring('klassisk', tGul, { ...natur, type: 'ny', skarphet: 10 }, sek, false, SYSTEMER.toko);
console.log('Toko −1 °C:', tokoSt.lag.map((l) => `${l.rolle}:${l.produkt}`).join(' | '));
ok(tokoSt.lag.some((l) => l.produkt === 'Toko Rød') || tokoSt.lag.some((l) => l.produkt === 'Toko Gul'), 'Toko-stabel bygges med Toko-produkter');

console.log(feil ? `\n${feil} FEIL` : '\nutstråling/sol/merke-tester ferdig uten feil');
if (feil) process.exit(1);
