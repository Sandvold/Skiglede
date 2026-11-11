import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { Hero } from '@/components/ski/hero';
import { mx, my } from '@/components/ski/kart';
import { HOVDEN_VISNING } from '@/components/ski/oversiktskart';
import { Chip, Kort } from '@/components/ski/ui';
import { ZoomKart } from '@/components/ski/zoomkart';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import kandidaterData from '@/data/kandidater-turrutebasen.json';
import { berik, etterNavn, lesOsmBiter, lengdeM, vanligsteNavn, type Bit, type LL, type NavnRef } from '@/data/osm';
import trailsData from '@/data/trails.json';
import { useTheme } from '@/hooks/use-theme';

type Rute = { id: string; navn: string; type: 'retur' | 'sloyfe'; kilde: 'osm' | 'turrutebasen'; biter: LL[][] };

const APP: NavnRef[] = (trailsData as unknown as { navn: string; punkter: number[][] }[]).map((t) => ({ navn: t.navn, biter: [t.punkter.map((p) => [p[0], p[1]] as LL)] }));
const TUR_RAA = (kandidaterData as unknown as { kandidater: { navn: string; biter: LL[][] }[] }).kandidater;
const TUR: NavnRef[] = TUR_RAA.map((k) => ({ navn: k.navn, biter: k.biter }));
// Turrutebasen som biter (hver bit får sitt navn), dekning mot appen beregnes som for OSM
const TUR_BITER: Bit[] = berik(
  TUR_RAA.filter((k) => k.navn !== 'Ukjent').flatMap((k) => k.biter.map((pts, i) => ({ id: `t/${k.navn}/${i}`, osmNavn: k.navn, preparering: null, pts }))),
  [],
  APP,
).map((b) => ({ ...b, navnKilde: 'turrutebasen' as const }));

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/å/g, 'a').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/[^a-z0-9-]/g, '');
const km = (m: number) => (m / 1000).toFixed(1).replace('.', ',');
const NY_GRENSE = 0.5; // under så stor dekning regnes en bit som ny
const I_APPEN = 0.8; // over så stor dekning regnes den som allerede i appen

