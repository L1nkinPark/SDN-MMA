import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes } from '@/theme';

import { Icon } from './Icon';

type RatingStarsProps = {
  /** 0 to 5; rounded to whole stars. */
  value: number;
  /** 13px in lists, 30px when picking a rating. */
  size?: number;
  /** Makes the stars pressable to pick a rating. */
  onChange?: (value: number) => void;
};

/** Filled ink stars for the rating, outlined grey for the rest. */
export function RatingStars({ value, size = 13, onChange }: RatingStarsProps) {
  const filled = Math.round(Math.max(0, Math.min(5, value)));
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <View style={[styles.row, { gap: 2 }]} accessible accessibilityRole="image" accessibilityLabel={`${filled} trên 5 sao`}>
        {stars.map((star) => (
          <Icon key={star} name="star" size={size} filled={star <= filled} color={star <= filled ? colors.ink : colors.fieldLine} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {stars.map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityLabel={`${star} sao`}
          accessibilityState={{ checked: star === filled }}
          onPress={() => onChange(star)}
          style={styles.pick}>
          <Icon name="star" size={size} filled={star <= filled} color={star <= filled ? colors.ink : colors.fieldLine} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pick: { minWidth: sizes.touchTarget, minHeight: sizes.touchTarget, alignItems: 'flex-start', justifyContent: 'center' },
});
