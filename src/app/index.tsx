import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrailMap } from '@/components/ski/kart';
import { Hoydeprofil } from '@/components/ski/profil';
import { Temperaturoversikt, tekstPå, type OversiktVisning } from '@/components/ski/oversikt';
import { Hero } from '@/components/ski/hero';
import { UnderlagValg } from '@/components/ski/underlag';
import { Chip, Kort, Sammenleggbar, Valgboks } from '@/components/ski/ui';
import { byggRute, tilhørende, type Løype } from '@/data/rute';
import { løypeFeilFor, useLøyper, useLøypeliste, type LøypeInfo } from '@/data/loyper';
import { EgneRuter } from '@/components/ski/egne-ruter';
import { useEgneRuterIOmråde } from '@/data/egneruter';
import { Loypevelger } from '@/components/ski/loypevelger';
import { Oversiktskart } from '@/components/ski/oversiktskart';
import { MaxContentWidth, Spacing, tempFarge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNaboløyper } from '@/data/naboloyper';
import type { KartBoks } from '@/components/ski/zoomkart';
import { oppdaterHistorikk, useOmråde, useOmråder, useVær, useVærstatus, VÆR_FERSK_DØGN, type Område, type Værstatus } from '@/data/omrader';
import { hentVarsel, lesVarselCache, type Varsel } from '@/data/varsel';
import { usePremium } from '@/data/premium';
import { osloDato, osloTs, timerI } from '@/data/tid';
import { Loggkort } from '@/components/ski/loggkort';
import { NØKKEL_BRUK_LAGER, NØKKEL_LAGER, NØKKEL_SKIPARK, NØKKEL_VALGTE, NØKKEL_VISNING, TOM_LISTE, useLagret, useStedData, type Ski } from '@/data/lagring';
import { useRouter } from 'expo-router';
import { skrivFraKonto } from '@/data/lagring';
import { SWIX, SYSTEMER, merkeAv, innkjøpsforslag, soneFor, soneVurdering, analyserSnø, produkt, byggMedLager, glideSystemFraLager, lagSeksjoner, forenklet, byggAlternativer, lagreSmøring, planTur, snøMedUnderlag, turMedUnderlag, medUnderlag, INGEN_UNDERLAG, type Underlag, vurderPåfylling, type SnøStatus, type Stabel, type Stil, type Vær } from '@/engine';

/** Værtimer fra 3 t før start. Dekker været ikke starttiden (utdatert prognose), brukes siste timene i stedet for å krasje. */
const vindu = (alle: Vær[], startTs: number): Vær[] => {
  const v = alle.filter((t) => t.ts >= startTs - 3 * 3600_000);
  return v.length ? v : alle.slice(-6);
};
const dagNavn = (dato: string, i: number) =>
  i === 0 ? 'I dag' : i === 1 ? 'I morgen' : new Intl.DateTimeFormat('nb-NO', { weekday: 'long', timeZone: 'UTC' }).format(Date.parse(dato + 'T12:00:00Z'));
const DAGER = [0, 1, 2];

const STIL_NAVN: Record<Stil, string> = { klassisk: 'Klassisk', felle: 'Felleski', rubb: 'Rubbski', skoyting: 'Skøyting' };
const TYPE_NAVN = { hardvoks: 'Hardvoks', klister: 'Klister', glider: 'Glider', felle: 'Felleski', rubb: 'Rubbski' } as const;

// km/t [Bruker]: klassisk tur 7 og trening 10; skøyting tur 10 og trening 15.
const TEMPO = { klassisk: { Trening: 10, Tur: 7 }, skoyting: { Trening: 15, Tur: 10 } } as const;
type Modus = 'Trening' | 'Tur';
const MODI: Modus[] = ['Tur', 'Trening'];
const VARSEL_GAMMELT_T = 6; // timer
const HISTORIKK_GAMMEL_T = 12; // timer
// Starttidspunkt hver halvtime fra 06:00 til 23:00, lokal tid
const STARTTIDER = Array.from({ length: (23 - 6) * 2 + 1 }, (_, i) => 6 + i / 2);
const klokke = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

const tid = (ts: number) => new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).format(ts);

function produktFarge(navn: string) {
  return produkt(navn)?.hex ?? '#B9C7D6';
}

const erGlidesone = (l: { rolle: string }) => l.rolle.startsWith('Glidesone');

/** Glideren (foran og bak festesonen) er valgfri og ikke en del av festestabelen: vises som egen boks. */
function GliderBoks({ lag }: { lag?: { produkt: string; merknad?: string } }) {
  const theme = useTheme();
  if (!lag) return null;
  const p = produkt(lag.produkt);
  return (
    <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 14, padding: 12, gap: 6 }}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>GLIDER (VALGFRI)</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: produktFarge(lag.produkt), borderWidth: 1, borderColor: theme.border }} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{lag.produkt}{p ? <Text style={{ fontWeight: '500', fontSize: 14 }}>  {p.farge}</Text> : null}</Text>
      </View>
      <ThemedText type="small" themeColor="textSecondary">Foran og bak festesonen. {(lag.merknad ?? '').replace(/\s*Ikke på festesonen\.?/, '')}</ThemedText>
    </View>
  );
}

function Tall({ verdi, tekst }: { verdi: string; tekst: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tall, { backgroundColor: theme.background }]}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{verdi}</Text>
      <ThemedText type="small" themeColor="textSecondary">{tekst}</ThemedText>
    </View>
  );
}

/** Løypesiden: med ferske værdata vises hele siden. Uten (nytt område, eller værjobben har stoppet) vises løypa uten smøreråd, med beskjed om hvorfor. */
function Detalj(props: { løype: Løype; liste: LøypeInfo[]; område: Område; onVelg: (id: string) => void; onTilbake: () => void }) {
  const status = useVærstatus(props.område);
  if (!status.fersk) return <DetaljUtenVær {...props} status={status} />;
  return <DetaljMedVær {...props} />;
}

