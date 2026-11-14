import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { avstandKm, avstandTil, prøvOmråderIgjen, sorterOmråder, useFavoritter, useOmråde, useOmråder, useOmrådeFeil } from '@/data/omrader';
import { usePosisjonNå } from '@/data/posisjon';
import { KLASSE_FARGE, useSnø } from '@/data/snoe';

type Sted = { navn: string; type: string; kommune: string; lat: number; lon: number };

/** Søk i Kartverkets stedsnavn (gratis, uten nøkkel). Gir steder som Arendal selv om ingen område heter det. */
function useStedssøk(q: string): Sted[] {
  const [treff, setTreff] = useState<Sted[]>([]);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`https://ws.geonorge.no/stedsnavn/v1/sted?sok=${encodeURIComponent(t)}*&fuzzy=true&treffPerSide=12&utkoordsys=4326`, { signal: ctrl.signal });
        const d = await r.json();
        const sett = new Set<string>();
        const ut: Sted[] = [];
        for (const n of d?.navn ?? []) {
          const p = n.representasjonspunkt;
          const navn = n.stedsnavn?.[0]?.skrivemåte;
          if (!navn || !p) continue;
          const kommune = n.kommuner?.[0]?.kommunenavn ?? '';
          const nøkkel = `${navn}|${kommune}`;
          if (sett.has(nøkkel)) continue;
          sett.add(nøkkel);
          ut.push({ navn, type: n.navneobjekttype ?? '', kommune, lat: p.nord, lon: p.øst });
          if (ut.length >= 5) break;
        }
        setTreff(ut);
      } catch {
        // avbrutt eller offline: ingen stedsforslag
      }
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);
  return treff;
}

const åpneIGoogleMaps = (s: Sted) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;
  if (Platform.OS === 'web') globalThis.open?.(url, '_blank', 'noopener');
  else Linking.openURL(url);
};

