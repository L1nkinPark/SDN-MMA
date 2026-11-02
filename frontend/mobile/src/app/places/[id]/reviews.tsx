import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { usePlace } from '@/api/hooks/usePlace';
import { useReviews } from '@/api/hooks/useReviews';
import type { Review } from '@/api/types';
import { useSession } from '@/auth/session';
import { ActionBar, Button, FormAlert, Header, LoadingList, MessageState, RatingStars, Screen } from '@/components';
import { colors, fonts, sizes, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

function ReviewItem({ review }: { review: Review }) {
  const author = typeof review.user === 'object' ? review.user : undefined;
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <Text style={styles.author} numberOfLines={1}>
          {author?.name ?? 'Người dùng'}
          {author?.reputation !== undefined ? <Text style={styles.authorPoints}> · {author.reputation} điểm</Text> : null}
        </Text>
        <RatingStars value={review.rating ?? 0} />
      </View>
      {review.text ? <Text style={styles.text}>{review.text}</Text> : null}
      <Text style={styles.date}>{review.verifiedVisit ? '✓ Đã xác minh lượt ghé' : 'Lượt ghé chưa xác minh'}</Text>
      <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
    </View>
  );
}

export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requireAuth } = useSession();
  const place = usePlace(id);
  const reviews = useReviews(id);

  const placeName = place.data?.place?.name;

  function writeReview() {
    if (!id || !requireAuth()) return;
    router.push({ pathname: '/places/[id]/review', params: { id } });
  }

  const PlaceLine = placeName ? (
    <Text style={styles.placeName} numberOfLines={2}>
      {placeName}
    </Text>
  ) : null;

  let body;
  let showCount = false;
  if (reviews.isPending) {
    body = (
      <>
        {PlaceLine}
        <LoadingList />
      </>
    );
  } else if (reviews.isError && !reviews.data) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được đánh giá"
        sentence={errorMessage(reviews.error)}
        action={{ label: 'Thử lại', onPress: () => reviews.refetch(), busy: reviews.isFetching }}
      />
    );
  } else if (reviews.items.length === 0) {
    body = (
      <MessageState
        heading="Chưa có đánh giá nào"
        sentence="Bạn có thể là người đầu tiên đánh giá địa điểm này."
        action={{ label: 'Viết đánh giá', variant: 'primary', onPress: writeReview }}
      />
    );
  } else {
    showCount = true;
    body = (
      <>
        {PlaceLine}
        <FlatList
          style={styles.list}
          data={reviews.items}
          keyExtractor={(review, index) => review._id ?? String(index)}
          renderItem={({ item }) => <ReviewItem review={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (reviews.hasNextPage && !reviews.isFetchingNextPage && !reviews.isFetchNextPageError) reviews.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={reviews.isRefetching && !reviews.isFetchingNextPage}
              onRefresh={() => {
                reviews.refetch();
              }}
              colors={[colors.ink]}
              tintColor={colors.ink}
            />
          }
          ListFooterComponent={
            reviews.isFetchingNextPage ? (
              <LoadingList rows={1} />
            ) : reviews.isFetchNextPageError ? (
              <View style={styles.footerError}>
                <FormAlert message={errorMessage(reviews.error)} />
                <Button label="Tải thêm" onPress={() => reviews.fetchNextPage()} />
              </View>
            ) : undefined
          }
        />
        <ActionBar>
          <Button label="Viết đánh giá" onPress={writeReview} block size="large" />
        </ActionBar>
      </>
    );
  }

  return (
    <Screen>
      <Header title="Đánh giá" back right={showCount ? `${reviews.total} đánh giá` : undefined} />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  placeName: {
    paddingVertical: 10,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  list: { flex: 1 },
  item: {
    gap: 6,
    paddingVertical: spacing.md,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  author: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  authorPoints: { fontFamily: fonts.medium, color: colors.textSecondary },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  date: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  footerError: { gap: spacing.sm, paddingVertical: spacing.lg, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
});