/** Løypeinfo som ikke avhenger av vær: kart, lengde, høyde og profil. Smøreråd vises først når været er ferskt (maks 4 døgn gammelt), så ingen får råd bygget på gamle data. */
function DetaljUtenVær({ løype, liste, område, onVelg, onTilbake, status }: { løype: Løype; liste: LøypeInfo[]; område: Område; onVelg: (id: string) => void; onTilbake: () => void; status: Værstatus }) {
  const theme = useTheme();
  const gruppe = løype.variantAv ?? løype.id;
  const varianter = liste.filter((l) => l.id === gruppe || l.variantAv === gruppe);
  const km = løype.lengde_m / 1000;
  const hs = løype.punkter.map((p) => p[2]);
  const opp = løype.punkter.slice(1).reduce((sum, p, i) => sum + Math.max(0, p[2] - løype.punkter[i][2]), 0);
  const farge = theme.accent;
  const segmenter = useMemo(() => [{ pts: løype.punkter.map((p) => [p[0], p[1]] as [number, number]), farge }], [løype, farge]);
  const profil = useMemo(() => løype.punkter.map((p) => ({ d: p[3], h: p[2], farge })), [løype, farge]);
  const dager = status.alderDøgn === null ? null : Math.floor(status.alderDøgn);
  const nettFeil = status.feilet && dager === null;
  const tittel = !status.lastet
    ? 'Henter værdata …'
    : nettFeil
      ? 'Fikk ikke hentet værdata'
      : dager === null
      ? 'Værdata er ikke klare ennå'
      : `Værdata er ${dager} døgn gamle`;
  const tekst = !status.lastet
    ? 'Smøretipset vises så snart været er hentet.'
    : nettFeil
      ? 'Sjekk nettforbindelsen og prøv igjen. Løypa kan du se på i mellomtiden.'
      : dager === null
      ? `${område.navn} er nytt, og værjobben har ikke samlet data her ennå. Den kjører hver 4. time, så smøretips kommer automatisk. Løypa er klar til å se på i mellomtiden.`
      : `Siste oppdatering er for gammel til at vi vil gi smøreråd (grensen er ${VÆR_FERSK_DØGN} døgn). Det kan bety at værtjenesten har stoppet. Tipsene kommer tilbake når nye data er hentet.`;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <Pressable onPress={onTilbake} style={[styles.chip, { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Alle løyper</Text>
        </Pressable>
        <Loypevelger løyper={liste.filter((l) => !l.variantAv)} valgt={gruppe} onVelg={onVelg} />
        {varianter.length > 1 && (
          <View style={styles.rad}>
            {varianter.map((v) => (
              <Chip key={v.id} aktiv={v.id === løype.id} onPress={() => onVelg(v.id)}>
                {`${v.type === 'retur' ? 'Tur-retur' : 'Sløyfe'} · ${(v.lengde_m / 1000).toFixed(1)} km`}
              </Chip>
            ))}
          </View>
        )}
        <View style={[styles.advarsel, { borderColor: '#E3A64A' }]}>
          <ThemedText type="smallBold">⚠ {tittel}</ThemedText>
          <ThemedText type="small">{tekst}</ThemedText>
        </View>
        <Kort>
          <Text style={[styles.h2, { color: theme.text }]}>{løype.navn}</Text>
          <View style={styles.rad}>
            <Tall verdi={`${km.toFixed(1)} km`} tekst={løype.type === 'retur' ? 'tur-retur' : løype.type === 'sloyfe' ? 'sløyfe' : 'lengde'} />
            <Tall verdi={`${Math.round(Math.min(...hs))}–${Math.round(Math.max(...hs))}`} tekst="moh" />
            <Tall verdi={`${Math.round(opp)} m`} tekst="stigning" />
          </View>
          <TrailMap segmenter={segmenter} />
          <Hoydeprofil punkter={profil} />
        </Kort>
      </View>
    </ScrollView>
  );
}

function DetaljMedVær({ løype: valgtLøype, liste, område, onVelg, onTilbake }: { løype: Løype; liste: LøypeInfo[]; område: Område; onVelg: (id: string) => void; onTilbake: () => void }) {
  const theme = useTheme();
  const LØYPER = liste;
  const værdata = useVær(område);
  const TIMER = useMemo(() => timerI(værdata), [værdata]);
  const { premium, pro } = usePremium();
  const [ekstraLagret, setEkstraIds] = useLagret<string[]>(`skiglede.ekstra.${valgtLøype.id}`, TOM_LISTE);
  const ekstraIds = premium ? ekstraLagret : TOM_LISTE; // utvide løypa er premium
  const gruppe = valgtLøype.variantAv ?? valgtLøype.id;
  const varianter = useMemo(() => LØYPER.filter((l) => l.id === gruppe || l.variantAv === gruppe), [LØYPER, gruppe]);
  const valgtInfo = useMemo(() => LØYPER.find((l) => l.id === valgtLøype.id) ?? { id: valgtLøype.id, variantAv: valgtLøype.variantAv, start: valgtLøype.punkter[0] as number[] }, [LØYPER, valgtLøype]);
  const mulige = useMemo(() => tilhørende(valgtInfo as LøypeInfo, LØYPER), [valgtInfo, LØYPER]);
  const ekstraFull = useLøyper(område.id, liste, ekstraIds); // ekstra løyper hentes først når de krysses av
  const løype = useMemo(
    () => byggRute(valgtLøype, mulige.filter((x) => ekstraIds.includes(x.id)).map((x) => ekstraFull.find((f) => f.id === x.id)).filter((l): l is Løype => !!l)),
    [valgtLøype, mulige, ekstraIds, ekstraFull],
  );
  // Tempo: standard hentes fra innstillingene (Tur om ikke annet er valgt). Valget her gjelder bare denne økten.
  const [standardModus] = useLagret<Modus>('skiglede.standardModus', 'Tur');
  const [modusValgt, setModus] = useState<Modus | null>(null);
  const modus: Modus = modusValgt ?? (standardModus === 'Trening' ? 'Trening' : 'Tur');
  // Starttid: i dag er standard én time frem (aldri før nå), andre dager 10:00. Valget huskes ikke mellom besøk, for «nå» endrer seg.
  const [startValgt, setStartValgt] = useState<number | null>(null);
  const [debug, setDebug] = useState(false);
  const [dagDato, setDagDato] = useLagret<string>('skiglede.dag', '');
  const [nå, setNå] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNå(Date.now()), 60_000); return () => clearInterval(id); }, []);
  const dagIdx = Math.max(0, DAGER.findIndex((i) => osloDato(i) === dagDato)); // utløpt dag → i dag
  const setDagIdx = (i: number) => { setDagDato(osloDato(i)); setStartValgt(null); };
  const osloTimeNå = (() => { const d = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(nå).split(':'); return Number(d[0]) + Number(d[1]) / 60; })();
  const tidligstI_dag = Math.min(23, Math.ceil(osloTimeNå * 2) / 2);
  const startTider = dagIdx === 0 ? STARTTIDER.filter((h) => h >= tidligstI_dag) : STARTTIDER;
  const startStandard = dagIdx === 0 ? startTider.find((h) => h >= osloTimeNå + 1) ?? startTider[startTider.length - 1] : 10;
  const startTime = startValgt !== null && startTider.includes(startValgt) ? startValgt : startStandard;
  const setStartTime = (h: number) => setStartValgt(h);
  const router = useRouter();
  const [stil, setStil] = useLagret<Stil>('skiglede.stil', 'klassisk');
  const [valgteLagret, setValgte] = useStedData<string[]>(NØKKEL_VALGTE, TOM_LISTE);
  const valgte = premium ? valgteLagret : TOM_LISTE;
  const [lagerLagret] = useStedData<string[]>(NØKKEL_LAGER, TOM_LISTE);
  const lager = premium ? lagerLagret : TOM_LISTE; // smørelageret er premium
  const [oversiktValgt, setOversiktVisning] = useState<OversiktVisning>('alle');
  const oversiktVisning: OversiktVisning = premium ? oversiktValgt : 'alle';
  const kjøp = useMemo(() => innkjøpsforslag(område.vinter, lager, SWIX), [område, lager]);
  const sys = SWIX; // Anbefalingen tar alltid utgangspunkt i Swix
  const [brukLagret, setBrukLager] = useLagret<boolean>(NØKKEL_BRUK_LAGER, false);
  const brukLager = premium && brukLagret;
  // Uten avkrysning: ren Swix-anbefaling. Med avkrysning: tilpasset smørelageret, på tvers av merker.
  const lagerBruk = brukLager ? lager : TOM_LISTE;
  const [visning, setVisning] = useLagret<'full' | 'enkel'>(NØKKEL_VISNING, 'full');
  // Kunstsnø huskes bare for i dag (føret endrer seg): lagres med dato og nullstilles neste dag.
  const [underlagLagret, setUnderlagLagret] = useLagret<{ dato: string; u: Underlag } | null>(`skiglede.underlag.${valgtLøype.id}`, null);
  const underlag: Underlag = underlagLagret && underlagLagret.dato === osloDato(0) ? underlagLagret.u : INGEN_UNDERLAG;
  const setUnderlag = (u: Underlag) => setUnderlagLagret({ dato: osloDato(0), u });
  const [skiparkLagret, setSkipark] = useStedData<Ski[]>(NØKKEL_SKIPARK, TOM_LISTE);
  const skipark = premium ? skiparkLagret : (TOM_LISTE as Ski[]);
  const [varsel, setVarsel] = useState<Varsel | null>(null);
  const [varselFeil, setVarselFeil] = useState(false);
  const [henter, setHenter] = useState(false);
  const oppdaterVær = (medHistorikk = false) => {
    setHenter(true);
    if (medHistorikk) void oppdaterHistorikk(område); // knappen oppdaterer også observert vær (databasen), ikke bare prognosen
    hentVarsel(område)
      .then((v) => { setVarsel(v); setVarselFeil(false); })
      .catch(() => setVarselFeil(true))
      .finally(() => { setHenter(false); setNå(Date.now()); });
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lagret prognose vises med en gang, ny hentes ved områdebytte
    setVarsel(lesVarselCache(område));
    oppdaterVær();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [område.id]);

  // Sist kjente snøstatus (omdannet/ny) lagres per område, så skorpa huskes selv om beviset er eldre enn værvinduet [Bruker].
  const [snøStatus, setSnøStatus] = useLagret<SnøStatus | null>(`skiglede.snostatus.${område.id}`, null);
  useEffect(() => {
    const nåTs = Date.now();
    const sisteH = TIMER[TIMER.length - 1].ts;
    const observert = [...TIMER, ...(varsel ? varsel.timer.filter((t) => t.ts > sisteH) : [])].filter((t) => t.ts <= nåTs);
    const ny = analyserSnø(observert, nåTs, snøStatus).status;
    if (!snøStatus || ny.type !== snøStatus.type || Math.abs(ny.ts - snøStatus.ts) > 3600_000) setSnøStatus(ny); // ikke skriv oftere enn hver time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TIMER, varsel, snøStatus]);

  const r = useMemo(() => {
    const seksjoner = lagSeksjoner(løype.punkter);
    const dato = osloDato(dagIdx);
    const startTs = osloTs(dato, startTime);
    // Observert historikk, så Yr-varselet fra der historikken slutter.
    const sisteHist = TIMER[TIMER.length - 1].ts;
    const alle = varsel ? [...TIMER, ...varsel.timer.filter((t) => t.ts > sisteHist)] : TIMER;
    const snø = snøMedUnderlag(analyserSnø(alle, startTs, snøStatus), underlag);
    const turFor = (s: 'klassisk' | 'skoyting') => turMedUnderlag(planTur({ seksjoner, timer: vindu(alle, startTs), startTs, tempoKmt: TEMPO[s][modus], refH: værdata.referansehoyde_m, terreng: løype.terreng, sted: område.sted }), underlag);
    const turK = turFor('klassisk');
    const turS = stil === 'skoyting' ? turFor('skoyting') : null;
    const tur = turS ?? turK;
    const turPer = (st: Stil) => (st === 'skoyting' ? turS ?? turFor('skoyting') : turK);
    const perStil = Object.fromEntries((['klassisk', 'skoyting', 'felle', 'rubb'] as Stil[]).map((st) => [st, medUnderlag(byggMedLager(st, turPer(st), snø, seksjoner, modus === 'Trening', lagerBruk), underlag, turPer(st))])) as Record<Stil, Stabel>;
    const stabel = perStil[stil];
    const farger = tur.seksjoner.map((s) => tempFarge(s.tEff));
    const segmenter = seksjoner.map((s, i) => ({
      pts: løype.punkter.filter((p) => p[3] >= s.startM && p[3] <= s.endM).map((p) => [p[0], p[1]] as [number, number]),
      farge: farger[i],
    }));
    const profil = løype.punkter.map((p) => {
      const i = Math.max(0, seksjoner.findIndex((s) => p[3] <= s.endM));
      return { d: p[3], h: p[2], farge: farger[i] };
    });
    const hs = løype.punkter.map((p) => p[2]);
    const opp = løype.punkter.slice(1).reduce((s, p, i) => s + Math.max(0, p[2] - løype.punkter[i][2]), 0);
    const alternativer = stil === 'klassisk'
      ? byggAlternativer(skipark.map((x) => x.stil), turK, snø, seksjoner, stabel, modus === 'Trening', glideSystemFraLager(lagerBruk))
      : [];
    return { dato, startTs, sisteHist, seksjoner, snø, tur, stabel, perStil, alternativer, segmenter, profil, lav: Math.min(...hs), høy: Math.max(...hs), opp };
  }, [løype, modus, startTime, dagIdx, varsel, stil, lagerBruk, skipark, område, TIMER, sys, snøStatus, underlag]);
  const vis = r.stabel;
  const enkel = visning === 'enkel';
  const lagLik = (a: { rolle: string; produkt: string }[], b: Stabel) => JSON.stringify(a) === JSON.stringify(b.lag.map((l) => ({ rolle: l.rolle, produkt: l.produkt })));
  // Skiene som smøres i dag, hver med sin stabel og vurdering (topplag eller rens)
  const valgteSki = skipark
    .filter((x) => valgte.includes(x.id))
    .map((x) => {
      const harSmøring = x.stil === 'klassisk' || x.stil === 'skoyting';
      // I enkel visning lagres bare base og dagens smøring, det du faktisk ser.
      const st = enkel && harSmøring ? forenklet(r.perStil[x.stil]) : r.perStil[x.stil];
      const vurdering = harSmøring ? vurderPåfylling(x.smoring, st, nå) : null;
      const lagret = !!x.smoring && !!vurdering && x.smoring.mål === r.dato && (!!vurdering.behold || lagLik(x.smoring.lag, st));
      const tSnitt = r.tur.seksjoner.reduce((a, y) => a + y.tEff, 0) / r.tur.seksjoner.length;
      const sone = soneVurdering(x.sone, tSnitt);
      // Annet par av samme type som passer sonen bedre
      const bedre = sone ? skipark.find((y) => y.id !== x.id && y.stil === x.stil && y.sone === soneFor(tSnitt)) : undefined;
      return { ski: x, st, vurdering, lagret, sone: sone && bedre ? `${sone} Du har ${bedre.navn}.` : sone };
    });
  const lagreSki = (liste: typeof valgteSki) =>
    setSkipark(skipark.map((x) => {
      const v = liste.find((y) => y.ski.id === x.id);
      return v && v.vurdering ? { ...x, smoring: lagreSmøring(x.stil, v.st, x.smoring, v.vurdering, Date.now(), r.dato) } : x;
    }));
  const [åpne, setÅpne] = useState<string[]>([]);
  const veksle = (id: string) => setValgte(valgte.includes(id) ? valgte.filter((v) => v !== id) : [...valgte, id]);
  const dagens = (st: Stabel) => st.lag.find((l) => ['Dagens voks', 'Dagens klister', 'Glider', 'Festesone'].includes(l.rolle));

  const harPrognose = !!varsel && varsel.timer.length > 0 && varsel.timer[varsel.timer.length - 1].ts > r.startTs;
  const lasterPrognose = !varsel && !varselFeil; // ingen smøretips før prognosen er hentet
  const ingenPrognose = !lasterPrognose && !harPrognose;
  // Prognosen rekker bare ca. 2,5 døgn: slutter den før turen er ferdig, regnes resten på siste kjente time. Si fra.
  const prognoseKort = harPrognose && varsel!.timer[varsel!.timer.length - 1].ts < r.tur.sluttTs;
  const prognoseAlderT = varsel ? (nå - varsel.hentet) / 3600_000 : 0;
  const prognoseGammel = !!varsel && prognoseAlderT > VARSEL_GAMMELT_T;
  const historikkGammel = (nå - r.sisteHist) / 3600_000 > HISTORIKK_GAMMEL_T;
  const km = løype.lengde_m / 1000;
  const tempo = TEMPO[stil === 'skoyting' ? 'skoyting' : 'klassisk'];
  const minutter = Math.round((km / tempo[modus]) * 60);
  const stabelVisning = [...(enkel ? forenklet(vis) : vis).lag].filter((l) => !erGlidesone(l)).reverse(); // øverste lag først, uten glider
  const glidesone = vis.lag.find(erGlidesone);
  const dagensP = produkt(dagens(vis)?.produkt ?? '');
  const smøreMerke = dagensP ? SYSTEMER[merkeAv(dagensP)].navn : sys.navn;
  const felleRubbSki = skipark.filter((x) => x.stil === 'felle' || x.stil === 'rubb');
  const baseAnbefaling = vis.lag.find((l) => l.rolle === 'Binder' || l.rolle === 'Baseklister')?.produkt;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />

      <View style={styles.innhold}>
        {/* Tilbake og bytte av løype */}
        <Pressable onPress={onTilbake} style={[styles.chip, { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Alle løyper</Text>
        </Pressable>
        <Loypevelger løyper={LØYPER.filter((l) => !l.variantAv)} valgt={gruppe} onVelg={onVelg} />
        {varianter.length > 1 && (
          <View style={styles.rad}>
            {varianter.map((v) => (
              <Chip key={v.id} aktiv={v.id === valgtLøype.id} onPress={() => onVelg(v.id)}>
                {`${v.type === 'retur' ? 'Tur-retur' : 'Sløyfe'} · ${(v.lengde_m / 1000).toFixed(1)} km`}
              </Chip>
            ))}
          </View>
        )}

        {mulige.length > 0 && (
          <View style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>GÅ LENGER: LEGG TIL FRA SAMME START</ThemedText>
            {!premium && <ThemedText type="small" themeColor="textSecondary">🔒 Premium: legg til flere løyper fra samme start og få smøringen regnet for hele turen. Logg inn og slå på premium øverst.</ThemedText>}
            <View style={styles.rad}>
              {premium && mulige.map((x) => (
                <Chip key={x.id} aktiv={ekstraIds.includes(x.id)} onPress={() => setEkstraIds(ekstraIds.includes(x.id) ? ekstraIds.filter((v) => v !== x.id) : [...ekstraIds, x.id])}>
                  {`${ekstraIds.includes(x.id) ? '✓ ' : '+ '}${x.navn} · ${(x.lengde_m / 1000).toFixed(1)} km`}
                </Chip>
              ))}
            </View>
            {ekstraIds.length > 0 && <ThemedText type="small" themeColor="textSecondary">Turen går først {valgtLøype.navn}, så {ekstraIds.map((i) => LØYPER.find((l) => l.id === i)?.navn).join(', ')}, og tilbake til start. Smøringen regnes for hele turen.</ThemedText>}
          </View>
        )}

        {/* Tur */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>TUREN</ThemedText>
        <View style={styles.rad}>
          {DAGER.map((i) => (
            <Chip liten key={i} aktiv={i === dagIdx} onPress={() => setDagIdx(i)}>{dagNavn(osloDato(i), i)}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          {(['klassisk', 'skoyting'] as Stil[]).map((x) => (
            <Chip liten key={x} aktiv={x === stil} onPress={() => setStil(x)}>{STIL_NAVN[x]}</Chip>
          ))}
          <Valgboks etikett="Tempo" verdi={modus} valg={MODI.map((m) => ({ verdi: m, tekst: `${m} · ${tempo[m]} km/t` }))} onVelg={(v) => setModus(v as Modus)} />
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>Start</Text>
          <Valgboks etikett="Starttidspunkt for turen" verdi={String(startTime)} valg={startTider.map((h) => ({ verdi: String(h), tekst: `🕒 ${klokke(h)}` }))} onVelg={(v) => setStartTime(Number(v))} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Ca. {Math.floor(minutter / 60)} t {minutter % 60} min · {tid(r.tur.startTs)}–{tid(r.tur.sluttTs)} · {Math.round(r.tur.skyggeAndel * 100)} % av løypa i terrengskygge
        </ThemedText>
        {ingenPrognose ? (
          <View style={[styles.advarsel, { borderColor: '#C0392B' }]}>
            <ThemedText type="smallBold">{varselFeil && !varsel
              ? '⚠ Fikk ikke hentet prognosen fra Yr, og det finnes ingen brukbar lagret prognose. Smøretipset vises ikke før været er hentet. Prøv «Oppdater vær».'
              : '⚠ Prognosen rekker ikke fram til valgt tidspunkt, så smøretipset vises ikke. Velg en tidligere dag eller tid, eller trykk «Oppdater vær».'}</ThemedText>
          </View>
        ) : null}
        {/* Smøring */}
        <Kort style={{ gap: Spacing.three }}>
          <View style={styles.rad}>
            <Text style={[styles.h2, { color: theme.text, flex: 1 }]}>Smøring</Text>
            <View style={[styles.merke, { backgroundColor: theme.accentSoft }]}>
              <Text style={{ color: theme.accent, fontWeight: '700' }}>{TYPE_NAVN[vis.type]}</Text>
            </View>
          </View>
          <Pressable onPress={() => premium && setBrukLager(!brukLager)} style={styles.rad} accessibilityRole="checkbox" accessibilityState={{ checked: brukLager }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: theme.border, backgroundColor: brukLager ? theme.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {brukLager ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
            </View>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Bruk min smøring</Text>
            <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
              {brukLager ? (lager.length ? `Tilpasset smørelageret ditt (${lager.length} produkter, alle merker).` : 'Smørelageret er tomt: kryss av det du har under Smørelager.') : (premium ? 'Anbefaling fra Swix. Kryss av for å bruke det du har i lageret, fra alle merker.' : '🔒 Premium: bruk det du har i smørelageret, fra alle merker.')}
            </ThemedText>
          </Pressable>
          <UnderlagValg u={underlag} onChange={setUnderlag} />
          <View style={styles.rad}>
            <Chip aktiv={!enkel} onPress={() => setVisning('full')}>Full</Chip>
            <Chip aktiv={enkel} onPress={() => setVisning('enkel')}>Enkel</Chip>
            {enkel ? <ThemedText type="small" themeColor="textSecondary">Bare dagens smøring og glidesonen. Det er bare dette som lagres på ski.</ThemedText> : null}
          </View>
          {lasterPrognose ? (
            <ThemedText type="small">Henter prognose fra Yr …</ThemedText>
          ) : ingenPrognose ? (
            <ThemedText type="small">Ingen smøretips uten prognose for valgt tid. Se advarselen under «Turen».</ThemedText>
          ) : (<>
          {vis.vanskeligFøre?.length ? (
            <View style={[styles.advarsel, { borderColor: '#C0392B' }]}>
              <ThemedText type="smallBold">⚠ {vis.vanskeligFøre[0]}</ThemedText>
              {vis.vanskeligFøre.slice(1).map((t, i) => <ThemedText key={i} type="small">{t}</ThemedText>)}
            </View>
          ) : null}
          {brukLager && vis.lagerPasserIkke && felleRubbSki.length ? (
            <View style={[styles.advarsel, { borderColor: '#C0392B' }]}>
              <ThemedText type="smallBold">⚠ I dag passer ikke smøringen du har i lageret godt ({vis.lagerPasserIkke}). Du har {felleRubbSki.map((x) => x.navn).join(' og ')}: vurder {felleRubbSki.some((x) => x.stil === 'felle') && felleRubbSki.some((x) => x.stil === 'rubb') ? 'felleski eller rubbski' : felleRubbSki[0].stil === 'felle' ? 'felleski' : 'rubbski'} i stedet for å smøre.</ThemedText>
              <ThemedText type="small">{r.alternativer.length ? r.alternativer.map((a) => a.grunn).join(' ') : 'Rubbski passer bare ved sludd uten fare for ordentlig minus, felleski er trygt når føret er utfordrende. Vurder ut fra føret og hva du vil ha på beina.'}</ThemedText>
            </View>
          ) : null}
          <GliderBoks lag={glidesone} />
          <ThemedText type="small" themeColor="textSecondary">{vis.lag.filter((l) => !erGlidesone(l)).length > 1 || vis.type === 'hardvoks' || vis.type === 'klister' ? 'Øverst = siste lag. Bygg nedenfra og opp.' : 'Ingen smøring på festesonen.'}</ThemedText>
          <View style={{ gap: 6 }}>
            {stabelVisning.map((l, i) => (
              <View key={i} style={[styles.lag, { backgroundColor: produktFarge(l.produkt) }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lagProdukt, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.produkt}<Text style={{ fontWeight: '500', fontSize: 14 }}>  {produkt(l.produkt)?.farge}</Text></Text>
                  <Text style={[styles.lagRolle, { color: tekstPå(produktFarge(l.produkt)), opacity: 0.85 }]}>{l.rolle}{l.merknad ? ` · ${l.merknad}` : ''}</Text>
                </View>
                {enkel ? null : <Text style={[styles.lagAntall, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.antall}</Text>}
              </View>
            ))}
          </View>
          {!enkel && vis.lag.some((l) => l.rolle === 'Dagens voks') ? <ThemedText type="small" themeColor="textSecondary">Tips: smør som en pyramide. Legg de første lagene lengst, og hvert lag litt kortere, så det blir tykkest under foten.</ThemedText> : null}
          {enkel && baseAnbefaling ? <ThemedText type="small" themeColor="textSecondary">Anbefaling: legg en base ({baseAnbefaling}) i bunn først, spesielt hvis du er usikker på smøring.</ThemedText> : null}
          {vis.alternativer?.map((a, i) => <ThemedText key={i} type="small" themeColor="textSecondary">Alternativ: {a}</ThemedText>)}
          {vis.advarsler.map((a, i) => (
            <View key={i} style={[styles.advarsel, { borderColor: '#E3A64A' }]}>
              <ThemedText type="small">⚠ {a}</ThemedText>
            </View>
          ))}
          </>)}
          <ThemedText type="small" themeColor="textSecondary">
            Utkast: temperaturområdene er hentet fra produsentene ({smøreMerke}), men tersklene i reglene er foreløpige og justeres mot erfaring.
          </ThemedText>
        </Kort>

        <ThemedText type="small" themeColor="textSecondary">
          {varsel
            ? `Prognose: MET Norway / Yr (oppdatert ${tid(Date.parse(varsel.oppdatert))}${varsel.fraCache ? ', lagret fra tidligere' : ''}) · solinnstråling anslått fra skydekke`
            : henter
              ? 'Henter prognose fra Yr …'
              : 'Ingen prognose tilgjengelig.'}
        </ThemedText>
        {prognoseKort ? <ThemedText type="small">⚠ Prognosen rekker ikke til turen er ferdig. Siste timer er regnet med siste kjente vær, så smøringen er mer usikker.</ThemedText> : null}
        {varselFeil && harPrognose ? <ThemedText type="small">⚠ Fikk ikke hentet ny prognose. Viser den sist lagrede.</ThemedText> : null}
        {prognoseGammel ? <ThemedText type="small">⚠ Prognosen er {Math.round(prognoseAlderT)} timer gammel. Trykk «Oppdater vær» før du smører.</ThemedText> : null}
        {historikkGammel ? <ThemedText type="small">⚠ Observert vær i appen er fra {tid(r.sisteHist)} ({new Date(r.sisteHist).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}). Snøtilstanden kan ha endret seg siden.</ThemedText> : null}
        <View style={styles.rad}>
          <Chip aktiv={false} onPress={henter ? () => {} : () => oppdaterVær(true)}>{henter ? 'Henter …' : '↻ Oppdater vær'}</Chip>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(r.tur.skyggeAndel * 100)} % av løypa ({(r.tur.skyggeAndel * km).toFixed(1)} km) ligger i terrengskygge når du går den.
          {r.tur.skyggeIgnorert ? ' Under 10 % av løypa, så skyggen er ikke regnet med i smøringen.' : r.tur.skyggeAndel >= 0.1 ? ' Skyggen er regnet med: kaldeste del er ' + r.tur.tMin.toFixed(1) + ' °C og varmeste ' + r.tur.tMaks.toFixed(1) + ' °C (5./95. persentil). Vurder selv om du vil smøre for sola eller skyggen.' : ''}
        </ThemedText>
        {!ingenPrognose && !lasterPrognose && r.alternativer.map((a) => {
          const festeLag = a.stabel.lag.filter((l) => !erGlidesone(l));
          const ingenSmøring = festeLag.length > 0 && festeLag.every((l) => l.antall === 'Ingen smøring');
          const alt = a.stabel.lag.find(erGlidesone);
          const samme = !!alt && alt.produkt === glidesone?.produkt;
          return (
            <Sammenleggbar key={a.stil} id={`alt-${a.stil}`} tittel={`Alternativ: ${STIL_NAVN[a.stil]}`} style={{ gap: Spacing.two }}>
              <ThemedText type="small">{a.grunn}</ThemedText>
              <ThemedText type="smallBold" themeColor="textSecondary">{skipark.filter((x) => x.stil === a.stil).map((x) => x.navn).join(', ') || 'Ingen ski av denne typen i skiparken ennå'}</ThemedText>
              {ingenSmøring ? (
                <ThemedText type="small">{festeLag[0].merknad ?? 'Ingen festevoks eller klister.'}</ThemedText>
              ) : (
                festeLag.map((l, i) => (
                  <View key={i} style={[styles.lag, { backgroundColor: produktFarge(l.produkt) }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lagProdukt, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.produkt}<Text style={{ fontWeight: '500', fontSize: 14 }}>  {produkt(l.produkt)?.farge}</Text></Text>
                      <Text style={[styles.lagRolle, { color: tekstPå(produktFarge(l.produkt)), opacity: 0.85 }]}>{l.rolle}{l.merknad ? ` · ${l.merknad}` : ''}</Text>
                    </View>
                    <Text style={[styles.lagAntall, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.antall}</Text>
                  </View>
                ))
              )}
              {alt ? (samme ? <ThemedText type="small" themeColor="textSecondary">Samme glider som over ({alt.produkt}).</ThemedText> : <GliderBoks lag={alt} />) : null}
              {a.stabel.advarsler.map((w, i) => (
                <ThemedText key={i} type="small">⚠ {w}</ThemedText>
              ))}
            </Sammenleggbar>
          );
        })}

        {/* Kart og profil */}
        <Kort>
          <Text style={[styles.h2, { color: theme.text }]}>{løype.navn}</Text>
          <View style={styles.rad}>
            <Tall verdi={`${km.toFixed(1)} km`} tekst={løype.type === 'retur' ? 'tur-retur' : løype.type === 'sloyfe' ? 'sløyfe' : 'lengde'} />
            <Tall verdi={`${Math.round(r.lav)}–${Math.round(r.høy)}`} tekst="moh" />
            <Tall verdi={`${Math.round(r.opp)} m`} tekst="stigning" />
          </View>
          <TrailMap segmenter={r.segmenter} />
          <ThemedText type="small" themeColor="textSecondary">
            Fargen viser beregnet snøtemperatur langs løypa: blå er kaldt, sand er mildt og sol.
          </ThemedText>
          <Hoydeprofil punkter={r.profil} />
        </Kort>

        {/* Ski */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>SKI JEG SMØRER I DAG</ThemedText>
        <View style={styles.rad}>
          {skipark.map((x) => (
            <Chip key={x.id} aktiv={valgte.includes(x.id)} onPress={() => veksle(x.id)}>{`${valgte.includes(x.id) ? '✓ ' : ''}${x.navn} · ${STIL_NAVN[x.stil]}${x.sone ? ` · ${x.sone}` : ''}`}</Chip>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.push('/skipark')} style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{skipark.length ? 'Skipark' : '+ Legg inn ski'}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/renn')} style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{pro ? 'Renn' : '🔒 Renn (pro)'}</Text>
          </Pressable>
        </View>
        {valgteSki.length > 0 && !ingenPrognose && !lasterPrognose && (
          <Kort style={{ gap: 0, paddingVertical: Spacing.two }}>
            {valgteSki.map(({ ski, st, vurdering, lagret, sone }, i) => {
              const åpen = åpne.includes(ski.id);
              const advar = vurdering?.handling === 'rens' || st.egnet === false;
              return (
                <View key={ski.id} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border, gap: 6 }}>
                  <Pressable onPress={() => setÅpne(åpen ? åpne.filter((x) => x !== ski.id) : [...åpne, ski.id])} accessibilityRole="button" accessibilityState={{ expanded: åpen }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{ski.navn}{sone ? ' ⚠' : ''}</Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={1}>
                        {dagens(st) && st.egnet !== false && (ski.stil === 'klassisk' || ski.stil === 'skoyting') ? `Legg på: ${dagens(st)!.produkt}${vurdering?.behold ? ` · behold glideren som ligger på (${ski.smoring?.lag.find((l) => l.rolle === 'Glider')?.produkt ?? 'ukjent'})` : ''}` : st.egnet === false ? 'Passer ikke i dag' : 'Ingen festesmøring'}
                      </Text>
                    </View>
                    <View style={[styles.merke, { backgroundColor: lagret ? theme.accent : advar ? '#F6DFB4' : theme.accentSoft }]}>
                      <Text style={{ color: lagret ? '#fff' : advar ? '#6B4A0B' : theme.accent, fontWeight: '700', fontSize: 13 }}>{lagret ? '✓ Lagret' : vurdering ? vurdering.tittel : st.egnet === false ? 'Passer ikke' : '–'}</Text>
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 16 }}>{åpen ? '▴' : '▾'}</Text>
                  </Pressable>
                  {åpen ? (
                    <View style={{ gap: 4 }}>
                      {vurdering?.grunner.map((g, k) => <ThemedText key={k} type="small">• {g}</ThemedText>)}
                      {!vurdering && st.egnet === false && st.advarsler.map((g, k) => <ThemedText key={k} type="small">• {g}</ThemedText>)}
                      {!vurdering && st.egnet !== false && <ThemedText type="small">{ski.stil === 'felle' ? 'Felleski har ingen festesmøring. Bare glidesonene smøres.' : 'Rubbski har ingen festesmøring. Børst opp rubben.'}</ThemedText>}
                      {sone ? <ThemedText type="small">⚠ {sone}</ThemedText> : null}
                      {ski.smoring && <ThemedText type="small" themeColor="textSecondary">Ligger på nå: {ski.smoring.lag.map((l) => l.produkt).join(' → ')} (nederst → øverst), {ski.smoring.turer} tur{ski.smoring.turer === 1 ? '' : 'er'}.</ThemedText>}
                      {vurdering && !lagret ? (
                        <View style={styles.rad}>
                          <Chip aktiv={false} onPress={() => lagreSki([{ ski, st, vurdering, lagret, sone }])}>Lagre smøring på dette paret</Chip>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {valgteSki.some((v) => v.vurdering) && (
              <View style={[styles.rad, { paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }]}>
                {valgteSki.every((v) => !v.vurdering || v.lagret) ? (
                  <ThemedText type="smallBold" themeColor="textSecondary">✓ Smøringen er lagret på alle valgte ski</ThemedText>
                ) : (
                  <Chip aktiv onPress={() => lagreSki(valgteSki.filter((v) => !v.lagret))}>{`Lagre smøring på alle valgte ski (${valgteSki.filter((v) => v.vurdering && !v.lagret).length})`}</Chip>
                )}
              </View>
            )}
          </Kort>
        )}

        {/* Logg (premium) */}
        <Loggkort grunnlag={{
          omrade: område.id,
          loype_id: valgtLøype.id,
          loype_navn: løype.navn,
          stil,
          ski_navn: valgteSki.map((x) => x.ski.navn).join(', ') || null,
          produkter: vis.lag.map((l) => ({ rolle: l.rolle, produkt: l.produkt })),
          modell: {
            tSnitt: r.tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / r.tur.seksjoner.length,
            tMin: r.tur.tMin,
            tMaks: r.tur.tMaks,
            skarphet: r.snø.skarphet,
            snotype: r.snø.type,
            sludd: r.tur.sludd,
            sol: r.tur.skyggeAndel,
            type: vis.type,
            start: r.startTs,
          },
        }} />

        {/* Snø */}
        <Sammenleggbar id="snoen" tittel="Snøen">
          <View style={styles.rad}>
            <Tall verdi={r.snø.type === 'ny' ? 'Nysnø' : 'Omdannet'} tekst="snøtype" />
            <Tall verdi={`${Math.round(r.snø.skarphet)}`} tekst="skarphet (0–100)" />
            <Tall verdi={`${r.tur.tMin.toFixed(1)} / ${r.tur.tMaks.toFixed(1)} °C`} tekst="kaldest / varmest" />
          </View>
        </Sammenleggbar>

        {/* Temperaturoversikt */}
        <Sammenleggbar id="voks-og-klister" tittel="Voks og klister" standardÅpen={false}>
          <ThemedText type="small" themeColor="textSecondary">Hva hvert produkt fungerer på, med fargekodene til {sys.navn}.</ThemedText>
          <View style={styles.rad}>
            <Chip aktiv={oversiktVisning === 'alle'} onPress={() => setOversiktVisning('alle')}>Alle produkter</Chip>
            <Chip aktiv={oversiktVisning === 'mine'} onPress={() => premium && setOversiktVisning('mine')}>{premium ? 'Mine produkter' : '🔒 Mine produkter'}</Chip>
            <Chip aktiv={oversiktVisning === 'kjop'} onPress={() => premium && setOversiktVisning('kjop')}>{premium ? 'Forslag til innkjøp' : '🔒 Forslag til innkjøp'}</Chip>
          </View>
          {oversiktVisning === 'kjop' ? (
            <ThemedText type="small" themeColor="textSecondary">
              Swix-produkter for snøtemperaturene som er vanlige i {område.navn} fra desember til april (ca. {område.vinter[0]} til {område.vinter[1]} °C, anslag). Produkter du allerede har med overlappende område er ikke med.
            </ThemedText>
          ) : null}
          <Temperaturoversikt tMin={r.tur.tMin} tMaks={r.tur.tMaks} brukt={vis.lag.map((l) => l.produkt)} sys={sys} visning={oversiktVisning} lager={lager} kjøp={kjøp} />
        </Sammenleggbar>

        {/* Feilsøking */}
        <Pressable onPress={() => setDebug(!debug)} style={[styles.chip, { alignSelf: 'flex-start', backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>{debug ? 'Skjul feilsøking' : 'Vis feilsøking'}</Text>
        </Pressable>
        {debug && (
          <Kort style={{ gap: Spacing.two }}>
            <Text style={[styles.h3, { color: theme.text }]}>Hvorfor denne stabelen</Text>
            {[...r.snø.forklaring, ...r.stabel.begrunnelse, ...(r.stabel.alternativ?.begrunnelse ?? [])].map((t, i) => (
              <ThemedText key={i} type="small">• {t}</ThemedText>
            ))}
            <Text style={[styles.h3, { color: theme.text, marginTop: Spacing.two }]}>Døgn (UTC): mild dag og kald natt</Text>
            {r.snø.dager.map((d) => (
              <View key={d.dato} style={styles.tabellRad}>
                <ThemedText type="small" style={{ width: 90 }}>{d.dato.slice(5)}</ThemedText>
                <ThemedText type="small" style={{ width: 80 }}>maks {d.maks.toFixed(1)}</ThemedText>
                <ThemedText type="small" style={{ width: 90 }}>natt {d.natt === null ? '–' : d.natt.toFixed(1)}</ThemedText>
                <ThemedText type="small">syklus {d.syklus.toFixed(2)}</ThemedText>
              </View>
            ))}
            <Text style={[styles.h3, { color: theme.text, marginTop: Spacing.two }]}>Seksjoner</Text>
            <View style={styles.tabellRad}>
              {['km', 'moh', 'luft', 'effektiv', 'sol W', 'skog'].map((h) => (
                <ThemedText key={h} type="smallBold" themeColor="textSecondary" style={styles.celle}>{h}</ThemedText>
              ))}
            </View>
            {r.seksjoner.map((s, i) => {
              const v = r.tur.seksjoner[i];
              return (
                <View key={s.seq} style={styles.tabellRad}>
                  <ThemedText type="small" style={styles.celle}>{(s.startM / 1000).toFixed(1)}</ThemedText>
                  <ThemedText type="small" style={styles.celle}>{Math.round(s.hMid)}</ThemedText>
                  <ThemedText type="small" style={styles.celle}>{v.tLuft.toFixed(1)}</ThemedText>
                  <ThemedText type="small" style={[styles.celle, { fontWeight: '700' }]}>{v.tEff.toFixed(1)}</ThemedText>
                  <ThemedText type="small" style={styles.celle}>{Math.round(v.sw)}</ThemedText>
                  <ThemedText type="small" style={styles.celle}>{Math.round(s.skog * 100)} %</ThemedText>
                </View>
              );
            })}
          </Kort>
        )}
      </View>
    </ScrollView>
  );
}

function Oversikt({ område, liste, feil, prøvIgjen, onVelg, onVelgNabo, egne }: { område: Område; liste: LøypeInfo[] | null; feil: boolean; prøvIgjen: () => void; onVelg: (id: string) => void; onVelgNabo: (omrade: string, id: string) => void; egne: ReturnType<typeof useEgneRuterIOmråde> }) {
  const theme = useTheme();
  const [boks, setBoks] = useState<KartBoks | null>(null);
  const naboer = useNaboløyper(område, useOmråder(), boks);
  const LØYPER = (liste ?? []).filter((l) => !l.variantAv);
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>LØYPER {område.navn.toUpperCase()}</ThemedText>
        <ThemedText themeColor="textSecondary">{LØYPER.length ? 'Trykk på en løype i kartet, eller velg fra lista.' : liste === null ? (feil ? 'Fikk ikke tak i løypene. Sjekk nettforbindelsen og prøv igjen.' : 'Henter løypene …') : 'Løypene for dette området er ikke lagt inn ennå. Kartet viser området.'}</ThemedText>
        {feil && liste === null ? <View style={styles.rad}><Chip aktiv={false} onPress={prøvIgjen}>↻ Prøv igjen</Chip></View> : null}
        <Oversiktskart key={område.id} løyper={LØYPER.map((l) => ({ id: l.id, navn: l.navn, punkter: l.oversikt }))} naboer={naboer} onBoks={setBoks} onVelgNabo={onVelgNabo} visning={område.visning} onVelg={onVelg} />
        <EgneRuter mine={egne.mine} bruker={egne.bruker} område={område} onVelg={onVelg} />
        <Loypevelger løyper={LØYPER} valgt={null} onVelg={onVelg} />
        <ThemedText type="small" themeColor="textSecondary">Løypedata: Turrutebasen og Kartverket (CC BY 4.0) og © OpenStreetMap-bidragsytere (ODbL).</ThemedText>
      </View>
    </ScrollView>
  );
}

export default function Hjem() {
  const [område, settOmråde] = useOmråde();
  const [valgt, setValgt] = useLagret<string | null>(`skiglede.loype.${område.id}`, null);
  const { liste: baseListe, feil, prøvIgjen } = useLøypeliste(område.id);
  const egne = useEgneRuterIOmråde(område);
  // Egne GPX-ruter (og delte fra kjente utfartssteder) legges inn i samme liste som områdets løyper.
  const liste = useMemo(() => (baseListe ? [...baseListe, ...egne.infos] : egne.infos.length ? egne.infos : baseListe), [baseListe, egne.infos]);
  const info = valgt ? liste?.find((l) => l.id === valgt) : undefined;
  const [forsøk, setForsøk] = useState(0);
  const [løype] = useLøyper(område.id, liste, info ? [info.id] : [], forsøk);
  const hentFeil = info ? løypeFeilFor(område.id, info.id) : '';
  if (valgt && liste === null && !feil) return <Laster tekst="Henter løypa …" />;
  if (!info || !liste) return <Oversikt område={område} liste={liste} feil={feil} prøvIgjen={prøvIgjen} onVelg={setValgt} onVelgNabo={(o, id) => { skrivFraKonto(`skiglede.loype.${o}`, JSON.stringify(id)); settOmråde(o); }} egne={egne} />;
  if (løype && løype.punkter.length < 2) return <Laster tekst={`${info.navn} mangler punkter i databasen, så den kan ikke vises. Velg en annen løype.`} onPrøv={() => setValgt(null)} onTilbake={() => setValgt(null)} />;
  if (!løype) return <Laster tekst={hentFeil ? `Fikk ikke tak i ${info.navn}: ${hentFeil}` : `Henter ${info.navn} …`} onPrøv={hentFeil ? () => setForsøk((n) => n + 1) : undefined} onTilbake={() => setValgt(null)} />;
  return <Detalj key={`${område.id}:${løype.id}`} løype={løype} liste={liste} område={område} onVelg={setValgt} onTilbake={() => setValgt(null)} />;
}

function Laster({ tekst, onPrøv, onTilbake }: { tekst: string; onPrøv?: () => void; onTilbake?: () => void }) {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <ThemedText themeColor="textSecondary">{tekst}</ThemedText>
        {onPrøv ? <View style={styles.rad}><Chip aktiv onPress={onPrøv}>Prøv igjen</Chip>{onTilbake ? <Chip aktiv={false} onPress={onTilbake}>← Alle løyper</Chip> : null}</View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 230, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  heroInnhold: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingBottom: 30 },
  heroTittel: { color: '#FFFFFF', fontSize: 52, fontWeight: '800', letterSpacing: -1 },
  heroUnder: { color: '#BFDDF7', fontSize: 17, marginTop: 4 },
  flak: { position: 'absolute', color: 'rgba(255,255,255,0.35)' },
  drift: { position: 'absolute', borderRadius: 999 },
  innhold: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, gap: Spacing.three, marginTop: Spacing.two },
  etikett: { letterSpacing: 1.2, marginTop: Spacing.two },
  rad: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
  kort: { borderRadius: 24, borderWidth: 1, padding: Spacing.three, gap: Spacing.two, boxShadow: '0 6px 24px rgba(18,56,107,0.08)' },
  h2: { fontSize: 26, fontWeight: '700' },
  h3: { fontSize: 17, fontWeight: '700' },
  tall: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, minWidth: 100 },
  merke: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999 },
  lag: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, gap: 12 },
  lagProdukt: { color: '#0B2540', fontSize: 20, fontWeight: '800' },
  lagRolle: { color: 'rgba(11,37,64,0.75)', fontSize: 13, marginTop: 1 },
  lagAntall: { color: '#0B2540', fontSize: 15, fontWeight: '700' },
  advarsel: { borderWidth: 1, borderRadius: 12, padding: 10 },
  tabellRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  celle: { width: 70 },
});
