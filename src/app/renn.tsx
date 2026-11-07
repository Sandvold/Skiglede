import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ProLås } from '@/components/ski/konto';
import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLøypeliste, useLøyper } from '@/data/loyper';
import { neonAnonym } from '@/data/neon';
import { useOmråder, useVær, type Område } from '@/data/omrader';
import { hentVarsel, lesVarselCache, type Varsel } from '@/data/varsel';
import { useTheme } from '@/hooks/use-theme';
import { SWIX, analyserSnø, anbefalStruktur, byggSmøring, lagSeksjoner, planTur, proGlidelag, type Stil, type Vær } from '@/engine';

type Renn = { id: string; navn: string; omrade: string; dato: string | null; starttid: string | null; stil: string | null; lengde_km: number | null; loype_id: string | null; testdata: boolean; merknad: string | null };

// Reserve hvis databasen ikke svarer.
const RESERVE: Renn[] = [
  { id: 'hovden-tour-test', navn: 'Hovden Tour (test)', omrade: 'hovden', dato: null, starttid: null, stil: null, lengde_km: null, loype_id: 'auversvatn', testdata: true, merknad: 'Testoppføring: ingen dato eller offisiell løype. Auversvatn brukes som stedfortreder.' },
];

const osloDato = (dager: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(Date.now() + dager * 86400_000);
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
const timerI = (v: Område['vær']): Vær[] => v.timer.map((r) => ({ ts: Date.parse(r[0] as string), temp: r[1] as number, nedbor: r[2] as number, rh: r[3] as number, vind: r[4] as number, sw: r[5] as number }));
const TEMPO_RENN = { klassisk: 12, skoyting: 17 }; // km/t, [Forslag] rask hobbyløper

function useRenn(): Renn[] {
  const [liste, setListe] = useState<Renn[]>(RESERVE);
  useEffect(() => {
    let avbrutt = false;
    (async () => {
      try {
        const { data } = await neonAnonym().from('konkurranse').select('id, navn, omrade, dato, starttid, stil, lengde_km, loype_id, testdata, merknad').order('dato', { ascending: true, nullsFirst: false });
        if (!avbrutt && data?.length) setListe(data as Renn[]);
      } catch {
        // beholder reserven
      }
    })();
    return () => { avbrutt = true; };
  }, []);
  return liste;
}

export default function RennSide() {
  const theme = useTheme();
  const router = useRouter();
  const renn = useRenn();
  const [valgt, setValgt] = useState<string>('');
  const r = renn.find((x) => x.id === valgt) ?? null;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={{ width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.three }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Tilbake</Text>
        </Pressable>
        <ProLås tittel="Renn">
          <ThemedText type="smallBold" themeColor="textSecondary">RENN</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {renn.map((x) => (
              <Chip key={x.id} aktiv={x.id === valgt} onPress={() => setValgt(x.id)}>{x.navn}</Chip>
            ))}
          </View>
          {r ? <RennDetalj key={r.id} renn={r} /> : <ThemedText themeColor="textSecondary">Velg et renn for å få råd for hele løypa.</ThemedText>}
        </ProLås>
      </View>
    </ScrollView>
  );
}

function RennDetalj({ renn }: { renn: Renn }) {
  const theme = useTheme();
  const områder = useOmråder();
  const område = områder.find((o) => o.id === renn.omrade);
  if (!område) return <Kort><ThemedText>Området {renn.omrade} finnes ikke.</ThemedText></Kort>;
  return <RennMedOmråde renn={renn} område={område} />;
}

function RennMedOmråde({ renn, område }: { renn: Renn; område: Område }) {
  const theme = useTheme();
  const værdata = useVær(område);
  const { liste } = useLøypeliste(område.id);
  const løype = useLøyper(område.id, liste, renn.loype_id ? [renn.loype_id] : [])[0];
  const [varsel, setVarsel] = useState<Varsel | null>(null);
  const [dag, setDag] = useState(renn.dato ? 0 : 1);
  const [time, setTime] = useState(renn.starttid ? Number(renn.starttid.slice(0, 2)) + Number(renn.starttid.slice(3, 5)) / 60 : 10);
  const [stil, setStil] = useState<'klassisk' | 'skoyting'>(renn.stil === 'skoyting' ? 'skoyting' : 'klassisk');
  const TIMER = useMemo(() => timerI(værdata), [værdata]);

  useEffect(() => {
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
    const snø = analyserSnø(alle, startTs, null);
    const tur = planTur({ seksjoner, timer: alle.filter((t) => t.ts >= startTs - 3 * 3600_000), startTs, tempoKmt: TEMPO_RENN[stil], refH: værdata.referansehoyde_m, terreng: løype.terreng, sted: område.sted });
    const stabel = byggSmøring(stil as Stil, tur, snø, seksjoner, false, SWIX);
    const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
    return { tur, snø, stabel, snitt, struktur: anbefalStruktur(snitt, snø, tur.sludd), glid: proGlidelag(tur, SWIX), harVarsel: dekket, startTs };
  }, [løype, utenVær, dato, time, varsel, stil, TIMER, område, værdata]);

  return (
    <View style={{ gap: Spacing.three }}>
      <Kort>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{renn.navn}</Text>
        <ThemedText themeColor="textSecondary">{[område.navn, renn.dato ? `dato ${renn.dato}` : 'dato ikke lagt inn', renn.lengde_km ? `${renn.lengde_km} km` : null].filter(Boolean).join(' · ')}</ThemedText>
        {renn.testdata && <ThemedText type="small" style={{ color: theme.accent }}>⚠ Testoppføring. {renn.merknad ?? ''}</ThemedText>}
        {løype && <ThemedText type="small" themeColor="textSecondary">{`Løype brukt i beregningen: ${løype.navn} (${(løype.lengde_m / 1000).toFixed(1)} km).`}</ThemedText>}
      </Kort>

      {!renn.dato && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0, 1, 2].map((d) => <Chip key={d} aktiv={dag === d} onPress={() => setDag(d)}>{d === 0 ? 'I dag' : d === 1 ? 'I morgen' : 'Overmorgen'}</Chip>)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[9, 10, 11, 12].map((t) => <Chip key={t} aktiv={time === t} onPress={() => setTime(t)}>{`Start ${t}:00`}</Chip>)}
        <Chip aktiv={stil === 'klassisk'} onPress={() => setStil('klassisk')}>Klassisk</Chip>
        <Chip aktiv={stil === 'skoyting'} onPress={() => setStil('skoyting')}>Skøyting</Chip>
      </View>

      {utenVær ? (
        <Kort><ThemedText>Værhistorikk mangler for {område.navn}.</ThemedText></Kort>
      ) : !løype ? (
        <Kort><ThemedText themeColor="textSecondary">Henter løypa …</ThemedText></Kort>
      ) : res ? (
        <>
          {!res.harVarsel && <ThemedText type="small" style={{ color: theme.accent }}>Ingen prognose for rennstarten ennå (finnes bare for de nærmeste dagene). Rådet under er regnet med siste kjente vær og oppdateres når rennet nærmer seg.</ThemedText>}
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Slipestruktur (rilljern)</Text>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>{res.struktur.navn}</Text>
            <ThemedText themeColor="textSecondary">{res.struktur.grunn}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{`Snøtemperatur i snitt ${res.snitt.toFixed(1)} °C (${res.tur.tMin.toFixed(1)} til ${res.tur.tMaks.toFixed(1)}). Forslag til testing, ikke fasit.`}</ThemedText>
          </Kort>
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Glid, lag for lag</Text>
            {res.glid.map((l, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{`${i + 1}. ${l.rolle}: ${l.produkt} · ${l.antall}`}</Text>
                {l.merknad ? <ThemedText type="small" themeColor="textSecondary">{l.merknad}</ThemedText> : null}
              </View>
            ))}
          </Kort>
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{stil === 'klassisk' ? 'Feste, lag for lag' : 'Skøyting: ingen feste'}</Text>
            {stil === 'klassisk' ? res.stabel.lag.map((l, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{`${i + 1}. ${l.rolle}: ${l.produkt} · ${l.antall}`}</Text>
                {l.merknad ? <ThemedText type="small" themeColor="textSecondary">{l.merknad}</ThemedText> : null}
              </View>
            )) : <ThemedText themeColor="textSecondary">Glideren over er hele smøringen.</ThemedText>}
            {res.stabel.advarsler.map((w, i) => <ThemedText key={i} type="small">⚠ {w}</ThemedText>)}
          </Kort>
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Test på rennmorgenen</Text>
            <ThemedText themeColor="textSecondary">Appen ser ikke snøen i løypa. Mål snøtemperaturen der, og test to eller tre par: anbefalt struktur, en finere og en grovere. Velg etter glidet, ikke etter rådet her.</ThemedText>
          </Kort>
        </>
      ) : null}
    </View>
  );
}
