import { Pressable, Text, View } from 'react-native';

import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

/** Øverst til høyre: «Logg inn» når du er utlogget; ellers e-post, premium-bryter (midlertidig, ingen betaling ennå) og «Logg ut». */
export function KontoHøyre() {
  const { klar, bruker, premium, loggInnMedGoogle, loggUt, byttPremium } = usePremium();
  if (!klar) return null;
  const knapp = { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999 } as const;
  if (!bruker) {
    return (
      <Pressable accessibilityRole="button" onPress={loggInnMedGoogle} style={[knapp, { backgroundColor: '#F4B73B', marginTop: 10 }]}>
        <Text style={{ color: '#12386B', fontWeight: '800', fontSize: 14 }}>Logg inn</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ alignItems: 'flex-end', gap: 6, marginTop: 8, flexShrink: 1 }}>
      <Text numberOfLines={1} style={{ color: '#BFDDF7', fontSize: 13, maxWidth: 220 }}>{bruker.epost}</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={byttPremium} style={[knapp, { backgroundColor: premium ? '#F4B73B' : 'rgba(255,255,255,0.14)' }]}>
          <Text style={{ color: premium ? '#12386B' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{premium ? 'Premium' : 'Vanlig'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={loggUt} style={[knapp, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Logg ut</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Viser innholdet bare for premium; ellers en forklaring med innlogging og bryter. */
export function PremiumLås({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  const theme = useTheme();
  const { klar, bruker, premium, feil, loggInnMedGoogle, byttPremium } = usePremium();
  if (premium) return <>{children}</>;
  return (
    <Kort>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>{tittel} er premium</Text>
      <ThemedText themeColor="textSecondary">
        Med premium lagrer du smørelager og ski på kontoen din, har flere steder (for eksempel fjellet og hjemme), flytter smøring mellom dem, får forslag til innkjøp, bruker «Bruk min smøring» og utvider løypa.
      </ThemedText>
      {!klar ? null : bruker ? (
        <Chip aktiv onPress={byttPremium}>Slå på premium (test, ingen betaling)</Chip>
      ) : (
        <Chip aktiv onPress={loggInnMedGoogle}>Logg inn med Google</Chip>
      )}
      {feil ? <ThemedText type="small" style={{ color: theme.accent }}>{feil}</ThemedText> : null}
    </Kort>
  );
}

export const LåsKort = Kort;
