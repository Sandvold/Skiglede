// Kjøres med: npx --yes tsx scripts/test-lager-skipark.ts  (feiler med exit 1 hvis en sjekk ikke stemmer)
import { glideFor, tilpassTilLager, vurderPåfylling, type Stabel, type Smøring } from '../src/engine';

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
sjekk('kaldere hardvoks = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP55']]), ny).handling, 'rens');
sjekk('klister -> hardvoks = rens', vurderPåfylling(smør('klister', [['Dagens klister', 'KX65']]), ny).handling, 'rens');
sjekk('hardvoks -> klister = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP45']]), stabel('klister', [['Dagens klister', 'KX65']])).handling, 'rens');
sjekk('4 turer = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']], 4), ny).handling, 'rens');
sjekk('3 turer = topplag', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']], 3), ny).handling, 'topplag');
sjekk('15 dager gammel = rens', vurderPåfylling(smør('hardvoks', [['Dagens voks', 'VP40']], 1, 15), ny).handling, 'rens');
sjekk('klister varmere = topplag', vurderPåfylling(smør('klister', [['Dagens klister', 'KX45N']]), stabel('klister', [['Dagens klister', 'KX65']])).handling, 'topplag');
sjekk('glider: HS7 -> HS8 (varmere) = topplag', vurderPåfylling(smør('glider', [['Glider', 'HS7']]), stabel('glider', [['Glider', 'HS8']])).handling, 'topplag');
sjekk('glider: HS8 -> HS7 (kaldere) = rens', vurderPåfylling(smør('glider', [['Glider', 'HS8']]), stabel('glider', [['Glider', 'HS7']])).handling, 'rens');

if (feil) { console.error(`${feil} feil`); process.exit(1); }
console.log('Alle sjekker OK');
