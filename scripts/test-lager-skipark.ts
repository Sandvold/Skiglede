// Kjøres med: npx --yes tsx scripts/test-lager-skipark.ts  (feiler med exit 1 hvis en sjekk ikke stemmer)
import trails from '../src/data/trails.json';
import { vektetPersentil } from '../src/engine/tur';
import { terrengFaktor } from '../src/engine/terreng';
import { analyserSnø, byggAlternativer, byggSmøring, forenklet, glideFor, lagSeksjoner, planTur, tilpassTilLager, vurderPåfylling, type Punkt, type Smøring, type Stabel, type Vær } from '../src/engine';

let feil = 0;
const sjekk = (navn: string, faktisk: unknown, forventet: unknown) => {
  const ok = JSON.stringify(faktisk) === JSON.stringify(forventet);
  if (!ok) feil++;
  console.log(ok ? 'OK  ' : 'FEIL', navn, ok ? '' : `faktisk ${JSON.stringify(faktisk)} forventet ${JSON.stringify(forventet)}`);
};

// Glider: kaldeste av de som passer
for (const [t, h] of [[-20, 'HS5'], [-14, 'HS5'], [-9, 'HS6'], [-5, 'HS7'], [-3, 'HS7'], [-1, 'HS8'], [0, 'HS8'], [2, 'HS8'], [5, 'HS10'], [12, 'HS10']] as const) sjekk(`glideFor(${t})`, glideFor(t).navn, h);

const stabel = (type: Stabel['type'], lag: [string, string][]): Stabel => ({ type, lag: lag.map(([rolle, produkt]) => ({ rolle, produkt, antall: '1' })), begrunnelse: [], advarsler: [] });
const smør = (type: Smøring['type'], lag: [string, string][], turer = 1, dagerSiden = 1): Smøring => ({ stil: type === 'glider' ? 'skoyting' : 'klassisk', type, lag: lag.map(([rolle, produkt]) => ({ rolle, produkt })), ts: Date.now() - dagerSiden * 86_400_000, turer });

// Lager: erstatter med nærmeste i samme kategori, kaldest ved likhet
const rec = stabel('hardvoks', [['Binder', 'VG35'], ['Dagens voks', 'VP45']]);
const t1 = tilpassTilLager(rec, ['VG35', 'VP40', 'VP50']);
sjekk('lager: VP45 -> VP50 (senter −1,5 er nærmere −3 enn VP40 −7)', t1.lag[1].produkt, 'VP50');
sjekk('lager: uavgjort (HS7 og HS10 like langt fra HS8) -> kaldest = HS7', tilpassTilLager(stabel('glider', [['Glider', 'HS8']]), ['HS7', 'HS10']).lag[0].produkt, 'HS7');
sjekk('lager: tomt lager endrer ingenting', tilpassTilLager(rec, []).lag.map((l) => l.produkt), ['VG35', 'VP45']);
sjekk('lager: glider kun fra glidere', tilpassTilLager(stabel('glider', [['Glider', 'HS7']]), ['HS8', 'VP40']).lag[0].produkt, 'HS8');
sjekk('lager: mangler helt gir advarsel', tilpassTilLager(stabel('klister', [['Dagens klister', 'KX65']]), ['VP40']).advarsler.length, 1);

