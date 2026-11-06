import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { PremiumProvider } from '@/data/premium';
import { useColorScheme } from 'react-native';

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
