import { SWIX, glideFor, hardvoksFor, hardvoksForSnø, klisterFor, type Smøresystem } from './tabeller';
import type { Lag, Seksjon, SnøAnalyse, Stabel, Stil, Tur } from './typer';

// Tidsgrenser for dekketrinn [Forslag, åpent punkt 2]
// Dekketrinn styres av det kalde partiet før det blir varmt: begge kriteriene teller [Forslag, åpent punkt 2/8]
export const DEKKE = { toTrinnMinKm: 6, toTrinnMinMin: 90 };
/** Festet regnes ut fra seksjonene der du trenger grep: flatt og stigninger (svake og bratte). Alt som går nedover teller ikke, selv 0,1 %: der staker man, og da er det glid som gjelder [Bruker]. −0,05° ≈ −0,1 % gir slingringsmonn for målestøy i høydedata. */
export const FESTE_MIN_STIGNING = -0.05;
/** Mye skygge: fra denne andelen av løypa (og et temperaturspenn på minst SKYGGE_SPENN °C mellom kaldeste og varmeste del) gis egen råd om blandet føre [Forslag]. */
export const SKYGGE_MYE_ANDEL = 0.3;
export const SKYGGE_SPENN = 4;
/**
 * Lagantall i festesonen [Bruker, fra research nov 2026]: kald snø 4–6 lag, over 30 km opptil 8, rundt 0 °C 2–4 lag, klister 2–3 lag totalt.
 * Motoren reduserer selv i stedet for å anbefale mer.
 */
export const LAG = { kald: 6, langTur: 8, langTurKm: 30, rundt0: 4, rundt0Fra: -1, klister: 3 };
export const MAKS_LAG = LAG.langTur; // absolutt øvre grense
export const lagGrense = (varm: number, lengdeKm: number) => (varm >= LAG.rundt0Fra ? LAG.rundt0 : lengdeKm >= LAG.langTurKm ? LAG.langTur : LAG.kald);
/** Klister brukes bare når snøen er omdannet/skarp (snøtype styrer). Kaldere enn dette brukes hardvoks med binder [Bruker, Nystad: kaldføre er −8 °C og kaldere]. */
/** Skarphet (0–100) som regnes som «veldig hard omdannet snø» der isklister (KX30) legges under dagens klister. */
export const KLISTER_ISHARD = 90;
export const KLISTER_KALDGRENSE = -8;
/** Et produkt regnes som utenfor området når temperaturen er mer enn dette (°C) utenfor det oppgitte området. Kald side tåles mer (fluorfri voks går ofte kaldere enn etiketten), varm side gir ising/baller. */
const TOLERANSE_VARM = 1;
const TOLERANSE_KALD = 2.5;

function utenfor(p: { navn: string; omr: [number, number] }, t: number, hva: string): string | null {
  const [lo, hi] = p.omr;
  if (t >= lo - TOLERANSE_KALD && t <= hi + TOLERANSE_VARM) return null;
  return `${p.navn} (${lo} til ${hi} °C) dekker ikke ${hva} (${t.toFixed(1)} °C). ${t < lo ? 'Du trenger noe kaldere.' : 'Du trenger noe varmere.'}`;
}

const persentil = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};

/** Reduserer lagantallet i grepsonen til høyst `grense`. Returnerer en kort beskrivelse av hva som ble kuttet, eller null. */
function begrensLag(lag: Lag[], grense: number): string | null {
  const maks = (l: Lag) => parseInt(l.antall.split('–').pop() as string, 10) || 0;
  const grep = () => lag.filter((l) => l.rolle !== 'Glidesone (foran og bak)').reduce((s, l) => s + maks(l), 0);
  if (grep() <= grense) return null;
  const kutt: string[] = [];
  const note = (t: string) => { if (!kutt.includes(t)) kutt.push(t); };
  const sett = (rolle: (r: string) => boolean, nytt: string, tekst: string) => {
    for (const l of lag) if (grep() > grense && rolle(l.rolle) && maks(l) > parseInt(nytt, 10)) { l.antall = nytt; note(tekst); }
  };
  const fjern = (rolle: (r: string) => boolean, tekst: string) => {
    for (let i = lag.length - 1; i >= 0 && grep() > grense; i--) if (rolle(lag[i].rolle)) { lag.splice(i, 1); note(tekst); }
  };
  sett((r) => r.startsWith('Dekke'), '1 lag', 'ett lag i hvert dekke');
  sett((r) => r.startsWith('Base'), '1 lag', 'ett lag i hvert base-trinn');
  sett((r) => r === 'Binder', '1 lag', 'ett lag binder');
  sett((r) => r === 'Dagens voks', '3 lag', 'tre lag dagens voks');
  fjern((r) => r === 'Base (kaldere)', 'færre base-trinn');
  sett((r) => r === 'Dagens voks', '2 lag', 'to lag dagens voks');
  fjern((r) => r.startsWith('Dekke'), 'uten dekke');
  return kutt.join(', ');
}

