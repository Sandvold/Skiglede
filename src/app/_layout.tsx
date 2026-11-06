import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { PremiumProvider } from '@/data/premium';
import { ScrollView, Text, Pressable, useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PremiumProvider>
        <Slot />
      </PremiumProvider>
    </ThemeProvider>
  );
}

/** Feilskjerm for krasj under visning: viser feilteksten i stedet for en blank side eller at appen lukker seg. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Noe gikk galt i Skiglede</Text>
      <Text selectable style={{ fontSize: 14 }}>{`${error.message}\n\n${String(error.stack ?? '').slice(0, 1500)}`}</Text>
      <Pressable onPress={retry} style={{ marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: '#12386B', alignSelf: 'flex-start' }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Prøv igjen</Text>
      </Pressable>
    </ScrollView>
  );
}
