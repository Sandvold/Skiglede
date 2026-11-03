import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TrailMap } from '@/components/ski/kart';
import { Hoydeprofil } from '@/components/ski/profil';
import { MaxContentWidth, Spacing, tempFarge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import trailsData from '@/data/trails.json';
import vaerData from '@/data/vaer-hovden.json';
import { HARDVOKS, KLISTER, analyserSnø, byggStabel, lagSeksjoner, planTur, type Punkt, type Vær } from '@/engine';

type Løype = { id: string; navn: string; lengde_m: number; punkter: Punkt[] };
const LØYPER = trailsData as unknown as Løype[];

const TIMER: Vær[] = (vaerData.timer as (string | number)[][]).map((r) => ({
  ts: Date.parse(r[0] as string), temp: r[1] as number, nedbor: r[2] as number, rh: r[3] as number, vind: r[4] as number, sw: r[5] as number,
}));
// Turdag: observert 2. nov. Står i for prognosen til Yr er koblet på.
const DAG_START = Date.parse('2026-11-02T00:00:00Z');
const DAG_TIMER = TIMER.filter((t) => t.ts >= DAG_START);

const TEMPO = { Trening: 9, Tur: 5 } as const;
type Modus = keyof typeof TEMPO;
const STARTTIDER = [9, 10, 11, 12, 13]; // lokal tid (UTC+1 i november)

const tid = (ts: number) => new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).format(ts);

function produktFarge(navn: string, snø: 'ny' | 'omdannet') {
  const v = HARDVOKS.find((x) => x.navn === navn);
  if (v) return tempFarge((v[snø][0] + v[snø][1]) / 2);
  const k = KLISTER.find((x) => x.navn === navn);
  if (k) return tempFarge((k.omr[0] + k.omr[1]) / 2);
  return navn === 'KB20C' ? '#9FBFAE' : '#B9C7D6';
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

export default function Hjem() {
  const theme = useTheme();
  const [løypeId, setLøypeId] = useState(LØYPER.find((l) => l.navn === 'Nedre Badstogdalen')!.id);
  const [modus, setModus] = useState<Modus>('Tur');
  const [startTime, setStartTime] = useState(10);
  const [debug, setDebug] = useState(false);

  const løype = LØYPER.find((l) => l.id === løypeId)!;
  const r = useMemo(() => {
    const seksjoner = lagSeksjoner(løype.punkter);
    const startTs = Date.parse(`2026-11-02T${String(startTime - 1).padStart(2, '0')}:00:00Z`);
    const snø = analyserSnø(TIMER, startTs);
    const tur = planTur({ seksjoner, timer: DAG_TIMER, startTs, tempoKmt: TEMPO[modus], refH: vaerData.referansehoyde_m });
    const stabel = byggStabel(tur, snø, seksjoner);
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
  }, [løype, modus, startTime]);

  const km = løype.lengde_m / 1000;
  const minutter = Math.round((km / TEMPO[modus]) * 60);
  const stabelVisning = [...r.stabel.lag].reverse(); // øverste lag først

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      {/* Hero med snødriver */}
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

      <View style={styles.innhold}>
        {/* Løypevelger */}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.etikett}>LØYPE</ThemedText>
        <View style={styles.rad}>
          {LØYPER.map((l) => (
            <Chip key={l.id} aktiv={l.id === løypeId} onPress={() => setLøypeId(l.id)}>{l.navn}</Chip>
          ))}
        </View>

        {/* Kart og profil */}
        <Kort>
          <Text style={[styles.h2, { color: theme.text }]}>{løype.navn}</Text>
          <View style={styles.rad}>
            <Tall verdi={`${km.toFixed(1)} km`} tekst="lengde" />
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
          {(Object.keys(TEMPO) as Modus[]).map((m) => (
            <Chip key={m} aktiv={m === modus} onPress={() => setModus(m)}>{`${m} · ${TEMPO[m]} km/t`}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          {STARTTIDER.map((h) => (
            <Chip key={h} aktiv={h === startTime} onPress={() => setStartTime(h)}>{`Start ${String(h).padStart(2, '0')}:00`}</Chip>
          ))}
        </View>
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
              <View key={i} style={[styles.lag, { backgroundColor: produktFarge(l.produkt, r.snø.type) }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lagProdukt}>{l.produkt}</Text>
                  <Text style={styles.lagRolle}>{l.rolle}{l.merknad ? ` · ${l.merknad}` : ''}</Text>
                </View>
                <Text style={styles.lagAntall}>{l.antall}</Text>
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
