import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PremiumLås } from '@/components/ski/konto';
import { Hero } from '@/components/ski/hero';
import { Chip, Kort, Sammenleggbar } from '@/components/ski/ui';
import { tekstPå } from '@/components/ski/oversikt';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { StedVelger } from '@/components/ski/sted';
import { NØKKEL_LAGER, TOM_LISTE, flyttProdukt, useAlleLagre, useSteder, useStedData } from '@/data/lagring';
import { useState } from 'react';
import { MERKE_IDER, SYSTEMER, type MerkeId, type Produkt } from '@/engine';
import { useTheme } from '@/hooks/use-theme';

export default function Lager() {
  const theme = useTheme();
  const [visMerke, setVisMerke] = useState<MerkeId | 'alle'>('swix'); // Swix vises først; de andre merkene velges med chips
  const [bekreftTøm, setBekreftTøm] = useState(false); // «Tøm alt» krever bekreftelse
  const GRUPPER = MERKE_IDER.filter((id) => visMerke === 'alle' || id === visMerke).flatMap((id) => SYSTEMER[id].oversikt.map((g) => ({ tittel: visMerke === 'alle' ? `${SYSTEMER[id].navn}: ${g.tittel}` : g.tittel, liste: g.liste })));
  const [lager, setLager] = useStedData<string[]>(NØKKEL_LAGER, TOM_LISTE);
  const { steder, aktiv } = useSteder();
  const alle = useAlleLagre();
  const stårPå = (n: string) => steder.filter((s) => alle[s.id]?.includes(n));
  const har = (n: string) => lager.includes(n);
  const bytt = (n: string) => setLager(har(n) ? lager.filter((x) => x !== n) : [...lager, n]);
  const gruppe = (liste: Produkt[], på: boolean) => setLager(på ? [...new Set([...lager, ...liste.map((p) => p.navn)])] : lager.filter((n) => !liste.some((p) => p.navn === n)));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={styles.innhold}>
        <Text style={[styles.h1, { color: theme.text }]}>Smørelager</Text>
      <PremiumLås tittel="Smørelager">
        <Kort><StedVelger forklaring="Hvert sted har eget smørelager. Valgt sted brukes også på forsiden og i skiparken." /></Kort>
        <ThemedText themeColor="textSecondary">
          Kryss av det du har. «Bruk min smøring» på forsiden foreslår da bare det du eier, og bytter det som mangler mot nærmeste du har.
        </ThemedText>
        <View style={styles.rad}>
          {([...MERKE_IDER, 'alle'] as const).map((id) => (
            <Chip key={id} aktiv={visMerke === id} onPress={() => setVisMerke(id)}>{id === 'alle' ? 'Alle merker' : SYSTEMER[id].navn}</Chip>
          ))}
        </View>
        <View style={styles.rad}>
          <Chip aktiv={false} onPress={() => setLager([...new Set([...lager, ...GRUPPER.flatMap((g) => g.liste.map((p) => p.navn))])])}>{visMerke === 'alle' ? 'Velg alle' : `Velg alle ${SYSTEMER[visMerke].navn}`}</Chip>
          {bekreftTøm ? (<>
            <Chip aktiv onPress={() => { setLager([]); setBekreftTøm(false); }}>{`Ja, tøm ${lager.length} produkter`}</Chip>
            <Chip aktiv={false} onPress={() => setBekreftTøm(false)}>Avbryt</Chip>
          </>) : (
            <Chip aktiv={false} onPress={() => (lager.length ? setBekreftTøm(true) : null)}>Tøm alt</Chip>
          )}
          <ThemedText type="smallBold" themeColor="textSecondary">{lager.length} produkter totalt</ThemedText>
        </View>
        {GRUPPER.map((g) => (
          <Sammenleggbar key={g.tittel} id={`lager-${g.tittel.toLowerCase().replace(/[^a-zæøå0-9]+/g, '-')}`} tittel={g.tittel} topp={<Chip aktiv={false} onPress={() => gruppe(g.liste, !g.liste.every((p) => har(p.navn)))}>{g.liste.every((p) => har(p.navn)) ? 'Fjern alle' : 'Velg alle'}</Chip>}>
            {g.liste.map((p) => (
              <View key={p.navn} style={{ gap: 6 }}>
              <Pressable onPress={() => bytt(p.navn)} style={styles.produkt} accessibilityRole="checkbox" accessibilityState={{ checked: har(p.navn) }}>
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
              {steder.length > 1 && stårPå(p.navn).length > 0 ? (
                <View style={[styles.rad, { paddingLeft: 38 }]}>
                  <ThemedText type="small" themeColor="textSecondary">{`Står: ${stårPå(p.navn).map((s) => s.navn).join(', ')}`}</ThemedText>
                  {har(p.navn) ? steder.filter((s) => s.id !== aktiv).map((s) => (
                    <Chip key={s.id || 'standard'} aktiv={false} onPress={() => flyttProdukt(p.navn, aktiv, s.id)}>{`Flytt til ${s.navn}`}</Chip>
                  )) : null}
                </View>
              ) : null}
              </View>
            ))}
          </Sammenleggbar>
        ))}
        <ThemedText type="small" themeColor="textSecondary">Toko, Rode og Ski Go: temperaturområdene er hentet fra nettsider og bør sjekkes mot etiketten. Lageret synkes til kontoen din som premium-bruker.</ThemedText>
      </PremiumLås>
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
