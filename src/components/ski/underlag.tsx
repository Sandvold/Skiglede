import type React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Nedtrekk } from '@/components/ski/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEL_VALG, type Del, type Påvirkning, type Underlag } from '@/engine';

function Rad<T extends Påvirkning>({ tittel, hjelp, p, onChange, ekstra }: { tittel: string; hjelp: string; p: T; onChange: (p: T) => void; ekstra?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => onChange({ ...p, på: !p.på })} accessibilityRole="checkbox" accessibilityState={{ checked: p.på }} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: theme.border, backgroundColor: p.på ? theme.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {p.på ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
        </View>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{tittel}</Text>
        {!p.på ? <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }}>{hjelp}</ThemedText> : null}
      </Pressable>
      {p.på ? (
        <View style={{ flexDirection: 'row', paddingLeft: 34 }}>
          <Nedtrekk etikett={`${tittel}: hvor på løypa`} verdi={p.del} valg={DEL_VALG.map((d) => ({ verdi: d.verdi, tekst: d.tekst }))} onVelg={(v) => onChange({ ...p, del: v as Del })} />
        </View>
      ) : null}
      {p.på && ekstra ? <View style={{ flexDirection: 'row', paddingLeft: 34 }}>{ekstra}</View> : null}
    </View>
  );
}

/** Avkrysning for kunstsnø (og salt på renn) med valg av hele eller deler av løypa. */
export function UnderlagValg({ u, onChange, medSalt = false }: { u: Underlag; onChange: (u: Underlag) => void; medSalt?: boolean }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <Rad tittel="Kunstsnø" hjelp="Kryss av hvis løypa har kunstsnø: smøringen justeres." p={u.kunstsnø} onChange={(p) => onChange({ ...u, kunstsnø: p })}
        ekstra={<Nedtrekk etikett="Kunstsnø: alder" verdi={u.kunstsnø.alder ?? 'fersk'} valg={[{ verdi: 'fersk', tekst: 'Fersk kunstsnø' }, { verdi: 'eldre', tekst: 'Eldre (noen dager)' }]} onVelg={(v) => onChange({ ...u, kunstsnø: { ...u.kunstsnø, alder: v as 'fersk' | 'eldre' } })} />} />
      {medSalt ? <Rad tittel="Saltet løype" hjelp="Kryss av hvis løypa er saltet." p={u.salt} onChange={(p) => onChange({ ...u, salt: p })} /> : null}
    </View>
  );
}
