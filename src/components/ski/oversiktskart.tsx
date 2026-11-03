import Svg, { Circle, Polyline } from 'react-native-svg';

import { mx, my } from './kart';
import { løypeFarge } from './loypefarger';
import { ZoomKart } from './zoomkart';

export type OversiktLøype = { id: string; navn: string; punkter: number[][] };

/** Standardvisning: Hovden-sentrum med Breive, Vidmyr, Lundane og Hartevatn i bildet [Bruker]. */
export const HOVDEN_VISNING = { lon: 7.3646, lat: 59.5699, z: 12 };

/** Kart med alle løyper. Trykk på en løype for å gå til den. Dra og zoom for å se nærmere. */
export function Oversiktskart({ løyper, onVelg, hoyde = 420 }: { løyper: OversiktLøype[]; onVelg: (id: string) => void; hoyde?: number }) {
  return (
    <ZoomKart punkter={løyper.flatMap((l) => l.punkter)} hoyde={hoyde} startZ={15} fast={HOVDEN_VISNING}>
      {({ z, left, top, w, h }) => {
        const xy = (p: number[]) => [mx(p[0], z) - left, my(p[1], z) - top] as const;
        const pts = (l: OversiktLøype) => l.punkter.map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ');
        return (
          <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
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
        );
      }}
    </ZoomKart>
  );
}
