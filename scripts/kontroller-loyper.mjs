// Regelkontroll for alle løypefiler src/data/trails*.json. Kjøres med `npm run kontroller` (feiler ved brudd) og i opplastingsjobben (--karantene).
//   node scripts/kontroller-loyper.mjs                       feiler (kode 1) hvis en løype bryter en regel
//   node scripts/kontroller-loyper.mjs --karantene ut.json   skriver { fil: [id, …] } for løyper som bryter regler, avslutter alltid med 0
// Regler:
//  1. Start og slutt er samme punkt (maks 15 m) og samme høyde (maks 1 m).
//  2. Hver løype har type 'retur' eller 'sloyfe'.
//  3. retur: andre halvdel speiler første (hvert punkt maks 60 m fra speilpunktet).
//  4. Ingen hopp mellom nabopunkter over 120 m (hull i løypa).
//  5. Avstand øker jevnt og siste avstand stemmer med lengde_m (1 %).
//  6. sloyfe: maks 30 % av løypa går samme vei to ganger (byggingen sikter på 25 %, kontrollen er sikkerhetsnettet) (ellers er det en tur-retur i forkledning).
//  7. Lengde 3–25 km (advarsel utenfor, ikke feil). Se docs/loypevalg.md.
// Avstander regnes med breddegraden til hvert punkt, så reglene gir samme resultat i Oslo og i Finnmark.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const mappe = new URL('../src/data/', import.meta.url);
const filer = readdirSync(mappe).filter((f) => /^trails.*\.json$/.test(f)).sort();
const iKarantene = process.argv.includes('--karantene');
const karanteneFil = iKarantene ? process.argv[process.argv.indexOf('--karantene') + 1] : null;
const rad = Math.PI / 180;
const m = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(((a[1] + b[1]) / 2) * rad), (a[1] - b[1]) * 111320);
const feil = [];
const advarsler = [];
const karantene = {};
let antall = 0;

for (const fil of filer) {
  for (const t of JSON.parse(readFileSync(new URL(fil, mappe), 'utf8'))) {
    antall++;
    const p = t.punkter;
    const n = p?.length ?? 0;
    const mine = [];
    const mld = (r) => mine.push(`${fil}: ${t.navn}: ${r}`);
    if (n < 2) { mld('mangler punkter'); }
    else {
      if (m(p[0], p[n - 1]) > 15) mld(`start og slutt er ${m(p[0], p[n - 1]).toFixed(0)} m fra hverandre (maks 15 m)`);
      if (Math.abs(p[0][2] - p[n - 1][2]) > 1) mld(`start ${p[0][2]} m og slutt ${p[n - 1][2]} m har ulik høyde`);
      if (p.some((q) => q[2] == null || Number.isNaN(q[2]))) mld('mangler høyde i noen punkter (utenfor høydemodellen?)');
      if (t.type !== 'retur' && t.type !== 'sloyfe') mld(`type mangler eller er ugyldig (${t.type})`);
      if (t.type === 'retur') {
        const avvik = Math.max(...Array.from({ length: Math.floor(n / 2) }, (_, i) => m(p[i], p[n - 1 - i])));
        if (avvik > 60) mld(`retur speiler ikke ut-turen (avvik ${avvik.toFixed(0)} m)`);
      }
      for (let i = 0; i < n - 1; i++) {
        if (m(p[i], p[i + 1]) > 120) mld(`hopp på ${m(p[i], p[i + 1]).toFixed(0)} m ved ${p[i][3]} m (hull i løypa)`);
        if (p[i + 1][3] < p[i][3]) mld(`avstand går bakover ved punkt ${i}`);
      }
      if (t.type === 'sloyfe') {
        // Andel punkter som ligger innen 25 m av et punkt mer enn 300 m unna langs løypa = samme vei to ganger
        let dobbelt = 0;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (Math.abs(p[i][3] - p[j][3]) > 300 && m(p[i], p[j]) < 25) { dobbelt++; break; }
          }
        }
        if (dobbelt / n > 0.30) mld(`sløyfe går ${((dobbelt / n) * 100).toFixed(0)} % av veien to ganger (maks 30 %). Velg annen retur eller bruk retur`);
      }
      if (Math.abs(p[n - 1][3] - t.lengde_m) > 0.01 * t.lengde_m) mld(`lengde_m ${t.lengde_m} stemmer ikke med siste avstand ${p[n - 1][3]}`);
    }
    if (!t.terreng?.length) advarsler.push(`${fil}: ${t.navn}: mangler terrengdata`);
    if (t.lengde_m < 3000 || t.lengde_m > 25000) advarsler.push(`${fil}: ${t.navn}: ${(t.lengde_m / 1000).toFixed(1)} km er utenfor 3–25 km, vurder om det er fornuftig`);
    if (mine.length) { feil.push(...mine); (karantene[fil] ??= []).push(t.id); }
  }
}

advarsler.forEach((a) => console.warn('Advarsel: ' + a));
if (karanteneFil) {
  writeFileSync(karanteneFil, JSON.stringify(karantene));
  feil.forEach((f) => console.warn('Karantene: ' + f));
  console.log(`Løypekontroll: ${antall} løyper, ${Object.values(karantene).flat().length} i karantene.`);
} else if (feil.length) {
  console.error('Løypekontroll feilet:\n- ' + feil.join('\n- '));
  process.exit(1);
} else console.log(`Løypekontroll OK: ${antall} løyper i ${filer.length} filer.`);
