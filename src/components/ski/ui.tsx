import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useLagret } from '@/data/lagring';

export function Kort({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return <View style={[styles.kort, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</View>;
}

export function Chip({ aktiv, onPress, children, liten }: { aktiv: boolean; onPress: () => void; children: string; liten?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={liten ? { top: 8, bottom: 8, left: 4, right: 4 } : undefined} // liten knapp holder seg kompakt, men trykkflaten blir ca. 44 px
      style={[styles.chip, { minHeight: liten ? 28 : 44, justifyContent: 'center' }, liten && { paddingVertical: 5, paddingHorizontal: 11 }, { backgroundColor: aktiv ? theme.accent : theme.backgroundElement, borderColor: aktiv ? theme.accent : theme.border }]}>
      <Text style={{ color: aktiv ? theme.onAccent : theme.text, fontWeight: '600', fontSize: liten ? 13 : 15 }}>{children}</Text>
    </Pressable>
  );
}

/** Kort som kan brettes sammen. Valget huskes på enheten og, for innloggede premium-brukere, på kontoen (nøkkel skiglede.ui.<id>). */
export function Sammenleggbar({ id, tittel, standardÅpen = true, topp, children, style }: { id: string; tittel: string; standardÅpen?: boolean; topp?: React.ReactNode; children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  const [åpen, setÅpen] = useLagret<boolean>(`skiglede.ui.${id}`, standardÅpen);
  return (
    <Kort style={style}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: åpen }} onPress={() => setÅpen(!åpen)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{tittel}</Text>
        {topp}
        <Text style={{ color: theme.textSecondary, fontSize: 18 }}>{åpen ? '▾' : '▸'}</Text>
      </Pressable>
      {åpen ? children : null}
    </Kort>
  );
}

/** Nedtrekk som ser likt ut overalt: <select> på nett, modal på mobil. */
export function Valgboks({ verdi, valg, onVelg, etikett }: { verdi: string; valg: { verdi: string; tekst: string }[]; onVelg: (v: string) => void; etikett: string }) {
  const theme = useTheme();
  if (Platform.OS !== 'web') return <Nedtrekk verdi={verdi} valg={valg} onVelg={onVelg} etikett={etikett} />;
  return createElement(
    'select',
    {
      value: verdi,
      'aria-label': etikett,
      onChange: (e: { target: { value: string } }) => onVelg(e.target.value),
      style: { fontSize: 14, fontWeight: 600, minHeight: 44, padding: '6px 12px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.backgroundElement, color: theme.text },
    },
    ...valg.map((v) => createElement('option', { key: v.verdi, value: v.verdi }, v.tekst)),
  );
}

/** Nedtrekksvalg for mobil (på nett brukes <select>). */
export function Nedtrekk({ verdi, valg, onVelg, etikett }: { verdi: string; valg: { verdi: string; tekst: string }[]; onVelg: (v: string) => void; etikett: string }) {
  const theme = useTheme();
  const [åpen, setÅpen] = useState(false);
  const valgt = valg.find((v) => v.verdi === verdi);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={etikett} onPress={() => setÅpen(true)} style={[styles.chip, { minHeight: 44, backgroundColor: theme.backgroundElement, borderColor: theme.border, flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
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
