import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { bookingPlace, bookingStatusLabel, isActiveBooking } from '@/api/bookings';
import { errorMessage } from '@/api/errors';
import { useCancelBooking, useMyBookings } from '@/api/hooks/useBookings';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import type { MyBooking } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button, FormAlert, Header, LoadingList, MessageState, Screen } from '@/components';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { CANCEL_LEAD_MS, vnDateTime } from '@/utils/vnTime';

type Section = { title: string; data: MyBooking[] };

function BookingRow({ booking, now, cancelling, onCancel }: {
  booking: MyBooking;
  now: number;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const place = bookingPlace(booking);
  const start = booking.startsAt ? Date.parse(booking.startsAt) : NaN;
  const active = isActiveBooking(booking);
  const cancellable = active && start - now > CANCEL_LEAD_MS;
  const tagColor = active ? colors.ink : booking.status === 'completed' ? colors.text : colors.textSecondary;

  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        {place?._id ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/places/[id]', params: { id: place._id } })}
            style={styles.placeLink}>
            <Text style={styles.placeName}>{place.name ?? 'Địa điểm'}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.placeName, styles.placeLink]}>Địa điểm không còn hiển thị</Text>
        )}
        <Text style={[styles.tag, { borderColor: tagColor, color: tagColor }]}>{bookingStatusLabel(booking.status)}</Text>
      </View>
      <Text style={styles.when}>
        {vnDateTime(booking.startsAt)} · {booking.partySize ?? 1} người
      </Text>
      {booking.note ? <Text style={styles.detail}>Ghi chú: {booking.note}</Text> : null}
      {booking.status === 'cancelled' && booking.cancellationReason ? (
        <Text style={styles.detail}>Lý do hủy: {booking.cancellationReason}</Text>
      ) : null}
      {booking.status === 'pending' ? (
        <Text style={type.secondary}>Quán chưa xác nhận. Yêu cầu tự hủy nếu chưa được xác nhận trước giờ đến 1 giờ.</Text>
      ) : null}
      {cancellable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: cancelling, disabled: cancelling }}
          disabled={cancelling}
          onPress={onCancel}
          style={styles.cancel}>
          <Text style={styles.cancelText}>{cancelling ? 'Đang hủy' : 'Hủy đặt chỗ'}</Text>
        </Pressable>
      ) : active && start > now ? (
        <Text style={type.secondary}>Còn dưới 1 giờ nên không hủy được trong app. Hãy liên hệ quán nếu không đến được.</Text>
      ) : null}
    </View>
  );
}

/** `GET /api/bookings/me`, split into upcoming and past. Cancelling is allowed until 1 hour before the start. */
export default function MyBookingsScreen() {
  const { status } = useSession();
  const bookings = useMyBookings();
  const cancel = useCancelBooking();
  const [now, setNow] = useState(() => Date.now());

  useRefetchOnFocus(bookings.refetch, status === 'signed-in');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function confirmCancel(booking: MyBooking) {
    const place = bookingPlace(booking);
    Alert.alert('Hủy đặt chỗ?', `${place?.name ?? 'Địa điểm'} · ${vnDateTime(booking.startsAt)}`, [
      { text: 'Giữ lượt đặt', style: 'cancel' },
      { text: 'Hủy đặt chỗ', style: 'destructive', onPress: () => cancel.mutate(booking) },
    ]);
  }

  let body;
  let count: string | undefined;
  if (status === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để xem đặt chỗ"
        sentence="Lượt đặt chỗ được giữ theo tài khoản của bạn."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (status === 'loading' || bookings.isPending) {
    body = <LoadingList />;
  } else if (bookings.isError && !bookings.data) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được đặt chỗ"
        sentence={errorMessage(bookings.error)}
        action={{ label: 'Thử lại', onPress: () => bookings.refetch(), busy: bookings.isFetching }}
      />
    );
  } else if (bookings.items.length === 0) {
    body = (
      <MessageState
        heading="Bạn chưa đặt chỗ nào"
        sentence="Ở trang chi tiết của quán có nhận đặt chỗ, chọn Đặt chỗ trước."
        action={{ label: 'Về Khám phá', onPress: () => router.navigate('/') }}
      />
    );
  } else {
    count = `${bookings.total} lượt`;
    // The list comes newest start first; upcoming reads better soonest first.
    const upcoming = bookings.items
      .filter((item) => isActiveBooking(item) && Date.parse(item.startsAt ?? '') > now)
      .sort((a, b) => Date.parse(a.startsAt ?? '') - Date.parse(b.startsAt ?? ''));
    const past = bookings.items.filter((item) => !upcoming.includes(item));
    const sections: Section[] = [
      ...(upcoming.length ? [{ title: 'Sắp tới', data: upcoming }] : []),
      ...(past.length ? [{ title: 'Đã qua và đã hủy', data: past }] : []),
    ];
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item._id ?? String(index)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => (
          <BookingRow
            booking={item}
            now={now}
            cancelling={cancel.isPending && cancel.variables?._id === item._id}
            onCancel={() => confirmCancel(item)}
          />
        )}
        ListHeaderComponent={
          cancel.isError ? (
            <View style={styles.banner}>
              <FormAlert message={errorMessage(cancel.error)} />
            </View>
          ) : undefined
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (bookings.hasNextPage && !bookings.isFetchingNextPage && !bookings.isFetchNextPageError) bookings.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={bookings.isRefetching && !bookings.isFetchingNextPage}
            onRefresh={() => {
              bookings.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }
        ListFooterComponent={
          bookings.isFetchingNextPage ? (
            <LoadingList rows={1} />
          ) : bookings.isFetchNextPageError ? (
            <View style={styles.banner}>
              <FormAlert message={errorMessage(bookings.error)} />
              <Button label="Tải thêm" onPress={() => bookings.fetchNextPage()} />
            </View>
          ) : undefined
        }
      />
    );
  }

  return (
    <Screen>
      <Header title="Đặt chỗ của tôi" back right={count} />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...type.label,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    color: colors.textSecondary,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  item: {
    gap: 6,
    paddingVertical: spacing.md,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  placeLink: { flex: 1, minHeight: sizes.touchTarget, justifyContent: 'center' },
  placeName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderRadius: sizes.radius,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  when: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  cancel: { minHeight: sizes.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.error },
  banner: { gap: spacing.sm, paddingVertical: spacing.md, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
});
