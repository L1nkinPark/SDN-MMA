import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, errorStatus } from '@/api/errors';
import { useAddFavorite, useRemoveFavorite } from '@/api/hooks/useFavorites';
import { usePlace } from '@/api/hooks/usePlace';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import { useReviews } from '@/api/hooks/useReviews';
import type { Place, Review } from '@/api/types';
import { useSession } from '@/auth/session';
import {
  ActionBar,
  Button,
  FormAlert,
  Icon,
  LiveStatusLarge,
  LoadingList,
  MessageState,
  RatingStars,
  Screen,
  Spinner,
} from '@/components';
import { usePlaceRealtime } from '@/realtime/usePlaceRealtime';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { formatDate, formatRating, formatThousands, formatTime } from '@/utils/format';
import { isStatusKnown, MIN_SAMPLES } from '@/utils/liveStatus';

/** Same top spacing as the shared Header with a back button: 52px in the design, ~44px of it status bar. */
const TOP_OFFSET = 52 - 44;

type AccuracyKey = NonNullable<NonNullable<Place['source']>['locationAccuracy']>;
const accuracyNotes: Partial<Record<AccuracyKey, string>> = {
  campus_approximate: 'Vị trí chỉ ở mức khuôn viên, chưa phải lối vào chính xác.',
  unknown: 'Vị trí trên bản đồ chưa được xác minh.',
};

function amenityText(value: boolean | null | undefined): string {
  if (value === true) return 'Có';
  if (value === false) return 'Không';
  return 'Chưa xác minh';
}