export default function Rutevelger() {
  const theme = useTheme();
  const [kilde, setKilde] = useState<'osm' | 'turrutebasen'>('osm');
  const [osmBiter, setOsmBiter] = useState<Bit[]>([]);
  const [feil, setFeil] = useState('');
  const [krysset, setKrysset] = useState<string[]>([]);
  const [ruter, setRuter] = useState<Rute[]>([]);
  const [nyttNavn, setNyttNavn] = useState('');
  const [nyType, setNyType] = useState<'retur' | 'sloyfe'>('retur');
  const [visUtenNavn, setVisUtenNavn] = useState(false);

  const biter = kilde === 'osm' ? osmBiter : TUR_BITER;
  const iRute = useMemo(() => new Set(ruter.flatMap((r) => (r as Rute & { ids?: string[] }).ids ?? [])), [ruter]);
  const grupper = useMemo(() => [...etterNavn(biter)].map(([navn, l]) => ({ navn, biter: l, m: l.reduce((s, b) => s + b.lengde_m, 0), dekning: l.reduce((s, b) => s + b.dekning * b.lengde_m, 0) / Math.max(1, l.reduce((s, b) => s + b.lengde_m, 0)) })).sort((a, b) => b.m - a.m), [biter]);
  const utenNavn = useMemo(() => biter.filter((b) => !b.navn).sort((a, b) => b.lengde_m - a.lengde_m), [biter]);
  const valgteBiter = biter.filter((b) => krysset.includes(b.id));

  const toggle = (ids: string[]) =>
    setKrysset((k) => {
      const alleMed = ids.every((i) => k.includes(i));
      return alleMed ? k.filter((i) => !ids.includes(i)) : [...new Set([...k, ...ids])];
    });

  const lastFil = () => {
    if (Platform.OS !== 'web') return;
    const inn = document.createElement('input');
    inn.type = 'file';
    inn.accept = '.json,application/json';
    inn.onchange = async () => {
      const f = inn.files?.[0];
      if (!f) return;
      try {
        const rå = lesOsmBiter(JSON.parse(await f.text()));
        if (!rå.length) throw new Error('Fant ingen preparerte løyper i filen');
        setOsmBiter(berik(rå, TUR, APP));
        setFeil('');
        setKilde('osm');
        setKrysset([]);
      } catch (e) {
        setFeil(`Kunne ikke lese filen: ${(e as Error).message}`);
      }
    };
    inn.click();
  };

  const lagRute = (navn: string, bs: Bit[], type: 'retur' | 'sloyfe') => {
    const ids = bs.map((b) => b.id);
    setRuter((r) => [...r.filter((x) => x.navn !== navn), { id: slug(navn), navn, type, kilde, biter: bs.map((b) => b.pts), ids } as Rute]);
    setKrysset((k) => k.filter((i) => !ids.includes(i)));
  };
  const slåSammen = () => {
    const navn = nyttNavn.trim() || vanligsteNavn(valgteBiter);
    if (!navn || !valgteBiter.length) return;
    lagRute(navn, valgteBiter, nyType);
    setNyttNavn('');
  };
  const enPerNavn = (kunNye: boolean) => {
    for (const g of grupper) {
      if (kunNye && g.dekning >= I_APPEN) continue;
      if (ruter.some((r) => r.navn === g.navn)) continue;
      lagRute(g.navn, g.biter.filter((b) => !kunNye || b.dekning < NY_GRENSE), 'retur');
    }
  };

  const eksporter = () => {
    if (Platform.OS !== 'web') return;
    const ut = { laget: new Date().toISOString(), valgt: ruter.map((r) => ({ kilde: r.kilde, navn: r.navn, id: slug(r.navn), type: r.type, biter: r.biter })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(ut)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'valgte-loyper.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }} keyboardShouldPersistTaps="handled">
      <Hero />
      <View style={styles.innhold}>
        <Text style={[styles.h1, { color: theme.text }]}>Rutevelger</Text>
        <ThemedText themeColor="textSecondary">
          OpenStreetMap er grunndata for løypene (geometri), og navnene hentes fra Turrutebasen. Velg biter, slå dem sammen til løyper, last ned filen og importer den.
        </ThemedText>

        <View style={styles.rad}>
          <Chip aktiv={kilde === 'osm'} onPress={() => (osmBiter.length ? setKilde('osm') : lastFil())}>{osmBiter.length ? `OpenStreetMap (${osmBiter.length} biter)` : 'OpenStreetMap: last inn fil …'}</Chip>
          <Chip aktiv={kilde === 'turrutebasen'} onPress={() => setKilde('turrutebasen')}>{`Turrutebasen (${TUR_BITER.length} biter)`}</Chip>
          {osmBiter.length > 0 && <Chip aktiv={false} onPress={lastFil}>Bytt OSM-fil</Chip>}
        </View>
        {!!feil && <ThemedText type="small" style={{ color: '#D6403A' }}>{feil}</ThemedText>}
        {kilde === 'osm' && osmBiter.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">Kjør «node scripts\hent_osm_loyper.mjs» og velg filen scripts\ut\osm-loyper.json. En eksport fra overpass-turbo (JSON) fungerer også. Backcountry (ikke preparert) tas ut automatisk.</ThemedText>
        )}

        <ZoomKart punkter={[[HOVDEN_VISNING.lon, HOVDEN_VISNING.lat]]} hoyde={480} startZ={12} fast={HOVDEN_VISNING}>
          {({ z, left, top, w, h }) => {
            const pts = (b: LL[]) => b.map((p) => `${(mx(p[0], z) - left).toFixed(1)},${(my(p[1], z) - top).toFixed(1)}`).join(' ');
            const farge = (b: Bit) => (iRute.has(b.id) ? '#2E9B5B' : krysset.includes(b.id) ? '#D6403A' : b.dekning >= I_APPEN ? '#9AA7B5' : b.dekning >= NY_GRENSE ? '#C9A06A' : '#E8892B');
            return (
              <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
                {biter.map((b) => (
                  <Polyline key={b.id} points={pts(b.pts)} fill="none" stroke={farge(b)} strokeWidth={krysset.includes(b.id) || iRute.has(b.id) ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {biter.map((b) => (
                  <Polyline key={`t${b.id}`} points={pts(b.pts)} fill="none" stroke="rgba(0,0,0,0.001)" strokeWidth={18} strokeLinecap="round" onPress={() => toggle([b.id])} {...({ cursor: 'pointer' } as object)} />
                ))}
              </Svg>
            );
          }}
        </ZoomKart>
        <ThemedText type="small" themeColor="textSecondary">Oransje = ny bit. Beige = delvis i appen. Grå = allerede i appen (≥ 80 %). Rød = krysset av. Grønn = i en løype nedenfor. Trykk på en bit i kartet for å krysse av.</ThemedText>

        <Kort style={{ gap: Spacing.two }}>
          <Text style={[styles.h2, { color: theme.text }]}>Løyper etter navn</Text>
          <ThemedText type="small" themeColor="textSecondary">Navn fra Turrutebasen der biten ligger langs en navngitt løype, ellers OSM-navnet. Trykk for å krysse av alle bitene.</ThemedText>
          <View style={styles.rad}>
            <Chip aktiv={false} onPress={() => enPerNavn(true)}>Lag én løype per nytt navn</Chip>
            <Chip aktiv={false} onPress={() => enPerNavn(false)}>Lag én løype per navn (alle)</Chip>
            <Chip aktiv={false} onPress={() => setKrysset([])}>Fjern kryss</Chip>
          </View>
          <View style={styles.rad}>
            {grupper.map((g) => (
              <Chip key={g.navn} aktiv={g.biter.every((b) => krysset.includes(b.id))} onPress={() => toggle(g.biter.map((b) => b.id))}>
                {`${g.navn} · ${g.biter.length} biter · ${km(g.m)} km${g.dekning >= I_APPEN ? ' · i appen' : g.dekning >= NY_GRENSE ? ` · ${Math.round(g.dekning * 100)} % i appen` : ' · NY'}`}
              </Chip>
            ))}
          </View>
          {utenNavn.length > 0 && (
            <>
              <Chip aktiv={visUtenNavn} onPress={() => setVisUtenNavn(!visUtenNavn)}>{`Uten navn: ${utenNavn.length} biter · ${km(utenNavn.reduce((s, b) => s + b.lengde_m, 0))} km`}</Chip>
              {visUtenNavn && (
                <View style={styles.rad}>
                  {utenNavn.map((b) => (
                    <Chip key={b.id} aktiv={krysset.includes(b.id)} onPress={() => toggle([b.id])}>{`${b.id.replace('way/', '')} · ${Math.round(b.lengde_m)} m${b.dekning >= I_APPEN ? ' · i appen' : ''}`}</Chip>
                  ))}
                </View>
              )}
            </>
          )}
        </Kort>

        {valgteBiter.length > 0 && (
          <Kort style={{ gap: Spacing.two }}>
            <Text style={[styles.h2, { color: theme.text }]}>Slå sammen {valgteBiter.length} biter ({km(valgteBiter.reduce((s, b) => s + b.lengde_m, 0))} km) til én løype</Text>
            <TextInput value={nyttNavn} onChangeText={setNyttNavn} placeholder={vanligsteNavn(valgteBiter) || 'Navn på løypa'} placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
            <View style={styles.rad}>
              <Chip aktiv={nyType === 'retur'} onPress={() => setNyType('retur')}>Tur-retur</Chip>
              <Chip aktiv={nyType === 'sloyfe'} onPress={() => setNyType('sloyfe')}>Sløyfe (lukket runde)</Chip>
              <Pressable onPress={slåSammen} accessibilityRole="button" style={[styles.knapp, { backgroundColor: theme.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Slå sammen til løype</Text>
              </Pressable>
            </View>
          </Kort>
        )}

        {ruter.length > 0 && (
          <Kort style={{ gap: Spacing.three }}>
            <Text style={[styles.h2, { color: theme.text }]}>Løyper som skal importeres ({ruter.length})</Text>
            {ruter.map((r) => (
              <View key={r.id} style={{ gap: Spacing.two }}>
                <ThemedText type="smallBold">{r.kilde === 'osm' ? 'OSM' : 'Turrutebasen'} · {r.biter.length} biter · {km(r.biter.reduce((s, b) => s + lengdeM(b), 0))} km</ThemedText>
                <TextInput
                  value={r.navn}
                  onChangeText={(t) => setRuter((l) => l.map((x) => (x === r ? { ...x, navn: t, id: slug(t) } : x)))}
                  placeholder="Navn i appen"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                />
                <View style={styles.rad}>
                  <Chip aktiv={r.type === 'retur'} onPress={() => setRuter((l) => l.map((x) => (x === r ? { ...x, type: 'retur' } : x)))}>Tur-retur</Chip>
                  <Chip aktiv={r.type === 'sloyfe'} onPress={() => setRuter((l) => l.map((x) => (x === r ? { ...x, type: 'sloyfe' } : x)))}>Sløyfe</Chip>
                  <Chip aktiv={false} onPress={() => setRuter((l) => l.filter((x) => x !== r))}>Fjern</Chip>
                </View>
              </View>
            ))}
            <View style={styles.rad}>
              <Pressable onPress={eksporter} disabled={ruter.some((r) => !r.navn.trim())} accessibilityRole="button" style={[styles.knapp, { backgroundColor: theme.accent, opacity: ruter.some((r) => !r.navn.trim()) ? 0.5 : 1 }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Last ned valgte-loyper.json</Text>
              </Pressable>
            </View>
          </Kort>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innhold: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, gap: Spacing.three },
  h1: { fontSize: 30, fontWeight: '800' },
  h2: { fontSize: 20, fontWeight: '700' },
  rad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  knapp: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
});
