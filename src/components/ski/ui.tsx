import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useLagret } from '@/data/lagring';

export function Kort({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return <View style={[styles.kort, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</View>;
}

export function Chip({ aktiv, onPress, children }: { aktiv: boolean; onPress: () => void; children: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: aktiv ? theme.accent : theme.backgroundElement, borderColor: aktiv ? theme.accent : theme.border }]}>
      <Text style={{ color: aktiv ? '#fff' : theme.text, fontWeight: '600', fontSize: 15 }}>{children}</Text>
    </Pressable>
  );
}

/** Kort som kan brettes sammen. Valget huskes på enheten og, for innloggede premium-brukere, på kontoen (nøkkel skiglede.ui.<id>). */
export function Sammenleggbar({ id, tittel, standardÅpen = true, topp, children, style }: { id: string; tittel: string; standardÅpen?: boolean; topp?: React.ReactNode; children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  const [åpen, setÅpen] = useLagret<boolean>(`skiglede.ui.${id}`, standardÅpen);
  return (
    <Kort style={style}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: åpen }} onPress={() => setÅpen(!åpen)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{tittel}</Text>
        {topp}
        <Text style={{ color: theme.textSecondary, fontSize: 18 }}>{åpen ? '▾' : '▸'}</Text>
      </Pressable>
      {åpen ? children : null}
    </Kort>
  );
}

/** Nedtrekksvalg for mobil (på nett brukes <select>). */
export function Nedtrekk({ verdi, valg, onVelg, etikett }: { verdi: string; valg: { verdi: string; tekst: string }[]; onVelg: (v: string) => void; etikett: string }) {
  const theme = useTheme();
  const [åpen, setÅpen] = useState(false);
  const valgt = valg.find((v) => v.verdi === verdi);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={etikett} onPress={() => setÅpen(true)} style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border, flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{valgt?.tekst ?? '–'}</Text>
        <Text style={{ color: theme.textSecondary }}>▾</Text>
      </Pressable>
      <Modal transparent animationType="fade" visible={åpen} onRequestClose={() => setÅpen(false)}>
        <Pressable onPress={() => setÅpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: theme.backgroundElement, borderRadius: 20, maxHeight: '70%', overflow: 'hidden' }}>
            <ScrollView>
              {valg.map((v) => (
                <Pressable key={v.verdi} onPress={() => { onVelg(v.verdi); setÅpen(false); }} style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: v.verdi === verdi ? theme.accentSoft : 'transparent' }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: v.verdi === verdi ? '800' : '500' }}>{v.tekst}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
  kort: { borderRadius: 24, borderWidth: 1, padding: Spacing.three, gap: Spacing.two, boxShadow: '0 6px 24px rgba(18,56,107,0.08)' },
});