function statusText(place: Place): string {
  const status = place.liveStatus;
  const count = status?.sampleCount ?? 0;
  if (count === 0) return 'Chưa có người báo.';
  if (!isStatusKnown(status)) return `${count} người báo, cần ít nhất ${MIN_SAMPLES} người.`;
  const parts = [`${count} người báo`];
  if (status?.updatedAt) parts.push(`cập nhật ${formatTime(status.updatedAt)}`);
  if (status?.validUntil) parts.push(`hiệu lực đến ${formatTime(status.validUntil)}`);
  return parts.join(', ');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ReviewPreview({ review }: { review: Review }) {
  const author = typeof review.user === 'object' ? review.user : undefined;
  return (
    <View style={styles.review}>
      <View style={styles.reviewTop}>
        <Text style={styles.reviewAuthor}>
          {author?.name ?? 'Người dùng'}
          {author?.reputation !== undefined ? <Text style={styles.reviewPoints}> · {author.reputation} điểm</Text> : null}
        </Text>
        <RatingStars value={review.rating ?? 0} />
      </View>
      {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
      <Text style={type.meta}>{review.verifiedVisit ? '✓ Đã xác minh lượt ghé' : 'Lượt ghé chưa xác minh'}</Text>
      <Text style={type.meta}>{formatDate(review.createdAt)}</Text>
    </View>
  );
}

/** Screen 5. Live status comes over Socket.IO while the screen is open. */
export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, requireAuth } = useSession();
  const placeQuery = usePlace(id);
  const reviews = useReviews(id);
  const realtime = usePlaceRealtime(id);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);

  // A review written by someone else or an admin change doesn't reach this screen by itself.
  useRefetchOnFocus(placeQuery.refetch);

  const place = placeQuery.data?.place;
  const favorite = Boolean(id && user?.favorites?.includes(id));
  const favoriteBusy = addFavorite.isPending || removeFavorite.isPending;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Hide the short "saved" notice after a few seconds.
  useEffect(() => {
    if (!favoriteNotice) return;
    const timer = setTimeout(() => setFavoriteNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [favoriteNotice]);

  const toggleFavorite = () => {
    if (!id || !requireAuth()) return;
    setFavoriteError(null);
    setFavoriteNotice(null);
    const saving = !favorite;
    (saving ? addFavorite : removeFavorite).mutate(id, {
      onSuccess: () => setFavoriteNotice(saving ? 'Đã thêm vào Yêu thích.' : 'Đã bỏ khỏi Yêu thích.'),
      onError: (error) => setFavoriteError(errorMessage(error)),
    });
  };

  const openSignedIn = (pathname: '/places/[id]/checkin' | '/places/[id]/report') => {
    if (id && requireAuth()) router.push({ pathname, params: { id } });
  };

  const topBar = (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 24) + TOP_OFFSET }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={back} style={styles.iconButton}>
        <Icon name="back" color={colors.ink} />
      </Pressable>
      {place ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: favorite, busy: favoriteBusy }}
          disabled={favoriteBusy}
          onPress={toggleFavorite}
          style={({ pressed }) => [styles.favorite, pressed ? styles.pressed : null]}>
          <Text style={styles.favoriteLabel}>{favorite ? 'Bỏ khỏi Yêu thích' : 'Thêm vào Yêu thích'}</Text>
          {favoriteBusy ? <Spinner color={colors.ink} /> : <Icon name="heart" color={colors.ink} filled={favorite} />}
        </Pressable>
      ) : null}
    </View>
  );

  if (placeQuery.isPending) {
    return (
      <Screen>
        {topBar}
        <LoadingList />
      </Screen>
    );
  }

  if (!place) {
    const notFound = errorStatus(placeQuery.error) === 404;
    return (
      <Screen>
        {topBar}
        {notFound ? (
          <MessageState
            heading="Không tìm thấy địa điểm"
            sentence="Địa điểm này có thể đã bị gỡ hoặc đang chờ duyệt."
            action={{ label: 'Về Khám phá', onPress: () => router.navigate('/') }}
          />
        ) : (
          <MessageState
            tone="error"
            heading="Chưa tải được địa điểm"
            sentence={errorMessage(placeQuery.error)}
            action={{ label: 'Thử lại', onPress: () => placeQuery.refetch(), busy: placeQuery.isFetching }}
          />
        )}
      </Screen>
    );
  }

  const photo = place.images?.[0];
  const ratingCount = place.ratingCount ?? 0;
  const accuracyNote = place.source?.locationAccuracy ? accuracyNotes[place.source.locationAccuracy] : undefined;
  const firstReview = reviews.items[0];

  return (
    <Screen>
      {topBar}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={placeQuery.isRefetching}
            onRefresh={() => {
              placeQuery.refetch();
              reviews.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel="Ảnh địa điểm"
          />
        ) : null}

        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={styles.title}>
            {place.name}
          </Text>
          {place.address ? <Text style={styles.address}>{place.address}</Text> : null}
          <View style={styles.rating}>
            {ratingCount > 0 ? <Icon name="star" size={13} color={colors.ink} filled /> : null}
            <Text style={styles.ratingText}>
              {ratingCount > 0 ? `${formatRating(place.ratingAverage ?? 0)} (${ratingCount} đánh giá)` : 'Chưa có đánh giá'}
            </Text>
          </View>
          <FormAlert message={favoriteError} />
          {favoriteNotice ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {favoriteNotice}
            </Text>
          ) : null}
        </View>

        <View accessibilityLabel="Trạng thái lúc này" style={styles.status}>
          <LiveStatusLarge liveStatus={place.liveStatus} />
          {realtime === 'offline' ? (
            <Text accessibilityRole="alert" style={styles.offline}>
              Mất kết nối, trạng thái có thể đã cũ. Đang kết nối lại.
            </Text>
          ) : (
            <Text style={type.secondary}>{statusText(place)}</Text>
          )}
        </View>

        <View style={styles.info}>
          <InfoRow label="Wi-Fi" value={amenityText(place.amenities?.wifi)} />
          {place.business?.openingHours?.length ? <InfoRow label="Giờ mở cửa" value="Xem theo ngày khi đặt chỗ" /> : null}
          <InfoRow label="Ổ cắm" value={amenityText(place.amenities?.outlets)} />
          <InfoRow
            label="Giá nước từ"
            value={place.minDrinkPrice == null ? 'Chưa có giá' : `${formatThousands(place.minDrinkPrice)} đ`}
          />
          {place.description ? <Text style={styles.description}>{place.description}</Text> : null}
          {accuracyNote ? <Text style={type.secondary}>{accuracyNote}</Text> : null}
        </View>

        <View style={styles.reviews}>
          <View style={styles.reviewsHeader}>
            <Text style={type.rowTitle}>Đánh giá</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => id && router.push({ pathname: '/places/[id]/reviews', params: { id } })}
              style={styles.linkButton}>
              <Text style={styles.link}>Xem tất cả</Text>
            </Pressable>
          </View>
          {firstReview ? (
            <ReviewPreview review={firstReview} />
          ) : reviews.isPending ? null : (
            <Text style={[type.secondary, styles.noReview]}>Chưa có đánh giá nào.</Text>
          )}
        </View>

        {place.booking?.enabled ? <Pressable accessibilityRole="link" onPress={() => {
          if (requireAuth()) router.push({ pathname: '/places/[id]/booking', params: { id } });
        }} style={styles.report}><Text style={styles.reportText}>Đặt chỗ tại quán</Text></Pressable> : null}
        <Pressable accessibilityRole="link" onPress={() => openSignedIn('/places/[id]/report')} style={styles.report}>
          <Text style={styles.reportText}>Báo cáo địa điểm</Text>
        </Pressable>
      </ScrollView>

      <ActionBar>
        <Button label="Check-in" block onPress={() => openSignedIn('/places/[id]/checkin')} />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 28, paddingRight: spacing.sm },
  iconButton: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  favorite: { minHeight: sizes.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 10 },
  pressed: { backgroundColor: colors.loading },
  favoriteLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  notice: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
  photo: { height: 196, marginTop: spacing.xs, marginLeft: spacing.contentLeft, backgroundColor: colors.loading },
  titleBlock: {
    gap: 6,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.titleRule,
    borderBottomColor: colors.ink,
  },
  title: { fontFamily: fonts.title, fontSize: 40, lineHeight: 43, color: colors.ink },
  address: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text, fontVariant: ['tabular-nums'] },
  status: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.titleRule,
    borderBottomColor: colors.ink,
  },
  offline: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.error },
  info: { paddingTop: spacing.lg, paddingBottom: spacing.sm, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  infoRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  infoLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  infoValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  description: { marginTop: spacing.md, marginBottom: spacing.sm, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  reviews: { paddingTop: spacing.sm, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkButton: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  review: { gap: 6, paddingVertical: spacing.md },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  reviewAuthor: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  reviewPoints: { fontFamily: fonts.medium, color: colors.textSecondary },
  reviewText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  noReview: { paddingVertical: spacing.md },
  report: { minHeight: sizes.touchTarget, justifyContent: 'center', paddingLeft: spacing.contentLeft, paddingBottom: spacing.sm },
  reportText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
});
