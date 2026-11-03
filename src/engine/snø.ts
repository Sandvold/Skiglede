import type { DagsRad, SnøAnalyse, Vær } from './typer';

const DAG = 86_400_000;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// Alle terskler her er [Forslag] og skal justeres mot Kristoffers erfaring (åpent punkt 1).
export const SNØ = {
  tineGrense: 1, // dagen regnes som «mild» ved maks >= +1 °C
  frostFull: 6, // natt på -6 °C eller kaldere gir full skarphet
  sykluserForFull: 2.5, // vektet sum som gir indeks 100
  vekter: [1, 1, 1, 0.6, 0.6, 0.6, 0.6, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3], // nyeste dag først
  nysnøMm: 5, // snøfall siste 48 t som nullstiller til «ny»
  snødekkeVarsel: 3, // snitt-temp siste 7 døgn over dette gir advarsel
};

/** Analyserer de siste 14 døgnene fram til `nå`. Dag = UTC-døgn, mild dag = maks kl. 08-16 UTC. */
export function analyserSnø(timer: Vær[], nå: number): SnøAnalyse {
  const h = timer.filter((x) => x.ts <= nå && x.ts > nå - 14 * DAG);
  const dagNr = (ts: number) => Math.floor(ts / DAG);
  const siste = dagNr(nå);
  const dager: DagsRad[] = [];
  let sum = 0;
  const forklaring: string[] = [];

  for (let i = 0; i < 14; i++) {
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
    }
    sum += syklus * SNØ.vekter[i];
    dager.push({ dato: new Date(d * DAG).toISOString().slice(0, 10), maks, natt: nattMin, syklus });
  }

  const snøfall48 = h.filter((x) => x.ts > nå - 2 * DAG && x.temp <= 0.5).reduce((s, x) => s + x.nedbor, 0);
  const sju = h.filter((x) => x.ts > nå - 7 * DAG);
  const regn7 = sju.filter((x) => x.temp > 0.5).reduce((s, x) => s + x.nedbor, 0);
  const snittTemp7 = sju.reduce((s, x) => s + x.temp, 0) / Math.max(1, sju.length);
  const milde = sju.filter((x) => x.temp > 1 && x.sw > 200_000).length;

  let skarphet = 100 * clamp(sum / SNØ.sykluserForFull, 0, 1);
  let type: SnøAnalyse['type'] = 'ny';
  if (snøfall48 >= SNØ.nysnøMm) {
    type = 'ny';
    skarphet *= 0.3;
    forklaring.push(`Nysnø: ${snøfall48.toFixed(1)} mm snø siste 48 t nullstiller snøen (skarphet ×0,3).`);
  } else if (sum > 0 || regn7 >= 3 || milde >= 6) {
    type = 'omdannet';
    forklaring.push(`Omdannet snø: vektet tine/frys-sum ${sum.toFixed(2)}, regn siste 7 d ${regn7.toFixed(1)} mm, ${milde} milde soltimer siste 7 d.`);
  } else {
    forklaring.push('Ingen tegn til omdanning siste 14 døgn: bruker nysnø-kolonnen.');
  }
  forklaring.push(`Skarphetsindeks ${Math.round(skarphet)} av 100 (frostdybde natt × milde dager, nyeste dager veier mest).`);

  const advarsler: string[] = [];
  if (snittTemp7 > SNØ.snødekkeVarsel) {
    advarsler.push(`Snitt ${snittTemp7.toFixed(1)} °C siste 7 døgn: mye mildvær og regn. Motoren forutsetter snødekke, sjekk at det finnes snø i løypa.`);
  }
  return { type, skarphet, sykluser: sum, snøfall48, regn7, snittTemp7, dager, forklaring, advarsler };
}
