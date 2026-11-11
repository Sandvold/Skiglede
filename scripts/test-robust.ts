// Robusthet: delvise lagre skal aldri krasje (rubb trenger bare glider), Swix V-linje og andre klistere teller, og dekke bare når voksen tåler varmen
import { byggMedLager, ALLE_NAVN } from '../src/engine';
import { planTur } from '../src/engine/tur';
import { analyserSnø } from '../src/engine/snø';
let feil = 0;
const ok = (b: boolean, t: string) => { console.log(b ? 'ok:' : 'FEIL:', t); if (!b) feil++; };
// enkel syntetisk løype
const seksjoner: any[] = Array.from({ length: 20 }, (_, i) => ({ startM: i * 500, endM: (i + 1) * 500, stigning: i % 3 === 0 ? -2 : 1, hoyde: 800, skog: 0.5, h: 800 }));
const timer: any[] = Array.from({ length: 24 * 14 }, (_, i) => ({ ts: Date.parse('2026-11-01T00:00:00Z') + i * 3600_000, temp: 0, nedbor: 0, rh: 0.8, vind: 2, sw: 0 }));
const mk = (temp: number) => { const t = planTur({ seksjoner, timer, startTs: Date.parse('2026-11-08T09:00:00Z'), tempoKmt: 7, refH: 800 } as any); t.seksjoner.forEach((s) => { s.tEff = temp; }); t.tMin = temp; t.tMaks = temp; return t; };
const snø: any = { type: 'omdannet', skarphet: 60, nysnøOppå: 0, advarsler: [], tidSidenNysnø: 99 };
const lagre = [['HS7'], ['Toko Blå', 'Toko Rød', 'V40', 'K22'], ['KX65'], ['V30', 'V40', 'V45', 'VG35'], ['K22', 'KB20C'], []];
let krasj = 0;
for (const l of lagre) for (const stil of ['klassisk', 'skoyting', 'felle', 'rubb'] as const) for (const t of [-12, -3, 0.2, 5]) {
  try { byggMedLager(stil, mk(t), snø, seksjoner, false, l); byggMedLager(stil, mk(t), { ...snø, type: 'ny', skarphet: 10 }, seksjoner, false, l); } catch (e) { krasj++; console.log('krasj', l.join(), stil, t, String(e)); }
}
ok(krasj === 0, 'ingen krasj med delvise lagre');
const r = byggMedLager('klassisk', mk(-3), { ...snø, type: 'ny', skarphet: 10 }, seksjoner, false, ['V30', 'V40', 'V45', 'VG35']);
ok(!r.advarsler.some((a) => a.includes('ingen hardvoks')) && r.lag.some((l) => l.rolle === 'Dagens voks'), 'Swix V-linja teller som hardvoks i lageret');
const k = byggMedLager('klassisk', mk(-0.5), snø, seksjoner, false, ['K22', 'KB20C']);
ok(!k.advarsler.some((a) => a.includes('ingen klister')) && k.lag.some((l) => l.rolle === 'Dagens klister'), 'K22 teller som klister i lageret');
const v = byggMedLager('klassisk', mk(5), { ...snø, nysnøOppå: 3 }, seksjoner, false, []);
ok(!v.lag.some((l) => l.rolle.startsWith('Voksdekke')), 'Ikke voksdekke over klister ved +5 °C');
// Vanskelig 0-føre (sludd): NB-varsel og råd om rubb/klister/felle, avhengig av om det blir varmere eller fryser på
import { byggSmøring, nullFøreRåd } from '../src/engine';
const sl = (trend: number, frys: boolean, tmin = 0) => { const t: any = mk(0.5); t.sludd = true; t.luftTrend = trend; t.fryserPå = frys; t.tMin = tmin; t.luftMin = tmin; return t; };
const varmere = nullFøreRåd(sl(2, false));
ok(varmere[0].startsWith('NB: vanskelig 0-føre') && varmere.some((x) => x.startsWith('Rubb: blir varmere')) && varmere.some((x) => x.includes('Klister: kan fungere når det blir varmere')), 'sludd som blir varmere: rubb og klister kan fungere');
const fryser = nullFøreRåd(sl(-3, true, -3));
ok(fryser.some((x) => x.startsWith('Rubb: passer ikke') && x.includes('fryse på')) && fryser.some((x) => x.includes('Klister: fungerer dårlig')), 'sludd som fryser på: ikke rubb, ikke klister');
const høyde = nullFøreRåd(sl(0, false, -3));
ok(høyde.some((x) => x.startsWith('Rubb: passer ikke')) && høyde.some((x) => x.includes('kaldere luft')), 'sludd med kaldere høyde: ikke rubb, ikke klister');
ok(!!byggSmøring('klassisk', sl(2, false), snø, seksjoner, false).vanskeligFøre, 'klassisk stabel får vanskeligFøre ved sludd');
const nysl = byggSmøring('klassisk', sl(2, false), { ...snø, type: 'ny', skarphet: 10 }, seksjoner, false);
ok(nysl.type === 'hardvoks' && nysl.advarsler.some((a) => a.includes('myk hardvoks')) && nysl.lag.some((l) => l.rolle === 'Klister under (valgfritt)'), 'sludd og ny snø: myk hardvoks med valgfritt tynt klister under');
const tørr: any = mk(-3); tørr.sludd = false;
ok(!byggSmøring('klassisk', tørr, snø, seksjoner, false).vanskeligFøre, 'ingen NB uten sludd');
// Lager fra andre merker: Rode P-linja og universalklister teller
const rp = byggMedLager('klassisk', mk(-4), { ...snø, type: 'ny', skarphet: 10 }, seksjoner, false, ['Rode P38', 'Rode P46', 'Rode P32']);
ok(!rp.advarsler.some((a) => a.includes('ingen hardvoks')) && rp.lag.some((l) => l.rolle === 'Dagens voks'), 'Rode P32/P38/P46 teller som hardvoks i lageret');
for (const [navn, t] of [['Toko Universal klisterspray', -0.5], ['Rode K76', -0.5], ['Skigo XC klister universal', -0.5]] as const) {
  const u = byggMedLager('klassisk', mk(t), snø, seksjoner, false, [navn]);
  ok(!u.advarsler.some((a) => a.includes('ingen klister')) && u.lag.some((l) => l.rolle === 'Dagens klister'), `${navn} teller som klister i lageret`);
}
// Glider: hull i lageret gir nærmeste glider, ikke alltid den varmeste
import { glideFor, SWIX } from '../src/engine/tabeller';
const kald = { ...SWIX, glider: SWIX.glider.filter((g) => ['HS5', 'HS10'].includes(g.navn)) };
ok(kald.glider.length === 2 && glideFor(-9.5, kald).navn === 'HS5', 'HS5 + HS10 ved -9,5 °C gir HS5 (nærmest), ikke HS10');
ok(glideFor(5, kald).navn === 'HS10' && glideFor(-25, kald).navn === 'HS5', 'utenfor begge: nærmeste ytterkant');
const gl = byggMedLager('skoyting', mk(-9.5), snø, seksjoner, false, ['HS5', 'HS10']);
ok(gl.lag.some((l) => l.produkt === 'HS5'), 'skøyting med HS5 + HS10 ved -9,5 °C: HS5');
console.log(feil ? 'FEIL' : 'Robusthet OK'); if (feil) process.exit(1);
