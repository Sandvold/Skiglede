// Tester OSM-modulen: backcountry ut, navn fra Turrutebasen, dekning mot appen. Kjør: npx --yes tsx scripts/test-osm.ts
import { berik, etterNavn, lesOsmBiter, type LL } from '../src/data/osm';
let feil = 0;
const sjekk = (n: string, a: unknown, f: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(f); if (!ok) feil++; console.log(`${ok ? 'OK  ' : 'FEIL'} ${n}${ok ? '' : ` faktisk ${JSON.stringify(a)} forventet ${JSON.stringify(f)}`}`); };

const linje = (lat: number, lon0: number, lon1: number, n = 6): LL[] => Array.from({ length: n }, (_, i) => [lon0 + ((lon1 - lon0) * i) / (n - 1), lat] as LL);
const rå = lesOsmBiter({ løyper: [
  { osm: 'way/1', navn: null, preparering: 'classic+skating', punkter: linje(59.55, 7.30, 7.31) },      // langs Turrutebasen «Galten»
  { osm: 'way/2', navn: 'Gammelt OSM-navn', preparering: 'classic', punkter: linje(59.56, 7.30, 7.31) }, // ingen Turrutebasen-treff
  { osm: 'way/3', navn: 'HovdenTour', preparering: 'backcountry', punkter: linje(59.57, 7.30, 7.31) },    // ut
  { osm: 'way/4', navn: null, preparering: null, punkter: linje(59.58, 7.30, 7.31) },                     // uten navn
] });
sjekk('backcountry tas ut', rå.map((b) => b.id), ['way/1', 'way/2', 'way/4']);
const b = berik(rå, [{ navn: 'Galten', biter: [linje(59.55002, 7.30, 7.31, 3)] }, { navn: 'Ukjent', biter: [linje(59.58, 7.30, 7.31)] }], [{ navn: 'Galten (i appen)', biter: [linje(59.55, 7.30, 7.305)] }]);
sjekk('navn fra Turrutebasen', [b[0].navn, b[0].navnKilde], ['Galten', 'turrutebasen']);
sjekk('OSM-navn når Turrutebasen ikke har treff', [b[1].navn, b[1].navnKilde], ['Gammelt OSM-navn', 'osm']);
sjekk('«Ukjent» gir ikke navn', [b[2].navn, b[2].navnKilde], [null, null]);
sjekk('dekning ca. halvparten når appen dekker halve biten', Math.abs(b[0].dekning - 0.5) < 0.1, true);
sjekk('appNavn settes ved ≥ 50 % overlapp', b[0].appNavn, 'Galten (i appen)');
sjekk('ingen dekning annet sted', b[1].dekning, 0);
sjekk('gruppering etter navn utelater uten navn', [...etterNavn(b).keys()], ['Galten', 'Gammelt OSM-navn']);
// Rå Overpass-format
sjekk('rå Overpass-JSON leses', lesOsmBiter({ elements: [{ type: 'way', id: 9, tags: { name: 'X', 'piste:grooming': 'classic' }, geometry: [{ lat: 59.5, lon: 7.3 }, { lat: 59.5, lon: 7.31 }] }] }).map((x) => [x.id, x.osmNavn]), [['way/9', 'X']]);
console.log(feil ? `${feil} feil` : 'Alle sjekker OK');
process.exit(feil ? 1 : 0);
