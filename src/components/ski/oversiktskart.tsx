import { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { TILE, mx, my, tileUrl } from './kart';
import { løypeFarge } from './loypefarger';

export type OversiktLøype = { id: string; navn: string; punkter: number[][] };

/** Kart med alle løyper. Trykk på en løype for å gå til den. */
export function Oversiktskart({ løyper, onVelg, hoyde = 420 }: { løyper: OversiktLøype[]; onVelg: (id: string) => void; hoyde?: number }) {
  const [w, setW] = useState(0);
  const alle = løyper.flatMap((l) => l.punkter);
  const lons = alle.map((p) => p[0]);
  const lats = alle.map((p) => p[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];

  let z = 15;
  const pad = 20;
  if (w > 0) {
    while (z > 8 && (mx(maxLon, z) - mx(minLon, z) > w - 2 * pad || my(minLat, z) - my(maxLat, z) > hoyde - 2 * pad)) z--;
  }
  const left = (mx(minLon, z) + mx(maxLon, z)) / 2 - w / 2;
  const top = (my(minLat, z) + my(maxLat, z)) / 2 - hoyde / 2;
  const xy = (p: number[]) => [mx(p[0], z) - left, my(p[1], z) - top] as const;
  const pts = (l: OversiktLøype) => l.punkter.map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ');

  const tiles: { x: number; y: number }[] = [];
  if (w > 0) {
    for (let x = Math.floor(left / TILE); x <= Math.floor((left + w) / TILE); x++) {
      for (let y = Math.floor(top / TILE); y <= Math.floor((top + hoyde) / TILE); y++) tiles.push({ x, y });
    }
  }

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height: hoyde, borderRadius: 16, overflow: 'hidden', backgroundColor: '#DCE9F5' }}>
      {tiles.map((t) => (
        <Image key={`${z}/${t.x}/${t.y}`} source={{ uri: tileUrl(z, t.x, t.y) }} style={{ position: 'absolute', left: t.x * TILE - left, top: t.y * TILE - top, width: TILE, height: TILE }} />
      ))}
      {w > 0 && (
        <Svg width={w} height={hoyde} style={{ position: 'absolute', left: 0, top: 0 }}>
          {løyper.map((l) => (
            <Polyline key={`h${l.id}`} points={pts(l)} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {løyper.map((l, i) => (
            <Polyline key={l.id} points={pts(l)} fill="none" stroke={løypeFarge(i)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {løyper.map((l, i) => {
            const [x, y] = xy(l.punkter[0]);
            return <Circle key={`s${l.id}`} cx={x} cy={y} r={4} fill="#fff" stroke={løypeFarge(i)} strokeWidth={2.5} />;
          })}
          {/* Bred, usynlig trykkflate over hver løype */}
          {løyper.map((l) => (
            <Polyline
              key={`t${l.id}`}
              points={pts(l)}
              fill="none"
              stroke="rgba(0,0,0,0.001)"
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
              onPress={() => onVelg(l.id)}
              {...({ cursor: 'pointer' } as object)}
            />
          ))}
        </Svg>
      )}
      <View style={{ position: 'absolute', right: 6, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 6, borderRadius: 6 }}>
        <ThemedText type="small" style={{ color: '#12386B', fontSize: 11, lineHeight: 16 }}>© Kartverket</ThemedText>
      </View>
    </View>
  );
}
