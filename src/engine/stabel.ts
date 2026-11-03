import { HARDVOKS, KLISTER, glideFor, hardvoksFor, klisterFor, produkt } from './tabeller';
import type { Lag, Seksjon, SnøAnalyse, Stabel, Stil, Tur } from './typer';

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
  const dag = hardvoksFor(varm);
  const kaldIdx = hardvoksFor(kald);
  const dagVoks = HARDVOKS[dag];
  const [lo] = dagVoks.omr;
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
  lag.push({ rolle: 'Dagens voks', produkt: dagVoks.navn, antall: lett ? '2–3 lag' : '3–4 lag', merknad: `Passer ${dagVoks.omr[0]} til ${dagVoks.omr[1]} °C` });
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
  // Swix' klisterguide: ett tynt lag baseklister, ett mellomlag, ett tykt dagslag (tykkere enn lagene under til sammen).
  // Isklister (KX30) legges mellom ved skarp/hard bane. Maks fire lag totalt (brukerens erfaring: sjelden mer enn 3–4).
  // Erfaring (bruker): KX-klistrene brukes i veldig stabilt vær. Universal (K22/K21S) er mest brukt totalt og passer ved
  // skiftende temperatur. KN33/KN44 (Nero) brukes ved sludd og vekslende forhold.
  const skiftende = tur.sludd || tur.variasjon >= 4 || tur.tMaks - tur.tMin >= 5;
  const dagNavn = tur.sludd ? (T.varm >= -0.5 ? 'KN44' : 'KN33') : skiftende ? (T.varm >= -1 ? 'K22' : 'K21S') : null;
  const dag = dagNavn ? produkt(dagNavn)! : KLISTER[klisterFor(T.varm)];
  const hardBane = snø.skarphet >= 70 || tur.tMin < -3;
  // Mellomlag bare med KX-klister utenom KX35N/KX45N; universal og Nero brukes som ett tykt lag.
  const mellom = dagNavn || dag.navn === 'KX45N' || dag.navn === 'KX35N' ? null : KLISTER[T.varm < -3 ? 1 : 2];
  const lag: Lag[] = [{ rolle: 'Baseklister', produkt: 'KB20C', antall: '1 lag', merknad: 'Svært tynt, bare over det slipte området' }];
  if (hardBane && dag.navn !== 'KX30') lag.push({ rolle: 'Isklister', produkt: 'KX30', antall: '1 lag', merknad: 'Hard/isete bane: gir feste under dagens klister' });
  if (mellom && !lett) lag.push({ rolle: 'Mellomlag', produkt: mellom.navn, antall: '1 lag', merknad: 'Fiskebeinsmønster, gni jevnt. Hindrer at dagens klister vandrer bakover' });
  lag.push({ rolle: 'Dagens klister', produkt: dag.navn, antall: '1 tykt lag', merknad: 'Tykkere enn lagene under til sammen' });
  begrunnelse.push(
    tur.sludd
      ? 'Sludd/bløt snø rundt turen: Nero-klister (KN33 kaldere, KN44 varmere).'
      : skiftende
        ? `Skiftende vær (${tur.variasjon.toFixed(1)} °C utslag i lufta, ${(tur.tMaks - tur.tMin).toFixed(1)} °C langs løypa): Universal-klister.`
        : 'Stabilt vær: vanlig KX-klister.'
  );
  begrunnelse.push(
    `Klister: omdannet snø, skarphet ${Math.round(snø.skarphet)} og varmest ${tur.tMaks.toFixed(1)} °C. Dagens klister ${dag.navn} (${dag.farge}) for ${T.varm.toFixed(1)} °C. ${lag.length} lag totalt (maks 4).`
  );
  if (hardBane) begrunnelse.push(`Isklister: ${snø.skarphet >= 70 ? `skarphet ${Math.round(snø.skarphet)} ≥ 70` : `kaldeste del ${tur.tMin.toFixed(1)} °C`} gir hard bane.`);
  if (lett) begrunnelse.push('Trening: uten mellomlag.');
  if (tur.tMin < -2 && tur.tMaks > 0) {
    advarsler.push('Isingsfare når temperaturen svinger rundt 0: Swix anbefaler minst tre tynne lag hardvoks over klisteren (VP40–VP55, litt hardere enn temperaturen tilsier). Unntak, ikke standard.');
  }
  return { type: 'klister', lag, begrunnelse, advarsler };
}

