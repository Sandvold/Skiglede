import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PremiumLås } from '@/components/ski/konto';
import { Hero } from '@/components/ski/hero';
import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { glidTekst, grepTekst, useLoggliste, type Logg } from '@/data/logg';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

const dato = (t: string) => new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).format(Date.parse(t));
const num = (v: unknown, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '–');

export default function LoggSide() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ alignItems: 'center', paddingBottom: Spacing.six }}>
      <Hero />
      <View style={{ width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.three }}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>← Tilbake</Text>
        </Pressable>
        <PremiumLås tittel="Smøreloggen">
          <Innhold />
        </PremiumLås>
      </View>
    </ScrollView>
  );
}

function Innhold() {
  const theme = useTheme();
  const { premium } = usePremium();
  const { liste, feil, slett } = useLoggliste(premium);
  if (feil) return <Kort><ThemedText>{feil}</ThemedText></Kort>;
  if (!liste) return <ThemedText themeColor="textSecondary">Henter loggen …</ThemedText>;
  if (!liste.length) return <Kort><ThemedText themeColor="textSecondary">Ingen loggføringer ennå. Logg smøringen fra løypesiden.</ThemedText></Kort>;
  return (
    <View style={{ gap: Spacing.two }}>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>Smøreloggen ({liste.length})</Text>
      {liste.map((l) => <Rad key={l.id} l={l} onSlett={() => slett(l.id)} />)}
    </View>
  );
}

function Rad({ l, onSlett }: { l: Logg; onSlett: () => void }) {
  const theme = useTheme();
  const m = l.modell ?? {};
  return (
    <Kort style={{ gap: 4 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{`${dato(l.tid)} · ${l.loype_navn ?? l.loype_id ?? ''}`}</Text>
      <ThemedText type="small" themeColor="textSecondary">{[l.stil, l.ski_navn].filter(Boolean).join(' · ')}</ThemedText>
      <Text style={{ color: theme.text }}>{`Feste: ${grepTekst(l.grep)} · Glid: ${glidTekst(l.glid)}`}</Text>
      {l.produkter?.length ? <ThemedText type="small">{l.produkter.map((p) => `${p.rolle}: ${p.produkt}`).join(' · ')}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">{`Modellen: snø snitt ${num(m.tSnitt)} °C (${num(m.tMin)} til ${num(m.tMaks)}), skarphet ${num(m.skarphet, 0)}${m.snotype ? `, ${String(m.snotype)}` : ''}${m.sludd ? ', sludd' : ''}${l.snotemp_malt !== null ? ` · målt snø ${l.snotemp_malt} °C` : ''}${l.lufttemp_malt !== null ? ` · målt luft ${l.lufttemp_malt} °C` : ''}`}</ThemedText>
      {l.kommentar ? <Text style={{ color: theme.text, fontStyle: 'italic' }}>{`«${l.kommentar}»`}</Text> : null}
      <View style={{ flexDirection: 'row' }}><Chip aktiv={false} onPress={onSlett}>Slett</Chip></View>
    </Kort>
  );
}
