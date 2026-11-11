import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ProLås } from '@/components/ski/konto';
import { Hero } from '@/components/ski/hero';
import { osloDato, osloTs, timerI } from '@/data/tid';
import { UnderlagValg } from '@/components/ski/underlag';
import { Chip, Kort, Nedtrekk, Sammenleggbar } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { TrailMap } from '@/components/ski/kart';
import { Hoydeprofil } from '@/components/ski/profil';
import { MaxContentWidth, Spacing, tempFarge } from '@/constants/theme';
import hovdenTour from '@/data/renn-hovden-tour.json';
import { useLøypeliste, useLøyper } from '@/data/loyper';
import type { Løype } from '@/data/rute';
import { lesAnonymt } from '@/data/neon';
import { useOmråder, useVær, type Område } from '@/data/omrader';
import { NØKKEL_SKIPARK, NØKKEL_VALGTE, TOM_LISTE, useStedData, type Ski } from '@/data/lagring';
import { StedVelger } from '@/components/ski/sted';
import * as DocumentPicker from 'expo-document-picker';
import { byggFraGpx, lesGpx, terrengFor } from '@/data/gpx';
import { hentLagretRutevær, hentRennRute, hentRutevær, lagreRenn, useAdminStatus, useMineRuter, type MinRute } from '@/data/minerute';
import { useLagret } from '@/data/lagring';
import { usePremium } from '@/data/premium';
import { hentVarsel, lesVarselCache, type Varsel } from '@/data/varsel';
import { useTheme } from '@/hooks/use-theme';
import { feilTekst } from '@/data/feil';
import { SWIX, analyserSnø, anbefalStruktur, nabostruktur, byggSmøring, lagSeksjoner, planTur, proGlidelag, snøMedUnderlag, turMedUnderlag, medUnderlag, strukturMedUnderlag, INGEN_UNDERLAG, type Underlag, type Stil, type Tur, type Vær } from '@/engine';

type Renn = { id: string; navn: string; omrade: string; dato: string | null; starttid: string | null; stil: string | null; lengde_km: number | null; loype_id: string | null; testdata: boolean; merknad: string | null };

// Reserve hvis databasen ikke svarer.
// Rennløyper som ligger i appen (fra OSM-biter eller arrangørens GPX). Nøkkel = renn-id.
const RENNLØYPER: Record<string, Løype> = {
  'hovden-tour-test': (hovdenTour as unknown as Løype[])[0],
};

const RESERVE: Renn[] = [
  { id: 'hovden-tour-test', navn: 'Hovden Tour (test)', omrade: 'hovden', dato: null, starttid: '10:00', stil: null, lengde_km: 16.4, loype_id: null, testdata: true, merknad: 'Løypa er OSM-linjene HovdenTour og HovdenTuren, og så ned til stadion langs Auversvatn-løypa (16,4 km). Ikke bekreftet som arrangørens løype. Dato mangler.' },
];

const TEMPO_RENN = { klassisk: 12, skoyting: 17 }; // km/t, [Forslag] rask hobbyløper

function useRenn(): Renn[] {
  const [liste, setListe] = useState<Renn[]>(RESERVE);
  useEffect(() => {
    let avbrutt = false;
    (async () => {
      try {
        const data = await lesAnonymt('konkurranse?select=id,navn,omrade,dato,starttid,stil,lengde_km,loype_id,testdata,merknad&order=dato.asc.nullslast');
        if (!avbrutt && data?.length) setListe(data as Renn[]);
      } catch {
        // beholder reserven
      }
    })();
    return () => { avbrutt = true; };
  }, []);
  return liste;
}

const MÅNEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const MND_KORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const dagnr = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
const idagNr = () => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86_400_000); };

