import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrailMap } from '@/components/ski/kart';
import { Hoydeprofil } from '@/components/ski/profil';
import { Temperaturoversikt, tekstPå } from '@/components/ski/oversikt';
import { Loypevelger } from '@/components/ski/loypevelger';
import { Oversiktskart } from '@/components/ski/oversiktskart';
import { MaxContentWidth, Spacing, tempFarge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import trailsData from '@/data/trails.json';
import vaerData from '@/data/vaer-hovden.json';
import { hentVarsel, type Varsel } from '@/data/varsel';
import { analyserSnø, produkt, byggStabel, lagSeksjoner, planTur, type Punkt, type Terreng, type Vær } from '@/engine';

type Løype = { id: string; navn: string; type?: 'retur' | 'sloyfe'; lengde_m: number; punkter: Punkt[]; terreng?: Terreng[] };
const LØYPER = trailsData as unknown as Løype[];

const TIMER: Vær[] = (vaerData.timer as (string | number)[][]).map((r) => ({
  ts: Date.parse(r[0] as string), temp: r[1] as number, nedbor: r[2] as number, rh: r[3] as number, vind: r[4] as number, sw: r[5] as number,
}));
// Reserve hvis Yr-varselet ikke kommer: observert 2. nov.
const RESERVE_DATO = '2026-11-02';

/** Dato (ÅÅÅÅ-MM-DD) i Oslo, `dager` frem i tid. */
const osloDato = (dager: number) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(Date.now() + dager * 86400_000);
/** UTC-tidspunkt for lokal Oslo-klokketime på en dato (håndterer sommer-/vintertid). */
function osloTs(dato: string, time: number) {
  for (const off of [1, 2]) {
    const ts = Date.parse(`${dato}T${String(time).padStart(2, '0')}:00:00Z`) - off * 3600_000;
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', hourCycle: 'h23' }).format(ts));
    if (h === time) return ts;
  }
  return Date.parse(`${dato}T${String(time).padStart(2, '0')}:00:00Z`) - 3600_000;
}
const dagNavn = (dato: string, i: number) =>
  i === 0 ? 'I dag' : i === 1 ? 'I morgen' : new Intl.DateTimeFormat('nb-NO', { weekday: 'long', timeZone: 'UTC' }).format(Date.parse(dato + 'T12:00:00Z'));
const DAGER = [0, 1, 2];

const TEMPO = { Trening: 9, Tur: 5 } as const;
type Modus = keyof typeof TEMPO;
const STARTTIDER = [9, 10, 11, 12, 13]; // lokal tid (UTC+1 i november)

const tid = (ts: number) => new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).format(ts);

function produktFarge(navn: string) {
  return produkt(navn)?.hex ?? '#B9C7D6';
}

function Chip({ aktiv, onPress, children }: { aktiv: boolean; onPress: () => void; children: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: aktiv ? theme.accent : theme.backgroundElement, borderColor: aktiv ? theme.accent : theme.border }]}>
      <Text style={{ color: aktiv ? '#fff' : theme.text, fontWeight: '600', fontSize: 15 }}>{children}</Text>
    </Pressable>
  );
}