/** Velg område: nedtrekksliste med favoritter øverst (stjerne), og «nærmeste» som standard. */
export function Områdevelger() {
  const [område, setOmråde, { automatisk, nærmeste }] = useOmråde();
  const liste = useOmråder();
  const listeFeil = useOmrådeFeil();
  const [fav, bytt] = useFavoritter();
  const pos = usePosisjonNå();
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState('');
  const [sted, setSted] = useState<Sted | null>(null);
  const snø = useSnø();
  const [kunSnø, setKunSnø] = useState(false);
  const stedsforslag = useStedssøk(sted ? '' : søk);
  // Valgt sted: områdene sorteres etter avstand til stedet (ikke posisjonen din)
  // Søker du, brukes valgt sted, ellers første stedstreff, som sentrum: områdene fra databasen kommer først, navnetreff øverst, så nærmest.
  const aktivt = sted ?? (søk.trim() ? stedsforslag[0] ?? null : null);
  const sentrum = aktivt ? { lat: aktivt.lat, lon: aktivt.lon } : pos;
  const q = søk.trim().toLowerCase();
  const dist = (o: (typeof liste)[number]) => avstandKm(sentrum!, { lat: o.visning.lat, lon: o.visning.lon });
  const sortert = (aktivt ? [...liste].sort((x, y) => (sted ? 0 : Number(y.navn.toLowerCase().includes(q)) - Number(x.navn.toLowerCase().includes(q))) || dist(x) - dist(y)) : sorterOmråder(liste, pos, fav))
    .filter((o) => aktivt || !q || o.navn.toLowerCase().includes(q));
  const harSnø = (o: (typeof liste)[number]) => (snø?.perOmråde.get(o.id)?.klasse ?? 0) >= 1;
  const sortertSnø = kunSnø && snø ? sortert.filter(harSnø).sort((x, y) => (snø.perOmråde.get(y.id)?.dybde ?? 0) - (snø.perOmråde.get(x.id)?.dybde ?? 0)) : sortert;
  const MAKS_VIST = 25; // favoritter og nærmeste først; resten via søk, så listen er rask også med hundrevis av områder
  const vist = kunSnø && snø ? sortertSnø.slice(0, MAKS_VIST) : aktivt ? sortert.slice(0, 8) : q ? sortert : sortert.slice(0, MAKS_VIST);
  const km = (o: (typeof liste)[number]) => {
    const d = aktivt ? dist(o) : avstandTil(o, pos);
    return d === null ? '' : d < 1 ? ' · under 1 km' : ` · ${Math.round(d)} km`;
  };
  return (
    <View style={{ marginTop: 14, gap: 8, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: åpen }} onPress={() => { setÅpen(!åpen); setSøk(''); setSted(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 }}>
        <Text style={{ color: '#12386B', fontWeight: '800', fontSize: 15 }}>{`${automatisk ? '📍 ' : fav.includes(område.id) ? '★ ' : ''}${område.navn}`}</Text>
        <Text style={{ color: '#12386B', fontSize: 12 }}>{åpen ? '▲' : '▼'}</Text>
      </Pressable>
      {åpen ? (
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 6, minWidth: 260, maxWidth: 420 }}>
          {listeFeil ? (
            <View style={{ backgroundColor: '#FFF3D6', paddingVertical: 8, paddingHorizontal: 14, gap: 4 }}>
              <Text style={{ color: '#6B4A00', fontSize: 13, fontWeight: '700' }}>Fikk ikke hentet alle områdene. Du ser bare noen få.</Text>
              <Pressable accessibilityRole="button" onPress={prøvOmråderIgjen}>
                <Text style={{ color: '#1F6FEB', fontSize: 13, fontWeight: '700' }}>Prøv igjen</Text>
              </Pressable>
            </View>
          ) : null}
          {liste.length > 8 ? (
            <TextInput value={søk} onChangeText={setSøk} placeholder="Søk etter område eller sted" style={{ margin: 8, borderWidth: 1, borderColor: '#C9D6E6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 15, color: '#12386B' }} />
          ) : null}
          {aktivt ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F1FB' }}>
              <Text style={{ flex: 1, color: '#12386B', fontWeight: '700', fontSize: 13, paddingVertical: 8, paddingHorizontal: 14 }}>{`Nærmeste løyper til ${aktivt.navn}`}</Text>
              <Pressable accessibilityRole="button" onPress={() => { setSted(null); setSøk(''); }} style={{ paddingVertical: 8, paddingHorizontal: 14 }}>
                <Text style={{ color: '#1F6FEB', fontSize: 12, fontWeight: '700' }}>Fjern</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => åpneIGoogleMaps(aktivt)} style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
                <Text style={{ color: '#1F6FEB', fontSize: 12, fontWeight: '700' }}>Google Maps ↗</Text>
              </Pressable>
            </View>
          ) : null}
          {aktivt ? null : <Pressable onPress={() => { setOmråde(''); setÅpen(false); }} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: automatisk ? '#E8F1FB' : 'transparent' }}>
            <Text style={{ color: '#12386B', fontWeight: '700', fontSize: 15 }}>{`📍 Nærmeste: ${nærmeste.navn}`}</Text>
            <Text style={{ color: '#55708F', fontSize: 12 }}>{pos ? 'Følger posisjonen din' : 'Tillat posisjon i nettleseren for å finne nærmeste'}</Text>
          </Pressable>}
          {snø ? (
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: kunSnø }} onPress={() => setKunSnø(!kunSnø)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
              <Text style={{ color: kunSnø ? '#1F6FEB' : '#12386B', fontWeight: '800', fontSize: 14 }}>{kunSnø ? '✓ Bare steder med snø nå (mest snø først)' : '❄ Vis bare steder med snø nå'}</Text>
            </Pressable>
          ) : null}
          {kunSnø && snø && !vist.length ? <Text style={{ color: '#55708F', fontSize: 13, paddingHorizontal: 14, paddingVertical: 8 }}>Ingen steder med snø i modellen akkurat nå.</Text> : null}
          {vist.map((o) => (
            <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: !automatisk && o.id === område.id ? '#E8F1FB' : 'transparent' }}>
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: !automatisk && o.id === område.id }} onPress={() => { setOmråde(o.id); setÅpen(false); setSted(null); }} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ color: '#12386B', fontWeight: '700', fontSize: 15 }}>{`${o.navn}${km(o)}`}</Text>
                {snø?.perOmråde.get(o.id)?.klasse != null ? <Text style={{ color: KLASSE_FARGE[snø.perOmråde.get(o.id)!.klasse!], fontSize: 12, fontWeight: '800' }}>{`● ${(snø.perOmråde.get(o.id)!.dybde ?? 0) >= 1 ? `${Math.round(snø.perOmråde.get(o.id)!.dybde!)} cm` : 'ingen snø'}`}</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={fav.includes(o.id) ? `Fjern ${o.navn} fra favoritter` : `Gjør ${o.navn} til favoritt`} onPress={() => bytt(o.id)} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ color: fav.includes(o.id) ? '#E0A100' : '#9FB3CC', fontSize: 20 }}>{fav.includes(o.id) ? '★' : '☆'}</Text>
              </Pressable>
            </View>
          ))}
          {stedsforslag.length ? (
            <View>
              <Text style={{ color: '#55708F', fontSize: 12, fontWeight: '700', paddingHorizontal: 14, paddingTop: 4 }}>VELG ET ANNET STED</Text>
              {stedsforslag.slice(0, 5).map((s) => (
                <View key={`${s.navn}|${s.kommune}|${s.lat}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable accessibilityRole="button" onPress={() => setSted(s)} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 14 }}>
                    <Text style={{ color: '#12386B', fontWeight: '700', fontSize: 15 }}>{`📍 ${s.navn}`}</Text>
                    <Text style={{ color: '#55708F', fontSize: 12 }}>{[s.type, s.kommune].filter(Boolean).join(' · ')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {!aktivt && vist.length < sortertSnø.length ? <Text style={{ color: '#55708F', fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 }}>{`Viser ${vist.length} av ${sortertSnø.length}. Søk for å finne flere.`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