/** Tourrenn som kalender: kommende renn etter dato (nærmeste først), gruppert på måned, så renn uten dato og til slutt tidligere. */
function Rennkalender({ renn, valgt, velg }: { renn: Renn[]; valgt: string; velg: (id: string) => void }) {
  const theme = useTheme();
  const idag = idagNr();
  const med = renn.filter((r) => r.dato).map((r) => ({ r, d: dagnr(r.dato as string) }));
  const kommende = med.filter((x) => x.d >= idag).sort((a, b) => a.d - b.d);
  const tidligere = med.filter((x) => x.d < idag).sort((a, b) => b.d - a.d);
  const udatert = renn.filter((r) => !r.dato);
  const rad = (r: Renn, d: number | null) => {
    const dato = r.dato ? new Date(`${(r.dato as string).slice(0, 10)}T00:00:00Z`) : null;
    const om = d === null ? '' : d === idag ? 'i dag' : d === idag + 1 ? 'i morgen' : d > idag ? `om ${d - idag} dager` : `${idag - d} dager siden`;
    return (
      <Pressable key={r.id} accessibilityRole="button" onPress={() => velg(r.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: r.id === valgt ? theme.accent : theme.border, backgroundColor: r.id === valgt ? theme.accentSoft : theme.backgroundElement }}>
        <View style={{ width: 48, alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{dato ? dato.getUTCDate() : '–'}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{dato ? MND_KORT[dato.getUTCMonth()].toUpperCase() : 'DATO?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{r.navn}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{[om, r.lengde_km ? `${Number(r.lengde_km).toFixed(1).replace('.', ',')} km` : '', r.stil === 'klassisk' ? 'klassisk' : r.stil === 'skoyting' ? 'skøyting' : ''].filter(Boolean).join(' · ')}</Text>
        </View>
      </Pressable>
    );
  };
  const måned = (r: { dato?: unknown }) => { const dt = new Date(`${(r.dato as string).slice(0, 10)}T00:00:00Z`); return `${MÅNEDER[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`; };
  return (
    <View style={{ gap: 8 }}>
      {kommende.length === 0 && udatert.length === 0 ? <ThemedText themeColor="textSecondary">Ingen kommende renn er lagt inn ennå.</ThemedText> : null}
      {kommende.map(({ r, d }, i) => {
        const mnd = måned(r);
        const overskrift = i === 0 || mnd !== måned(kommende[i - 1].r);
        return (
          <View key={r.id} style={{ gap: 6 }}>
            {overskrift ? <ThemedText type="smallBold" themeColor="textSecondary">{mnd.toUpperCase()}</ThemedText> : null}
            {rad(r, d)}
          </View>
        );
      })}
      {udatert.length ? <ThemedText type="smallBold" themeColor="textSecondary">UTEN DATO</ThemedText> : null}
      {udatert.map((r) => rad(r, null))}
      {tidligere.length ? <ThemedText type="smallBold" themeColor="textSecondary">TIDLIGERE</ThemedText> : null}
      {tidligere.map(({ r, d }) => rad(r, d))}
    </View>
  );
}

export default function RennSide() {
  const theme = useTheme();
  const router = useRouter();
  const renn = useRenn().filter((x) => !x.testdata);
  const [fane, setFane] = useLagret<'tour' | 'mine'>('skiglede.renn.fane', 'tour');
  const [valgt, setValgt] = useState<string>('');
  const [valgtEgen, setValgtEgen] = useState<string>('');
  const { bruker } = usePremium();
  const mine = useMineRuter(!!bruker);
  const egen = mine.ruter.find((x) => x.id === valgtEgen) ?? null;
  // Åpner rett på neste kommende renn (ellers det siste som har vært) hvis ingen er valgt
  const neste = valgtEgen ? null : [...renn].filter((x) => x.dato).sort((a, b) => {
    const da = dagnr(a.dato as string), db = dagnr(b.dato as string), i = idagNr();
    return (da >= i ? da - i : 1e6 + (i - da)) - (db >= i ? db - i : 1e6 + (i - db));
  })[0] ?? renn[0] ?? null;
  const r = renn.find((x) => x.id === valgt) ?? neste;
  const andres = mine.ruter.filter((x) => bruker && x.user_id && x.user_id !== bruker.id);
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={{ width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.three }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Tilbake</Text>
        </Pressable>
        <ProLås tittel="Renn">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip aktiv={fane === 'tour'} onPress={() => setFane('tour')}>Tourrenn</Chip>
            <Chip aktiv={fane === 'mine'} onPress={() => setFane('mine')}>Mine renn</Chip>
          </View>
          {fane === 'tour' ? (
            <>
              <Rennkalender renn={renn} valgt={r?.id ?? ''} velg={(id) => { setValgt(id); setValgtEgen(''); }} />
              {andres.length ? (
                <View style={{ gap: 8 }}>
                  <ThemedText type="smallBold" themeColor="textSecondary">DELT AV ANDRE</ThemedText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {andres.map((x) => <Chip key={x.id} aktiv={x.id === valgtEgen} onPress={() => { setValgtEgen(x.id); setValgt(''); }}>{`${x.navn} · ${(x.lengde_m / 1000).toFixed(1).replace('.', ',')} km`}</Chip>)}
                  </View>
                </View>
              ) : null}
              {egen && andres.some((x) => x.id === egen.id) ? <EgenRuteDetalj key={egen.id} rute={egen} /> : r ? <RennDetalj key={r.id} renn={r} /> : <ThemedText themeColor="textSecondary">Velg et renn i kalenderen for å få råd for hele løypa.</ThemedText>}
              <EgenRute modus="admin" mine={mine} valgt={valgtEgen} velg={() => undefined} />
            </>
          ) : (
            <>
              <EgenRute modus="mine" mine={mine} valgt={valgtEgen} velg={(id) => { setValgtEgen(id); setValgt(''); }} />
              {egen && !andres.some((x) => x.id === egen.id) ? <EgenRuteDetalj key={egen.id} rute={egen} /> : <ThemedText themeColor="textSecondary">Last opp en GPX eller velg en av dine ruter for å få råd for hele løypa.</ThemedText>}
            </>
          )}
        </ProLås>
      </View>
    </ScrollView>
  );
}

function RennDetalj({ renn }: { renn: Renn }) {
  const områder = useOmråder();
  const område = områder.find((o) => o.id === renn.omrade);
  const [opplastet, setOpplastet] = useState<Løype | undefined>(undefined);
  const [lastet, setLastet] = useState<{ ferdig: boolean; feil: string }>({ ferdig: false, feil: '' });
  const [forsøk, setForsøk] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starter ny henting av rennløypa
    setLastet({ ferdig: false, feil: '' });
    hentRennRute(renn.id)
      .then((l) => { setOpplastet(l ? { ...l, navn: renn.navn } : undefined); setLastet({ ferdig: true, feil: '' }); })
      .catch((e) => setLastet({ ferdig: true, feil: feilTekst(e) }));
  }, [renn.id, forsøk]);
  if (!område) return <Kort><ThemedText>Området {renn.omrade} finnes ikke.</ThemedText></Kort>;
  return <RennMedOmråde renn={renn} område={område} egenLøype={opplastet} løypeStatus={{ ...lastet, prøvIgjen: () => setForsøk((n) => n + 1) }} />;
}

/** Dine egne ruter: last opp GPX (bare for deg), velg en lagret rute eller slett den. */
function EgenRute({ mine, valgt, velg, modus }: { mine: ReturnType<typeof useMineRuter>; valgt: string; velg: (id: string) => void; modus: 'mine' | 'admin' }) {
  const theme = useTheme();
  const [status, setStatus] = useState('');
  const [bekreftSlett, setBekreftSlett] = useState<string | null>(null);
  const [opptatt, setOpptatt] = useState(false);
  const [del, setDel] = useState(false);
  const { bruker } = usePremium();
  const { er: erAdmin, feil: adminFeil } = useAdminStatus(!!bruker);
  const områder = useOmråder();
  const [rennNavn, setRennNavn] = useState('');
  const [rennDato, setRennDato] = useState('');
  const [rennStil, setRennStil] = useState<'klassisk' | 'skoyting' | ''>('');
  const lastRenn = async () => {
    setStatus('');
    try {
      if (!rennNavn.trim()) return setStatus('Skriv navnet på rennet først.');
      if (rennDato && !/^\d{4}-\d{2}-\d{2}$/.test(rennDato)) return setStatus('Datoen må være åååå-mm-dd, eller tom.');
      const r = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      setOpptatt(true);
      const a = r.assets[0];
      const gpx = lesGpx(a.file ? await a.file.text() : await (await fetch(a.uri)).text());
      setStatus('Henter høyde og skog fra Kartverket …');
      const løype = await byggFraGpx(gpx.punkter, rennNavn.trim());
      løype.terreng = await terrengFor(løype.punkter, (f, t) => setStatus(`Regner terreng for solskygge … ${Math.round((f / t) * 100)} %`));
      const km = (a_: { sted: { lat: number; lon: number } }) => Math.hypot((a_.sted.lat - løype.start_lat) * 111, (a_.sted.lon - løype.start_lon) * 111 * Math.cos((løype.start_lat * Math.PI) / 180));
      const nær = [...områder].sort((x, y) => km(x) - km(y))[0];
      if (!nær || km(nær) > 60) return setStatus('Ruten ligger mer enn 60 km fra et område med værdata. Legg til området først.');
      const id = rennNavn.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const feil = await lagreRenn({ id, navn: rennNavn.trim(), omrade: nær.id, dato: rennDato || null, stil: rennStil || null, løype });
      setStatus(feil ? `Kunne ikke lagre: ${feil}` : `Rennet «${rennNavn.trim()}» er lagt inn (${(løype.lengde_m / 1000).toFixed(1).replace('.', ',')} km, vær fra ${nær.navn}). Alle Pro-brukere ser det under Renn.`);
    } catch (e) {
      setStatus(feilTekst(e));
    } finally {
      setOpptatt(false);
    }
  };
  const last = async () => {
    setStatus('');
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      setOpptatt(true);
      const a = r.assets[0];
      const tekst = a.file ? await a.file.text() : await (await fetch(a.uri)).text();
      const gpx = lesGpx(tekst);
      setStatus('Henter høyde og skog fra Kartverket …');
      const navn = (gpx.navn || a.name.replace(/\.gpx$/i, '') || 'Min rute').slice(0, 80);
      const løype = await byggFraGpx(gpx.punkter, navn);
      løype.terreng = await terrengFor(løype.punkter, (f, t) => setStatus(`Regner terreng for solskygge … ${Math.round((f / t) * 100)} %`));
      const feil = await mine.lagre(løype, 'klassisk', del);
      if (feil) {
        setStatus(`Kunne ikke lagre: ${feil}`);
        return;
      }
      setStatus(`Lagret «${navn}» (${(løype.lengde_m / 1000).toFixed(1).replace('.', ',')} km), ${del ? 'delt med andre Pro-brukere' : 'bare synlig for deg'}.`);
    } catch (e) {
      setStatus(feilTekst(e));
    } finally {
      setOpptatt(false);
    }
  };
  const egne = mine.ruter.filter((x) => !bruker || !x.user_id || x.user_id === bruker.id);
  if (modus === 'admin') {
    if (!erAdmin) return adminFeil ? <ThemedText type="small" themeColor="textSecondary">Fikk ikke sjekket admin-tilgangen ({adminFeil}). Logg ut og inn igjen, og last siden på nytt.</ThemedText> : null;
    return (
      <Sammenleggbar id="renn-admin" tittel="Legg inn renn (admin)" standardÅpen={false}>
        <>
          <ThemedText type="small" themeColor="textSecondary">F.eks. Hovden Tour: skriv navn og dato, velg stil og last opp arrangørens GPX. Alle Pro-brukere får rennet og løypa under Renn.</ThemedText>
          <TextInput value={rennNavn} onChangeText={setRennNavn} placeholder="Navn på rennet" placeholderTextColor={theme.textSecondary} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text }} />
          <TextInput value={rennDato} onChangeText={setRennDato} placeholder="Dato åååå-mm-dd (valgfritt)" placeholderTextColor={theme.textSecondary} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text }} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip aktiv={rennStil === 'klassisk'} onPress={() => setRennStil(rennStil === 'klassisk' ? '' : 'klassisk')}>Klassisk</Chip>
            <Chip aktiv={rennStil === 'skoyting'} onPress={() => setRennStil(rennStil === 'skoyting' ? '' : 'skoyting')}>Skøyting</Chip>
            <Chip aktiv onPress={opptatt ? () => undefined : lastRenn}>{opptatt ? 'Laster opp …' : 'Last opp GPX som renn'}</Chip>
          </View>
        </>        {status ? <ThemedText type="small" style={{ color: theme.accent }}>{status}</ThemedText> : null}
      </Sammenleggbar>
    );
  }
  return (
    <Sammenleggbar id="renn-1" tittel="Dine egne ruter">
      <ThemedText type="small" themeColor="textSecondary">Last opp en GPX-fil, så regnes råd ut for akkurat denne løypa: vær, snøtemperatur, innstråling og struktur. Ruten lagres på kontoen din. Solskygge regnes fra terrenget (ett punkt per 300 m), så opplasting tar litt tid.</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip aktiv onPress={opptatt ? () => undefined : last}>{opptatt ? 'Laster opp …' : 'Last opp GPX'}</Chip>
        {egne.map((x) => (
          <Chip key={x.id} aktiv={x.id === valgt} onPress={() => velg(x.id)}>{`${x.navn} · ${(x.lengde_m / 1000).toFixed(1).replace('.', ',')} km${x.delt ? ' · delt' : ''}`}</Chip>
        ))}
      </View>
      <Chip aktiv={del} onPress={() => setDel(!del)}>{del ? '✓ Del med andre Pro-brukere' : 'Del med andre Pro-brukere (av)'}</Chip>
      <ThemedText type="small" themeColor="textSecondary">Delte ruter kan alle Pro-brukere se, inkludert startpunktet. Del ikke ruter som starter ved hjemmet ditt. Delte ruter får værhistorikk lagret fra opplastingen (opptil 90 døgn, oppdatert hver fjerde time); først etter første oppdatering brukes den, til da brukes 14 døgn.</ThemedText>
      {(() => {
        const v = mine.ruter.find((x) => x.id === valgt);
        if (!v || (bruker && v.user_id && v.user_id !== bruker.id)) return null;
        return (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip aktiv={false} onPress={async () => { const f = await mine.delMed(v.id, !v.delt); if (f) setStatus(`Kunne ikke endre deling: ${f}`); }}>{v.delt ? 'Slutt å dele' : 'Del med Pro-brukere'}</Chip>
            {bekreftSlett === v.id ? (
              <>
                <ThemedText type="small">Slette «{v.navn}» for godt?</ThemedText>
                <Chip aktiv onPress={async () => { const f = await mine.slett(v.id); setBekreftSlett(null); if (f) setStatus(`Kunne ikke slette: ${f}`); else velg(''); }}>Ja, slett</Chip>
                <Chip aktiv={false} onPress={() => setBekreftSlett(null)}>Avbryt</Chip>
              </>
            ) : (
              <Chip aktiv={false} onPress={() => setBekreftSlett(v.id)}>Slett valgt rute</Chip>
            )}
          </View>
        );
      })()}
      {status ? <ThemedText type="small" style={{ color: theme.accent }}>{status}</ThemedText> : null}
      {mine.feil ? <ThemedText type="small" style={{ color: theme.accent }}>{mine.feil}</ThemedText> : null}
    </Sammenleggbar>
  );
}

