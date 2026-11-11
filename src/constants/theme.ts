/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B2540',
    background: '#EAF3FB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#D5E6F6',
    textSecondary: '#52708F',
    accent: '#2F7FD1',
    accentSoft: '#CFE5F9',
    onAccent: '#FFFFFF', // tekst på accent-bakgrunn
    border: '#C9DDF0',
    hero: '#12386B',
  },
  dark: {
    text: '#EAF4FF',
    background: '#08182A',
    backgroundElement: '#102B47',
    backgroundSelected: '#1A4467',
    textSecondary: '#9DB9D3',
    accent: '#6DB3F2',
    accentSoft: '#1D4A73',
    onAccent: '#08182A', // mørk tekst på lys accent (hvit ga kontrast 2,2:1)
    border: '#1F4468',
    hero: '#0B2A52',
  },
} as const;

/** Snøfarger for temperatur: dyp blå (kaldt) via isblå og hvitt til varm sand ved +5. */
const TEMP_STOPS: [number, [number, number, number]][] = [
  [-10, [22, 60, 140]],
  [-5, [52, 120, 205]],
  [-2, [100, 175, 235]],
  [0, [160, 215, 240]],
  [2, [247, 200, 130]],
  [5, [235, 140, 70]],
];
export function tempFarge(t: number): string {
  if (t <= TEMP_STOPS[0][0]) return `rgb(${TEMP_STOPS[0][1].join(',')})`;
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = TEMP_STOPS[i - 1];
      const f = (t - t0) / (t1 - t0);
      return `rgb(${c0.map((v, k) => Math.round(v + f * (c1[k] - v))).join(',')})`;
    }
  }
  return `rgb(${TEMP_STOPS[TEMP_STOPS.length - 1][1].join(',')})`;
}

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
