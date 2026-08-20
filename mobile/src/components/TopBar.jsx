import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { font, spacing } from '../theme';
import { useCondo } from '../context/CondoContext';
import { useTheme } from '../context/ThemeContext';

export default function TopBar({ title, onMenuPress, roleLabel }) {
  const { condoName } = useCondo();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onMenuPress} style={styles.hamburger} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.lines}>≡</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!condoName && (
          <Text style={styles.condoLabel}>{condoName}</Text>
        )}
      </View>
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.pillText}>{roleLabel}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    hamburger: { marginRight: spacing.sm, padding: 2 },
    lines:     { fontSize: 22, color: colors.text, lineHeight: 26 },
    title:     { fontSize: font.lg, fontWeight: '700', color: colors.text },
    condoLabel: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.disabledBg, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 5,
      marginLeft: spacing.sm,
    },
    dot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b' },
    pillText: { fontSize: 11, fontWeight: '600', color: colors.text2 },
  });
}