/** lett = Trening: færre lag og høyst ett dekketrinn. */
export function byggStabel(tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett = false, sys0: Smøresystem = SWIX): Stabel {
  const HARDVOKS = hardvoksForSnø(sys0, snø.type === 'omdannet'); // Swix' dobbelte områder velges automatisk etter snøtype
  const sys: Smøresystem = { ...sys0, hardvoks: HARDVOKS };
  const tAlle = tur.seksjoner.map((x) => x.tEff);
  // Festet trenger du på flatt og i stigninger, ikke i nedoverbakker (selv svake: da staker man); er mindre enn 20 % av løypa igjen, brukes hele løypa
  const feste = tAlle.filter((_, i) => seksjoner[i].stigning >= FESTE_MIN_STIGNING);
  const brukerFeste = feste.length >= tAlle.length * 0.2 && feste.length < tAlle.length;
  const t = brukerFeste ? feste : tAlle;
  const kald = persentil(t, 0.1);
  const midt = persentil(t, 0.5);
  const varm = persentil(t, 0.8);
  const lengdeKm = seksjoner[seksjoner.length - 1].endM / 1000;
  const begrunnelse: string[] = [
    `Snøtemperatur langs løypa (luft justert for høyde pluss sol): kaldest ${tur.tMin.toFixed(1)}, varmest ${tur.tMaks.toFixed(1)} °C. Brukt: kald ${kald.toFixed(1)}, midt ${midt.toFixed(1)}, varm ${varm.toFixed(1)} °C (10./50./80. persentil${brukerFeste ? `, bare der du trenger feste: flatt og stigninger, ikke nedoverbakker (${Math.round((feste.length / tAlle.length) * 100)} % av løypa)` : ''}).`,
  ];
  const advarsler = [...snø.advarsler];
  if (tur.skyggeAndel >= SKYGGE_MYE_ANDEL && tur.tMaks - tur.tMin >= SKYGGE_SPENN) {
    const prosent = Math.round(tur.skyggeAndel * 100);
    advarsler.push(
      `Mye skygge (${prosent} % av løypa, ${tur.tMin.toFixed(1)} til ${tur.tMaks.toFixed(1)} °C): smør med kald base og et tynt topplag av den varme voksen, aldri kald voks oppå varm. Bakglatt får du av for hard voks i sola, klabb av tykke lag eller fuktige ski som kommer inn i kald skygge. Kork godt og bruk tynne lag.`,
    );
    begrunnelse.push(`Mye skygge (${prosent} % ≥ ${Math.round(SKYGGE_MYE_ANDEL * 100)} %) og spenn ≥ ${SKYGGE_SPENN} °C: kald base under, varm voks øverst, og klabbrisiko ved overgang fra sol til skygge.`);
  }

  const skarpSnø = snø.type === 'omdannet' && (snø.skarphet >= 50 || tur.tMaks >= 0.5);
  // Klister brukes ikke i skikkelig kulde: skarp, iset bane ved −10 er hardvoks over binder (og evt. isklister bare på de verste partiene)
  const klisterFøre = skarpSnø && tur.tMaks > KLISTER_KALDGRENSE;
  if (skarpSnø && !klisterFøre) {
    begrunnelse.push(`Skarp/omdannet snø, men varmeste del er ${tur.tMaks.toFixed(1)} °C (under ${KLISTER_KALDGRENSE} °C): hardvoks over binder, ikke klister.`);
  }
  if (klisterFøre) return klisterStabel(tur, snø, { kald, midt, varm }, begrunnelse, advarsler, lett, sys);

  // ---- Hardvoks ----
  const dag = hardvoksFor(varm, sys);
  const kaldIdx = hardvoksFor(kald, sys);
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

  const lag: Lag[] = [];
  const gl = glidesone(tur, sys);
  if (gl) lag.push(gl);
  if (sys.binder) {
    const skarp = snø.skarphet >= 50 || lengdeKm > 15 || tur.tMaks >= 0;
    const binder = skarp ? sys.binder.skarp : sys.binder.mild;
    begrunnelse.push(`Binder ${binder.navn}: ${skarp ? 'skarp/omdannet snø, lang tur eller nær 0 °C' : 'ikke skarp snø'}.`);
    lag.push({ rolle: 'Binder', produkt: binder.navn, antall: lett ? '1–2 lag' : '2 lag', merknad: 'Kork inn mellom hvert lag' });
  }
  // Base fra kaldt til varmt (maks to mellomtrinn)
  const mellom: number[] = [];
  if (!lett) for (let i = Math.min(kaldIdx, dag); i < dag && mellom.length < 2; i++) mellom.push(i);
  mellom.forEach((i) => lag.push({ rolle: 'Base (kaldere)', produkt: HARDVOKS[i].navn, antall: '1–2 lag' }));
  lag.push({ rolle: 'Dagens voks', produkt: dagVoks.navn, antall: lett ? '2–3 lag' : '3–4 lag', merknad: `Passer ${dagVoks.omr[0]} til ${dagVoks.omr[1]} °C` });
  begrunnelse.push(`Dagens voks ${dagVoks.navn} velges for varm del (${varm.toFixed(1)} °C).`);
  const ute = utenfor(dagVoks, varm, 'varm del av løypa');
  if (ute) advarsler.push(ute);
  if (tur.sludd) advarsler.push('Nedbør rundt 0 °C: hardvoks kan snøballe og islegge seg i sludd. Vurder klister, felleski eller rubb.');

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
  const grense = lagGrense(varm, lengdeKm);
  const redusert = begrensLag(lag, grense);
  begrunnelse.push(`Lagantall: høyst ${grense} tynne lag i festesonen (${grense === LAG.rundt0 ? 'rundt 0 °C: 2–4 lag' : grense === LAG.langTur ? `kald snø og over ${LAG.langTurKm} km: opptil ${LAG.langTur}` : 'kald snø: 4–6 lag'})${redusert ? `. Redusert: ${redusert}` : ''}.`);
  return { type: 'hardvoks', lag, begrunnelse, advarsler };
}

