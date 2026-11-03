import { HARDVOKS, KLISTER, hardvoksFor, klisterFor } from './tabeller';
import type { Lag, Seksjon, SnøAnalyse, Stabel, Tur } from './typer';

// Tidsgrenser for dekketrinn [Forslag, åpent punkt 2]
export const DEKKE = { ettTrinnMaksMin: 60, toTrinnMinMin: 120 };

const persentil = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};

export function byggStabel(tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[]): Stabel {
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
  if (klisterFøre) return klisterStabel(tur, snø, { kald, midt, varm }, begrunnelse, advarsler);

  // ---- Hardvoks ----
  const dag = hardvoksFor(varm, snø.type);
  const kaldIdx = hardvoksFor(kald, snø.type);
  const dagVoks = HARDVOKS[dag];
  const [lo] = dagVoks[snø.type];
  const minKaldt = tur.seksjoner.reduce((s, x, i) => {
    const L = (seksjoner[i].endM - seksjoner[i].startM) / 1000;
    return s + (x.tEff < lo ? (L / tur.tempoKmt) * 60 : 0);
  }, 0);

  const binder = snø.skarphet >= 50 || lengdeKm > 15 || tur.tMaks >= 0 ? 'VG35' : 'VG30';
  begrunnelse.push(`Binder ${binder}: ${binder === 'VG35' ? 'skarp/omdannet snø, lang tur eller nær 0 °C' : 'ikke skarp snø'}.`);

  const lag: Lag[] = [{ rolle: 'Binder', produkt: binder, antall: '2 lag', merknad: 'Kork inn mellom hvert lag' }];
  // Base fra kaldt til varmt (maks to mellomtrinn)
  const mellom: number[] = [];
  for (let i = Math.min(kaldIdx, dag); i < dag && mellom.length < 2; i++) mellom.push(i);
  mellom.forEach((i) => lag.push({ rolle: 'Base (kaldere)', produkt: HARDVOKS[i].navn, antall: '1–2 lag' }));
  lag.push({ rolle: 'Dagens voks', produkt: dagVoks.navn, antall: '3–4 lag', merknad: `Passer ${dagVoks[snø.type][0]} til ${dagVoks[snø.type][1]} °C (${snø.type === 'ny' ? 'nysnø' : 'omdannet'})` });
  begrunnelse.push(`Dagens voks ${dagVoks.navn} velges for varm del (${varm.toFixed(1)} °C).`);

  if (minKaldt > 0 && dag > 0) {
    const trinn = minKaldt >= DEKKE.toTrinnMinMin ? 2 : 1;
    for (let k = 1; k <= trinn && dag - k >= 0; k++) {
      lag.push({ rolle: `Dekke ${k}`, produkt: HARDVOKS[dag - k].navn, antall: '2 lag', merknad: 'Kaldere voks øverst, slites av når det blir varmere' });
    }
    begrunnelse.push(
      `Dekke: ${Math.round(minKaldt)} min under ${lo} °C (underkant for ${dagVoks.navn}) gir ${trinn} trinn kaldere (grense ${DEKKE.ettTrinnMaksMin}/${DEKKE.toTrinnMinMin} min).`
    );
  } else {
    begrunnelse.push('Ingen strekning kaldere enn dagens voks: ingen dekke.');
  }
  const totalt = lag.reduce((s, l) => s + parseInt(l.antall.split('–').pop() as string, 10), 0);
  if (totalt > 12) advarsler.push('Mange lag. Hold deg til 4–10 tynne lag totalt og dropp ett base-trinn om nødvendig.');
  return { type: 'hardvoks', lag, begrunnelse, advarsler };
}

function klisterStabel(tur: Tur, snø: SnøAnalyse, T: { kald: number; midt: number; varm: number }, begrunnelse: string[], advarsler: string[]): Stabel {
  const dag = klisterFor(T.varm);
  const midt = klisterFor(T.midt);
  const mellomLag = snø.skarphet >= 70 ? '4–5 lag' : snø.skarphet >= 50 ? '3–4 lag' : '2–3 lag';
  const lag: Lag[] = [
    { rolle: 'Baseklister', produkt: 'KB20C', antall: '1 lag', merknad: 'Glatt ut og la det sette seg' },
    { rolle: 'Isklister', produkt: 'KX30', antall: '1–2 lag' },
    { rolle: 'Mellomlag', produkt: KLISTER[midt === dag ? Math.max(0, dag - 1) : midt].navn, antall: mellomLag, merknad: 'Bygg opp i mange lag, kjøl mellom lag' },
    { rolle: 'Dagens klister', produkt: KLISTER[dag].navn, antall: '1 tykt lag', merknad: 'Tykkere enn lagene under til sammen' },
  ];
  begrunnelse.push(
    `Klister: omdannet snø med skarphet ${Math.round(snø.skarphet)} og varmest ${tur.tMaks.toFixed(1)} °C. Mellomlag ${mellomLag} etter skarphet. Dagens klister ${KLISTER[dag].navn} for ${T.varm.toFixed(1)} °C.`
  );
  if (tur.tMin < -2 && tur.tMaks > 0) {
    advarsler.push('Isingsfare når temperaturen svinger rundt 0: vurder et tynt dekke hardvoks øverst. Dette er unntaket, ikke standard.');
  }
  return { type: 'klister', lag, begrunnelse, advarsler };
}
