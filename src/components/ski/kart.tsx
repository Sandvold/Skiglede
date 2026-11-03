import { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';

export type KartSegment = { pts: [number, number][]; farge: string };

const TILE = 256;
const mx = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const my = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

// Kartverket Topo (åpne data, CC BY 4.0)
const tileUrl = (z: number, x: number, y: number) =>
  `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`;

export function TrailMap({ segmenter, hoyde = 320 }: { segmenter: KartSegment[]; hoyde?: number }) {
  const [w, setW] = useState(0);
  const alle = segmenter.flatMap((s) => s.pts);
  const lons = alle.map((p) => p[0]);
  const lats = alle.map((p) => p[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];

  let z = 16;
  const pad = 18;
  if (w > 0) {
    while (z > 8 && (mx(maxLon, z) - mx(minLon, z) > w - 2 * pad || my(minLat, z) - my(maxLat, z) > hoyde - 2 * pad)) z--;
  }
  const cx = (mx(minLon, z) + mx(maxLon, z)) / 2;
  const cy = (my(minLat, z) + my(maxLat, z)) / 2;
  const left = cx - w / 2;
  const top = cy - hoyde / 2;
  const toXY = (p: [number, number]) => `${(mx(p[0], z) - left).toFixed(1)},${(my(p[1], z) - top).toFixed(1)}`;

  const tiles: { x: number; y: number }[] = [];
  if (w > 0) {
    for (let x = Math.floor(left / TILE); x <= Math.floor((left + w) / TILE); x++) {
      for (let y = Math.floor(top / TILE); y <= Math.floor((top + hoyde) / TILE); y++) tiles.push({ x, y });
    }
  }
  const start = alle[0];
  const slutt = alle[alle.length - 1];
  const xy = (p: [number, number]) => toXY(p).split(',').map(Number);

  return (
    <View
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{ height: hoyde, borderRadius: 16, overflow: 'hidden', backgroundColor: '#DCE9F5' }}>
      {tiles.map((t) => (
        <Image
          key={`${z}/${t.x}/${t.y}`}
          source={{ uri: tileUrl(z, t.x, t.y) }}
          style={{ position: 'absolute', left: t.x * TILE - left, top: t.y * TILE - top, width: TILE, height: TILE }}
        />
      ))}
      {w > 0 && (
        <Svg width={w} height={hoyde} style={{ position: 'absolute', left: 0, top: 0 }}>
          {segmenter.map((s, i) => (
            <Polyline key={`h${i}`} points={s.pts.map(toXY).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {segmenter.map((s, i) => (
            <Polyline key={i} points={s.pts.map(toXY).join(' ')} fill="none" stroke={s.farge} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <Circle cx={xy(start)[0]} cy={xy(start)[1]} r={7} fill="#2E9B5B" stroke="#fff" strokeWidth={2.5} />
          <Circle cx={xy(slutt)[0]} cy={xy(slutt)[1]} r={7} fill="#12386B" stroke="#fff" strokeWidth={2.5} />
        </Svg>
      )}
      <View style={{ position: 'absolute', right: 6, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 6, borderRadius: 6 }}>
        <ThemedText type="small" style={{ color: '#12386B', fontSize: 11, lineHeight: 16 }}>© Kartverket</ThemedText>
      </View>
    </View>
  );
}
