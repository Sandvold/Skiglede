import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { avstandTil, sorterOmråder, useFavoritter, useOmråde, useOmråder } from '@/data/omrader';
import { usePosisjonNå } from '@/data/posisjon';

/** Velg område: nedtrekksliste med favoritter øverst (stjerne), og «nærmeste» som standard. */
export function Områdevelger() {
  const [område, setOmråde, { automatisk, nærmeste }] = useOmråde();
  const liste = useOmråder();
  const [fav, bytt] = useFavoritter();
  const pos = usePosisjonNå();
  const [åpen, setÅpen] = useState(false);
  const [søk, setSøk] = useState('');
  const sortert = sorterOmråder(liste, pos, fav).filter((o) => !søk.trim() || o.navn.toLowerCase().includes(søk.trim().toLowerCase()));
  const MAKS_VIST = 25; // favoritter og nærmeste først; resten via søk, så listen er rask også med hundrevis av områder
  const vist = søk.trim() ? sortert : sortert.slice(0, MAKS_VIST);
  const km = (o: (typeof liste)[number]) => {
    const d = avstandTil(o, pos);
    return d === null ? '' : d < 1 ? ' · under 1 km' : ` · ${Math.round(d)} km`;
  };
  return (
    <View style={{ marginTop: 14, gap: 8, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: åpen }} onPress={() => { setÅpen(!åpen); setSøk(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 }}>
        <Text style={{ color: '#12386B', fontWeight: '800', fontSize: 15 }}>{`${automatisk ? '📍 ' : fav.includes(område.id) ? '★ ' : ''}${område.navn}`}</Text>
        <Text style={{ color: '#12386B', fontSize: 12 }}>{åpen ? '▲' : '▼'}</Text>
      </Pressable>
      {åpen ? (
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 6, minWidth: 260, maxWidth: 420 }}>
          {liste.length > 8 ? (
            <TextInput value={søk} onChangeText={setSøk} placeholder="Søk etter område" style={{ margin: 8, borderWidth: 1, borderColor: '#C9D6E6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 15, color: '#12386B' }} />
          ) : null}
          <Pressable onPress={() => { setOmråde(''); setÅpen(false); }} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: automatisk ? '#E8F1FB' : 'transparent' }}>
            <Text style={{ color: '#12386B', fontWeight: '700', fontSize: 15 }}>{`📍 Nærmeste: ${nærmeste.navn}`}</Text>
            <Text style={{ color: '#55708F', fontSize: 12 }}>{pos ? 'Følger posisjonen din' : 'Tillat posisjon i nettleseren for å finne nærmeste'}</Text>
          </Pressable>
          {vist.map((o) => (
            <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: !automatisk && o.id === område.id ? '#E8F1FB' : 'transparent' }}>
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: !automatisk && o.id === område.id }} onPress={() => { setOmråde(o.id); setÅpen(false); }} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ color: '#12386B', fontWeight: '700', fontSize: 15 }}>{`${o.navn}${km(o)}`}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={fav.includes(o.id) ? `Fjern ${o.navn} fra favoritter` : `Gjør ${o.navn} til favoritt`} onPress={() => bytt(o.id)} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ color: fav.includes(o.id) ? '#E0A100' : '#9FB3CC', fontSize: 20 }}>{fav.includes(o.id) ? '★' : '☆'}</Text>
              </Pressable>
            </View>
          ))}
          {vist.length < sortert.length ? <Text style={{ color: '#55708F', fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 }}>{`Viser ${vist.length} av ${sortert.length}. Søk for å finne flere.`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
