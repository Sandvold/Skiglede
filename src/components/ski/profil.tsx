import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type ProfilPunkt = { d: number; h: number; farge: string };

export function Hoydeprofil({ punkter, hoyde = 150 }: { punkter: ProfilPunkt[]; hoyde?: number }) {
  const theme = useTheme();
  const [w, setW] = useState(0);
  const hs = punkter.map((p) => p.h);
  const lav = Math.min(...hs) - 10;
  const høy = Math.max(...hs) + 10;
  const total = punkter[punkter.length - 1].d;
  const X = (d: number) => (d / total) * w;
  const Y = (h: number) => hoyde - 4 - ((h - lav) / (høy - lav)) * (hoyde - 12);
  const linje = punkter.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.h).toFixed(1)}`).join(' ');
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 && (
        <Svg width={w} height={hoyde}>
          <Defs>
            <LinearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.accent} stopOpacity={0.35} />
              <Stop offset="1" stopColor={theme.accent} stopOpacity={0.04} />
            </LinearGradient>
          </Defs>
          <Path d={`${linje} L${w},${hoyde} L0,${hoyde} Z`} fill="url(#snow)" />
          <Path d={linje} fill="none" stroke={theme.text} strokeOpacity={0.35} strokeWidth={5.5} strokeLinejoin="round" />
          {punkter.slice(1).map((p, i) => (
            <Path key={i} d={`M${X(punkter[i].d).toFixed(1)},${Y(punkter[i].h).toFixed(1)} L${X(p.d).toFixed(1)},${Y(p.h).toFixed(1)}`} stroke={p.farge} strokeWidth={3.5} strokeLinecap="round" />
          ))}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <ThemedText type="small" themeColor="textSecondary">0 km · {Math.round(punkter[0].h)} m</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{(total / 1000).toFixed(1)} km · {Math.round(punkter[punkter.length - 1].h)} m</ThemedText>
      </View>
    </View>
  );
}
