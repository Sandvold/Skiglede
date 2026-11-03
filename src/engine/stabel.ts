import { HARDVOKS, KLISTER, hardvoksFor, klisterFor } from './tabeller';
import type { Lag, Seksjon, SnøAnalyse, Stabel, Tur } from './typer';

// Tidsgrenser for dekketrinn [Forslag, åpent punkt 2]
// Dekketrinn styres av det kalde partiet før det blir varmt: begge kriteriene teller [Forslag, åpent punkt 2/8]
export const DEKKE = { toTrinnMinKm: 6, toTrinnMinMin: 90 };

const persentil = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};

/** lett = Trening: færre lag og høyst ett dekketrinn. */
export function byggStabel(tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett = false): Stabel {
  const t = tur.seksjoner.map((x) => x.tEff);
  const kald = persentil(t, 0.1);
  const midt = persentil(t, 0.5);
  const varm = persentil(t, 0.8);
  const lengdeKm = seksjoner[seksjoner.length - 1].endM / 1000;
  const begrunnelse: string[] = [
    `Snøtemperatur langs løypa (luft justert for høyde pluss sol): kaldest ${tur.tMin.toFixed(1)}, varmest ${tur.tMaks.toFixed(1)} °C. Brukt: kald ${kald.toFixed(1)}, midt ${midt.toFixed(1)}, varm ${varm.toFixed(1)} °C (10./50./80. persentil).`,
  ];
  const advarsler = [...snø.advarsler];

  const klisterFøre = snø.type === 'omdannet' && (snø.skarphet >= 50 || tur.tMaks >= 0.5);
  if (klisterFøre) return klisterStabel(tur, snø, { kald, midt, varm }, begrunnelse, advarsler, lett);

  // ---- Hardvoks ----
  const dag = hardvoksFor(varm, snø.type);
  const kaldIdx = hardvoksFor(kald, snø.type);
  const dagVoks = HARDVOKS[dag];
  const [lo] = dagVoks[snø.type];
  // Kaldt parti før det blir varmt: sammenhengende fra start til første seksjon over underkanten til dagens voks
  let kmKaldt = 0;
  let minKaldt = 0;
  let iKaldt = 0;
  for (; iKaldt < tur.seksjoner.length && tur.seksjoner[iKaldt].tEff < lo; iKaldt++) {
    const L = (seksjoner[iKaldt].endM - seksjoner[iKaldt].startM) / 1000;
    kmKaldt += L;
    minKaldt += (L / tur.tempoKmt) * 60;
  }
  const blirVarmt = iKaldt > 0 && iKaldt < tur.seksjoner.length;

  const binder = snø.skarphet >= 50 || lengdeKm > 15 || tur.tMaks >= 0 ? 'VG35' : 'VG30';
  begrunnelse.push(`Binder ${binder}: ${binder === 'VG35' ? 'skarp/omdannet snø, lang tur eller nær 0 °C' : 'ikke skarp snø'}.`);

  const lag: Lag[] = [{ rolle: 'Binder', produkt: binder, antall: lett ? '1–2 lag' : '2 lag', merknad: 'Kork inn mellom hvert lag' }];
  // Base fra kaldt til varmt (maks to mellomtrinn)
  const mellom: number[] = [];
  if (!lett) for (let i = Math.min(kaldIdx, dag); i < dag && mellom.length < 2; i++) mellom.push(i);
  mellom.forEach((i) => lag.push({ rolle: 'Base (kaldere)', produkt: HARDVOKS[i].navn, antall: '1–2 lag' }));
  lag.push({ rolle: 'Dagens voks', produkt: dagVoks.navn, antall: lett ? '2–3 lag' : '3–4 lag', merknad: `Passer ${dagVoks[snø.type][0]} til ${dagVoks[snø.type][1]} °C (${snø.type === 'ny' ? 'nysnø' : 'omdannet'})` });
  begrunnelse.push(`Dagens voks ${dagVoks.navn} velges for varm del (${varm.toFixed(1)} °C).`);

  if (blirVarmt && dag > 0) {
    let trinn = kmKaldt >= DEKKE.toTrinnMinKm || minKaldt >= DEKKE.toTrinnMinMin ? 2 : 1;
    if (lett) trinn = 1;
    for (let k = 1; k <= trinn && dag - k >= 0; k++) {
      lag.push({ rolle: `Dekke ${k}`, produkt: HARDVOKS[dag - k].navn, antall: lett ? '1–2 lag' : '2 lag', merknad: 'Kaldere voks øverst, slites av når det blir varmere' });
    }
    begrunnelse.push(
      `Dekke: ${kmKaldt.toFixed(1)} km / ${Math.round(minKaldt)} min under ${lo} °C før det blir varmt gir ${trinn} trinn kaldere (to trinn fra ${DEKKE.toTrinnMinKm} km eller ${DEKKE.toTrinnMinMin} min${lett ? '; Trening får maks ett' : ''}).`
    );
  } else {
    begrunnelse.push('Ingen kaldt parti etterfulgt av varmere føre: ingen dekke.');
  }
  if (lett) begrunnelse.push('Trening: færre og tynnere lag enn på tur, og ingen mellomtrinn i basen.');
  const totalt = lag.reduce((s, l) => s + parseInt(l.antall.split('–').pop() as string, 10), 0);
  if (totalt > 12) advarsler.push('Mange lag. Hold deg til 4–10 tynne lag totalt og dropp ett base-trinn om nødvendig.');
  return { type: 'hardvoks', lag, begrunnelse, advarsler };
}

function klisterStabel(tur: Tur, snø: SnøAnalyse, T: { kald: number; midt: number; varm: number }, begrunnelse: string[], advarsler: string[], lett: boolean): Stabel {
  const dag = klisterFor(T.varm);
  const midt = klisterFor(T.midt);
  const mellomLag = lett ? (snø.skarphet >= 70 ? '2–3 lag' : '2 lag') : snø.skarphet >= 70 ? '4–5 lag' : snø.skarphet >= 50 ? '3–4 lag' : '2–3 lag';
  const lag: Lag[] = [
    { rolle: 'Baseklister', produkt: 'KB20C', antall: '1 lag', merknad: 'Glatt ut og la det sette seg' },
    { rolle: 'Isklister', produkt: 'KX30', antall: lett ? '1 lag' : '1–2 lag' },
    { rolle: 'Mellomlag', produkt: KLISTER[midt === dag ? Math.max(0, dag - 1) : midt].navn, antall: mellomLag, merknad: 'Bygg opp i mange lag, kjøl mellom lag' },
    { rolle: 'Dagens klister', produkt: KLISTER[dag].navn, antall: '1 tykt lag', merknad: 'Tykkere enn lagene under til sammen' },
  ];
  begrunnelse.push(
    `Klister: omdannet snø med skarphet ${Math.round(snø.skarphet)} og varmest ${tur.tMaks.toFixed(1)} °C. Mellomlag ${mellomLag} etter skarphet${lett ? ' (Trening: færre lag)' : ''}. Dagens klister ${KLISTER[dag].navn} for ${T.varm.toFixed(1)} °C.`
  );
  if (tur.tMin < -2 && tur.tMaks > 0) {
    advarsler.push('Isingsfare når temperaturen svinger rundt 0: vurder et tynt dekke hardvoks øverst. Dette er unntaket, ikke standard.');
  }
  return { type: 'klister', lag, begrunnelse, advarsler };
}
