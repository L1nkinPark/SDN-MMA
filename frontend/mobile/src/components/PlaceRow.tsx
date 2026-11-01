import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Place } from '@/api/types';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { formatRating, formatTime } from '@/utils/format';
import { crowdLevel, isStatusKnown, MIN_SAMPLES, noiseLevel } from '@/utils/liveStatus';

import { Icon } from './Icon';
import { LiveStatusMeter } from './LiveStatusMeter';

type PlaceRowProps = {
  place: Place;
  onPress?: () => void;
  /** Shows the heart button. `favorite` fills it. */
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** Disables the heart while a change is being sent. */
  favoriteBusy?: boolean;
};

function ratingText(place: Place): string | null {
  const count = place.ratingCount ?? 0;
  if (count === 0) return null;
  return `${formatRating(place.ratingAverage ?? 0)} (${count} đánh giá)`;
}

function reportText(place: Place, known: boolean): string {
  const count = place.liveStatus?.sampleCount ?? 0;
  if (count === 0) return 'Chưa có người báo';
  const until = known ? formatTime(place.liveStatus?.validUntil) : '';
  return until ? `${count} người báo, đến ${until}` : `${count} người báo`;
}

/** One place in a list: name, address, live status, rating and report count, separated by a 1px rule. */
export function PlaceRow({ place, onPress, favorite, onToggleFavorite, favoriteBusy }: PlaceRowProps) {
  const known = isStatusKnown(place.liveStatus);
  const rating = ratingText(place);
  const name = place.name ?? '';

  return (
    <Pressable
      accessibilityRole="link"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={type.rowTitle}>{name}</Text>
          {place.address ? <Text style={type.secondary}>{place.address}</Text> : null}
        </View>
        {onToggleFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? `Bỏ lưu ${name}` : `Lưu ${name}`}
            accessibilityState={{ disabled: favoriteBusy, selected: favorite }}
            disabled={favoriteBusy}
            onPress={onToggleFavorite}
            style={[styles.heart, favoriteBusy ? styles.busy : null]}>
            <Icon name="heart" color={colors.ink} filled={favorite} />
          </Pressable>
        ) : null}
      </View>

      {known ? (
        <View style={styles.status}>
          <View style={styles.half}>
            <LiveStatusMeter kind="crowd" level={crowdLevel(place.liveStatus?.crowd)} />
          </View>
          <View style={styles.half}>
            <LiveStatusMeter kind="noise" level={noiseLevel(place.liveStatus?.noise)} />
          </View>
        </View>
      ) : (
        <Text style={type.secondary}>Chưa đủ người báo, cần ít nhất {MIN_SAMPLES} người</Text>
      )}

      <View style={styles.meta}>
        <View style={styles.rating}>
          {rating ? <Icon name="star" size={13} color={colors.ink} filled /> : null}
          <Text style={styles.metaText}>{rating ?? 'Chưa có đánh giá'}</Text>
        </View>
        <Text style={styles.metaText}>{reportText(place, known)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  pressed: { backgroundColor: colors.loading },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleBlock: { flex: 1, gap: 2 },
  heart: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    marginTop: -8,
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.5 },
  status: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
});