/** Råd for en egen rute: været hentes for rutens start, resten regnes som for andre renn. */
function EgenRuteDetalj({ rute }: { rute: MinRute }) {
  const [vær, setVær] = useState<{ referansehoyde_m: number; timer: (string | number)[][] } | null>(null);
  const [feil, setFeil] = useState('');
  useEffect(() => {
    (rute.delt ? hentLagretRutevær(rute.id) : Promise.resolve(null)).catch(() => null).then((l) => l ?? hentRutevær(rute.start_lat, rute.start_lon)).then(setVær).catch((e) => setFeil(feilTekst(e)));
  }, [rute.id]);
  if (feil) return <Kort><ThemedText>Fikk ikke hentet været for ruten: {feil}</ThemedText></Kort>;
  if (!vær) return <Kort><ThemedText themeColor="textSecondary">Henter været for ruten …</ThemedText></Kort>;
  const løype: Løype = { id: rute.id, navn: rute.navn, lengde_m: rute.lengde_m, punkter: rute.punkter, terreng: rute.terreng ?? undefined };
  const område: Område = {
    id: `rute-${rute.id}`, navn: rute.navn, sted: { lat: rute.start_lat, lon: rute.start_lon }, hoyde: Math.round(rute.punkter[0][2]),
    visning: { lon: rute.start_lon, lat: rute.start_lat, z: 12 }, vær, vinter: [-18, 1],
  };
  const renn: Renn = { id: `egen-${rute.id}`, navn: rute.navn, omrade: område.id, dato: null, starttid: '10:00', stil: null, lengde_km: rute.lengde_m / 1000, loype_id: null, testdata: false, merknad: null };
  return <RennMedOmråde renn={renn} område={område} egenLøype={løype} />;
}

