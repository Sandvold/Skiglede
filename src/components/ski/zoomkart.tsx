import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TILE, latAv, lonAv, mx, my, tileUrl } from './kart';

const MIN_Z = 8;
const MAX_Z = 17;

export type Utsnitt = { z: number; left: number; top: number; w: number; h: number };

/** Kartramme med Kartverket-fliser, dra for å flytte, knapper/musehjul/klyping for å zoome. */
export type KartBoks = { z: number; vest: number; sør: number; øst: number; nord: number };

export function ZoomKart({ punkter, hoyde, startZ = 16, fast, onBoks, children }: { punkter: number[][]; hoyde: number; startZ?: number; /** Får synlig område (og zoom) når kartet flyttes eller zoomes, med litt forsinkelse */ onBoks?: (b: KartBoks) => void; /** Fast startvisning (senter og zoom) i stedet for å tilpasse til punktene */ fast?: { lon: number; lat: number; z: number }; children: (u: Utsnitt) => ReactNode }) {
  const [w, setW] = useState(0);
  const lons = punkter.map((p) => p[0]);
  const lats = punkter.map((p) => p[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];

  // Passende zoom som standard
  const passZ = useMemo(() => {
    if (fast) return fast.z;
    if (w <= 0) return startZ;
    let z = startZ;
    const pad = 20;
    while (z > MIN_Z && (mx(maxLon, z) - mx(minLon, z) > w - 2 * pad || my(minLat, z) - my(maxLat, z) > hoyde - 2 * pad)) z--;
    return z;
  }, [w, hoyde, startZ, fast, minLon, maxLon, minLat, maxLat]);

  const [dz, setDz] = useState(0);
  const [senter, setSenter] = useState<[number, number]>(fast ? [mx(fast.lon, 0), my(fast.lat, 0)] : [(mx(minLon, 0) + mx(maxLon, 0)) / 2, (my(minLat, 0) + my(maxLat, 0)) / 2]);
  const z = Math.max(MIN_Z, Math.min(MAX_Z, passZ + dz));

  const ref = useRef({ z, w, passZ });
  ref.current = { z, w, passZ };
  const zoom = (d: number) => setDz((v) => Math.max(MIN_Z - ref.current.passZ, Math.min(MAX_Z - ref.current.passZ, v + d)));

  const gest = useRef({ sist: [0, 0], avstand: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          gest.current = { sist: [0, 0], avstand: 0 };
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t && t.length >= 2) {
            const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            const g0 = gest.current;
            if (g0.avstand === 0) g0.avstand = d;
            else if (d > g0.avstand * 1.6) { zoom(1); g0.avstand = d; }
            else if (d < g0.avstand * 0.6) { zoom(-1); g0.avstand = d; }
            return;
          }
          const s = gest.current.sist;
          const ddx = g.dx - s[0];
          const ddy = g.dy - s[1];
          gest.current.sist = [g.dx, g.dy];
          const f = 2 ** ref.current.z;
          setSenter(([x, y]) => [x - ddx / f, y - ddy / f]);
        },
      }),
    [],
  );

  const boks = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = boks.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let sist = 0;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const nå = Date.now();
      if (nå - sist < 120) return;
      sist = nå;
      zoom(ev.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const f = 2 ** z;
  const left = senter[0] * f - w / 2;
  const top = senter[1] * f - hoyde / 2;
  const tiles: { x: number; y: number }[] = [];
  if (w > 0) {
    for (let x = Math.floor(left / TILE); x <= Math.floor((left + w) / TILE); x++) {
      for (let y = Math.floor(top / TILE); y <= Math.floor((top + hoyde) / TILE); y++) tiles.push({ x, y });
    }
  }

  useEffect(() => {
    if (!onBoks || w <= 0) return;
    const t = setTimeout(() => onBoks({ z, vest: lonAv(left, z), øst: lonAv(left + w, z), nord: latAv(top, z), sør: latAv(top + hoyde, z) }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z, Math.round(left / 20), Math.round(top / 20), w, hoyde]);

  const knapp = (tekst: string, onPress: () => void, av: boolean) => (
    <Pressable onPress={onPress} disabled={av} accessibilityLabel={tekst === '+' ? 'Zoom inn' : 'Zoom ut'} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', opacity: av ? 0.4 : 1 }}>
      <ThemedText style={{ color: '#12386B', fontSize: 22, lineHeight: 24 }}>{tekst}</ThemedText>
    </Pressable>
  );

  return (
    <View
      ref={boks}
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      {...pan.panHandlers}
      style={[{ height: hoyde, borderRadius: 16, overflow: 'hidden', backgroundColor: '#DCE9F5' }, { touchAction: 'none', userSelect: 'none' } as object]}>
      {tiles.map((t) => (
        <Image key={`${z}/${t.x}/${t.y}`} source={{ uri: tileUrl(z, t.x, t.y) }} style={{ position: 'absolute', left: t.x * TILE - left, top: t.y * TILE - top, width: TILE, height: TILE }} />
      ))}
      {w > 0 ? children({ z, left, top, w, h: hoyde }) : null}
      <View style={{ position: 'absolute', right: 8, top: 8, borderRadius: 8, overflow: 'hidden' }}>
        {knapp('+', () => zoom(1), z >= MAX_Z)}
        <View style={{ height: 1, backgroundColor: '#C5D3E3' }} />
        {knapp('−', () => zoom(-1), z <= MIN_Z)}
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 6, borderRadius: 6 }}>
        <ThemedText type="small" style={{ color: '#12386B', fontSize: 11, lineHeight: 16 }}>© Kartverket</ThemedText>
      </View>
    </View>
  );
}
