import { StyleSheet, Text, View } from 'react-native';

import type { LiveStatus } from '@/api/types';
import { colors, fonts, spacing, type } from '@/theme';
import { crowdLevel, levelLabel, noiseLevel, type MeterKind, type MeterLevel } from '@/utils/liveStatus';

import { LiveStatusBars } from './LiveStatusMeter';

function Item({ kind, level }: { kind: MeterKind; level: MeterLevel }) {
  const title = kind === 'crowd' ? 'Độ đông' : 'Độ ồn';
  const label = level === 0 ? 'Chưa rõ' : levelLabel(kind, level);
  return (
    <View style={styles.item} accessible accessibilityLabel={`${title}: ${label}`}>
      <Text style={type.secondary}>{title}</Text>
      <View style={styles.value}>
        <LiveStatusBars level={level} />
        <Text style={[styles.label, level === 0 ? styles.unknown : null]}>{label}</Text>
      </View>
    </View>
  );
}

/** Crowd and noise side by side with large condensed labels, as on Chi tiết and after a check-in. */
export function LiveStatusLarge({ liveStatus }: { liveStatus: LiveStatus | undefined }) {
  return (
    <View style={styles.row}>
      <Item kind="crowd" level={crowdLevel(liveStatus?.crowd)} />
      <Item kind="noise" level={noiseLevel(liveStatus?.noise)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  item: { flex: 1, gap: 6 },
  value: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  label: { fontFamily: fonts.title, fontSize: 30, lineHeight: 30, color: colors.ink },
  unknown: { color: colors.textSecondary },
});
