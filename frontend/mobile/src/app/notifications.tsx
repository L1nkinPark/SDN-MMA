import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/api/hooks/useNotifications';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import { notificationTarget } from '@/api/notifications';
import type { AppNotification } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button, FormAlert, Header, Icon, LoadingList, MessageState, Screen } from '@/components';
import { colors, fonts, sizes, spacing } from '@/theme';
import { formatDate, formatTime } from '@/utils/format';

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const unread = !item.readAt;
  const target = notificationTarget(item);
  return (
    <Pressable
      accessibilityRole={target ? 'link' : 'button'}
      accessibilityLabel={`${unread ? 'Chưa đọc. ' : ''}${item.title}. ${item.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          {unread ? <View style={styles.unreadMark} /> : null}
          <Text style={[styles.title, unread ? styles.titleUnread : null]}>{item.title}</Text>
        </View>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.meta}>
          {formatDate(item.createdAt)} · {formatTime(item.createdAt)}
          {unread ? ' · Chưa đọc' : ''}
        </Text>
      </View>
      {target ? <Icon name="chevron" size={18} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

/** `GET /api/notifications`. Tapping marks one read and opens the related screen when the app has one. */
export default function NotificationsScreen() {
  const { status } = useSession();
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  useRefetchOnFocus(list.refetch, status === 'signed-in');

  function open(item: AppNotification) {
    if (!item.readAt) markRead.mutate(item._id);
    const target = notificationTarget(item);
    if (target) router.push(target);
  }

  let body;
  let right: string | undefined;
  if (status === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để xem thông báo"
        sentence="Thông báo về đặt chỗ, báo cáo và đánh giá được gửi theo tài khoản."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (status === 'loading' || list.isPending) {
    body = <LoadingList />;
  } else if (list.isError && !list.data) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được thông báo"
        sentence={errorMessage(list.error)}
        action={{ label: 'Thử lại', onPress: () => list.refetch(), busy: list.isFetching }}
      />
    );
  } else if (list.items.length === 0) {
    body = (
      <MessageState
        heading="Chưa có thông báo"
        sentence="Khi quán xác nhận đặt chỗ hoặc báo cáo của bạn được xử lý, thông báo sẽ hiện ở đây."
      />
    );
  } else {
    right = list.unreadCount > 0 ? `${list.unreadCount} chưa đọc` : undefined;
    body = (
      <FlatList
        data={list.items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <NotificationRow item={item} onPress={() => open(item)} />}
        ListHeaderComponent={
          list.unreadCount > 0 || markAll.isError || markRead.isError ? (
            <View style={styles.toolbar}>
              {list.unreadCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: markAll.isPending }}
                  disabled={markAll.isPending}
                  onPress={() => markAll.mutate()}
                  style={styles.linkButton}>
                  <Text style={styles.link}>{markAll.isPending ? 'Đang cập nhật' : 'Đánh dấu tất cả đã đọc'}</Text>
                </Pressable>
              ) : null}
              <FormAlert message={markAll.isError ? errorMessage(markAll.error) : null} />
            </View>
          ) : undefined
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage && !list.isFetchNextPageError) list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => {
              list.refetch();
            }}
            colors={[colors.ink]}
            tintColor={colors.ink}
          />
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <LoadingList rows={1} />
          ) : list.isFetchNextPageError ? (
            <View style={styles.footerError}>
              <FormAlert message={errorMessage(list.error)} />
              <Button label="Tải thêm" onPress={() => list.fetchNextPage()} />
            </View>
          ) : undefined
        }
      />
    );
  }

  return (
    <Screen>
      <Header title="Thông báo" back right={right} />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight, borderBottomWidth: sizes.rowRule, borderBottomColor: colors.rule },
  linkButton: { minHeight: sizes.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  pressed: { backgroundColor: colors.loading },
  rowText: { flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unreadMark: { width: 8, height: 8, backgroundColor: colors.ink },
  title: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text },
  titleUnread: { fontFamily: fonts.semibold, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  footerError: { gap: spacing.sm, paddingVertical: spacing.lg, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
});
