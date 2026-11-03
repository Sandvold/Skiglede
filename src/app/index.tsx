import { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import løype from '@/data/nedre-badstogdalen.json';

const TEMPO = { Trening: 9, Tur: 5 } as const;
type Modus = keyof typeof TEMPO;

export default function HomeScreen() {
  const theme = useTheme();
  const [modus, setModus] = useState<Modus>('Tur');

  const pts = løype.punkter as [number, number][];
  const total = pts[pts.length - 1][0];
  const hs = pts.map((p) => p[1]);
  const lav = Math.min(...hs);
  const høy = Math.max(...hs);
  const opp = pts.slice(1).reduce((s, p, i) => s + Math.max(0, p[1] - pts[i][1]), 0);
  const minutter = Math.round((total / 1000 / TEMPO[modus]) * 60);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Skiglede</ThemedText>
        <ThemedText themeColor="textSecondary">
          Smøring for løypa du skal gå, ikke bare stedet du står. Hovden, kun Swix.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{løype.navn}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {(total / 1000).toFixed(1)} km · {Math.round(lav)}–{Math.round(høy)} moh · {Math.round(opp)} m stigning
          </ThemedText>

          <View style={styles.chart}>
            {pts.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: 8 + ((p[1] - lav) / (høy - lav)) * 112, backgroundColor: theme.text },
                ]}
              />
            ))}
          </View>
          <View style={styles.axis}>
            <ThemedText type="small" themeColor="textSecondary">0 km</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{(total / 1000).toFixed(1)} km</ThemedText>
          </View>
        </ThemedView>

        <View style={styles.row}>
          {(Object.keys(TEMPO) as Modus[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setModus(m)}
              style={[
                styles.knapp,
                { backgroundColor: modus === m ? theme.text : theme.backgroundElement },
              ]}>
              <ThemedText style={{ color: modus === m ? theme.background : theme.text }}>
                {m} · {TEMPO[m]} km/t
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <ThemedText themeColor="textSecondary">
          Estimert tid: ca. {Math.floor(minutter / 60)} t {minutter % 60} min
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Smøring</ThemedText>
          <ThemedText themeColor="textSecondary">
            Kommer. Regelmotoren bygger en komplett stabel fra bindervoks til topplag ut fra 14 dagers
            vær, prognose og høydeprofil, når reglene er avklart.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
  container: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 128, gap: 1, marginTop: Spacing.two },
  bar: { flex: 1, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: Spacing.two },
  knapp: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.five },
});
