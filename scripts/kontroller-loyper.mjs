// Regelkontroll for src/data/trails.json. Kjøres før hvert bygg (se netlify.toml) og feiler ved brudd.
//   node scripts/kontroller-loyper.mjs
// Regler:
//  1. Start og slutt er samme punkt (maks 15 m) og samme høyde (maks 1 m).
//  2. Hver løype har type 'retur' eller 'sloyfe'.
//  3. retur: andre halvdel speiler første (hvert punkt maks 60 m fra speilpunktet).
//  4. Ingen hopp mellom nabopunkter over 120 m (hull i løypa).
//  5. Avstand øker jevnt og siste avstand stemmer med lengde_m (1 %).
import { readFileSync } from 'node:fs';

const fil = new URL('../src/data/trails.json', import.meta.url);
const trails = JSON.parse(readFileSync(fil, 'utf8'));
const m = (a, b) => Math.hypot((a[0] - b[0]) * 111000 * Math.cos((59.5 * Math.PI) / 180), (a[1] - b[1]) * 111000);
const feil = [];

for (const t of trails) {
  const p = t.punkter;
  const n = p.length;
  const mld = (r) => feil.push(`${t.navn}: ${r}`);
  if (m(p[0], p[n - 1]) > 15) mld(`start og slutt er ${m(p[0], p[n - 1]).toFixed(0)} m fra hverandre (maks 15 m)`);
  if (Math.abs(p[0][2] - p[n - 1][2]) > 1) mld(`start ${p[0][2]} m og slutt ${p[n - 1][2]} m har ulik høyde`);
  if (t.type !== 'retur' && t.type !== 'sloyfe') mld(`type mangler eller er ugyldig (${t.type})`);
  if (t.type === 'retur') {
    const avvik = Math.max(...Array.from({ length: Math.floor(n / 2) }, (_, i) => m(p[i], p[n - 1 - i])));
    if (avvik > 60) mld(`retur speiler ikke ut-turen (avvik ${avvik.toFixed(0)} m)`);
  }
  for (let i = 0; i < n - 1; i++) {
    if (m(p[i], p[i + 1]) > 120) mld(`hopp på ${m(p[i], p[i + 1]).toFixed(0)} m ved ${p[i][3]} m (hull i løypa)`);
    if (p[i + 1][3] < p[i][3]) mld(`avstand går bakover ved punkt ${i}`);
  }
  if (Math.abs(p[n - 1][3] - t.lengde_m) > 0.01 * t.lengde_m) mld(`lengde_m ${t.lengde_m} stemmer ikke med siste avstand ${p[n - 1][3]}`);
}

if (feil.length) {
  console.error('Løypekontroll feilet:\n- ' + feil.join('\n- '));
  process.exit(1);
}
console.log(`Løypekontroll OK: ${trails.length} løyper, alle starter og slutter på samme sted.`);
