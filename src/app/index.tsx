import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrailMap } from '@/components/ski/kart';
import { Hoydeprofil } from '@/components/ski/profil';
import { Temperaturoversikt, tekstPå, type OversiktVisning } from '@/components/ski/oversikt';
import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
import { byggRute, tilhørende, type Løype } from '@/data/rute';
import { Loypevelger } from '@/components/ski/loypevelger';
import { Oversiktskart } from '@/components/ski/oversiktskart';
import { MaxContentWidth, Spacing, tempFarge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OMRÅDER, useOmråde, type Område } from '@/data/omrader';
import { hentVarsel, lesVarselCache, type Varsel } from '@/data/varsel';
import { NØKKEL_BRUK_LAGER, NØKKEL_LAGER, NØKKEL_SKIPARK, NØKKEL_VALGTE, NØKKEL_VISNING, TOM_LISTE, useLagret, useStedData, type Ski } from '@/data/lagring';
import { useRouter } from 'expo-router';
import { SWIX, innkjøpsforslag, soneFor, soneVurdering, analyserSnø, produkt, byggMedLager, glideSystemFraLager, lagSeksjoner, forenklet, byggAlternativer, lagreSmøring, planTur, vurderPåfylling, type Punkt, type SnøStatus, type Stabel, type Stil, type Terreng, type Vær } from '@/engine';

const løyperI = (o: Område) => o.løyper as unknown as Løype[];
const timerI = (o: Område): Vær[] => o.vær.timer.map((r) => ({
  ts: Date.parse(r[0] as string), temp: r[1] as number, nedbor: r[2] as number, rh: r[3] as number, vind: r[4] as number, sw: r[5] as number,
}));
// Reserve hvis Yr-varselet ikke kommer: observert 2. nov.
const RESERVE_DATO = '2026-11-02';