/** Skøyting: bare glider, valgt etter snøtemperaturen (snitt langs turen). Temperatur er hovedsaken [Bruker]. */
export function byggGlider(tur: Tur): Stabel {
  const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
  const g = glideFor(snitt);
  const begrunnelse = [
    `Skøyting: bare glider. Snøtemperatur snitt ${snitt.toFixed(1)} °C (kaldest ${tur.tMin.toFixed(1)}, varmest ${tur.tMaks.toFixed(1)}). ${g.navn} (${g.farge}) passer ${g.omr[0]} til ${g.omr[1]} °C.`,
  ];
  begrunnelse.push('Glidere overlapper i temperatur. Ved overlapp velges den kaldeste som passer: heller litt for kaldt enn for varmt.');
  const advarsler: string[] = [];
  if (tur.tMaks - tur.tMin >= 6) advarsler.push(`Stor temperaturforskjell langs løypa (${(tur.tMaks - tur.tMin).toFixed(1)} °C). Glideren er valgt for snittet, vurder en kaldere hvis mesteparten er i skyggen.`);
  return {
    type: 'glider',
    lag: [{ rolle: 'Glider', produkt: g.navn, antall: '1 lag', merknad: 'Smelt inn, la den kjøle, skrap og børst. Hydrokarbon uten fluor.' }],
    begrunnelse,
    advarsler,
  };
}

/** Rubbski: bare sludd, aldri ved fare for ordentlig minus [Bruker; −2 °C er Forslag]. */
export const RUBB = { minLuft: -2 };

function glidesone(tur: Tur): Lag {
  const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
  const g = glideFor(snitt);
  return { rolle: 'Glidesone (foran og bak)', produkt: g.navn, antall: '1 lag', merknad: `Passer ${g.omr[0]} til ${g.omr[1]} °C. Ikke på festesonen.` };
}

/** Felleski: fungerer alltid, men aldri perfekt, og glir alltid [Bruker]. Ingen festevoks eller klister. */
export function byggFelle(tur: Tur): Stabel {
  return {
    type: 'felle',
    lag: [
      { rolle: 'Festesone', produkt: 'Felle', antall: 'Ingen smøring', merknad: 'Ingen festevoks eller klister. Hold fella ren og tørr' },
      glidesone(tur),
    ],
    begrunnelse: [
      'Felleski fungerer i alle føre, men gir aldri perfekt feste eller glid: et kompromiss som slår feil smøring, men ikke riktig smøring.',
      `Snøtemperatur ${tur.tMin.toFixed(1)} til ${tur.tMaks.toFixed(1)} °C: samme felle uansett.`,
    ],
    advarsler: [],
    egnet: true,
  };
}

/**
 * Rubbski: bare på sluddføre, og aldri når det er fare for ordentlig minus (da iser rubben).
 * Passer det ikke, frarådes den og vanlig klassisk smøring foreslås som alternativ.
 */
export function byggRubb(tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett: boolean): Stabel {
  const grunner: string[] = [];
  if (!tur.sludd) grunner.push('Rubb brukes bare på sluddføre (nedbør rundt 0 °C). Det er ikke meldt sludd rundt turen.');
  const kaldest = Math.min(tur.luftMin, tur.tMin);
  if (kaldest < RUBB.minLuft) {
    grunner.push(`Fare for ordentlig minus: ned mot ${kaldest.toFixed(1)} °C rundt turen (grense ${RUBB.minLuft} °C). Rubben iser.`);
  }
  if (grunner.length) {
    return {
      type: 'rubb',
      lag: [],
      begrunnelse: ['Rubbski passer ikke i dag. Vanlig klassisk smøring er foreslått i stedet.'],
      advarsler: grunner,
      egnet: false,
      alternativ: byggStabel(tur, snø, seksjoner, lett),
    };
  }
  return {
    type: 'rubb',
    lag: [
      { rolle: 'Festesone', produkt: 'Rubb', antall: 'Ingen smøring', merknad: 'Børst opp med sandpapir (grovt midt under, finere ytterst). Ingen festevoks eller klister' },
      glidesone(tur),
    ],
    begrunnelse: [`Sluddføre rundt 0 °C uten fare for ordentlig minus (lufta ned til ${tur.luftMin.toFixed(1)} °C): rubb passer.`],
    advarsler: tur.tMaks > 3 ? ['Over +3 °C og blankt: rubben kan bli for glatt og klister er da bedre.'] : [],
    egnet: true,
  };
}

/** Samler alle skityper. */
export function byggSmøring(stil: Stil, tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett = false): Stabel {
  if (stil === 'skoyting') return byggGlider(tur);
  if (stil === 'felle') return byggFelle(tur);
  if (stil === 'rubb') return byggRubb(tur, snø, seksjoner, lett);
  return byggStabel(tur, snø, seksjoner, lett);
}