/** Glideren på festeoppsettet (glidesonen), eller dagens glider i skøyting. */
function glid(st: { lag: { rolle: string; produkt: string }[] }, pro: { rolle: string; produkt: string }[]): string {
  const g = st.lag.find((l) => l.rolle.startsWith('Glidesone') || l.rolle === 'Glider');
  if (g) return g.produkt;
  return pro.find((l) => l.rolle === 'Dagens glider')?.produkt ?? 'se Glid over';
}

function RennMedOmråde({ renn, område, egenLøype, løypeStatus }: { renn: Renn; område: Område; egenLøype?: Løype; løypeStatus?: { ferdig: boolean; feil: string; prøvIgjen: () => void } }) {
  const theme = useTheme();
  const værdata = useVær(område);
  const { liste } = useLøypeliste(område.id);
  const fraListe = useLøyper(område.id, liste, renn.loype_id ? [renn.loype_id] : [])[0];
  const løype = egenLøype ?? RENNLØYPER[renn.id] ?? fraListe;
  const [varsel, setVarsel] = useState<Varsel | null>(null);
  const [dag, setDag] = useState(renn.dato ? 0 : 1);
  const [time, setTime] = useState(renn.starttid ? Number(renn.starttid.slice(0, 2)) + Number(renn.starttid.slice(3, 5)) / 60 : 10);
  const [underlagValgt, setUnderlag] = useState<Underlag>(INGEN_UNDERLAG);
  const [stil, setStil] = useState<'klassisk' | 'skoyting'>(renn.stil === 'skoyting' ? 'skoyting' : 'klassisk');
  const TIMER = useMemo(() => timerI(værdata), [værdata]);
  const [skipark] = useStedData<Ski[]>(NØKKEL_SKIPARK, TOM_LISTE);
  const [valgte, setValgte] = useStedData<string[]>(NØKKEL_VALGTE, TOM_LISTE);
  const mine = skipark.filter((x) => x.stil === stil);
  const valgteSki = valgte.map((id) => mine.find((x) => x.id === id)).filter((x): x is Ski => !!x);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lagret prognose vises med en gang, ny hentes ved områdebytte
    setVarsel(lesVarselCache(område));
    hentVarsel(område).then(setVarsel).catch(() => undefined);
  }, [område.id]);

  const dato = renn.dato ?? osloDato(dag);
  const utenVær = TIMER.length === 0;
  const res = useMemo(() => {
    if (!løype || utenVær) return null;
    const seksjoner = lagSeksjoner(løype.punkter);
    const sisteHist = TIMER[TIMER.length - 1].ts;
    const alle = varsel ? [...TIMER, ...varsel.timer.filter((t) => t.ts > sisteHist)] : TIMER;
    // Uten vær for rennstarten (for langt frem, eller prognosen kom ikke): bruk siste observerte døgn i stedet for å krasje.
    const ønsket = osloTs(dato, time);
    const sisteTs = alle[alle.length - 1].ts;
    const dekket = ønsket + 6 * 3600_000 <= sisteTs;
    const startTs = dekket ? ønsket : sisteTs - 8 * 3600_000;
    const rå = planTur({ seksjoner, timer: alle.filter((t) => t.ts >= startTs - 3 * 3600_000), startTs, tempoKmt: TEMPO_RENN[stil], refH: værdata.referansehoyde_m, terreng: løype.terreng, sted: område.sted });
    // Man salter ikke kald løype: salt-valget finnes bare når snøen blir 0 °C eller varmere, og slås ellers av.
    const saltMulig = rå.tMaksRå >= 0;
    const underlag = saltMulig || !underlagValgt.salt.på ? underlagValgt : { ...underlagValgt, salt: { ...underlagValgt.salt, på: false } };
    const snø = snøMedUnderlag(analyserSnø(alle, startTs, null), underlag);
    const tur = turMedUnderlag(rå, underlag);
    const stabel = medUnderlag(byggSmøring(stil as Stil, tur, snø, seksjoner, false, SWIX), underlag, tur);
    // Tre alternativer til test: anbefalt, kaldere og varmere (±2 °C er [Forslag]). Like alternativer slås sammen.
    const forskyv = (d: number): Tur => ({ ...tur, tMin: tur.tMin + d, tMaks: tur.tMaks + d, tMinRå: tur.tMinRå + d, tMaksRå: tur.tMaksRå + d, seksjoner: tur.seksjoner.map((x) => ({ ...x, tEff: x.tEff + d, tLuft: x.tLuft + d })) });
    const nøkkel = (x: typeof stabel) => x.lag.map((l) => `${l.rolle}:${l.produkt}:${l.antall}`).join('|');
    const feste: { navn: string; stabel: typeof stabel; likt: boolean }[] = [];
    if (stil === 'klassisk') {
      for (const [navn, d] of [['Anbefalt', 0], ['Kaldere (−2 °C)', -2], ['Varmere (+2 °C)', 2]] as const) {
        const st = d === 0 ? stabel : medUnderlag(byggSmøring('klassisk', forskyv(d), snø, seksjoner, false, SWIX), underlag, tur);
        feste.push({ navn, stabel: st, likt: d !== 0 && nøkkel(st) === nøkkel(stabel) });
      }
    }
    const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
    const farger = tur.seksjoner.map((x) => tempFarge(x.tEff));
    const segmenter = seksjoner.map((x, i) => ({ pts: løype.punkter.filter((p) => p[3] >= x.startM && p[3] <= x.endM).map((p) => [p[0], p[1]] as [number, number]), farge: farger[i] }));
    const profil = løype.punkter.map((p) => ({ d: p[3], h: p[2], farge: farger[Math.max(0, seksjoner.findIndex((x) => p[3] <= x.endM))] }));
    const opp = løype.punkter.slice(1).reduce((a, p, i) => a + Math.max(0, p[2] - løype.punkter[i][2]), 0);
    return { segmenter, profil, opp, tur, snø, stabel, feste, snitt, struktur: strukturMedUnderlag(anbefalStruktur(snitt, snø, tur.sludd, stil), underlag, stil as 'klassisk' | 'skoyting'), glid: proGlidelag(tur, SWIX), harVarsel: dekket, startTs, saltMulig };
  }, [løype, utenVær, dato, time, varsel, stil, TIMER, område, værdata, underlagValgt]);

  return (
    <View style={{ gap: Spacing.three }}>
      <Kort>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{renn.navn}</Text>
        <ThemedText themeColor="textSecondary">{[område.navn, renn.dato ? `dato ${renn.dato}` : 'dato ikke lagt inn', renn.lengde_km ? `${renn.lengde_km} km` : null].filter(Boolean).join(' · ')}</ThemedText>
        {renn.testdata && <ThemedText type="small" style={{ color: theme.accent }}>⚠ Testoppføring. {renn.merknad ?? ''}</ThemedText>}
        {løype && <ThemedText type="small" themeColor="textSecondary">{`Løype brukt i beregningen: ${løype.navn} (${(løype.lengde_m / 1000).toFixed(1).replace('.', ',')} km).`}</ThemedText>}
      </Kort>

      {!renn.dato && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0, 1, 2].map((d) => <Chip key={d} aktiv={dag === d} onPress={() => setDag(d)}>{d === 0 ? 'I dag' : d === 1 ? 'I morgen' : 'Overmorgen'}</Chip>)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Nedtrekk etikett="Starttidspunkt" verdi={String(time)} valg={Array.from({ length: 35 }, (_, i) => 6 + i / 2).map((h) => ({ verdi: String(h), tekst: `🕒 Start ${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}` }))} onVelg={(v) => setTime(Number(v))} />
        <Chip aktiv={stil === 'klassisk'} onPress={() => setStil('klassisk')}>Klassisk</Chip>
        <Chip aktiv={stil === 'skoyting'} onPress={() => setStil('skoyting')}>Skøyting</Chip>
      </View>
      <Kort>
        <UnderlagValg u={underlagValgt} onChange={setUnderlag} medSalt={!!res?.saltMulig} />
      </Kort>

      {utenVær ? (
        <Kort><ThemedText>Værhistorikk mangler for {område.navn}.</ThemedText></Kort>
      ) : !løype ? (
        <Kort>
          {løypeStatus?.feil ? (
            <>
              <ThemedText>Fikk ikke hentet løypa: {løypeStatus.feil}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Hvis det fortsetter: logg ut og inn igjen, og last siden på nytt.</ThemedText>
              <View style={{ flexDirection: 'row' }}><Chip aktiv={false} onPress={løypeStatus.prøvIgjen}>↻ Prøv igjen</Chip></View>
            </>
          ) : løypeStatus?.ferdig && !renn.loype_id ? (
            <ThemedText>Det er ikke lastet opp noen løype for dette rennet ennå.</ThemedText>
          ) : (
            <ThemedText themeColor="textSecondary">Henter løypa …</ThemedText>
          )}
        </Kort>
      ) : res ? (
        <>
          <Sammenleggbar id="renn-2" tittel="Løypa">
            <ThemedText type="small" themeColor="textSecondary">{`${(løype.lengde_m / 1000).toFixed(1).replace('.', ',')} km · ${Math.round(res.opp)} m opp · ${Math.round(Math.min(...løype.punkter.map((p) => p[2])))}–${Math.round(Math.max(...løype.punkter.map((p) => p[2])))} moh. Fargen viser beregnet snøtemperatur langs løypa.`}</ThemedText>
            <TrailMap segmenter={res.segmenter} />
            <Hoydeprofil punkter={res.profil} />
          </Sammenleggbar>
          {!res.harVarsel && <ThemedText type="small" style={{ color: theme.accent }}>Ingen prognose for rennstarten ennå (finnes bare for de nærmeste dagene). Rådet under er regnet med siste kjente vær og oppdateres når rennet nærmer seg.</ThemedText>}
          <Sammenleggbar id="renn-3" tittel="Slipestruktur (rilljern)">
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>{res.struktur.navn}</Text>
            <ThemedText themeColor="textSecondary">{res.struktur.grunn}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{`Snøtemperatur i snitt ${res.snitt.toFixed(1).replace('.', ',')} °C (${res.tur.tMin.toFixed(1).replace('.', ',')} til ${res.tur.tMaks.toFixed(1).replace('.', ',')}). Forslag til testing, ikke fasit.`}</ThemedText>
          </Sammenleggbar>
          <Sammenleggbar id="renn-4" tittel="Glid, lag for lag">
            {res.glid.map((l, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{`${i + 1}. ${l.rolle}: ${l.produkt} · ${l.antall}`}</Text>
                {l.merknad ? <ThemedText type="small" themeColor="textSecondary">{l.merknad}</ThemedText> : null}
              </View>
            ))}
          </Sammenleggbar>
          {stil === 'klassisk' ? (
            <Sammenleggbar id="renn-5" tittel="Feste, lag for lag (anbefalt)">
              {res.stabel.lag.filter((l) => !l.rolle.startsWith('Glidesone') && l.rolle !== 'Glider').map((l, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{`${i + 1}. ${l.rolle}: ${l.produkt} · ${l.antall}`}</Text>
                  {l.merknad ? <ThemedText type="small" themeColor="textSecondary">{l.merknad}</ThemedText> : null}
                </View>
              ))}
              {res.stabel.advarsler.map((w, i) => <ThemedText key={i} type="small">⚠ {w}</ThemedText>)}
            </Sammenleggbar>
          ) : null}
          <Sammenleggbar id="renn-6" tittel="Dine ski">
            <StedVelger forklaring="Stedet velges automatisk når du er innen 10 km. Ellers velger du selv ski fra et av stedene, eller bruker smøring fra lageret." />
            {mine.length ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">Velg ski til testen (samme valg som «Smører i dag» i skiparken). Parene vises i testplanen under.</ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {mine.map((x) => (
                    <Chip key={x.id} aktiv={valgte.includes(x.id)} onPress={() => setValgte(valgte.includes(x.id) ? valgte.filter((v) => v !== x.id) : [...valgte, x.id])}>{x.navn}</Chip>
                  ))}
                </View>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">{`Ingen ${stil === 'klassisk' ? 'klassiskski' : 'skøyteski'} på dette stedet. Legg dem til i Skipark, eller velg et annet sted.`}</ThemedText>
            )}
          </Sammenleggbar>
          <Sammenleggbar id="renn-7" tittel="Testplan: tre par ski">
            <ThemedText type="small" themeColor="textSecondary">Appen ser ikke snøen i løypa. Mål snøtemperaturen der og test tre par ski. Glid vurderer du på følelsen. {stil === 'klassisk' ? 'Festet testes samtidig, og så melder du tilbake hva som skal justeres (se under).' : ''} Forslag, ikke fasit.</ThemedText>
            {[[1, 'Anbefalt', res.struktur, 0], [2, 'Finere glid' + (stil === 'klassisk' ? ', kaldere feste' : ''), nabostruktur(res.struktur, -1, stil), 1], [3, 'Grovere glid' + (stil === 'klassisk' ? ', varmere feste' : ''), nabostruktur(res.struktur, 1, stil), 2]].map(([n, tittel, str, fi]) => {
              const f = stil === 'klassisk' ? res.feste[fi as number] : null;
              return (
                <View key={String(n)} style={{ gap: 2, marginTop: 8 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>{`Par ${n}${valgteSki[(n as number) - 1] ? ` · ${valgteSki[(n as number) - 1].navn}` : ''}: ${tittel}`}</Text>
                  <ThemedText type="small">{`Struktur: ${str ? (str as { navn: string }).navn : 'finnes ikke (bruk anbefalt)'}`}</ThemedText>
                  <ThemedText type="small">{`Glider: ${glid(f ? f.stabel : res.stabel, res.glid)}`}</ThemedText>
                  {f ? (
                    f.likt ? (
                      <ThemedText type="small">Feste: samme som anbefalt (kaldere/varmere gir samme lag i dag, juster med antall lag).</ThemedText>
                    ) : (
                      <ThemedText type="small">{`Feste: ${f.stabel.lag.filter((l) => !l.rolle.startsWith('Glidesone')).map((l) => `${l.produkt} (${l.antall})`).join(' → ') || 'ingen'}`}</ThemedText>
                    )
                  ) : null}
                </View>
              );
            })}
          </Sammenleggbar>
          {stil === 'klassisk' ? (
            <Sammenleggbar id="renn-8" tittel="Etter testen: juster festet">
              <ThemedText>{'• Slipper eller er bakglatt: legg på flere lag, eller gå til varmere voks.'}</ThemedText>
              <ThemedText>{'• Klabber, setter seg fast eller isner: færre lag, eller kaldere voks.'}</ThemedText>
              <ThemedText>{'• Klister: tykkere lag mot glatt, tynnere mot klabb. Husk å kjøle mellom lagene.'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Etter rennet kan du føre inn hva som funket i Smøreloggen, så kalibrerer vi rådene.</ThemedText>
            </Sammenleggbar>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
