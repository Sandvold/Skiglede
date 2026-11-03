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
import trailsData from '@/data/trails.json';
import kandidaterData from '@/data/kandidater-turrutebasen.json';
import { useTheme } from '@/hooks/use-theme';

type LL = [number, number];
type Kandidat = { key: string; kilde: 'turrutebasen' | 'osm'; navn: string; lengde_m: number; biter: LL[][] };
type Valg = { navn: string; type: 'retur' | 'sloyfe' };

const I_APPEN = (trailsData as unknown as { navn: string; punkter: number[][] }[]).map((t) => ({ navn: t.navn, pts: t.punkter.map((p) => [p[0], p[1]] as LL) }));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const meter = (a: LL, b: LL) => Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180) * 111_320, (a[1] - b[1]) * 111_320);
const lengde = (biter: LL[][]) => biter.reduce((s, b) => s + b.slice(1).reduce((t, p, i) => t + meter(b[i], p), 0), 0);

const TURRUTEBASEN: Kandidat[] = (kandidaterData as unknown as { kandidater: { navn: string; lengde_m: number; biter: LL[][] }[] }).kandidater
  .filter((k) => k.navn !== 'Ukjent')
  .map((k) => ({ key: `t:${k.navn}`, kilde: 'turrutebasen', navn: k.navn, lengde_m: k.lengde_m, biter: k.biter }));

/** Leser utdata fra scripts/hent_osm_loyper.mjs, eller rå Overpass-JSON (overpass-turbo-eksport). Biter med samme navn slås sammen. */
export function lesOsm(json: any): Kandidat[] {
  const biter: { navn: string; id: string; pts: LL[] }[] = [];
  if (Array.isArray(json?.løyper)) {
    for (const l of json.løyper) biter.push({ navn: l.navn ?? '', id: l.osm, pts: l.punkter });
  } else if (Array.isArray(json?.elements)) {
    for (const el of json.elements) {
      const gs: any[][] = el.type === 'way' ? [el.geometry] : (el.members ?? []).filter((m: any) => m.geometry).map((m: any) => m.geometry);
      for (const g of gs) if (g && g.length > 1) biter.push({ navn: el.tags?.name ?? el.tags?.['piste:name'] ?? '', id: `${el.type}/${el.id}`, pts: g.map((p: any) => [p.lon, p.lat] as LL) });
    }
  }
  const grupper = new Map<string, Kandidat>();
  for (const b of biter) {
    if (!b.pts || b.pts.length < 2) continue;
    const key = b.navn ? `o:${b.navn}` : `o:${b.id}`;
    const g = grupper.get(key) ?? { key, kilde: 'osm' as const, navn: b.navn || `(uten navn) ${b.id}`, lengde_m: 0, biter: [] };
    g.biter.push(b.pts);
    grupper.set(key, g);
  }
  return [...grupper.values()].map((g) => ({ ...g, lengde_m: Math.round(lengde(g.biter)) }));
}

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/å/g, 'a').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/[^a-z0-9-]/g, '');

