// Robusthet: delvise lagre skal aldri krasje (rubb trenger bare glider), Swix V-linje og andre klistere teller, og dekke bare når voksen tåler varmen
import { byggMedLager, ALLE_NAVN } from '../src/engine';
import { planTur } from '../src/engine/tur';
import { analyserSnø } from '../src/engine/snø';
let feil = 0;
const ok = (b: boolean, t: string) => { console.log(b ? 'ok:' : 'FEIL:', t); if (!b) feil++; };
// enkel syntetisk løype
const seksjoner: any[] = Array.from({ length: 20 }, (_, i) => ({ startM: i * 500, endM: (i + 1) * 500, stigning: i % 3 === 0 ? -2 : 1, hoyde: 800, skog: 0.5, h: 800 }));
const timer: any[] = Array.from({ length: 24 * 14 }, (_, i) => ({ ts: Date.parse('2026-11-01T00:00:00Z') + i * 3600_000, t: 0, nedbor: 0, fukt: 0.8, vind: 2, straling: 0 }));
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
console.log(feil ? 'FEIL' : 'Robusthet OK'); if (feil) process.exit(1);
