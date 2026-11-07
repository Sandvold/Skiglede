import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KontoHøyre } from '@/components/ski/konto';
import { useOmråde } from '@/data/omrader';
import { useSteder } from '@/data/lagring';
import { STED_RADIUS_KM, useStedFølgerPosisjon, useStedStatus } from '@/data/stedauto';
import { usePremium } from '@/data/premium';
import { Områdevelger } from '@/components/ski/omradevelger';

const MENY = [
  { href: '/', tekst: 'Løyper' },
  { href: '/lager', tekst: 'Smørelager' },
  { href: '/skipark', tekst: 'Skipark' },
] as const;
// Premium og pro får egne faner.
const LOGG = { href: '/logg', tekst: 'Logg' } as const;
const RENN = { href: '/renn', tekst: 'Renn' } as const;

export function Hero() {
  const theme = useTheme();
  const topp = useSafeAreaInsets().top;
  const sti = usePathname();
  const router = useRouter();
  const [område] = useOmråde();
  const { premium, pro } = usePremium();
  const meny = [...MENY, ...(premium ? [LOGG] : []), ...(pro ? [RENN] : [])];
  useStedFølgerPosisjon();
  const stedStatus = useStedStatus();
  const { steder, aktiv } = useSteder();
  const stedNavn = steder.find((x) => x.id === aktiv)?.navn;
  return (
    <View style={[styles.hero, { backgroundColor: theme.hero, paddingTop: 24 + topp }]}>
      {['❄', '❅', '❆', '❄', '❅', '❆', '❄'].map((f, i) => (
        <Text key={i} style={[styles.flak, { left: `${8 + i * 14}%`, top: 14 + ((i * 37) % 70), fontSize: 14 + ((i * 5) % 14) }]}>{f}</Text>
      ))}
      <View style={styles.innhold}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/')}>
            <Text style={styles.tittel}>Skiglede</Text>
          </Pressable>
          <KontoHøyre />
        </View>
        <Text style={styles.under}>Smøring for løypa du skal gå. {område.navn}</Text>
        <Områdevelger />
        {premium && stedStatus.tilstand !== 'ukjent' ? (
          <Text style={{ color: '#BFDDF7', fontSize: 13, marginTop: 10 }}>
            {stedStatus.tilstand === 'inne' ? `📍 ${stedNavn} (valgt automatisk)` : `📍 Mer enn ${STED_RADIUS_KM} km fra stedene dine: velg smøring fra lageret eller ski fra et av stedene.`}
          </Text>
        ) : null}
        <View style={styles.meny}>
          {meny.map((m) => {
            const aktiv = sti === m.href;
            return (
              <Pressable key={m.href} accessibilityRole="link" onPress={() => router.push(m.href)} style={[styles.menyKnapp, { backgroundColor: aktiv ? '#FFFFFF' : 'rgba(255,255,255,0.14)' }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: aktiv ? '#12386B' : '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{m.tekst}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={[styles.drift, { left: -80, width: 420, height: 160, backgroundColor: theme.background, bottom: -100 }]} />
      <View style={[styles.drift, { right: -120, width: 560, height: 190, backgroundColor: theme.background, bottom: -120 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', minHeight: 340, paddingTop: 24, paddingBottom: 48, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  innhold: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingBottom: 34 },
  tittel: { color: '#FFFFFF', fontSize: 52, fontWeight: '800', letterSpacing: -1 },
  under: { color: '#BFDDF7', fontSize: 17, marginTop: 4 },
  meny: { flexDirection: 'row', gap: 6, marginTop: 14 },
  menyKnapp: { paddingVertical: 7, paddingHorizontal: 8, borderRadius: 999, flexGrow: 1, flexShrink: 1, alignItems: 'center' },
  flak: { position: 'absolute', color: 'rgba(255,255,255,0.35)' },
  drift: { position: 'absolute', borderRadius: 999 },
});
