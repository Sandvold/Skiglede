import type { DagsRad, SnøAnalyse, Vær } from './typer';

const DAG = 86_400_000;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// Alle terskler her er [Forslag] og skal justeres mot Kristoffers erfaring (åpent punkt 1).
export const SNØ = {
  tineGrense: 1, // dagen regnes som «mild» ved maks >= +1 °C
  frostFull: 6, // natt på -6 °C eller kaldere gir full skarphet
  sykluserForFull: 2.5, // vektet sum som gir indeks 100
  dager: 30, // [Bruker] skorpa varer til det snør igjen: ingen alder gjør snøen mindre skarp, så vi ser 30 døgn tilbake
  vekter: [1, 1, 1, 0.6, 0.6, 0.6, 0.6, ...Array(23).fill(0.3)], // nyeste dag først; bare skarphetsindeksen veies etter alder, ikke om snøen er omdannet
  begravMm: 5, // [Bruker] 5 cm nysnø (≈ 5 mm nedbør) oppå uansett lag er helt ny snø: da starter tellingen på skarphet på nytt. Bare nysnø nullstiller, alder gjør det ikke.
  regnMm: 2, // regn på snø siste 7 d som gir skare ved frost (research: lavere enn før)
  minSum: 0.8, // uvektet tine/frys-sum under dette er ikke nok til å kalle snøen omdannet: én svak mild dag er ikke omdanning, men to moderate eller én sterk er det [Forslag]
  vindStille: 3, // under dette (m/s, snitt kl. 08-16 UTC) har vinden ingen effekt på smelting
  vindIngenSmelting: 5, // ved dette og over er det nesten ingen smelting når det bare er svakt over null
  vindMaksT: 4, // over denne maks-temperaturen (°C) tiner det uansett, så vinden dempes ikke
  snødekkeVarsel: 3, // snitt-temp siste 7 døgn over dette gir advarsel
};

/** Analyserer de siste 30 døgnene fram til `nå`. Dag = UTC-døgn, mild dag = maks kl. 08-16 UTC. */
export function analyserSnø(timer: Vær[], nå: number): SnøAnalyse {
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
    if (nattMin !== null && maks >= SNØ.tineGrense) {
      syklus = clamp(-nattMin / SNØ.frostFull, 0, 1) * (0.7 + 0.3 * clamp(solMaks / 800_000, 0, 1));
      // Vind ved 1–2 °C gir fordampning og kjøling i stedet for smelting: lite tining og omdanning [Bruker]. Forsvinner ved høyere temperatur.
      const vind = dagTimer.reduce((a, x) => a + x.vind, 0) / dagTimer.length;
      const vindDemp = clamp((SNØ.vindIngenSmelting - vind) / (SNØ.vindIngenSmelting - SNØ.vindStille), 0, 1);
      const tempFri = clamp((maks - (SNØ.vindMaksT - 2)) / 2, 0, 1); // 0 ved ≤2 °C, 1 ved ≥4 °C
      const f = vindDemp + (1 - vindDemp) * tempFri;
      if (f < 0.95) forklaring.push(`${new Date(d * DAG).toISOString().slice(0, 10)}: maks ${maks.toFixed(1)} °C med ${vind.toFixed(1)} m/s vind gir lite smelting (×${f.toFixed(2)}).`);
      syklus *= f;
    }
    // Snø som falt etter denne syklusen ligger oppå skorpa og skjuler den: syklusen teller bare for det som ikke er dekket.
    const snøEtter = h.filter((x) => x.ts >= d * DAG + 17 * 3600_000 && x.temp <= 0.5).reduce((s, x) => s + x.nedbor, 0);
    if (nysnøOppå === null && syklus > 0) nysnøOppå = snøEtter;
    const dekket = clamp(snøEtter / SNØ.begravMm, 0, 1);
    if (syklus > 0 && dekket > 0.05) forklaring.push(`${new Date(d * DAG).toISOString().slice(0, 10)}: skorpa er dekket av ${snøEtter.toFixed(0)} mm snø siden og teller ×${(1 - dekket).toFixed(2)}.`);
    syklus *= 1 - dekket;
    sum += syklus * SNØ.vekter[i];
    sumUvektet += syklus;
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
  let type: SnøAnalyse['type'] = 'ny';
  // [Bruker] Omdannet/skarp snø blir ikke mindre skarp med alderen: den varer til det snør igjen (≥ 5 cm). Derfor teller uvektet sum.
  const omdannetTegn = sumUvektet >= SNØ.minSum || regn7 >= SNØ.regnMm || milde >= 6;
  if (tBury !== null && !omdannetTegn) {
    type = 'ny';
    forklaring.push(`Nysnø: ${SNØ.begravMm} mm (≈ ${SNØ.begravMm} cm) snø eller mer ligger oppå alt eldre og starter tellingen på nytt.`);
  } else if (omdannetTegn) {
    type = 'omdannet';
    forklaring.push(`Omdannet snø: tine/frys-sum ${sumUvektet.toFixed(2)} (uten aldersvekt), regn siste 7 d ${regn7.toFixed(1)} mm, ${milde} milde soltimer siste 7 d.`);
  } else {
    forklaring.push('Ingen tegn til omdanning siste 30 døgn: bruker nysnø-kolonnen.');
  }
  forklaring.push(`Skarphetsindeks ${Math.round(skarphet)} av 100 (frostdybde natt × milde dager, nyeste dager veier mest).`);

  const advarsler: string[] = [];
  if (snittTemp7 > SNØ.snødekkeVarsel) {
    advarsler.push(`Snitt ${snittTemp7.toFixed(1)} °C siste 7 døgn: mye mildvær og regn. Motoren forutsetter snødekke, sjekk at det finnes snø i løypa.`);
  }
  return { type, skarphet, sykluser: sum, snøfall48, nysnøOppå: nysnøOppå ?? 0, regn7, snittTemp7, dager, forklaring, advarsler };
}
