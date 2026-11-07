import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ProLås } from '@/components/ski/konto';
import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
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
import { hentVarsel, lesVarselCache, type Varsel } from '@/data/varsel';
import { useTheme } from '@/hooks/use-theme';
import { SWIX, analyserSnø, anbefalStruktur, nabostruktur, byggSmøring, lagSeksjoner, planTur, proGlidelag, type Stil, type Tur, type Vær } from '@/engine';

type Renn = { id: string; navn: string; omrade: string; dato: string | null; starttid: string | null; stil: string | null; lengde_km: number | null; loype_id: string | null; testdata: boolean; merknad: string | null };

// Reserve hvis databasen ikke svarer.
// Rennløyper som ligger i appen (fra OSM-biter eller arrangørens GPX). Nøkkel = renn-id.
const RENNLØYPER: Record<string, Løype> = {
  'hovden-tour-test': (hovdenTour as unknown as Løype[])[0],
};

const RESERVE: Renn[] = [
  { id: 'hovden-tour-test', navn: 'Hovden Tour (test)', omrade: 'hovden', dato: null, starttid: '10:00', stil: null, lengde_km: 16.4, loype_id: null, testdata: true, merknad: 'Løypa er OSM-linjene HovdenTour og HovdenTuren, og så ned til stadion langs Auversvatn-løypa (16,4 km). Ikke bekreftet som arrangørens løype. Dato mangler.' },
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

/** Glideren på festeoppsettet (glidesonen), eller dagens glider i skøyting. */
function glid(st: { lag: { rolle: string; produkt: string }[] }, pro: { rolle: string; produkt: string }[]): string {
  const g = st.lag.find((l) => l.rolle.startsWith('Glidesone') || l.rolle === 'Glider');
  if (g) return g.produkt;
  return pro.find((l) => l.rolle === 'Dagens glider')?.produkt ?? 'se Glid over';
}

function RennMedOmråde({ renn, område }: { renn: Renn; område: Område }) {
  const theme = useTheme();
  const værdata = useVær(område);
  const { liste } = useLøypeliste(område.id);
  const fraListe = useLøyper(område.id, liste, renn.loype_id ? [renn.loype_id] : [])[0];
  const løype = RENNLØYPER[renn.id] ?? fraListe;
  const [varsel, setVarsel] = useState<Varsel | null>(null);
  const [dag, setDag] = useState(renn.dato ? 0 : 1);
  const [time, setTime] = useState(renn.starttid ? Number(renn.starttid.slice(0, 2)) + Number(renn.starttid.slice(3, 5)) / 60 : 10);
  const [stil, setStil] = useState<'klassisk' | 'skoyting'>(renn.stil === 'skoyting' ? 'skoyting' : 'klassisk');
  const TIMER = useMemo(() => timerI(værdata), [værdata]);
  const [skipark] = useStedData<Ski[]>(NØKKEL_SKIPARK, TOM_LISTE);
  const [valgte, setValgte] = useStedData<string[]>(NØKKEL_VALGTE, TOM_LISTE);
  const mine = skipark.filter((x) => x.stil === stil);
  const valgteSki = valgte.map((id) => mine.find((x) => x.id === id)).filter((x): x is Ski => !!x);

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
    // Tre alternativer til test: anbefalt, kaldere og varmere (±2 °C er [Forslag]). Like alternativer slås sammen.
    const forskyv = (d: number): Tur => ({ ...tur, tMin: tur.tMin + d, tMaks: tur.tMaks + d, tMinRå: tur.tMinRå + d, tMaksRå: tur.tMaksRå + d, seksjoner: tur.seksjoner.map((x) => ({ ...x, tEff: x.tEff + d, tLuft: x.tLuft + d })) });
    const nøkkel = (x: typeof stabel) => x.lag.map((l) => `${l.rolle}:${l.produkt}:${l.antall}`).join('|');
    const feste: { navn: string; stabel: typeof stabel; likt: boolean }[] = [];
    if (stil === 'klassisk') {
      for (const [navn, d] of [['Anbefalt', 0], ['Kaldere (−2 °C)', -2], ['Varmere (+2 °C)', 2]] as const) {
        const st = d === 0 ? stabel : byggSmøring('klassisk', forskyv(d), snø, seksjoner, false, SWIX);
        feste.push({ navn, stabel: st, likt: d !== 0 && nøkkel(st) === nøkkel(stabel) });
      }
    }
    const snitt = tur.seksjoner.reduce((a, x) => a + x.tEff, 0) / tur.seksjoner.length;
    const farger = tur.seksjoner.map((x) => tempFarge(x.tEff));
    const segmenter = seksjoner.map((x, i) => ({ pts: løype.punkter.filter((p) => p[3] >= x.startM && p[3] <= x.endM).map((p) => [p[0], p[1]] as [number, number]), farge: farger[i] }));
    const profil = løype.punkter.map((p) => ({ d: p[3], h: p[2], farge: farger[Math.max(0, seksjoner.findIndex((x) => p[3] <= x.endM))] }));
    const opp = løype.punkter.slice(1).reduce((a, p, i) => a + Math.max(0, p[2] - løype.punkter[i][2]), 0);
    return { segmenter, profil, opp, tur, snø, stabel, feste, snitt, struktur: anbefalStruktur(snitt, snø, tur.sludd, stil), glid: proGlidelag(tur, SWIX), harVarsel: dekket, startTs };
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
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Løypa</Text>
            <ThemedText type="small" themeColor="textSecondary">{`${(løype.lengde_m / 1000).toFixed(1)} km · ${Math.round(res.opp)} m opp · ${Math.round(Math.min(...løype.punkter.map((p) => p[2])))}–${Math.round(Math.max(...løype.punkter.map((p) => p[2])))} moh. Fargen viser beregnet snøtemperatur langs løypa.`}</ThemedText>
            <TrailMap segmenter={res.segmenter} />
            <Hoydeprofil punkter={res.profil} />
          </Kort>
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
          {stil === 'klassisk' ? (
            <Kort>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Feste, lag for lag (anbefalt)</Text>
              {res.stabel.lag.map((l, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{`${i + 1}. ${l.rolle}: ${l.produkt} · ${l.antall}`}</Text>
                  {l.merknad ? <ThemedText type="small" themeColor="textSecondary">{l.merknad}</ThemedText> : null}
                </View>
              ))}
              {res.stabel.advarsler.map((w, i) => <ThemedText key={i} type="small">⚠ {w}</ThemedText>)}
            </Kort>
          ) : null}
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Dine ski</Text>
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
          </Kort>
          <Kort>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Testplan: tre par ski</Text>
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
          </Kort>
          {stil === 'klassisk' ? (
            <Kort>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Etter testen: juster festet</Text>
              <ThemedText>{'• Slipper eller er bakglatt: legg på flere lag, eller gå til varmere voks.'}</ThemedText>
              <ThemedText>{'• Klabber, setter seg fast eller isner: færre lag, eller kaldere voks.'}</ThemedText>
              <ThemedText>{'• Klister: tykkere lag mot glatt, tynnere mot klabb. Husk å kjøle mellom lagene.'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Etter rennet kan du føre inn hva som funket i Smøreloggen, så kalibrerer vi rådene.</ThemedText>
            </Kort>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
