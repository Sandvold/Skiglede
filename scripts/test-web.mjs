// Nettlesertest av den eksporterte web-appen (dist). Tester det som har gått galt før:
//   1) løypesiden uten værdata, med for gamle værdata og med ferske værdata
//   2) nabo-løyper i oversiktskartet når du zoomer ut, og at trykk på dem åpner løypa
// Kjør etter `npx expo export --platform web`:   node scripts/test-web.mjs   (krever playwright: `npm i --no-save playwright`)
// Bruker databasen (anonym lesing) for områder og løyper, men er uavhengig av hva værtabellen inneholder (den mockes).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Mangler playwright. Kjør: npm i --no-save playwright'); process.exit(2); }

const DIST = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TYPER = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  let sti = normalize(decodeURIComponent(req.url.split('?')[0]).replace(/^\/Skiglede\/app/, ''));  // dist kan være eksportert med baseUrl (deploy_pages.sh)
  if (sti.endsWith('/') || sti === '.') sti = join(sti, 'index.html');
  try { const buf = await readFile(join(DIST, sti)); res.writeHead(200, { 'content-type': TYPER[extname(sti)] ?? 'application/octet-stream' }); res.end(buf); }
  catch { if (process.env.DEBUG_SERVER) console.log('fallback', req.url); try { const buf = await readFile(join(DIST, 'index.html')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(buf); } catch { res.writeHead(404); res.end(); } }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

const OMRÅDE = 'damslett', LØYPE = 'bordvika-garsjokoia'; // finnes i databasen (Buskerud/Oslo-området)
const dag = 86400e3;
const vær = (alderDøgn) => JSON.stringify([{ referansehoyde_m: 300, timer: [['2026-11-09T10:00:00Z', -2, 0, 80, 2, 0]], oppdatert: new Date(Date.now() - alderDøgn * dag).toISOString() }]);

const browser = await chromium.launch();
let feil = 0;
const sjekk = (navn, ok, info = '') => { console.log(`${ok ? '✓' : '✗'} ${navn}${ok ? '' : '  ' + info}`); if (!ok) feil++; };

async function side(værSvar, omr, løype) {
  const p = await browser.newPage({ viewport: { width: 420, height: 1000 } });
  p.js = [];
  p.on('pageerror', (e) => p.js.push(String(e)));
  await p.route(/\/vaer\?/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: værSvar }));
  await p.addInitScript(([o, l]) => { localStorage.setItem('skiglede.omrade', JSON.stringify(o)); if (l) localStorage.setItem(`skiglede.loype.${o}`, JSON.stringify(l)); else localStorage.removeItem(`skiglede.loype.${o}`); }, [omr, løype]);
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return p;
}
const tekst = async (p) => (await p.innerText('body')).replace(/\n/g, ' / ');

for (const [navn, svar, forvent] of [
  ['vær mangler: løypeinfo og beskjed', '[]', ['Værdata er ikke klare ennå', '15.7 km']],
  ['vær 7 døgn gammelt: løypeinfo uten smøreråd', vær(7), ['Værdata er 7 døgn gamle', '15.7 km']],
  ['ferskt vær: hele siden', vær(0), ['Fargen viser beregnet snøtemperatur', '15.7 km']],
]) {
  const p = await side(svar, OMRÅDE, LØYPE);
  const t = await tekst(p);
  for (const f of forvent) sjekk(`${navn} (${f})`, t.includes(f), t.slice(0, 300));
  sjekk(`${navn}: ingen JS-feil`, p.js.length === 0, p.js[0]);
  await p.close();
}

{
  const p = await side('[]', 'urdin', null);
  const nabo = () => p.evaluate(() => document.querySelectorAll('polyline[stroke-opacity="0.55"]').length);
  const før = await nabo();
  for (let i = 0; i < 2; i++) { await p.getByLabel('Zoom ut').click(); await p.waitForTimeout(500); }
  await p.waitForTimeout(3500);
  const etter = await nabo();
  sjekk(`nabo-løyper: ingen ved start (${før}), mange etter zoom ut (${etter})`, før === 0 && etter > 20);
  await p.locator('polyline[stroke-width="18"]').first().dispatchEvent('click');
  await p.waitForTimeout(3500);
  const omr = await p.evaluate(() => localStorage.getItem('skiglede.omrade'));
  sjekk(`trykk på nabo-løype bytter område (${omr}) og åpner løypa`, omr !== '"urdin"' && (await tekst(p)).includes('← Alle løyper'));
  sjekk('nabo-løyper: ingen JS-feil', p.js.length === 0, p.js[0]);
  await p.close();
}

await browser.close();
server.close();
console.log(feil ? `\n${feil} sjekker feilet` : '\nAlle sjekker OK');
process.exit(feil ? 1 : 0);