// Skipark
const ny = stabel('hardvoks', [['Dagens voks', 'VP45']]);
sjekk('ingen forrige = ny', vurderPåfylling(undefined, ny).handling, 'ny');
sjekk('varmere hardvoks = topplag', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']]), ny).handling, 'topplag');
sjekk('samme hardvoks = topplag', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP45']]), ny).handling, 'topplag');
sjekk('mye kaldere hardvoks (rød under, blå oppå) = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP65']]), ny).handling, 'rens');
sjekk('litt kaldere hardvoks = topplag som tynt dekke', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP55']]), ny).handling, 'topplag');
sjekk('smurt opp til blå ekstra, fiolett på toppen = topplag', vurderPåfylling(smør('hardvoks', [['Binder', 'VG35'], ['Dagens voks', 'VP45'], ['Dekke 1', 'VP40']]), stabel('hardvoks', [['Dagens voks', 'VP55']])).handling, 'topplag');
sjekk('øverste lag teller, ikke dagens: dekke VP40 under ny VP65 er fortsatt fint', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP45'], ['Dekke 1', 'VP40']]), stabel('hardvoks', [['Dagens voks', 'VP65']])).handling, 'topplag');
sjekk('klister -> hardvoks = rens', vurderPåfylling(smør('klister', [['Dagens klister', 'KX65']]), ny).handling, 'rens');
sjekk('hardvoks -> klister = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP45']]), stabel('klister', [['Dagens klister', 'KX65']])).handling, 'rens');
sjekk('4 turer = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']], 4), ny).handling, 'rens');
sjekk('3 turer = topplag', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']], 3), ny).handling, 'topplag');
sjekk('15 dager gammel = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']], 1, 15), ny).handling, 'rens');
sjekk('klister varmere = topplag', vurderPåfylling(smør('klister', [['Dagens klister', 'KX45N']]), stabel('klister', [['Dagens klister', 'KX65']])).handling, 'topplag');
sjekk('glider: bytte uten temperatur = rens', vurderPåfylling(smør('glider', [['Glider', 'HS7']]), stabel('glider', [['Glider', 'HS8']])).handling, 'rens');
const medT = (g: string, t: number): Stabel => ({ ...stabel('glider', [['Glider', g]]), tSnitt: t });
sjekk('glider: HS7 på, snø −1 °C (innenfor monn) = behold', vurderPåfylling(smør('glider', [['Glider', 'HS7']]), medT('HS8', -1)).behold, true);
sjekk('glider: HS7 på, snø +1 °C (utenfor monn) = rens', vurderPåfylling(smør('glider', [['Glider', 'HS7']]), medT('HS8', 1)).handling, 'rens');
sjekk('glider: HS8 på, snø −9 °C (kaldere, utenfor) = rens', vurderPåfylling(smør('glider', [['Glider', 'HS8']]), medT('HS6', -9)).handling, 'rens');
sjekk('glider: HS8 -> HS7 (kaldere) = rens', vurderPåfylling(smør('glider', [['Glider', 'HS8']]), stabel('glider', [['Glider', 'HS7']])).handling, 'rens');

// Felle og rubb. Syntetisk døgn rundt turen: temp(h) og nedbør(h) for hver time (UTC).
const lun: any = (trails as any[]).find((t) => t.navn === 'Lundane');
const sek = lagSeksjoner(lun.punkter as Punkt[]);
const start = Date.parse('2026-02-10T09:00:00Z');
const døgn = (f: (h: number) => Partial<Vær>): Vær[] => Array.from({ length: 24 * 15 }, (_, i) => { const ts = start - 14 * 86400_000 + i * 3600_000; return { ts, temp: 0, nedbor: 0, rh: 0.8, vind: 1, sw: 0, ...f(new Date(ts).getUTCHours()) }; });
const kjør = (stil: 'felle' | 'rubb' | 'klassisk', f: (h: number) => Partial<Vær>) => {
  const t = døgn(f);
  const sn = analyserSnø(t, start);
  const tur = planTur({ seksjoner: sek, timer: t.filter((x) => x.ts >= start - 3 * 3600_000), startTs: start, tempoKmt: 5, refH: 838 });
  return byggSmøring(stil, tur, sn, sek);
};
const sludd = kjør('rubb', () => ({ temp: 1, nedbor: 0.8 }));
sjekk('rubb: sludd +1 °C er egnet', sludd.egnet, true);
sjekk('rubb: egnet gir festesone Rubb', sludd.lag[0].produkt, 'Rubb');
const tørt = kjør('rubb', () => ({ temp: 1, nedbor: 0 }));
sjekk('rubb: ingen sludd, frarådes', tørt.egnet, false);
sjekk('rubb: frarådes gir alternativ', !!tørt.alternativ && tørt.alternativ.lag.length > 0, true);
sjekk('rubb: frarådes har ingen egne lag', tørt.lag.length, 0);
const minus = kjør('rubb', (h) => ({ temp: h >= 12 || h < 4 ? -4 : 1, nedbor: 0.8 }));
sjekk('rubb: sludd men ordentlig minus i vinduet, frarådes', minus.egnet, false);
sjekk('rubb: minus nevnes som grunn', minus.advarsler.some((a) => a.includes('minus')), true);
const kaldSludd = kjør('rubb', () => ({ temp: -3, nedbor: 0.8 }));
sjekk('rubb: snø ved −3 °C frarådes', kaldSludd.egnet, false);
for (const [navn, f] of [['kaldt', () => ({ temp: -12 })], ['sludd', () => ({ temp: 1, nedbor: 1 })], ['mildt', () => ({ temp: 4 })]] as const) {
  const fl = kjør('felle', f);
  sjekk(`felle: virker alltid (${navn})`, fl.egnet && fl.lag[0].produkt === 'Felle', true);
}
sjekk('felle: ingen advarsler om feil smøring', kjør('felle', () => ({ temp: -12 })).advarsler.length, 0);
sjekk('lager: «Felle» meldes ikke som manglende produkt (glideren kan det)', tilpassTilLager(kjør('felle', () => ({ temp: -5 })), ['VP40']).advarsler.some((a) => a.includes('Felle')), false);
sjekk('lager: alternativ tilpasses også', tilpassTilLager(tørt, ['VP40']).alternativ?.advarsler.length, (tilpassTilLager(tørt.alternativ!, ['VP40'])).advarsler.length);