export default function Rutevelger() {
  const theme = useTheme();
  const [kilde, setKilde] = useState<'turrutebasen' | 'osm'>('turrutebasen');
  const [osm, setOsm] = useState<Kandidat[]>([]);
  const [feil, setFeil] = useState('');
  const [valgt, setValgt] = useState<Record<string, Valg>>({});
  const kandidater = kilde === 'osm' ? osm : TURRUTEBASEN;
  const liste = useMemo(() => [...kandidater].sort((a, b) => b.lengde_m - a.lengde_m), [kandidater]);
  const alle = useMemo(() => [...TURRUTEBASEN, ...osm], [osm]);

  const veksle = (k: Kandidat) =>
    setValgt((v) => {
      const ny = { ...v };
      if (ny[k.key]) delete ny[k.key];
      else ny[k.key] = { navn: k.navn.startsWith('(uten navn)') ? '' : k.navn, type: 'retur' };
      return ny;
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
        const k = lesOsm(JSON.parse(await f.text()));
        if (!k.length) throw new Error('Fant ingen løyper i filen');
        setOsm(k);
        setFeil('');
        setKilde('osm');
      } catch (e) {
        setFeil(`Kunne ikke lese filen: ${(e as Error).message}`);
      }
    };
    inn.click();
  };

  const valgteListe = alle.filter((k) => valgt[k.key]);
  const eksporter = () => {
    const ut = { laget: new Date().toISOString(), valgt: valgteListe.map((k) => ({ kilde: k.kilde, navn: valgt[k.key].navn.trim() || k.navn, id: slug(valgt[k.key].navn.trim() || k.navn), type: valgt[k.key].type, biter: k.biter })) };
    if (Platform.OS !== 'web') return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(ut)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'valgte-loyper.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const mangler = valgteListe.some((k) => !valgt[k.key].navn.trim() && k.navn.startsWith('(uten navn)'));

  const punkterTilKart = [[HOVDEN_VISNING.lon, HOVDEN_VISNING.lat]];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }} keyboardShouldPersistTaps="handled">
      <Hero />
      <View style={styles.innhold}>
        <Text style={[styles.h1, { color: theme.text }]}>Rutevelger</Text>
        <ThemedText themeColor="textSecondary">
          Verktøy for å velge løyper fra Turrutebasen (Kartverket) eller OpenStreetMap. Velg ruter i lista eller trykk på dem i kartet, last ned «valgte-loyper.json» og importer dem med skriptet under.
        </ThemedText>

        <View style={styles.rad}>
          <Chip aktiv={kilde === 'turrutebasen'} onPress={() => setKilde('turrutebasen')}>{`Turrutebasen (${TURRUTEBASEN.length})`}</Chip>
          <Chip aktiv={kilde === 'osm'} onPress={() => (osm.length ? setKilde('osm') : lastFil())}>{osm.length ? `OpenStreetMap (${osm.length})` : 'OpenStreetMap: last inn fil …'}</Chip>
          {osm.length > 0 && <Chip aktiv={false} onPress={lastFil}>Bytt OSM-fil</Chip>}
        </View>
        {!!feil && <ThemedText type="small" style={{ color: '#D6403A' }}>{feil}</ThemedText>}
        {kilde === 'osm' && osm.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">Kjør «node scripts/hent_osm_loyper.mjs» og velg filen scripts/ut/osm-loyper.json. En eksport fra overpass-turbo (JSON) fungerer også.</ThemedText>
        )}

        <ZoomKart punkter={punkterTilKart} hoyde={460} startZ={12} fast={HOVDEN_VISNING}>
          {({ z, left, top, w, h }) => {
            const pts = (b: LL[]) => b.map((p) => `${(mx(p[0], z) - left).toFixed(1)},${(my(p[1], z) - top).toFixed(1)}`).join(' ');
            return (
              <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
                {I_APPEN.map((t, i) => (
                  <Polyline key={`a${i}`} points={pts(t.pts)} fill="none" stroke="#2F7DE1" strokeOpacity={0.45} strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />
                ))}
                {liste.flatMap((k) =>
                  k.biter.map((b, i) => (
                    <Polyline key={`${k.key}${i}`} points={pts(b)} fill="none" stroke={valgt[k.key] ? '#D6403A' : '#E8892B'} strokeWidth={valgt[k.key] ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" />
                  )),
                )}
                {liste.flatMap((k) =>
                  k.biter.map((b, i) => (
                    <Polyline key={`t${k.key}${i}`} points={pts(b)} fill="none" stroke="rgba(0,0,0,0.001)" strokeWidth={20} strokeLinecap="round" onPress={() => veksle(k)} {...({ cursor: 'pointer' } as object)} />
                  )),
                )}
              </Svg>
            );
          }}
        </ZoomKart>
        <ThemedText type="small" themeColor="textSecondary">Stiplet blå = løyper som allerede ligger i appen. Oransje = kandidater fra valgt kilde. Rød = valgt.</ThemedText>

        <Kort style={{ gap: Spacing.two }}>
          <Text style={[styles.h2, { color: theme.text }]}>Kandidater</Text>
          <View style={styles.rad}>
            {liste.map((k) => {
              const iAppen = I_APPEN.some((t) => norm(t.navn) === norm(k.navn));
              return (
                <Chip key={k.key} aktiv={!!valgt[k.key]} onPress={() => veksle(k)}>
                  {`${valgt[k.key] ? '✓ ' : ''}${k.navn} · ${(k.lengde_m / 1000).toFixed(1)} km${iAppen ? ' · i appen' : ''}`}
                </Chip>
              );
            })}
          </View>
          {liste.length === 0 && <ThemedText type="small" themeColor="textSecondary">Ingen kandidater ennå.</ThemedText>}
        </Kort>

        {valgteListe.length > 0 && (
          <Kort style={{ gap: Spacing.three }}>
            <Text style={[styles.h2, { color: theme.text }]}>Valgte ({valgteListe.length})</Text>
            {valgteListe.map((k) => (
              <View key={k.key} style={{ gap: Spacing.two }}>
                <ThemedText type="smallBold">{k.kilde === 'osm' ? 'OSM' : 'Turrutebasen'}: {k.navn} · {(k.lengde_m / 1000).toFixed(1)} km</ThemedText>
                <TextInput
                  value={valgt[k.key].navn}
                  onChangeText={(t) => setValgt((v) => ({ ...v, [k.key]: { ...v[k.key], navn: t } }))}
                  placeholder="Navn i appen"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                />
                <View style={styles.rad}>
                  <Chip aktiv={valgt[k.key].type === 'retur'} onPress={() => setValgt((v) => ({ ...v, [k.key]: { ...v[k.key], type: 'retur' } }))}>Tur-retur</Chip>
                  <Chip aktiv={valgt[k.key].type === 'sloyfe'} onPress={() => setValgt((v) => ({ ...v, [k.key]: { ...v[k.key], type: 'sloyfe' } }))}>Sløyfe (lukket runde)</Chip>
                </View>
              </View>
            ))}
            <View style={styles.rad}>
              <Pressable onPress={eksporter} disabled={mangler} accessibilityRole="button" style={[styles.knapp, { backgroundColor: theme.accent, opacity: mangler ? 0.5 : 1 }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Last ned valgte-loyper.json</Text>
              </Pressable>
              {mangler && <ThemedText type="small" style={{ color: '#D6403A' }}>Gi løypene uten navn et navn først.</ThemedText>}
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
