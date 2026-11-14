import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { KLASSE_FARGE, snøTekst, type Snø } from '@/data/snoe';
import { løypeFarge } from './loypefarger';

export type ValgLøype = { id: string; navn: string; lengde_m: number; type?: 'retur' | 'sloyfe'; snø?: Snø | null };

const typeNavn = { retur: 'tur-retur', sloyfe: 'sløyfe' } as const;

/** Liste (opptil `maksListe` løyper) eller dropdown når det er flere. Lengde vises ved navnet. */
export function Loypevelger({ løyper, valgt, onVelg, maksListe = 8 }: { løyper: ValgLøype[]; valgt: string | null; onVelg: (id: string) => void; maksListe?: number }) {
  const theme = useTheme();
  const [åpen, setÅpen] = useState(false);
  const sortert = løyper.map((l, i) => ({ ...l, farge: løypeFarge(i) }));

  const rad = (l: (typeof sortert)[number], onPress: () => void) => { // vanlig funksjon, ikke komponent: ellers bygges radene opp på nytt ved hver visning
    const aktiv = l.id === valgt;
    return (
      <Pressable
        key={l.id}
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: aktiv ? theme.backgroundSelected : 'transparent' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: l.farge }} />
        <Text style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: aktiv ? '800' : '600' }} numberOfLines={1}>{l.navn}</Text>
        {l.snø && l.snø.klasse !== null ? <Text accessibilityLabel={`Snø: ${snøTekst(l.snø)}`} style={{ color: KLASSE_FARGE[l.snø.klasse], fontSize: 12, fontWeight: '800' }}>{`● ${snøTekst(l.snø)}`}</Text> : null}
        {l.type ? <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{typeNavn[l.type]}</Text> : null}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', minWidth: 64, textAlign: 'right' }}>{(l.lengde_m / 1000).toFixed(1).replace('.', ',')} km</Text>
      </Pressable>
    );
  };

  const ramme = { borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement, overflow: 'hidden' as const };

  if (løyper.length <= maksListe) {
    return (
      <View style={ramme}>
        {sortert.map((l) => (
          rad(l, () => onVelg(l.id))
        ))}
      </View>
    );
  }

  const nå = sortert.find((l) => l.id === valgt);
  return (
    <View style={{ gap: 6, zIndex: 10 }}>
      <Pressable onPress={() => setÅpen(!åpen)} style={[ramme, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 10 }]}>
        {nå ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: nå.farge }} /> : null}
        <Text style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
          {nå ? `${nå.navn} · ${(nå.lengde_m / 1000).toFixed(1).replace('.', ',')} km` : `Velg løype (${løyper.length})`}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>{åpen ? '▲' : '▼'}</Text>
      </Pressable>
      {åpen && (
        <ScrollView style={[ramme, { maxHeight: 360 }]} nestedScrollEnabled>
          {sortert.map((l) => (
            rad(l, () => {
              setÅpen(false);
              onVelg(l.id);
            })
          ))}
        </ScrollView>
      )}
    </View>
  );
}
