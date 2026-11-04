import type { DagsRad, SnøAnalyse, SnøStatus, Vær } from './typer';

const DAG = 86_400_000;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// Alle terskler her er [Forslag] og skal justeres mot Kristoffers erfaring (åpent punkt 1).
export const SNØ = {
  tempFull: 3, // [Forslag] tining fra 0 °C, full effekt ved +3 °C (Swix: ved 0 °C holder snøen 0 °C, og vanninnholdet øker bare med varme over)
  solFra: 150, // W/m² innstråling der solskorpe begynner å dannes
  solFull: 300, // W/m² der solskorpa er full (lab: skorpe ved ≥ 200 W/m² absorbert; gammel snø absorberer ca. halvparten)
  minSmelt: 0.25, // en dag teller som ekte tine/frys-syklus for «omdannet» bare med minst så mye smelting; svake dager (litt over 0 med vind) bidrar bare til skarphetsindeksen
  solVekt: 0.7, // solskorpe er tynnere (1–2 mm) enn en ordentlig tine/frys-skorpe
  solMinTemp: -3, // solskorpe dannes ned til ca. −3 °C lufttemperatur
  solVindFra: 6, // m/s der vind begynner å kjøle bort solvarmen
  solVindBredde: 4,
  frostFull: 6, // natt på -6 °C eller kaldere gir full skarphet
  sykluserForFull: 2.5, // vektet sum som gir indeks 100
  dager: 14, // vær-vinduet. Skorpa varer likevel til det snør igjen [Bruker]: forrige status (omdannet/ny) huskes av appen når beviset går ut av vinduet
  vekter: [1, 1, 1, 0.6, 0.6, 0.6, 0.6, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3], // nyeste dag først; bare skarphetsindeksen veies etter alder
  begravMm: 5, // [Bruker] 5 cm nysnø (≈ 5 mm nedbør) oppå uansett lag er helt ny snø: da starter tellingen på skarphet på nytt. Bare nysnø nullstiller, alder gjør det ikke.
  regnMm: 2, // regn på snø siste 7 d som gir skare ved frost (research: lavere enn før)
  minSum: 0.8, // uvektet tine/frys-sum under dette er ikke nok til å kalle snøen omdannet: én svak mild dag er ikke omdanning, men to moderate eller én sterk er det [Forslag]
  vindStille: 3, // under dette (m/s, snitt kl. 08-16 UTC) har vinden ingen effekt på smelting
  vindIngenSmelting: 5, // ved dette og over er det nesten ingen smelting når det bare er svakt over null
  vindMaksT: 4, // over denne maks-temperaturen (°C) tiner det uansett, så vinden dempes ikke
  snødekkeVarsel: 3, // snitt-temp siste 7 døgn over dette gir advarsel
};

/** Analyserer de siste 14 døgnene fram til `nå`. Dag = UTC-døgn, mild dag = maks kl. 08-16 UTC. */
/**
 * `forrige` er sist kjente snøstatus (lagres av appen). Er snøen omdannet og det ikke har snødd 5 cm eller mer siden,
 * er den fortsatt omdannet selv om beviset (tine/frys, regn) er eldre enn værvinduet [Bruker]. Bare ny snø nullstiller, alder gjør det ikke.
 */
