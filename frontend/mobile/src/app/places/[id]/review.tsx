import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage, isApiError } from '@/api/errors';
import { useDeleteReview, useMyReview, useSaveReview } from '@/api/hooks/useMyReview';
import { usePlace } from '@/api/hooks/usePlace';
import type { Review } from '@/api/types';
import { useSession } from '@/auth/session';
import {
  ActionBar,
  Button,
  FormAlert,
  FormScroll,
  Header,
  LoadingList,
  MessageState,
  RatingStars,
  Screen,
  TextArea,
} from '@/components';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { ratingError, reviewTextError } from '@/utils/validation';

const TEXT_MAX = 1000;

function backToPlace(placeId: string) {
  router.dismissTo({ pathname: '/places/[id]', params: { id: placeId } });
}

type FormProps = {
  placeId: string;
  placeName: string | undefined;
  existing: Review | undefined;
  onHidden: () => void;
};

function ReviewForm({ placeId, placeName, existing, onHidden }: FormProps) {
  const editing = Boolean(existing);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? '');
  const [errors, setErrors] = useState<{ rating: string | null; text: string | null }>({ rating: null, text: null });
  const save = useSaveReview(placeId);
  const remove = useDeleteReview(placeId);
  const busy = save.isPending || remove.isPending;

  function submit() {
    if (busy) return;
    const next = { rating: ratingError(rating), text: reviewTextError(text) };
    setErrors(next);
    if (next.rating || next.text) return;
    save.mutate(
      { rating, text: text.trim() },
      {
        onSuccess: () => router.back(),
        onError: (error) => {
          if (isApiError(error) && error.is(403, 'This review was hidden by moderation')) onHidden();
        },
      },
    );
  }

  function confirmDelete() {
    if (busy) return;
    Alert.alert('Xóa đánh giá?', 'Đánh giá sẽ bị xóa khỏi địa điểm này.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);
  }

  const failure = save.error ?? remove.error;
  const formError = failure && !(isApiError(failure) && failure.status === 403 && save.error) ? errorMessage(failure) : null;

  return (
    <>
      <Header title={editing ? 'Sửa đánh giá' : 'Viết đánh giá'} back />
      <FormScroll contentStyle={styles.body}>
        {placeName ? <Text style={styles.placeName}>{placeName}</Text> : null}
        <View>
          <Text style={[styles.legend, errors.rating ? styles.legendError : null]}>Số sao</Text>
          <View style={styles.stars}>
            <RatingStars
              value={rating}
              size={30}
              onChange={(value) => {
                setRating(value);
                if (errors.rating) setErrors((current) => ({ ...current, rating: null }));
              }}
            />
          </View>
          {errors.rating ? <Text style={styles.fieldError}>{errors.rating}</Text> : null}
        </View>
        <View>
          <TextArea
            label="Nhận xét"
            value={text}
            onChangeText={(value) => {
              setText(value);
              if (errors.text) setErrors((current) => ({ ...current, text: null }));
              if (save.isError) save.reset();
            }}
            placeholder="Không gian, chỗ ngồi, giờ nào vắng..."
            rows={5}
            maxLength={TEXT_MAX}
            error={errors.text}
            editable={!busy}
          />
          {!errors.text ? <Text style={styles.hint}>Từ 3 đến 1.000 ký tự.</Text> : null}
        </View>
      </FormScroll>
      <ActionBar>
        <FormAlert message={formError} />
        <Button
          label={editing ? 'Lưu thay đổi' : 'Gửi đánh giá'}
          busyLabel="Đang gửi"
          busy={save.isPending}
          disabled={remove.isPending}
          onPress={submit}
          block
          size="large"
        />
        {editing ? (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy: remove.isPending }}
              disabled={busy}
              onPress={confirmDelete}
              style={styles.delete}>
              <Text style={[styles.deleteText, busy ? styles.dim : null]}>
                {remove.isPending ? 'Đang xóa' : 'Xóa đánh giá'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ActionBar>
    </>
  );
}

export default function WriteReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const placeId = id ?? '';
  const { status } = useSession();
  const place = usePlace(placeId);
  const mine = useMyReview(status === 'signed-in' ? placeId : undefined);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <Screen>
        <Header title="Sửa đánh giá" back />
        <MessageState
          heading="Không thể sửa đánh giá này"
          sentence="Đánh giá của bạn đã bị ẩn bởi quản trị viên."
          action={{ label: 'Về địa điểm', onPress: () => backToPlace(placeId) }}
        />
      </Screen>
    );
  }

  if (status === 'guest') {
    return (
      <Screen>
        <Header title="Viết đánh giá" back />
        <MessageState
          heading="Đăng nhập để viết đánh giá"
          sentence="Mỗi tài khoản có một đánh giá cho mỗi địa điểm."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  if (status === 'loading' || mine.isSearching) {
    return (
      <Screen>
        <Header title="Viết đánh giá" back />
        <LoadingList rows={2} />
      </Screen>
    );
  }

  if (mine.error) {
    return (
      <Screen>
        <Header title="Viết đánh giá" back />
        <MessageState
          tone="error"
          heading="Chưa tải được đánh giá"
          sentence={errorMessage(mine.error)}
          action={{ label: 'Thử lại', onPress: () => mine.retry() }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ReviewForm
        key={mine.review?._id ?? 'new'}
        placeId={placeId}
        placeName={place.data?.place?.name}
        existing={mine.review}
        onHidden={() => setHidden(true)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  placeName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  legend: { ...type.label, color: colors.textSecondary, marginBottom: 6 },
  legendError: { color: colors.error },
  stars: { marginLeft: -6 },
  fieldError: { ...type.error, marginTop: spacing.xs },
  hint: { ...type.secondary, marginTop: 6 },
  delete: { minHeight: sizes.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.error },
  dim: { opacity: 0.6 },
});
