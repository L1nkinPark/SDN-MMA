import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { NOTIFICATIONS_PAGE_SIZE, notificationsApi } from '../notifications';
import { queryKeys } from '../queryKeys';
import type { AppNotification, NotificationPage } from '../types';

function nextPage(last: NotificationPage): number | undefined {
  const page = last.page ?? 1;
  const limit = last.limit ?? NOTIFICATIONS_PAGE_SIZE;
  return page * limit < (last.total ?? 0) ? page + 1 : undefined;
}

/** Paged `GET /api/notifications`, newest first. */
export function useNotifications() {
  const { status } = useSession();
  const query = useInfiniteQuery({
    queryKey: queryKeys.notificationList,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: status === 'signed-in',
  });
  const items: AppNotification[] = query.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  return { ...query, items, unreadCount: query.data?.pages[0]?.unreadCount ?? 0 };
}

/** Unread count for the Hồ sơ row: one tiny request, refreshed when the screen gains focus. */
export function useUnreadNotificationCount() {
  const { status } = useSession();
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: () => notificationsApi.list(1, { unread: true, limit: 1 }),
    select: (page) => page.unreadCount ?? 0,
    enabled: status === 'signed-in',
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    // 404 means it was already read elsewhere; either way the list is stale.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