export function analyserSnø(timer: Vær[], nå: number, forrige?: SnøStatus | null): SnøAnalyse {
  const h = timer.filter((x) => x.ts <= nå && x.ts > nå - SNØ.dager * DAG);
  const dagNr = (ts: number) => Math.floor(ts / DAG);
  const siste = dagNr(nå);
  const dager: DagsRad[] = [];
  let sum = 0;
  let sumUvektet = 0; // tine/frys-sykluser som ikke er dekket av nysnø, uten aldersvekt
  let nysnøOppå: number | null = null; // snø oppå den nyeste skorpa
  const forklaring: string[] = [];

  for (let i = 0; i < SNØ.dager; i++) {
    const d = siste - i;
    const dagTimer = h.filter((x) => dagNr(x.ts) === d && new Date(x.ts).getUTCHours() >= 8 && new Date(x.ts).getUTCHours() <= 16);
    if (!dagTimer.length) continue;
    const maks = Math.max(...dagTimer.map((x) => x.temp));
    const natt = h.filter((x) => x.ts >= d * DAG + 17 * 3600_000 && x.ts < (d + 1) * DAG + 6 * 3600_000);
    const nattMin = natt.length >= 6 ? Math.min(...natt.map((x) => x.temp)) : null;
    const solMaks = Math.max(...dagTimer.map((x) => x.sw));
    let syklus = 0;
    let smeltDag = 0;
    if (nattMin !== null) {
      const vind = dagTimer.reduce((a, x) => a + x.vind, 0) / dagTimer.length;
      // 1) Lufttemperatur: tining vokser gradvis fra 0 °C (full ved +3). Vind ved 1–2 °C gir fordampning og kjøling i stedet for smelting [Bruker]; forsvinner ved høyere temperatur.
      const vindDemp = clamp((SNØ.vindIngenSmelting - vind) / (SNØ.vindIngenSmelting - SNØ.vindStille), 0, 1);
      const tempFri = clamp((maks - (SNØ.vindMaksT - 2)) / 2, 0, 1); // 0 ved ≤2 °C, 1 ved ≥4 °C
      const f = vindDemp + (1 - vindDemp) * tempFri;
      const tempSmelt = clamp(maks / SNØ.tempFull, 0, 1) * f;
      // 2) Sol: solskorpe kan dannes også ved minusgrader når sola varmer overflaten (innstråling over ca. 200 W/m², Cambridge/J. Glaciology «Energy balance and formation of sun crust»), men sterk vind kjøler den bort.
      const solW = solMaks / 3600;
      const solSmelt = maks >= SNØ.solMinTemp ? SNØ.solVekt * clamp((solW - SNØ.solFra) / (SNØ.solFull - SNØ.solFra), 0, 1) * (1 - clamp((vind - SNØ.solVindFra) / SNØ.solVindBredde, 0, 1)) : 0;
      const smelt = Math.max(tempSmelt, solSmelt);
      smeltDag = smelt;
      syklus = clamp(-nattMin / SNØ.frostFull, 0, 1) * (0.7 + 0.3 * clamp(solMaks / 800_000, 0, 1)) * smelt;
      const dato = new Date(d * DAG).toISOString().slice(0, 10);
      if (maks > 0 && smelt < 0.9) forklaring.push(`${dato}: maks ${maks.toFixed(1)} °C, vind ${vind.toFixed(1)} m/s, sol ${Math.round(solW)} W/m² gir ${smelt < 0.05 ? 'nesten ingen' : 'svak'} smelting (×${smelt.toFixed(2)})${solSmelt > tempSmelt ? ' (solskorpe)' : ''}.`);
    }
    // Snø som falt etter denne syklusen ligger oppå skorpa og skjuler den: syklusen teller bare for det som ikke er dekket.
    const snøEtter = h.filter((x) => x.ts >= d * DAG + 17 * 3600_000 && x.temp <= 0.5).reduce((s, x) => s + x.nedbor, 0);
    if (nysnøOppå === null && syklus > 0) nysnøOppå = snøEtter;
    const dekket = clamp(snøEtter / SNØ.begravMm, 0, 1);
    if (syklus > 0 && dekket > 0.05) forklaring.push(`${new Date(d * DAG).toISOString().slice(0, 10)}: skorpa er dekket av ${snøEtter.toFixed(0)} mm snø siden og teller ×${(1 - dekket).toFixed(2)}.`);
    syklus *= 1 - dekket;
    sum += syklus * SNØ.vekter[i];
    if (syklus > 0 && smeltDag >= SNØ.minSmelt) sumUvektet += syklus;
    dager.push({ dato: new Date(d * DAG).toISOString().slice(0, 10), maks, natt: nattMin, syklus });
  }

  const snøfall48 = h.filter((x) => x.ts > nå - 2 * DAG && x.temp <= 0.5).reduce((s, x) => s + x.nedbor, 0);
  // Nysnø-restart: finn tidspunktet der snøen som har falt siden tilsammen er begravMm (≈ 5 cm). Alt før det ligger under ny snø og teller ikke (regn, milde timer). Alder spiller ingen rolle.
  let tBury: number | null = null;
  let acc = 0;
  for (const x of [...h].sort((a, b) => b.ts - a.ts)) {
    if (x.temp <= 0.5) acc += x.nedbor;
    if (acc >= SNØ.begravMm) { tBury = x.ts; break; }
  }
  const sju = h.filter((x) => x.ts > nå - 7 * DAG);
  const etterBury = (x: Vær) => tBury === null || x.ts > tBury;
  const regn7 = sju.filter(etterBury).filter((x) => x.temp > 0.5).reduce((s, x) => s + x.nedbor, 0);
  const snittTemp7 = sju.reduce((s, x) => s + x.temp, 0) / Math.max(1, sju.length);
  const milde = sju.filter(etterBury).filter((x) => x.temp > 1 && x.sw > 200_000 && (x.vind < SNØ.vindIngenSmelting || x.temp > SNØ.vindMaksT)).length; // vind ved svak plussgrad: ingen smelting

  let skarphet = 100 * clamp(sum / SNØ.sykluserForFull, 0, 1);
  let beholdt = false;
  const snøSiden = (ts: number) => h.filter((x) => x.ts > ts && x.temp <= 0.5).reduce((s, x) => s + x.nedbor, 0);
  let type: SnøAnalyse['type'] = 'ny';
  // [Bruker] Omdannet/skarp snø blir ikke mindre skarp med alderen: den varer til det snør igjen (≥ 5 cm). Derfor teller uvektet sum.
  const omdannetTegn = sumUvektet >= SNØ.minSum || regn7 >= SNØ.regnMm || milde >= 6;
  if (tBury !== null && !omdannetTegn) {
    type = 'ny';
    forklaring.push(`Nysnø: ${SNØ.begravMm} mm (≈ ${SNØ.begravMm} cm) snø eller mer ligger oppå alt eldre og starter tellingen på nytt.`);
  } else if (omdannetTegn) {
    type = 'omdannet';
    forklaring.push(`Omdannet snø: tine/frys-sum ${sumUvektet.toFixed(2)} (uten aldersvekt), regn siste 7 d ${regn7.toFixed(1)} mm, ${milde} milde soltimer siste 7 d.`);
  } else if (forrige?.type === 'omdannet' && snøSiden(forrige.ts) < SNØ.begravMm) {
    type = 'omdannet';
    skarphet = Math.max(skarphet, forrige.skarphet);
    beholdt = true;
    forklaring.push(`Snøen var omdannet ${new Date(forrige.ts).toISOString().slice(0, 10)}, og det har ikke kommet 5 cm nysnø siden (${snøSiden(forrige.ts).toFixed(1)} mm): fortsatt skarp.`);
  } else {
    forklaring.push('Ingen tegn til omdanning siste 14 døgn: bruker nysnø-kolonnen.');
  }
  forklaring.push(`Skarphetsindeks ${Math.round(skarphet)} av 100 (frostdybde natt × milde dager, nyeste dager veier mest).`);

  const advarsler: string[] = [];
  if (snittTemp7 > SNØ.snødekkeVarsel) {
    advarsler.push(`Snitt ${snittTemp7.toFixed(1)} °C siste 7 døgn: mye mildvær og regn. Motoren forutsetter snødekke, sjekk at det finnes snø i løypa.`);
  }
  // Status som appen kan lagre. Tidspunktet står stille mens statusen bare er beholdt, så snø etter det summeres riktig.
  const status: SnøStatus = { type, skarphet, ts: beholdt && forrige ? forrige.ts : type === 'ny' && !(tBury !== null) && forrige?.type === 'ny' ? forrige.ts : nå };
  return { status, type, skarphet, sykluser: sum, snøfall48, nysnøOppå: nysnøOppå ?? 0, regn7, snittTemp7, dager, forklaring, advarsler };
}
