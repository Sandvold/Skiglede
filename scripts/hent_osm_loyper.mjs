#!/usr/bin/env node
// Henter merkede langrennsløyper (piste:type=nordic) fra OpenStreetMap via Overpass og lagrer dem som enkel JSON.
// Må kjøres der Overpass er tilgjengelig (ikke fra Claude-arbeidsmiljøet, som blokkerer Overpass).
// Bruk:
//   node scripts/hent_osm_loyper.mjs                          (Hovden, skriver scripts/ut/osm-loyper.json)
//   node scripts/hent_osm_loyper.mjs --bbox 59.50,7.25,59.62,7.45 --ut scripts/ut/osm-loyper.json
//   node scripts/hent_osm_loyper.mjs --fil overpass-turbo-eksport.json   (les en lagret Overpass-respons i stedet)
// Bounding box er sør,vest,nord,øst (som i hent_loyper.py). Bounding box er tryggere enn administrative områder.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { kjørPool, sleep } from './lib/pool.mjs';

// Overpass tåler dårlig store spørringer og mange kall: bounding boxen deles i ruter (én liten spørring hver), rutene tas rolig
// med pause og automatisk retry (429/504: vent 60–90 s), og fremdriften lagres underveis så en avbrutt kjøring tar opp tråden.
// --samtidig N bruker N ulike Overpass-servere parallelt (maks antall speil). Standard 1 = sekvensielt, anbefalt av Overpass.
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BBOX = arg('bbox', '59.50,7.25,59.62,7.45');
const UT = arg('ut', 'scripts/ut/osm-loyper.json');
const FIL = arg('fil', null);
const SPEIL = (arg('speil', null) ?? 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter').split(',');
const SAMTIDIG = Math.max(1, Math.min(Number(arg('samtidig', 1)), SPEIL.length));
const PAUSE_MS = Number(arg('pause', 3)) * 1000; // pause per worker mellom spørringer
const VENT_S = Number(arg('vent', 60)); // ventetid ved 429/504 (60–90 s, tilfeldig tillegg opptil halvparten)
const FORSØK = Number(arg('forsok', 4));
const RUTE_LAT = Number(arg('rute-lat', 0.1)); // grader (ca. 11 km)
const RUTE_LON = Number(arg('rute-lon', 0.2)); // grader (ca. 11 km på 60° N)
const MIDLERTIDIG_FEIL = new Set([429, 502, 503, 504]);

const spørring = (b) => `[out:json][timeout:90];
(
  way["piste:type"="nordic"](${b});
  relation["piste:type"="nordic"](${b});
  way["highway"~"^(track|path)$"]["piste:type"](${b});
);
out geom tags;`;

/** Deler «sør,vest,nord,øst» i ruter à RUTE_LAT × RUTE_LON grader. */
export function delOpp(bbox, dLat = RUTE_LAT, dLon = RUTE_LON) {
  const [s, w, n, e] = bbox.split(',').map(Number);
  const ruter = [];
  for (let la = s; la < n - 1e-9; la += dLat) for (let lo = w; lo < e - 1e-9; lo += dLon) ruter.push([la, lo, Math.min(la + dLat, n), Math.min(lo + dLon, e)].map((v) => Number(v.toFixed(5))).join(','));
  return ruter;
}

/** Én spørring med retry. Ved midlertidig feil (429/504 …) ventes 60–90 s, andre feil prøver neste server etter noen sekunder. */
async function overpass(q, foretrukketSpeil, merke) {
  let sistFeil = '';
  for (let forsøk = 0; forsøk < FORSØK; forsøk++) {
    const url = SPEIL[(foretrukketSpeil + (forsøk > 1 ? forsøk - 1 : 0)) % SPEIL.length]; // bytt server fra og med tredje forsøk
    let midlertidig = false;
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'skiglede-data-scripts (sandvold40@gmail.com)' }, body: 'data=' + encodeURIComponent(q) });
      if (r.ok) return await r.json();
      sistFeil = `HTTP ${r.status}`;
      midlertidig = MIDLERTIDIG_FEIL.has(r.status);
    } catch (e) {
      sistFeil = e.message;
    }
    if (forsøk === FORSØK - 1) break;
    const vent = midlertidig ? (VENT_S + Math.random() * VENT_S * 0.5) * 1000 : 5000;
    console.error(`${merke}: ${sistFeil} fra ${new URL(url).host}, venter ${Math.round(vent / 1000)} s (forsøk ${forsøk + 1}/${FORSØK})`);
    await sleep(vent);
  }
  throw new Error(sistFeil);
}