function klisterStabel(tur: Tur, snø: SnøAnalyse, T: { kald: number; midt: number; varm: number }, begrunnelse: string[], advarsler: string[], lett: boolean, sys: Smøresystem): Stabel {
  const KLISTER = sys.klister;
  // Swix' klisterguide: ett tynt lag baseklister, ett mellomlag, ett tykt dagslag (tykkere enn lagene under til sammen).
  // Isklister (KX30) legges mellom ved skarp/hard bane. Høyst tre lag totalt [Bruker: 2–3 med klister].
  // Erfaring (bruker): KX-klistrene brukes i veldig stabilt vær. Universal (K22/K21S) er mest brukt totalt og passer ved
  // skiftende temperatur. KN33/KN44 (Nero) brukes ved sludd og vekslende forhold.
  const skiftende = tur.sludd || tur.variasjon >= 4 || tur.tMaks - tur.tMin >= 5;
  const universal = T.varm >= -1 ? sys.universalVarm : sys.universalKald;
  const slud = T.varm >= -0.5 ? sys.sluddVarm : sys.sluddKald;
  // [Bruker] KN44 (Nero) i lageret: brukes ved skiftende vær i stedet for universal. Den iser mindre og tåler varierende vær bedre.
  const nero = sys.foretrekkNero && sys.sluddVarm && T.varm >= sys.sluddVarm.omr[0] && T.varm <= sys.sluddVarm.omr[1] ? sys.sluddVarm : undefined;
  const dagP = tur.sludd ? (slud ?? universal) : skiftende ? (nero ?? universal) : undefined;
  // [Bruker] KX30 (blå isklister) brukes som dagens klister på omdannet snø under 0 °C, med voksdekke over (gjerne Blå Extra). Ikke ved sludd eller skiftende vær.
  const isK = sys.isKlister;
  const kaldDekke = !!isK && !tur.sludd && !skiftende && tur.tMaks <= 0.5 && T.varm >= isK.omr[0] - 1 && T.varm <= isK.omr[1] + 1;
  const dag = dagP ?? (kaldDekke ? isK! : KLISTER[klisterFor(T.varm, sys)]);
  // KX30 (blå is) er sjelden [Bruker]: bare på veldig hard omdannet snø, som lag under dagens klister. Ellers er vanlig mellomlag (KX35N/KX45N) standard.
  const hardBane = snø.skarphet >= KLISTER_ISHARD;
  // Mellomlag bare med vanlig klister som ikke står i utenMellomlag; universal og sludd-klister brukes som ett tykt lag.
  const mellomNavn = sys.mellomKlister?.[T.varm < -3 ? 0 : 1];
  const mellom = dagP || kaldDekke || sys.utenMellomlag.includes(dag.navn) || !mellomNavn ? null : KLISTER.find((k) => k.navn === mellomNavn) ?? null;
  const lag: Lag[] = [];
  const gl = glidesone(tur, sys);
  if (gl) lag.push(gl);
  if (sys.baseKlister) lag.push({ rolle: 'Baseklister', produkt: sys.baseKlister.navn, antall: '1 lag', merknad: 'Svært tynt, bare over det slipte området' });
  // Høyst 3 lag klister totalt [Bruker]: baseklister + (isklister på hard bane, ellers mellomlag) + dagens
  const plass = LAG.klister - (sys.baseKlister ? 1 : 0) - 1;
  const medIs = hardBane && !!sys.isKlister && dag.navn !== sys.isKlister.navn && plass >= 1;
  if (medIs) lag.push({ rolle: 'Isklister', produkt: sys.isKlister!.navn, antall: '1 lag', merknad: 'Veldig hard omdannet snø (sjelden): legges under dagens klister' });
  if (mellom && !lett && !medIs && plass >= 1) lag.push({ rolle: 'Mellomlag', produkt: mellom.navn, antall: '1 lag', merknad: 'Fiskebeinsmønster, gni jevnt. Hindrer at dagens klister vandrer bakover' });
  lag.push({ rolle: 'Dagens klister', produkt: dag.navn, antall: '1 tykt lag', merknad: 'Tykkere enn lagene under til sammen' });
  // Klister med dekke [Solid: Swix, NSF, Dæhlie]: tynt klister + 2–3 lag hardvoks over når snøen er under 0 °C eller det kan ligge nysnø i sporet.
  // Hindrer ising og dempar klisteret. Ikke i sludd/våt snø, der hardvoksen baller.
  const medDekke = !tur.sludd && (tur.tMaks <= 0.5 || snø.nysnøOppå >= 1);
  if (medDekke) {
    const hv = sys.hardvoks;
    const i = Math.max(0, hardvoksFor(T.varm, sys) - 1); // litt hardere enn temperaturen tilsier [Swix]
    if (hv[i]) {
      lag.push({ rolle: 'Voksdekke (over klister)', produkt: hv[i].navn, antall: '2–3 lag', merknad: 'La klisteret herde ca. 5 min (gjerne ute) først. Tynne lag, kork mellom hvert' });
      begrunnelse.push(`Klister med dekke: ${tur.tMaks <= 0.5 ? `snøen er under 0 °C (varmest ${tur.tMaks.toFixed(1)} °C)` : `${snø.nysnøOppå.toFixed(0)} cm nysnø kan ligge i sporet`}. 2–3 tynne lag ${hv[i].navn} over klisteret hindrer ising og demper klisteret. Voksdekket slites av etter ca. 1–2 mil.`);
    }
  }
  begrunnelse.push(
    tur.sludd
      ? `Sludd/bløt snø rundt turen: ${dagP === slud && slud ? 'sludd-klister' : 'universalklister'} (${dag.navn}).`
      : skiftende
        ? `Skiftende vær (${tur.variasjon.toFixed(1)} °C utslag i lufta, ${(tur.tMaks - tur.tMin).toFixed(1)} °C langs løypa): ${dagP === nero && nero ? `${nero.navn} (Nero), som iser mindre og tåler varierende vær bedre [Bruker]` : 'Universal-klister'}.`
        : 'Stabilt vær: vanlig klister.'
  );
  begrunnelse.push(
    `Klister: omdannet snø, skarphet ${Math.round(snø.skarphet)} og varmest ${tur.tMaks.toFixed(1)} °C. Dagens klister ${dag.navn} (${dag.farge}) for ${T.varm.toFixed(1)} °C. ${lag.filter((l) => !l.rolle.startsWith('Glidesone') && !l.rolle.startsWith('Voksdekke')).length} lag klister (2–3).`
  );
  const ute = utenfor(dag, T.varm, 'varm del av løypa');
  if (ute) advarsler.push(ute);
  if (medIs) begrunnelse.push(`Isklister: skarphet ${Math.round(snø.skarphet)} ≥ ${KLISTER_ISHARD} gir veldig hard omdannet snø.`);
  if (lett) begrunnelse.push('Trening: uten mellomlag.');
  if (tur.tMin < -2 && tur.tMaks > 0 && !lag.some((l) => l.rolle.startsWith('Voksdekke'))) {
    advarsler.push(`Isingsfare når temperaturen svinger rundt 0 °C. Valgfritt tiltak: ${sys.ising}`);
  }
  return { type: 'klister', lag, begrunnelse, advarsler };
}