// Alternativer fra skiparken (klassisk tur)
const alt = (eier: ('felle' | 'rubb' | 'klassisk')[], f: (h: number) => Partial<Vær>) => {
  const t = døgn(f);
  const sn = analyserSnø(t, start);
  const tur = planTur({ seksjoner: sek, timer: t.filter((x) => x.ts >= start - 3 * 3600_000), startTs: start, tempoKmt: 5, refH: 838 });
  return byggAlternativer(eier, tur, sn, sek, byggSmøring('klassisk', tur, sn, sek)).map((a) => a.stil);
};
sjekk('alternativ: sludd + rubb og felle i parken gir begge', alt(['rubb', 'felle'], () => ({ temp: 1, nedbor: 0.8 })), ['rubb', 'felle']);
sjekk('alternativ: tomt skipark gir ingen', alt([], () => ({ temp: 1, nedbor: 0.8 })), []);
sjekk('alternativ: rubb i parken men tørt føre gir ikke rubb', alt(['rubb'], () => ({ temp: -8 })), []);
sjekk('alternativ: stabilt kaldt føre gir ikke felle', alt(['felle'], () => ({ temp: -10 })), []);
sjekk('alternativ: skiftende temperatur gir felle', alt(['felle'], (h) => ({ temp: h >= 6 && h < 18 ? 3 : -4 })), ['felle']);

// Robuste ytterpunkter: ett kort parti avgjør ikke, et langt strekk gjør
const lik = Array(20).fill(250);
sjekk('persentil: 1 av 20 biter i skygge (5 %) påvirker ikke 5. persentil', vektetPersentil([...Array(19).fill(0), -6], lik, 0.05), 0);
sjekk('persentil: 4 av 20 biter (20 %) påvirker 5. persentil', vektetPersentil([...Array(16).fill(0), ...Array(4).fill(-6)], lik, 0.05), -6);
sjekk('persentil: 1 av 20 varme biter (5 %) påvirker ikke 95. persentil', -vektetPersentil([...Array(19).fill(0), 6].map((x) => -x), lik, 0.05), 0);
sjekk('persentil: lange biter veier mer', vektetPersentil([0, -6], [250, 1000], 0.05), -6);

// Skygge teller bare ved minst 10 % av løypa
const TERR = (hor: number) => [[0, 180, 0, Array(16).fill(hor)]] as any;
const høyTid = Date.parse('2026-03-10T11:00:00Z');
const blokk = terrengFaktor(TERR(80)[0], høyTid, 59.57, 7.37);
sjekk('terreng: blokkert horisont gir skygge og lav solfaktor', [Math.round(blokk.faktor * 100), blokk.skygge], [30, true]);
sjekk('terreng: ignorerSkygge gir full solfaktor men melder skygge', terrengFaktor(TERR(80)[0], høyTid, 59.57, 7.37, true).faktor > 0.3, true);

// Forenklet: bare base og dagens smøring
const full = stabel('hardvoks', [['Binder', 'VG35'], ['Base (kaldere)', 'VP40'], ['Dagens voks', 'VP45'], ['Dekke 1', 'VP40']]);
sjekk('forenklet hardvoks: binder + dagens', forenklet(full).lag.map((l) => l.produkt), ['VG35', 'VP45']);
sjekk('forenklet klister: baseklister + dagens', forenklet(stabel('klister', [['Baseklister', 'KB20C'], ['Isklister', 'KX30'], ['Mellomlag', 'KX45N'], ['Dagens klister', 'KX65']])).lag.map((l) => l.produkt), ['KB20C', 'KX65']);
sjekk('forenklet glider uendret', forenklet(stabel('glider', [['Glider', 'HS7']])).lag.map((l) => l.produkt), ['HS7']);
sjekk('forenklet rører ikke originalen', full.lag.length, 4);

if (feil) { console.error(`${feil} feil`); process.exit(1); }
console.log('Alle sjekker OK');
