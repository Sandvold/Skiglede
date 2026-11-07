import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { PremiumProvider } from '@/data/premium';
import { useEffect } from 'react';
import { Platform, ScrollView, Text, Pressable, useColorScheme } from 'react-native';

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
  // Ny versjon er lagt ut mens siden var åpen: den gamle filen finnes ikke lenger. Last siden på nytt (én gang) for å hente den nye.
  useEffect(() => {
    if (Platform.OS !== 'web' || !/Loading module .* failed/.test(String(error?.message))) return;
    try {
      if (globalThis.sessionStorage?.getItem('skiglede.omlast')) return;
      globalThis.sessionStorage?.setItem('skiglede.omlast', '1');
    } catch {
      return;
    }
    globalThis.location?.reload();
  }, [error]);
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