/** Skøyting: bare glider, valgt etter snøtemperaturen (snitt langs turen). Temperatur er hovedsaken [Bruker]. */
export function byggGlider(tur: Tur, sys: Smøresystem = SWIX): Stabel {
  const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
  if (!sys.glider.length) return { type: 'glider', tSnitt: snitt, lag: [], begrunnelse: ['Ingen glidevoks å velge blant.'], advarsler: ['Ingen glidevoks i lageret.'] };
  const g = glideFor(snitt, sys);
  const begrunnelse = [
    `Skøyting: bare glider. Snøtemperatur snitt ${snitt.toFixed(1)} °C (kaldest ${tur.tMin.toFixed(1)}, varmest ${tur.tMaks.toFixed(1)}). ${g.navn} (${g.farge}) passer ${g.omr[0]} til ${g.omr[1]} °C.`,
  ];
  begrunnelse.push('Glidere overlapper i temperatur. Ved overlapp velges den kaldeste som passer: heller litt for kaldt enn for varmt.');
  const advarsler: string[] = [];
  const ute = utenfor(g, snitt, 'snøen i snitt');
  if (ute) advarsler.push(ute);
  if (tur.sludd) advarsler.push('Sludd/våt snø: velg heller den varmeste glideren som passer og skrap/børst godt.');
  if (tur.tMaks - tur.tMin >= 6) advarsler.push(`Stor temperaturforskjell langs løypa (${(tur.tMaks - tur.tMin).toFixed(1)} °C). Glideren er valgt for snittet, vurder en kaldere hvis mesteparten er i skyggen.`);
  return {
    type: 'glider',
    tSnitt: snitt,
    lag: [{ rolle: 'Glider', produkt: g.navn, antall: '1 lag', merknad: 'Smelt inn, la den kjøle, skrap og børst. Hydrokarbon uten fluor.' }],
    begrunnelse,
    advarsler,
  };
}

