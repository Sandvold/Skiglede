import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
import { tekstPå } from '@/components/ski/oversikt';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { NØKKEL_LAGER, TOM_LISTE, useLagret } from '@/data/lagring';
import { MERKE_IDER, SYSTEMER, type Produkt } from '@/engine';
import { useTheme } from '@/hooks/use-theme';

export default function Lager() {
  const theme = useTheme();
  const GRUPPER = MERKE_IDER.flatMap((id) => SYSTEMER[id].oversikt.map((g) => ({ tittel: `${SYSTEMER[id].navn}: ${g.tittel}`, liste: g.liste })));
  const [lager, setLager] = useLagret<string[]>(NØKKEL_LAGER, TOM_LISTE);
  const har = (n: string) => lager.includes(n);
  const bytt = (n: string) => setLager(har(n) ? lager.filter((x) => x !== n) : [...lager, n]);
  const gruppe = (liste: Produkt[], på: boolean) => setLager(på ? [...new Set([...lager, ...liste.map((p) => p.navn)])] : lager.filter((n) => !liste.some((p) => p.navn === n)));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <Text style={[styles.h1, { color: theme.text }]}>Smørelager</Text>
        <ThemedText themeColor="textSecondary">
          Kryss av det du har, fra alle merker. Når du huker av «Bruk min smøring» under smøretipsene, foreslår Skiglede bare det du eier, og bytter det som mangler mot nærmeste du har, på tvers av merker.
        </ThemedText>
        <View style={styles.rad}>
          <Chip aktiv={false} onPress={() => setLager([...new Set(GRUPPER.flatMap((g) => g.liste.map((p) => p.navn)))])}>Velg alle</Chip>
          <Chip aktiv={false} onPress={() => setLager([])}>Tøm alt</Chip>
          <ThemedText type="smallBold" themeColor="textSecondary">{lager.length} produkter totalt</ThemedText>
        </View>
        {GRUPPER.map((g) => (
          <Kort key={g.tittel}>
            <View style={styles.rad}>
              <Text style={[styles.h2, { color: theme.text, flex: 1 }]}>{g.tittel}</Text>
              <Chip aktiv={false} onPress={() => gruppe(g.liste, !g.liste.every((p) => har(p.navn)))}>{g.liste.every((p) => har(p.navn)) ? 'Fjern alle' : 'Velg alle'}</Chip>
            </View>
            {g.liste.map((p) => (
              <Pressable key={p.navn} onPress={() => bytt(p.navn)} style={styles.produkt} accessibilityRole="checkbox" accessibilityState={{ checked: har(p.navn) }}>
                <View style={[styles.boks, { borderColor: theme.border, backgroundColor: har(p.navn) ? theme.accent : 'transparent' }]}>
                  {har(p.navn) ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
                </View>
                <View style={[styles.farge, { backgroundColor: p.hex }]}>
                  <Text style={{ color: tekstPå(p.hex), fontWeight: '800', fontSize: 13 }}>{p.navn}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{p.farge}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{p.omr[0] === p.omr[1] ? p.merknad ?? '' : `${p.omr[0]} til ${p.omr[1]} °C`}</Text>
                </View>
              </Pressable>
            ))}
          </Kort>
        ))}
        <ThemedText type="small" themeColor="textSecondary">Toko, Rode og Ski Go: temperaturområdene er hentet fra nettsider og bør sjekkes mot etiketten. Lageret lagres på denne enheten. Innlogging og synk mellom enheter kommer senere.</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innhold: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, gap: Spacing.three, marginTop: Spacing.two },
  h1: { fontSize: 34, fontWeight: '800', marginTop: Spacing.two },
  h2: { fontSize: 22, fontWeight: '700' },
  rad: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  produkt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  boks: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  farge: { minWidth: 70, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center' },
});
