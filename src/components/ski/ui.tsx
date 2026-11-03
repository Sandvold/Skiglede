import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

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

const styles = StyleSheet.create({
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1 },
  kort: { borderRadius: 24, borderWidth: 1, padding: Spacing.three, gap: Spacing.two, boxShadow: '0 6px 24px rgba(18,56,107,0.08)' },
});
