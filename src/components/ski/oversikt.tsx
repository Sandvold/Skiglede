import { Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Produkt, Smøresystem } from '@/engine';

const MIN = -25;
const MAX = 15;
const pct = (t: number) => `${((Math.min(MAX, Math.max(MIN, t)) - MIN) / (MAX - MIN)) * 100}%` as const;

/** Svart eller hvit tekst etter bakgrunn. */
export function tekstPå(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const y = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return y > 150 ? '#0B2540' : '#FFFFFF';
}

function Rad({ p, tMin, tMaks, brukt }: { p: Produkt; tMin: number; tMaks: number; brukt: boolean }) {
  const theme = useTheme();
  const [lo, hi] = p.omr;
  const bredde = Math.max(hi - lo, 1.2);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 }}>
      <View style={{ width: 118 }}>
        <Text style={{ color: theme.text, fontWeight: brukt ? '800' : '600', fontSize: 14 }}>
          {brukt ? '● ' : ''}{p.navn}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 13 }} numberOfLines={1}>{p.farge}</Text>
      </View>
      <View style={{ flex: 1, height: 26, justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: pct(tMin), width: `${((tMaks - tMin) / (MAX - MIN)) * 100}%`, top: 0, bottom: 0, backgroundColor: theme.accentSoft, borderRadius: 4, opacity: 0.8 }} />
        <View
          style={{
            position: 'absolute',
            left: pct(lo),
            width: `${(bredde / (MAX - MIN)) * 100}%`,
            height: 18,
            borderRadius: 9,
            backgroundColor: p.hex,
            borderWidth: brukt ? 2.5 : 1,
            borderColor: brukt ? theme.text : 'rgba(11,37,64,0.25)',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}>
          <Text style={{ color: tekstPå(p.hex), fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{lo === hi ? `${lo}` : `${lo}…${hi}`}</Text>
        </View>
      </View>
    </View>
  );
}

function Gruppe({ tittel, liste, tMin, tMaks, brukt }: { tittel: string; liste: Produkt[]; tMin: number; tMaks: number; brukt: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginTop: 8 }}>{tittel}</Text>
      {liste.map((p) => (
        <Rad key={p.navn} p={p} tMin={tMin} tMaks={tMaks} brukt={brukt.includes(p.navn)} />
      ))}
    </View>
  );
}

export function Temperaturoversikt({ tMin, tMaks, brukt, sys }: { tMin: number; tMaks: number; brukt: string[]; sys: Smøresystem }) {
  const theme = useTheme();
  const ticks = [-25, -20, -15, -10, -5, 0, 5, 10, 15];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ width: 118 }} />
        <View style={{ flex: 1, height: 16 }}>
          {ticks.map((t) => (
            <Text key={t} style={{ position: 'absolute', left: pct(t), marginLeft: -10, width: 20, textAlign: 'center', color: t === 0 ? theme.text : theme.textSecondary, fontSize: 11, fontWeight: t === 0 ? '800' : '500' }}>{t}</Text>
          ))}
        </View>
      </View>
      {sys.oversikt.map((g) => (
        <Gruppe key={g.tittel} tittel={g.tittel} liste={g.liste} tMin={tMin} tMaks={tMaks} brukt={brukt} />
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 8 }}>
        Området i °C slik {sys.navn} oppgir det. Det lyseblå feltet er turens snøtemperatur ({tMin.toFixed(1)} til {tMaks.toFixed(1)} °C), og ● markerer produkter i smøringen din. Fargene er tilnærminger til etikettfarger. Binder og baseklister uten temperaturområde vises som en strek ved 0. Kilde: {sys.kilde}
      </ThemedText>
    </View>
  );
}
