import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';

/** Widths of the title and second line in each placeholder row, from the design. */
const ROWS = [
  { title: 214, line: 268 },
  { title: 186, line: 240 },
  { title: 228, line: 256 },
  { title: 200, line: 224 },
];

/** Static placeholder blocks in the row layout. No animation. */
export function LoadingList({ rows = 4 }: { rows?: number }) {
  return (
    <View accessible accessibilityLabel="Đang tải" accessibilityState={{ busy: true }} style={styles.list}>
      {Array.from({ length: rows }, (_, index) => {
        const row = ROWS[index % ROWS.length];
        return (
          <View key={index} style={styles.row}>
            <View style={[styles.block, { width: row.title, height: 16 }]} />
            <View style={[styles.block, { width: row.line, height: 12 }]} />
            <View style={styles.pair}>
              <View style={[styles.block, styles.half]} />
              <View style={[styles.block, styles.half]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, overflow: 'hidden' },
  row: {
    gap: 10,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  block: { backgroundColor: colors.loading, maxWidth: '100%' },
  pair: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1, height: 16 },
});
