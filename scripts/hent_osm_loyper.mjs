#!/usr/bin/env node
// Henter merkede langrennsløyper (piste:type=nordic) fra OpenStreetMap via Overpass og lagrer dem som enkel JSON.
// Må kjøres der Overpass er tilgjengelig (ikke fra Claude-arbeidsmiljøet, som blokkerer Overpass).
// Bruk:
//   node scripts/hent_osm_loyper.mjs                          (Hovden, skriver scripts/ut/osm-loyper.json)
//   node scripts/hent_osm_loyper.mjs --bbox 59.50,7.25,59.62,7.45 --ut scripts/ut/osm-loyper.json
//   node scripts/hent_osm_loyper.mjs --fil overpass-turbo-eksport.json   (les en lagret Overpass-respons i stedet)
// Bounding box er sør,vest,nord,øst (som i hent_loyper.py). Bounding box er tryggere enn administrative områder.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BBOX = arg('bbox', '59.50,7.25,59.62,7.45');
const UT = arg('ut', 'scripts/ut/osm-loyper.json');
const FIL = arg('fil', null);
const SPEIL = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const spørring = (b) => `[out:json][timeout:90];
(
  way["piste:type"="nordic"](${b});
  relation["piste:type"="nordic"](${b});
  way["highway"~"^(track|path)$"]["piste:type"](${b});
);
out geom tags;`;

async function overpass(q) {
  for (let forsøk = 0; forsøk < 6; forsøk++) {
    const url = SPEIL[forsøk % SPEIL.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'skiglede-data-scripts (sandvold40@gmail.com)' }, body: 'data=' + encodeURIComponent(q) });
      if (r.ok) return await r.json();
      console.error(`${url}: HTTP ${r.status}, prøver igjen`);
    } catch (e) {
      console.error(`${url}: ${e.message}, prøver igjen`);
    }
    await sleep(2000 * (forsøk + 1)); // rate limit: vent lenger for hvert forsøk
  }
  throw new Error('Overpass svarte ikke. Prøv igjen senere, eller kjør spørringen i overpass-turbo og bruk --fil.');
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

const data = FIL ? JSON.parse(readFileSync(FIL, 'utf8')) : await overpass(spørring(BBOX));
const løyper = tilLøyper(data);
mkdirSync(dirname(UT), { recursive: true });
writeFileSync(UT, JSON.stringify({ hentet: new Date().toISOString(), bbox: BBOX, kilde: 'OpenStreetMap (ODbL)', løyper }, null, 1));
console.log(`${løyper.length} biter lagret i ${UT}`);
const perNavn = new Map();
for (const l of løyper) perNavn.set(l.navn ?? '(uten navn)', (perNavn.get(l.navn ?? '(uten navn)') ?? 0) + l.lengde_m);
for (const [n, m] of [...perNavn].sort((a, b) => b[1] - a[1])) console.log(`${(m / 1000).toFixed(1).padStart(6)} km  ${n}`);
