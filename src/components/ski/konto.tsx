import { Pressable, Text, View } from 'react-native';

import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

/** Innlogging og bryteren mellom premium og vanlig (foreløpig uten ekte betaling). */
export function KontoLinje() {
  const { klar, bruker, premium, loggInnMedGoogle, loggUt, byttPremium } = usePremium();
  if (!klar || !bruker) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
      <Text style={{ color: '#BFDDF7', fontSize: 14 }}>{bruker.epost}</Text>
      <Chip aktiv={premium} onPress={byttPremium}>{premium ? 'Premium: på' : 'Vanlig: bytt til premium'}</Chip>
      <Chip aktiv={false} onPress={loggUt}>Logg ut</Chip>
    </View>
  );
}

/** Knapp i menyen øverst: logg inn med Google (vises ikke når du er innlogget; da ligger kontoen under menyen). */
export function LoggInnKnapp({ stil }: { stil: object }) {
  const { klar, bruker, loggInnMedGoogle } = usePremium();
  if (!klar || bruker) return null;
  return (
    <Pressable accessibilityRole="button" onPress={loggInnMedGoogle} style={[stil, { backgroundColor: '#F4B73B' }]}>
      <Text style={{ color: '#12386B', fontWeight: '800', fontSize: 14 }}>Logg inn</Text>
    </Pressable>
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
