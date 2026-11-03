import Svg, { Circle, Polyline } from 'react-native-svg';

import { ZoomKart } from './zoomkart';

export type KartSegment = { pts: [number, number][]; farge: string };

export const TILE = 256;
export const mx = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
export const my = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

// Kartverket Topo (åpne data, CC BY 4.0)
export const tileUrl = (z: number, x: number, y: number) =>
  `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`;

export function TrailMap({ segmenter, hoyde = 320 }: { segmenter: KartSegment[]; hoyde?: number }) {
  const alle = segmenter.flatMap((s) => s.pts);
  const start = alle[0];
  const slutt = alle[alle.length - 1];
  return (
    <ZoomKart punkter={alle} hoyde={hoyde} startZ={16}>
      {({ z, left, top, w, h }) => {
        const toXY = (p: [number, number]) => `${(mx(p[0], z) - left).toFixed(1)},${(my(p[1], z) - top).toFixed(1)}`;
        const xy = (p: [number, number]) => toXY(p).split(',').map(Number);
        return (
          <Svg width={w} height={h} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
            {segmenter.map((s, i) => (
              <Polyline key={`h${i}`} points={s.pts.map(toXY).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {segmenter.map((s, i) => (
              <Polyline key={i} points={s.pts.map(toXY).join(' ')} fill="none" stroke={s.farge} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            <Circle cx={xy(slutt)[0]} cy={xy(slutt)[1]} r={9} fill="#12386B" stroke="#fff" strokeWidth={2.5} />
            <Circle cx={xy(start)[0]} cy={xy(start)[1]} r={4.5} fill="#2E9B5B" stroke="#fff" strokeWidth={1.5} />
          </Svg>
        );
      }}
    </ZoomKart>
  );
}