async function hentAlt() {
  const ruter = delOpp(BBOX);
  const fremdriftsfil = `${UT}.fremdrift.json`;
  let ferdige = {};
  if (existsSync(fremdriftsfil)) {
    const f = JSON.parse(readFileSync(fremdriftsfil, 'utf8'));
    if (f.bbox === BBOX && f.ruter === ruter.length) ferdige = f.ferdige;
    if (Object.keys(ferdige).length) console.error(`Fortsetter: ${Object.keys(ferdige).length} av ${ruter.length} ruter er hentet fra før`);
  }
  const igjen = ruter.filter((r) => !ferdige[r]);
  console.error(`${ruter.length} ruter (${igjen.length} igjen), ${SAMTIDIG} samtidig, pause ${PAUSE_MS / 1000} s`);
  const lagre = () => writeFileSync(fremdriftsfil, JSON.stringify({ bbox: BBOX, ruter: ruter.length, ferdige }));
  mkdirSync(dirname(UT), { recursive: true });
  const res = await kjørPool(
    igjen,
    SAMTIDIG,
    async (rute, nr) => {
      const data = await overpass(spørring(rute), nr, `rute ${ruter.indexOf(rute) + 1}/${ruter.length}`);
      ferdige[rute] = data.elements ?? [];
      return ferdige[rute].length;
    },
    { pause: PAUSE_MS, ferdig: (n, rute, r) => { lagre(); console.error(`[${Object.keys(ferdige).length}/${ruter.length}] ${r.ok ? `${r.verdi} elementer` : `feilet: ${r.feil.message}`}`); } },
  );
  const feilet = igjen.filter((_, i) => !res[i].ok);
  // Samme løype kan ligge i flere ruter: behold ett element per type/id
  const unike = new Map();
  for (const els of Object.values(ferdige)) for (const el of els) unike.set(`${el.type}/${el.id}`, el);
  return { data: { elements: [...unike.values()] }, feilet, fremdriftsfil };
}

const rad = Math.PI / 180;
const meter = (a, b) => Math.hypot((a.lon - b.lon) * Math.cos(a.lat * rad) * 111320, (a.lat - b.lat) * 111320);
const lengde = (g) => g.slice(1).reduce((s, p, i) => s + meter(g[i], p), 0);

export function tilLøyper(data) {
  const ut = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const biter = el.type === 'way' ? [el.geometry] : (el.members ?? []).filter((m) => m.type === 'way' && m.geometry).map((m) => m.geometry);
    for (const g of biter) {
      if (!g || g.length < 2) continue;
      ut.push({
        osm: `${el.type}/${el.id}`,
        navn: tags.name ?? tags['piste:name'] ?? null,
        ref: tags.ref ?? null,
        lysløype: tags.lit ?? null,
        preparering: tags['piste:grooming'] ?? null,
        vanskelighet: tags['piste:difficulty'] ?? null,
        lengde_m: Math.round(lengde(g)),
        punkter: g.map((p) => [Number(p.lon.toFixed(5)), Number(p.lat.toFixed(5))]),
      });
    }
  }
  return ut;
}

let data;
let feilet = [];
let fremdriftsfil = null;
if (FIL) data = JSON.parse(readFileSync(FIL, 'utf8'));
else ({ data, feilet, fremdriftsfil } = await hentAlt());
const løyper = tilLøyper(data);
mkdirSync(dirname(UT), { recursive: true });
writeFileSync(UT, JSON.stringify({ hentet: new Date().toISOString(), bbox: BBOX, kilde: 'OpenStreetMap (ODbL)', ufullstendig: feilet.length ? feilet : undefined, løyper }, null, 1));
console.log(`${løyper.length} biter lagret i ${UT}`);
const perNavn = new Map();
for (const l of løyper) perNavn.set(l.navn ?? '(uten navn)', (perNavn.get(l.navn ?? '(uten navn)') ?? 0) + l.lengde_m);
for (const [n, m] of [...perNavn].sort((a, b) => b[1] - a[1])) console.log(`${(m / 1000).toFixed(1).padStart(6)} km  ${n}`);
if (feilet.length) {
  console.error(`\n${feilet.length} ruter feilet (filen er ufullstendig). Kjør kommandoen på nytt, så fortsetter den med bare de som mangler:\n  ${feilet.join('\n  ')}`);
  process.exit(2);
}
if (fremdriftsfil) rmSync(fremdriftsfil, { force: true });