function Kort({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return <View style={[styles.kort, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</View>;
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

function Detalj({ løype, onVelg, onTilbake }: { løype: Løype; onVelg: (id: string) => void; onTilbake: () => void }) {
  const theme = useTheme();
  const [modus, setModus] = useState<Modus>('Tur');
  const [startTime, setStartTime] = useState(10);
  const [debug, setDebug] = useState(false);
  const [dagIdx, setDagIdx] = useState(0);
  const [varsel, setVarsel] = useState<Varsel | null>(null);
  const [varselFeil, setVarselFeil] = useState(false);
  useEffect(() => {
    hentVarsel().then(setVarsel).catch(() => setVarselFeil(true));
  }, []);

  const r = useMemo(() => {
    const seksjoner = lagSeksjoner(løype.punkter);
    const dato = varsel ? osloDato(dagIdx) : RESERVE_DATO;
    const startTs = osloTs(dato, startTime);
    // Observert historikk, så Yr-varselet fra der historikken slutter.
    const sisteHist = TIMER[TIMER.length - 1].ts;
    const alle = varsel ? [...TIMER, ...varsel.timer.filter((t) => t.ts > sisteHist)] : TIMER;
    const snø = analyserSnø(alle, startTs);
    const tur = planTur({ seksjoner, timer: alle.filter((t) => t.ts >= startTs - 3 * 3600_000), startTs, tempoKmt: TEMPO[modus], refH: vaerData.referansehoyde_m, terreng: løype.terreng });
    const stabel = byggStabel(tur, snø, seksjoner, modus === 'Trening');
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
    return { seksjoner, snø, tur, stabel, segmenter, profil, lav: Math.min(...hs), høy: Math.max(...hs), opp };
  }, [løype, modus, startTime, dagIdx, varsel]);

  const km = løype.lengde_m / 1000;
  const minutter = Math.round((km / TEMPO[modus]) * 60);
  const stabelVisning = [...r.stabel.lag].reverse(); // øverste lag først

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />

      <View style={styles.innhold}>
        {/* Tilbake og bytte av løype */}
        <Pressable onPress={onTilbake} style={[styles.chip, { alignSelf: 'flex-start', backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Alle løyper</Text>
        </Pressable>
        <Loypevelger løyper={LØYPER} valgt={løype.id} onVelg={onVelg} />

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
            <Chip key={i} aktiv={varsel ? i === dagIdx : false} onPress={() => varsel && setDagIdx(i)}>{dagNavn(osloDato(i), i)}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          {(Object.keys(TEMPO) as Modus[]).map((m) => (
            <Chip key={m} aktiv={m === modus} onPress={() => setModus(m)}>{`${m} · ${TEMPO[m]} km/t`}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          {STARTTIDER.map((h) => (
            <Chip key={h} aktiv={h === startTime} onPress={() => setStartTime(h)}>{`Start ${String(h).padStart(2, '0')}:00`}</Chip>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {r.tur.seksjoner.filter((x) => x.skygge).length} av {r.tur.seksjoner.length} deler av løypa ligger i terrengskygge når du går dem.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {varsel
            ? `Prognose: MET Norway / Yr (oppdatert ${tid(Date.parse(varsel.oppdatert))}) · solinnstråling anslått fra skydekke`
            : varselFeil
              ? 'Fikk ikke hentet Yr-prognosen. Viser observert vær 2. november.'
              : 'Henter prognose fra Yr …'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Ca. {Math.floor(minutter / 60)} t {minutter % 60} min · {tid(r.tur.startTs)}–{tid(r.tur.sluttTs)}
        </ThemedText>

        {/* Smøring */}
        <Kort style={{ gap: Spacing.three }}>
          <View style={styles.rad}>
            <Text style={[styles.h2, { color: theme.text, flex: 1 }]}>Smøring</Text>
            <View style={[styles.merke, { backgroundColor: theme.accentSoft }]}>
              <Text style={{ color: theme.accent, fontWeight: '700' }}>{r.stabel.type === 'klister' ? 'Klister' : 'Hardvoks'}</Text>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary">Øverst = siste lag. Bygg nedenfra og opp.</ThemedText>
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
          {r.stabel.advarsler.map((a, i) => (
            <View key={i} style={[styles.advarsel, { borderColor: '#E3A64A' }]}>
              <ThemedText type="small">⚠ {a}</ThemedText>
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Utkast: Swix-tabellene og tersklene er foreløpige og må verifiseres. Været er observert 2. nov som stand-in for prognose.
          </ThemedText>
        </Kort>

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
          <ThemedText type="small" themeColor="textSecondary">Hva hvert produkt fungerer på, med Swix’ fargekoder.</ThemedText>
          <Temperaturoversikt tMin={r.tur.tMin} tMaks={r.tur.tMaks} brukt={r.stabel.lag.map((l) => l.produkt)} />
        </Kort>

        {/* Feilsøking */}
        <Pressable onPress={() => setDebug(!debug)} style={[styles.chip, { alignSelf: 'flex-start', backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>{debug ? 'Skjul feilsøking' : 'Vis feilsøking'}</Text>
        </Pressable>
        {debug && (
          <Kort style={{ gap: Spacing.two }}>
            <Text style={[styles.h3, { color: theme.text }]}>Hvorfor denne stabelen</Text>
            {[...r.snø.forklaring, ...r.stabel.begrunnelse].map((t, i) => (
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

function Hero() {
  const theme = useTheme();
  return (
      <View style={[styles.hero, { backgroundColor: theme.hero }]}>
        {['❄', '❅', '❆', '❄', '❅', '❆', '❄'].map((f, i) => (
          <Text key={i} style={[styles.flak, { left: `${8 + i * 14}%`, top: 14 + ((i * 37) % 70), fontSize: 14 + ((i * 5) % 14) }]}>{f}</Text>
        ))}
        <View style={styles.heroInnhold}>
          <Text style={styles.heroTittel}>Skiglede</Text>
          <Text style={styles.heroUnder}>Smøring for løypa du skal gå. Hovden · Swix</Text>
        </View>
        <View style={[styles.drift, { left: -80, width: 420, height: 160, backgroundColor: theme.background, bottom: -100 }]} />
        <View style={[styles.drift, { right: -120, width: 560, height: 190, backgroundColor: theme.background, bottom: -120 }]} />
      </View>
  );
}

function Oversikt({ onVelg }: { onVelg: (id: string) => void }) {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>LØYPER PÅ HOVDEN</ThemedText>
        <ThemedText themeColor="textSecondary">Trykk på en løype i kartet, eller velg fra lista.</ThemedText>
        <Oversiktskart løyper={LØYPER} onVelg={onVelg} />
        <Loypevelger løyper={LØYPER} valgt={null} onVelg={onVelg} />
        <ThemedText type="small" themeColor="textSecondary">Løypedata: Turrutebasen og Kartverket (CC BY 4.0).</ThemedText>
      </View>
    </ScrollView>
  );
}

export default function Hjem() {
  const [valgt, setValgt] = useState<string | null>(null);
  const løype = LØYPER.find((l) => l.id === valgt);
  if (!løype) return <Oversikt onVelg={setValgt} />;
  return <Detalj key={løype.id} løype={løype} onVelg={setValgt} onTilbake={() => setValgt(null)} />;
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
