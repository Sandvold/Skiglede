import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Chip, Kort } from '@/components/ski/ui';
import { ThemedText } from '@/components/themed-text';
import { usePremium } from '@/data/premium';
import { useTheme } from '@/hooks/use-theme';

/** Øverst til høyre: «Logg inn» og tannhjul når du er utlogget; ellers e-post og tannhjul. Premium/pro-brytere og «Logg ut» ligger i Innstillinger. */
export function KontoHøyre() {
  const { klar, bruker, feil, pågår, loggInnMedGoogle } = usePremium();
  const router = useRouter();
  if (!klar) return null;
  const tilInnstillinger = () => router.push('/innstillinger');
  const tannhjul = (
    <Pressable accessibilityRole="button" accessibilityLabel="Innstillinger" onPress={tilInnstillinger} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 26 }}>⚙</Text>
    </Pressable>
  );
  const knapp = { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999 } as const;
  if (!bruker) {
    return (
      <View style={{ alignItems: 'flex-end', marginTop: 10, maxWidth: 200, flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {tannhjul}
          <Pressable accessibilityRole="button" onPress={loggInnMedGoogle} style={[knapp, { backgroundColor: '#F4B73B', opacity: pågår ? 0.6 : 1 }]}>
            <Text style={{ color: '#12386B', fontWeight: '800', fontSize: 14 }}>{pågår ? 'Logger inn …' : 'Logg inn'}</Text>
          </Pressable>
        </View>
        {feil ? <Text style={{ color: '#FFD9D9', fontSize: 12, marginTop: 6, textAlign: 'right', alignSelf: 'stretch' }}>{feil.slice(0, 160)}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'flex-end', gap: 6, marginTop: 8, flexShrink: 1, maxWidth: 220 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 220 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Innstillinger" onPress={tilInnstillinger} style={{ flexShrink: 1 }}>
          <Text numberOfLines={1} style={{ color: '#BFDDF7', fontSize: 13 }}>{bruker.epost}</Text>
        </Pressable>
        {tannhjul}
      </View>
      {feil ? <Text style={{ color: '#FFD9D9', fontSize: 12, width: 200, textAlign: 'right' }}>{feil.slice(0, 160)}</Text> : null}
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

/** Viser innholdet bare for pro (konkurranse); ellers forklaring og bryter. Pro bygger på premium. */
export function ProLås({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  const theme = useTheme();
  const { klar, bruker, pro, feil, loggInnMedGoogle, byttPro } = usePremium();
  if (pro) return <>{children}</>;
  return (
    <Kort>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>{tittel} er for pro-brukere</Text>
      <ThemedText themeColor="textSecondary">
        Pro er konkurransesmøring: velg et renn og få råd for hele løypa, med slipestruktur (rilljern), glidelag og festesmøring. Rådene er utgangspunkt for testing på rennmorgenen.
      </ThemedText>
      {!klar ? null : !bruker ? (
        <Chip aktiv onPress={loggInnMedGoogle}>Logg inn med Google</Chip>
      ) : (
        <Chip aktiv onPress={byttPro}>Slå på pro (test, ingen betaling)</Chip>
      )}
      {feil ? <ThemedText type="small" style={{ color: theme.accent }}>{feil}</ThemedText> : null}
    </Kort>
  );
}
