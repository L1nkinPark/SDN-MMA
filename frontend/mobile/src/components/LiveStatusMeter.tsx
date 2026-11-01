import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, sizes, type } from '@/theme';
import { levelLabel, type MeterKind, type MeterLevel } from '@/utils/liveStatus';

/** Three bars 6px wide, 8/13/18px high, 2px apart. One bar per level in ink; level 3 fills all in red. */
export function LiveStatusBars({ level }: { level: MeterLevel }) {
  const fill = level === 3 ? colors.error : colors.ink;
  return (
    <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sizes.meterBarHeights.map((height, index) => {
        const on = index < level;
        return (
          <View
            key={height}
            style={[
              styles.bar,
              { height, backgroundColor: on ? fill : 'transparent', borderColor: on ? fill : colors.fieldLine },
            ]}
          />
        );
      })}
    </View>
  );
}

type LiveStatusMeterProps = {
  kind: MeterKind;
  level: MeterLevel;
};

/** Bars plus "Độ đông: Vừa" / "Độ ồn: Yên tĩnh". */
export function LiveStatusMeter({ kind, level }: LiveStatusMeterProps) {
  const prefix = kind === 'crowd' ? 'Độ đông' : 'Độ ồn';
  const label = level === 0 ? 'Chưa rõ' : levelLabel(kind, level);
  return (
    <View style={styles.meter} accessible accessibilityLabel={`${prefix}: ${label}`}>
      <LiveStatusBars level={level} />
      <Text style={type.secondary}>
        {prefix}: <Text style={[styles.value, level === 3 ? styles.high : null]}>{label}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: sizes.meterGap, height: 18 },
  bar: { width: sizes.meterBarWidth, borderWidth: 1 },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  value: { fontFamily: fonts.semibold, color: colors.text },
  high: { color: colors.error },
});
