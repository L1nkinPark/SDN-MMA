import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, sizes } from '@/theme';

type RadioRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/** One choice in a single-select list: 20px ring, 1px rule underneath, at least 46px high. */
export function RadioRow({ label, selected, onPress, disabled = false }: RadioRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.row}>
      <View style={[styles.ring, selected ? styles.ringOn : null]}>{selected ? <View style={styles.dot} /> : null}</View>
      <Text style={[styles.label, selected ? styles.labelOn : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  ring: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.fieldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { borderColor: colors.ink },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  labelOn: { fontFamily: fonts.semibold },
});