/** Rubbski: bare sludd, aldri ved fare for ordentlig minus [Bruker; −2 °C er Forslag]. */
export const RUBB = { minLuft: -2 };

function glidesone(tur: Tur, sys: Smøresystem): Lag | null {
  if (!sys.glider.length) return null;
  const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
  const g = glideFor(snitt, sys);
  return { rolle: 'Glidesone (foran og bak)', produkt: g.navn, antall: '1 lag', merknad: `Passer ${g.omr[0]} til ${g.omr[1]} °C. Ikke på festesonen.` };
}

/** Felleski: fungerer alltid, men aldri perfekt, og glir alltid [Bruker]. Ingen festevoks eller klister. */
export function byggFelle(tur: Tur, sys: Smøresystem = SWIX): Stabel {
  return {
    type: 'felle',
    lag: [
      { rolle: 'Festesone', produkt: 'Felle', antall: 'Ingen smøring', merknad: 'Ingen festevoks eller klister. Hold fella ren og tørr' },
      ...(glidesone(tur, sys) ? [glidesone(tur, sys)!] : []),
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
export function byggRubb(tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett: boolean, sys: Smøresystem = SWIX): Stabel {
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
      alternativ: byggStabel(tur, snø, seksjoner, lett, sys),
    };
  }
  return {
    type: 'rubb',
    lag: [
      { rolle: 'Festesone', produkt: 'Rubb', antall: 'Ingen smøring', merknad: 'Børst opp med sandpapir (grovt midt under, finere ytterst). Ingen festevoks eller klister' },
      ...(glidesone(tur, sys) ? [glidesone(tur, sys)!] : []),
    ],
    begrunnelse: [`Sluddføre rundt 0 °C uten fare for ordentlig minus (lufta ned til ${tur.luftMin.toFixed(1)} °C): rubb passer.`],
    advarsler: tur.tMaks > 3 ? ['Over +3 °C og blankt: rubben kan bli for glatt og klister er da bedre.'] : [],
    egnet: true,
  };
}

/** Samler alle skityper. */
export function byggSmøring(stil: Stil, tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], lett = false, sys: Smøresystem = SWIX): Stabel {
  if (stil === 'skoyting') return byggGlider(tur, sys);
  if (stil === 'felle') return byggFelle(tur, sys);
  if (stil === 'rubb') return byggRubb(tur, snø, seksjoner, lett, sys);
  return byggStabel(tur, snø, seksjoner, lett, sys);
}

