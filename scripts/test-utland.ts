// Test: ruter utenfor Norge bruker global høydekilde, norske bruker Kartverket. fetch er stubbet (sandkassen når ikke API-ene).
import { byggFraGpx, terrengFor, iNorge } from '../src/data/gpx';
const kall: string[] = [];
(globalThis as any).fetch = async (url: string) => {
  kall.push(url);
  if (url.includes('open-meteo.com/v1/elevation')) {
    const n = new URL(url).searchParams.get('latitude')!.split(',').length;
    if (n > 100) throw new Error('mer enn 100 punkter');
    return { ok: true, json: async () => ({ elevation: Array.from({ length: n }, (_, i) => 1200 + i) }) };
  }
  if (url.includes('geonorge')) return { ok: true, json: async () => ({ punkter: JSON.parse(new URL(url).searchParams.get('punkter')!).map(() => ({ z: 800, terreng: 'Skog' })) }) };
  throw new Error('uventet ' + url);
};
const ok = (b: boolean, t: string) => { if (!b) { console.log('FEIL: ' + t); process.exit(1); } console.log('ok: ' + t); };
(async () => {
  ok(iNorge(59.5, 7.3) && !iNorge(46.4, 11.7) && !iNorge(51.5, 10), 'iNorge skiller Hovden fra Moena og Tyskland');
  // ca. 6 km nær Moena (Val di Fiemme), uten ele i GPX
  const it = Array.from({ length: 61 }, (_, i) => ({ lat: 46.375 + i * 0.0005, lon: 11.66 + i * 0.001 }));
  const l = await byggFraGpx(it, 'Testrute Moena');
  ok(l.punkter.length > 100 && l.punkter[0][2] >= 1200, `Italia: høyde fra global kilde (${l.punkter[0][2]} m, ${l.punkter.length} punkter)`);
  ok(kall.every((u) => !u.includes('geonorge')), 'Italia: ingen Kartverket-kall');
  const t = await terrengFor(l.punkter);
  ok(t.length >= 5 && t.every((x) => x[3].length === 16), `Italia: terreng regnet (${t.length} punkter, 1 km mellomrom)`);
  kall.length = 0;
  const no = Array.from({ length: 61 }, (_, i) => ({ lat: 59.567 + i * 0.0005, lon: 7.367 + i * 0.001 }));
  const n = await byggFraGpx(no, 'Testrute Hovden');
  ok(n.punkter[0][2] === 800 && kall.every((u) => u.includes('geonorge')), 'Norge: Kartverket som før');
  // Sverige (innenfor Norge-avgrensningen, Kartverket gir ingen høyde): faller tilbake til global
  (globalThis as any).fetch = async (url: string) => url.includes('geonorge') ? { ok: true, json: async () => ({ punkter: JSON.parse(new URL(url).searchParams.get('punkter')!).map(() => ({ z: null })) }) } : { ok: true, json: async () => ({ elevation: Array.from({ length: new URL(url).searchParams.get('latitude')!.split(',').length }, () => 400) }) };
  const se = await byggFraGpx(Array.from({ length: 61 }, (_, i) => ({ lat: 61.1 + i * 0.0005, lon: 13.2 + i * 0.001 })), 'Sälen');
  ok(se.punkter[0][2] === 400, 'Sverige: faller tilbake til global høyde');
  console.log('Alle sjekker OK');
})();
