import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
import { tekstPå } from '@/components/ski/oversikt';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { StedVelger } from '@/components/ski/sted';
import { NØKKEL_SKIPARK, TOM_LISTE, useStedData, type Ski } from '@/data/lagring';
import { produkt, type Stil } from '@/engine';
import { useTheme } from '@/hooks/use-theme';

const STIL_NAVN: Record<Stil, string> = { klassisk: 'Klassisk (voks/klister)', felle: 'Felleski', rubb: 'Rubbski', skoyting: 'Skøyting' };
const dato = (ts: number) => new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'Europe/Oslo' }).format(ts);

export default function Skipark() {
  const theme = useTheme();
  const [ski, setSki] = useStedData<Ski[]>(NØKKEL_SKIPARK, TOM_LISTE);
  const [navn, setNavn] = useState('');
  const [stil, setStil] = useState<Stil>('klassisk');
  const [nå] = useState(() => Date.now());

  const legg = () => {
    const n = navn.trim();
    if (!n) return;
    setSki([...ski, { id: `${nå}-${ski.length}-${Math.round(Math.random() * 1e6)}`, navn: n, stil }]);
    setNavn('');
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }} keyboardShouldPersistTaps="handled">
      <Hero />
      <View style={styles.innhold}>
        <Text style={[styles.h1, { color: theme.text }]}>Skipark</Text>
        <ThemedText themeColor="textSecondary">
          Legg inn skiene dine. Når du velger et par på en tur og lagrer smøringen, husker Skiglede hva som ligger på og sier fra neste gang om skia må renses eller bare trenger topplag.
        </ThemedText>

        <Kort><StedVelger forklaring="Hvert sted har egen skipark. Valgt sted brukes også på forsiden og i smørelageret." /></Kort>

        <Kort>
          <Text style={[styles.h2, { color: theme.text }]}>Legg til ski</Text>
          <TextInput
            value={navn}
            onChangeText={setNavn}
            onSubmitEditing={legg}
            placeholder="Navn, f.eks. «Fischer skøyte» eller «Madshus rubb»"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <View style={styles.rad}>
            {(Object.keys(STIL_NAVN) as Stil[]).map((s) => (
              <Chip key={s} aktiv={s === stil} onPress={() => setStil(s)}>{STIL_NAVN[s]}</Chip>
            ))}
            <Chip aktiv={false} onPress={legg}>+ Legg til</Chip>
          </View>
        </Kort>

        {ski.length === 0 ? <ThemedText themeColor="textSecondary">Ingen ski ennå.</ThemedText> : null}
        {ski.map((s) => (
          <Kort key={s.id}>
            <View style={styles.rad}>
              <Text style={[styles.h2, { color: theme.text, flex: 1 }]}>{s.navn}</Text>
              <View style={[styles.merke, { backgroundColor: theme.accentSoft }]}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>{STIL_NAVN[s.stil]}</Text>
              </View>
            </View>
            {s.smoring ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Sist smurt {dato(s.smoring.ts)} · {s.smoring.turer} {s.smoring.turer === 1 ? 'tur' : 'turer'} siden rens
                </ThemedText>
                <View style={styles.rad}>
                  {s.smoring.lag.map((l, i) => {
                    const p = produkt(l.produkt);
                    return (
                      <View key={i} style={[styles.lag, { backgroundColor: p?.hex ?? '#B9C7D6' }]}>
                        <Text style={{ color: tekstPå(p?.hex ?? '#B9C7D6'), fontWeight: '700', fontSize: 13 }}>{l.produkt}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">Ingen lagret smøring.</ThemedText>
            )}
            <View style={styles.rad}>
              {s.smoring ? <Chip aktiv={false} onPress={() => setSki(ski.map((x) => (x.id === s.id ? { ...x, smoring: undefined } : x)))}>Renset (nullstill)</Chip> : null}
              <Pressable onPress={() => setSki(ski.filter((x) => x.id !== s.id))} style={[styles.slett, { borderColor: theme.border }]}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>Slett</Text>
              </Pressable>
            </View>
          </Kort>
        ))}
        <ThemedText type="small" themeColor="textSecondary">Skiparken lagres på denne enheten. Innlogging og synk mellom enheter kommer senere.</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innhold: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, gap: Spacing.three, marginTop: Spacing.two },
  h1: { fontSize: 34, fontWeight: '800', marginTop: Spacing.two },
  h2: { fontSize: 22, fontWeight: '700' },
  rad: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16 },
  merke: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  lag: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  slett: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
});