const ENKEL_ROLLER = new Set(['Binder', 'Baseklister', 'Dagens voks', 'Dagens klister', 'Voksdekke (over klister)', 'Glider', 'Festesone', 'Glidesone (foran og bak)']);

/** Forenklet utgave: bare base (binder/baseklister) og dagens smøring. Mellomlag, isklister, kaldere base og dekke utelates [Bruker]. */
export function forenklet(stabel: Stabel): Stabel {
  return { ...stabel, lag: stabel.lag.filter((l) => ENKEL_ROLLER.has(l.rolle)) };
}

export type Alternativ = { stil: 'felle' | 'rubb'; stabel: Stabel; grunn: string };

/** Hvorfor føret er utfordrende å smøre (null = ikke utfordrende) [Bruker: felleski ved utfordrende smøreforhold]. */
export function utfordrendeGrunn(tur: Tur, stabel: Stabel): string | null {
  if (tur.sludd) return 'sludd gjør smøringen vanskelig';
  if (tur.variasjon >= 4 || tur.tMaks - tur.tMin >= 5) return 'skiftende temperatur gjør smøringen vanskelig';
  if (stabel.type === 'klister') return 'klisterføre er krevende å smøre riktig';
  return null;
}

/**
 * Ekstra forslag fra skiparken ved klassisk tur: felleski når føret er utfordrende,
 * rubbski når den passer (sluddføre uten fare for ordentlig minus) [Bruker].
 * `eier` er skityper brukeren har i skiparken.
 */
export function byggAlternativer(eier: Stil[], tur: Tur, snø: SnøAnalyse, seksjoner: Seksjon[], hoved: Stabel, lett = false, sys: Smøresystem = SWIX): Alternativ[] {
  const ut: Alternativ[] = [];
  if (eier.includes('rubb')) {
    const rubb = byggRubb(tur, snø, seksjoner, lett, sys);
    if (rubb.egnet) ut.push({ stil: 'rubb', stabel: rubb, grunn: 'Sluddføre uten fare for ordentlig minus: rubbski passer i dag.' });
  }
  if (eier.includes('felle')) {
    const grunn = utfordrendeGrunn(tur, hoved);
    if (grunn) ut.push({ stil: 'felle', stabel: byggFelle(tur, sys), grunn: `Felleski er et trygt valg i dag: ${grunn}.` });
  }
  return ut;
}
