// Regelkontroll for src/data/trails.json. Kjøres før hvert bygg (se netlify.toml) og feiler ved brudd.
//   node scripts/kontroller-loyper.mjs
// Regler:
//  1. Start og slutt er samme punkt (maks 15 m) og samme høyde (maks 1 m).
//  2. Hver løype har type 'retur' eller 'sloyfe'.
//  3. retur: andre halvdel speiler første (hvert punkt maks 60 m fra speilpunktet).
//  4. Ingen hopp mellom nabopunkter over 120 m (hull i løypa).
//  5. Avstand øker jevnt og siste avstand stemmer med lengde_m (1 %).
//  6. sloyfe: maks 25 % av løypa går samme vei to ganger (ellers er det en tur-retur i forkledning).
//  7. Lengde 3–25 km (advarsel utenfor, ikke feil). Se docs/loypevalg.md.
import { readFileSync } from 'node:fs';

const fil = new URL('../src/data/trails.json', import.meta.url);
const trails = JSON.parse(readFileSync(fil, 'utf8'));
const m = (a, b) => Math.hypot((a[0] - b[0]) * 111000 * Math.cos((59.5 * Math.PI) / 180), (a[1] - b[1]) * 111000);
const feil = [];
const advarsler = [];

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
  // Andel punkter som ligger innen 25 m av et punkt mer enn 300 m unna langs løypa = samme vei to ganger
  let dobbelt = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(p[i][3] - p[j][3]) > 300 && m(p[i], p[j]) < 25) {
        dobbelt++;
        break;
      }
    }
  }
  const andel = dobbelt / n;
  if (t.type === 'sloyfe' && andel > 0.25) mld(`sløyfe går ${(andel * 100).toFixed(0)} % av veien to ganger (maks 25 %). Velg annen retur eller bruk retur`);
  if (t.lengde_m < 3000 || t.lengde_m > 25000) advarsler.push(`${t.navn}: ${(t.lengde_m / 1000).toFixed(1)} km er utenfor 3–25 km, vurder om det er fornuftig`);
  if (Math.abs(p[n - 1][3] - t.lengde_m) > 0.01 * t.lengde_m) mld(`lengde_m ${t.lengde_m} stemmer ikke med siste avstand ${p[n - 1][3]}`);
}

if (feil.length) {
  console.error('Løypekontroll feilet:\n- ' + feil.join('\n- '));
  process.exit(1);
}
advarsler.forEach((a) => console.warn('Advarsel: ' + a));
console.log(`Løypekontroll OK: ${trails.length} løyper, alle starter og slutter på samme sted.`);