/** Dato (ÅÅÅÅ-MM-DD) i Oslo, `dager` frem i tid. */
const osloDato = (dager: number) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(Date.now() + dager * 86400_000);
/** UTC-tidspunkt for lokal Oslo-klokkeslett (time kan ha desimaler, 10.5 = 10:30) på en dato (håndterer sommer-/vintertid). */
function osloTs(dato: string, time: number) {
  const hh = Math.floor(time);
  const mm = Math.round((time - hh) * 60);
  const lokalSomUtc = Date.parse(`${dato}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  for (const off of [1, 2]) {
    const ts = lokalSomUtc - off * 3600_000;
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', hourCycle: 'h23' }).format(ts));
    if (h === hh) return ts;
  }
  return lokalSomUtc - 3600_000;
}
const dagNavn = (dato: string, i: number) =>
  i === 0 ? 'I dag' : i === 1 ? 'I morgen' : new Intl.DateTimeFormat('nb-NO', { weekday: 'long', timeZone: 'UTC' }).format(Date.parse(dato + 'T12:00:00Z'));
const DAGER = [0, 1, 2];

const STIL_NAVN: Record<Stil, string> = { klassisk: 'Klassisk', felle: 'Felleski', rubb: 'Rubbski', skoyting: 'Skøyting' };
const TYPE_NAVN = { hardvoks: 'Hardvoks', klister: 'Klister', glider: 'Glider', felle: 'Felleski', rubb: 'Rubbski' } as const;

// km/t. Skøyting går ca. 2 km/t fortere enn klassisk, både på tur og trening.
const TEMPO = { klassisk: { Trening: 9, Tur: 5 }, skoyting: { Trening: 11, Tur: 7 } } as const;
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
      <ThemedText type="small" themeColor="textSecondary">Foran og bak festesonen, ikke i den. {lag.merknad ?? ''}</ThemedText>
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

function Detalj({ løype: valgtLøype, område, onVelg, onTilbake }: { løype: Løype; område: Område; onVelg: (id: string) => void; onTilbake: () => void }) {
  const theme = useTheme();
  const LØYPER = useMemo(() => løyperI(område), [område]);
  const TIMER = useMemo(() => timerI(område), [område]);
  const [ekstraIds, setEkstraIds] = useLagret<string[]>(`skiglede.ekstra.${valgtLøype.id}`, TOM_LISTE);
  const gruppe = valgtLøype.variantAv ?? valgtLøype.id;
  const varianter = useMemo(() => LØYPER.filter((l) => l.id === gruppe || l.variantAv === gruppe), [LØYPER, gruppe]);
  const mulige = useMemo(() => tilhørende(valgtLøype, LØYPER), [valgtLøype, LØYPER]);
  const løype = useMemo(() => byggRute(valgtLøype, mulige.filter((x) => ekstraIds.includes(x.id))), [valgtLøype, mulige, ekstraIds]);
  const [modus, setModus] = useLagret<Modus>('skiglede.modus', 'Tur');
  const [startTime, setStartTime] = useLagret<number>('skiglede.start', 10);
  const [debug, setDebug] = useState(false);
  const [dagDato, setDagDato] = useLagret<string>('skiglede.dag', '');
  const dagIdx = Math.max(0, DAGER.findIndex((i) => osloDato(i) === dagDato)); // utløpt dag → i dag
  const setDagIdx = (i: number) => setDagDato(osloDato(i));
  const router = useRouter();
  const [stil, setStil] = useLagret<Stil>('skiglede.stil', 'klassisk');
  const [valgte, setValgte] = useStedData<string[]>(NØKKEL_VALGTE, TOM_LISTE);
  const [nå, setNå] = useState(() => Date.now());
  const [lager] = useStedData<string[]>(NØKKEL_LAGER, TOM_LISTE);
  const [oversiktVisning, setOversiktVisning] = useState<OversiktVisning>('alle');
  const kjøp = useMemo(() => innkjøpsforslag(område.vinter, lager, SWIX), [område, lager]);
  const sys = SWIX; // Anbefalingen tar alltid utgangspunkt i Swix
  const [brukLager, setBrukLager] = useLagret<boolean>(NØKKEL_BRUK_LAGER, false);
  // Uten avkrysning: ren Swix-anbefaling. Med avkrysning: tilpasset smørelageret, på tvers av merker.
  const lagerBruk = brukLager ? lager : TOM_LISTE;
  const [visning, setVisning] = useLagret<'full' | 'enkel'>(NØKKEL_VISNING, 'full');
  const [skipark, setSkipark] = useStedData<Ski[]>(NØKKEL_SKIPARK, TOM_LISTE);
  const [varsel, setVarsel] = useState<Varsel | null>(null);
  const [varselFeil, setVarselFeil] = useState(false);
  const [henter, setHenter] = useState(false);
  const oppdaterVær = () => {
    setHenter(true);
    hentVarsel(område.id)
      .then((v) => { setVarsel(v); setVarselFeil(false); })
      .catch(() => setVarselFeil(true))
      .finally(() => { setHenter(false); setNå(Date.now()); });
  };
  useEffect(() => {
    setVarsel(lesVarselCache(område.id)); // sist lagrede prognose vises mens ny hentes
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
    const dato = varsel ? osloDato(dagIdx) : RESERVE_DATO;
    const startTs = osloTs(dato, startTime);
    // Observert historikk, så Yr-varselet fra der historikken slutter.
    const sisteHist = TIMER[TIMER.length - 1].ts;
    const alle = varsel ? [...TIMER, ...varsel.timer.filter((t) => t.ts > sisteHist)] : TIMER;
    const snø = analyserSnø(alle, startTs, snøStatus);
    const turFor = (s: 'klassisk' | 'skoyting') => planTur({ seksjoner, timer: alle.filter((t) => t.ts >= startTs - 3 * 3600_000), startTs, tempoKmt: TEMPO[s][modus], refH: område.vær.referansehoyde_m, terreng: løype.terreng, sted: område.sted });
    const turK = turFor('klassisk');
    const turS = stil === 'skoyting' ? turFor('skoyting') : null;
    const tur = turS ?? turK;
    const turPer = (st: Stil) => (st === 'skoyting' ? turS ?? turFor('skoyting') : turK);
    const perStil = Object.fromEntries((['klassisk', 'skoyting', 'felle', 'rubb'] as Stil[]).map((st) => [st, byggMedLager(st, turPer(st), snø, seksjoner, modus === 'Trening', lagerBruk)])) as Record<Stil, Stabel>;
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
  }, [løype, modus, startTime, dagIdx, varsel, stil, lagerBruk, skipark, område, TIMER, sys, snøStatus]);
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
  const ingenPrognose = varselFeil && !harPrognose;
  const prognoseAlderT = varsel ? (nå - varsel.hentet) / 3600_000 : 0;
  const prognoseGammel = !!varsel && prognoseAlderT > VARSEL_GAMMELT_T;
  const historikkGammel = (nå - r.sisteHist) / 3600_000 > HISTORIKK_GAMMEL_T;
  const km = løype.lengde_m / 1000;
  const tempo = TEMPO[stil === 'skoyting' ? 'skoyting' : 'klassisk'];
  const minutter = Math.round((km / tempo[modus]) * 60);
  const stabelVisning = [...(enkel ? forenklet(vis) : vis).lag].filter((l) => !erGlidesone(l)).reverse(); // øverste lag først, uten glider
  const glidesone = vis.lag.find(erGlidesone);

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
            <View style={styles.rad}>
              {mulige.map((x) => (
                <Chip key={x.id} aktiv={ekstraIds.includes(x.id)} onPress={() => setEkstraIds(ekstraIds.includes(x.id) ? ekstraIds.filter((v) => v !== x.id) : [...ekstraIds, x.id])}>
                  {`${ekstraIds.includes(x.id) ? '✓ ' : '+ '}${x.navn} · ${(x.lengde_m / 1000).toFixed(1)} km`}
                </Chip>
              ))}
            </View>
            {ekstraIds.length > 0 && <ThemedText type="small" themeColor="textSecondary">Turen går først {valgtLøype.navn}, så {ekstraIds.map((i) => LØYPER.find((l) => l.id === i)?.navn).join(', ')}, og tilbake til start. Smøringen regnes for hele turen.</ThemedText>}
          </View>
        )}

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

        {/* Tur */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>TUREN</ThemedText>
        <View style={styles.rad}>
          {DAGER.map((i) => (
            <Chip key={i} aktiv={harPrognose ? i === dagIdx : false} onPress={() => harPrognose && setDagIdx(i)}>{dagNavn(osloDato(i), i)}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          {(['klassisk', 'skoyting'] as Stil[]).map((x) => (
            <Chip key={x} aktiv={x === stil} onPress={() => setStil(x)}>{STIL_NAVN[x]}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          {MODI.map((m) => (
            <Chip key={m} aktiv={m === modus} onPress={() => setModus(m)}>{`${m} · ${tempo[m]} km/t`}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Start</Text>
          {Platform.OS === 'web' ? (
            createElement(
              'select',
              {
                value: String(startTime),
                'aria-label': 'Starttidspunkt for turen',
                onChange: (e: { target: { value: string } }) => setStartTime(Number(e.target.value)),
                style: { fontSize: 17, fontWeight: 600, padding: '10px 14px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.backgroundElement, color: theme.text, minWidth: 130 },
              },
              ...STARTTIDER.map((h) => createElement('option', { key: h, value: String(h) }, `🕒 ${klokke(h)}`))
            )
          ) : (
            [9, 10, 11, 12, 13].map((h) => <Chip key={h} aktiv={h === startTime} onPress={() => setStartTime(h)}>{`${klokke(h)}`}</Chip>)
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(r.tur.skyggeAndel * 100)} % av løypa ({(r.tur.skyggeAndel * km).toFixed(1)} km) ligger i terrengskygge når du går den.
          {r.tur.skyggeIgnorert ? ' Under 10 % av løypa, så skyggen er ikke regnet med i smøringen.' : r.tur.skyggeAndel >= 0.1 ? ' Skyggen er regnet med: kaldeste del er ' + r.tur.tMin.toFixed(1) + ' °C og varmeste ' + r.tur.tMaks.toFixed(1) + ' °C (5./95. persentil). Vurder selv om du vil smøre for sola eller skyggen.' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {varsel
            ? `Prognose: MET Norway / Yr (oppdatert ${tid(Date.parse(varsel.oppdatert))}${varsel.fraCache ? ', lagret fra tidligere' : ''}) · solinnstråling anslått fra skydekke`
            : henter
              ? 'Henter prognose fra Yr …'
              : 'Ingen prognose tilgjengelig.'}
        </ThemedText>
        {ingenPrognose ? (
          <View style={[styles.advarsel, { borderColor: '#C0392B' }]}>
            <ThemedText type="smallBold">⚠ Fikk ikke hentet prognosen fra Yr, og det finnes ingen brukbar lagret prognose. Smøretipset vises ikke før været er hentet. Prøv «Oppdater vær».</ThemedText>
          </View>
        ) : null}
        {varselFeil && harPrognose ? <ThemedText type="small">⚠ Fikk ikke hentet ny prognose. Viser den sist lagrede.</ThemedText> : null}
        {prognoseGammel ? <ThemedText type="small">⚠ Prognosen er {Math.round(prognoseAlderT)} timer gammel. Trykk «Oppdater vær» før du smører.</ThemedText> : null}
        {historikkGammel ? <ThemedText type="small">⚠ Observert vær i appen er fra {tid(r.sisteHist)} ({new Date(r.sisteHist).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}). Snøtilstanden kan ha endret seg siden.</ThemedText> : null}
        <View style={styles.rad}>
          <Chip aktiv={false} onPress={henter ? () => {} : oppdaterVær}>{henter ? 'Henter …' : '↻ Oppdater vær'}</Chip>
        </View>
        <ThemedText themeColor="textSecondary">
          Ca. {Math.floor(minutter / 60)} t {minutter % 60} min · {tid(r.tur.startTs)}–{tid(r.tur.sluttTs)}
        </ThemedText>

        {/* Smøring */}
        <Kort style={{ gap: Spacing.three }}>
          <View style={styles.rad}>
            <Text style={[styles.h2, { color: theme.text, flex: 1 }]}>Smøring</Text>
            <View style={[styles.merke, { backgroundColor: theme.accentSoft }]}>
              <Text style={{ color: theme.accent, fontWeight: '700' }}>{TYPE_NAVN[vis.type]}</Text>
            </View>
          </View>
          <Pressable onPress={() => setBrukLager(!brukLager)} style={styles.rad} accessibilityRole="checkbox" accessibilityState={{ checked: brukLager }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: theme.border, backgroundColor: brukLager ? theme.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {brukLager ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
            </View>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Bruk min smøring</Text>
            <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>
              {brukLager ? (lager.length ? `Tilpasset smørelageret ditt (${lager.length} produkter, alle merker).` : 'Smørelageret er tomt: kryss av det du har under Smørelager.') : 'Anbefaling fra Swix. Kryss av for å bruke det du har i lageret, fra alle merker.'}
            </ThemedText>
          </Pressable>
          <View style={styles.rad}>
            <Chip aktiv={!enkel} onPress={() => setVisning('full')}>Full</Chip>
            <Chip aktiv={enkel} onPress={() => setVisning('enkel')}>Enkel</Chip>
            {enkel ? <ThemedText type="small" themeColor="textSecondary">Base, glidesone og dagens smøring. Det er bare dette som lagres på ski.</ThemedText> : null}
          </View>
          {ingenPrognose ? (
            <ThemedText type="small">Ingen smøretips uten prognose. Se advarselen under «Turen».</ThemedText>
          ) : (<>
          <ThemedText type="small" themeColor="textSecondary">{vis.lag.filter((l) => !erGlidesone(l)).length > 1 || vis.type === 'hardvoks' || vis.type === 'klister' ? 'Øverst = siste lag. Bygg nedenfra og opp.' : 'Ingen smøring på festesonen.'}</ThemedText>
          <View style={{ gap: 6 }}>
            {stabelVisning.map((l, i) => (
              <View key={i} style={[styles.lag, { backgroundColor: produktFarge(l.produkt) }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lagProdukt, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.produkt}<Text style={{ fontWeight: '500', fontSize: 14 }}>  {produkt(l.produkt)?.farge}</Text></Text>
                  <Text style={[styles.lagRolle, { color: tekstPå(produktFarge(l.produkt)), opacity: 0.85 }]}>{l.rolle}{l.merknad ? ` · ${l.merknad}` : ''}</Text>
                </View>
                <Text style={[styles.lagAntall, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.antall}</Text>
              </View>
            ))}
          </View>
          <GliderBoks lag={glidesone} />
          {vis.alternativer?.map((a, i) => <ThemedText key={i} type="small" themeColor="textSecondary">Alternativ: {a}</ThemedText>)}
          {vis.advarsler.map((a, i) => (
            <View key={i} style={[styles.advarsel, { borderColor: '#E3A64A' }]}>
              <ThemedText type="small">⚠ {a}</ThemedText>
            </View>
          ))}
          </>)}
          <ThemedText type="small" themeColor="textSecondary">
            Utkast: temperaturområdene er hentet fra produsentene ({sys.navn}), men tersklene i reglene er foreløpige og justeres mot erfaring.
          </ThemedText>
        </Kort>

        {!ingenPrognose && r.alternativer.map((a) => (
          <Kort key={a.stil} style={{ gap: Spacing.two }}>
            <View style={styles.rad}>
              <Text style={[styles.h3, { color: theme.text, flex: 1 }]}>Alternativ: {STIL_NAVN[a.stil]}</Text>
              <View style={[styles.merke, { backgroundColor: theme.accentSoft }]}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>{skipark.filter((x) => x.stil === a.stil).map((x) => x.navn).join(', ')}</Text>
              </View>
            </View>
            <ThemedText type="small">{a.grunn}</ThemedText>
            {a.stabel.lag.filter((l) => !erGlidesone(l)).map((l, i) => (
              <View key={i} style={[styles.lag, { backgroundColor: produktFarge(l.produkt) }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lagProdukt, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.produkt}<Text style={{ fontWeight: '500', fontSize: 14 }}>  {produkt(l.produkt)?.farge}</Text></Text>
                  <Text style={[styles.lagRolle, { color: tekstPå(produktFarge(l.produkt)), opacity: 0.85 }]}>{l.rolle}{l.merknad ? ` · ${l.merknad}` : ''}</Text>
                </View>
                <Text style={[styles.lagAntall, { color: tekstPå(produktFarge(l.produkt)) }]}>{l.antall}</Text>
              </View>
            ))}
            <GliderBoks lag={a.stabel.lag.find(erGlidesone)} />
            {a.stabel.advarsler.map((w, i) => (
              <ThemedText key={i} type="small">⚠ {w}</ThemedText>
            ))}
          </Kort>
        ))}

        {/* Ski */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>SKI JEG SMØRER I DAG</ThemedText>
        <View style={styles.rad}>
          {skipark.map((x) => (
            <Chip key={x.id} aktiv={valgte.includes(x.id)} onPress={() => veksle(x.id)}>{`${valgte.includes(x.id) ? '✓ ' : ''}${x.navn} · ${STIL_NAVN[x.stil]}${x.sone ? ` · ${x.sone}` : ''}`}</Chip>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.push('/skipark')} style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{skipark.length ? 'Skipark' : '+ Legg inn ski'}</Text>
          </Pressable>
        </View>
        {valgteSki.length > 0 && !ingenPrognose && (
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

        {/* Snø */}
        <Kort>
          <Text style={[styles.h2, { color: theme.text }]}>Snøen</Text>
          <View style={styles.rad}>
            <Tall verdi={r.snø.type === 'ny' ? 'Nysnø' : 'Omdannet'} tekst="snøtype" />
            <Tall verdi={`${Math.round(r.snø.skarphet)}`} tekst="skarphet (0–100)" />
            <Tall verdi={`${r.tur.tMin.toFixed(1)} / ${r.tur.tMaks.toFixed(1)} °C`} tekst="kaldest / varmest" />
          </View>
        </Kort>

        {/* Temperaturoversikt */}
        <Kort>
          <Text style={[styles.h2, { color: theme.text }]}>Voks og klister</Text>
          <ThemedText type="small" themeColor="textSecondary">Hva hvert produkt fungerer på, med fargekodene til {sys.navn}.</ThemedText>
          <View style={styles.rad}>
            <Chip aktiv={oversiktVisning === 'alle'} onPress={() => setOversiktVisning('alle')}>Alle produkter</Chip>
            <Chip aktiv={oversiktVisning === 'mine'} onPress={() => setOversiktVisning('mine')}>Mine produkter</Chip>
            <Chip aktiv={oversiktVisning === 'kjop'} onPress={() => setOversiktVisning('kjop')}>Forslag til innkjøp</Chip>
          </View>
          {oversiktVisning === 'kjop' ? (
            <ThemedText type="small" themeColor="textSecondary">
              Swix-produkter for snøtemperaturene som er vanlige i {område.navn} fra desember til april (ca. {område.vinter[0]} til {område.vinter[1]} °C, anslag). Produkter du allerede har med overlappende område er ikke med.
            </ThemedText>
          ) : null}
          <Temperaturoversikt tMin={r.tur.tMin} tMaks={r.tur.tMaks} brukt={vis.lag.map((l) => l.produkt)} sys={sys} visning={oversiktVisning} lager={lager} kjøp={kjøp} />
        </Kort>

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

function Oversikt({ område, onVelg }: { område: Område; onVelg: (id: string) => void }) {
  const theme = useTheme();
  const router = useRouter();
  const LØYPER = løyperI(område).filter((l) => !l.variantAv);
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>LØYPER {område.navn.toUpperCase()}</ThemedText>
        <ThemedText themeColor="textSecondary">{LØYPER.length ? 'Trykk på en løype i kartet, eller velg fra lista.' : 'Løypene for dette området er ikke lagt inn ennå. Kartet viser området.'}</ThemedText>
        <Oversiktskart key={område.id} løyper={LØYPER} visning={område.visning} onVelg={onVelg} />
        <Loypevelger løyper={LØYPER} valgt={null} onVelg={onVelg} />
        <ThemedText type="small" themeColor="textSecondary">Løypedata: Turrutebasen og Kartverket (CC BY 4.0) og © OpenStreetMap-bidragsytere (ODbL).</ThemedText>
      </View>
    </ScrollView>
  );
}

export default function Hjem() {
  const [område] = useOmråde();
  const [valgt, setValgt] = useLagret<string | null>(`skiglede.loype.${område.id}`, null);
  const løype = løyperI(område).find((l) => l.id === valgt);
  if (!løype) return <Oversikt område={område} onVelg={setValgt} />;
  return <Detalj key={`${område.id}:${løype.id}`} løype={løype} område={område} onVelg={setValgt} onTilbake={() => setValgt(null)} />;
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
