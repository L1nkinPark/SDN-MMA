import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, sizes } from '@/theme';

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Square-cornered toggle: outline when off, filled ink when on. 44px high. */
export function ChoiceChip({ label, selected, onPress, accessibilityLabel }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.selected : null]}>
      <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.fieldLine,
    borderRadius: sizes.radius,
    justifyContent: 'center',
  },
  selected: { borderColor: colors.ink, backgroundColor: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  labelSelected: { fontFamily: fonts.semibold, color: colors.onInk },
});
