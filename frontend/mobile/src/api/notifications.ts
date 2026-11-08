import { api } from './client';
import type { AppNotification, NotificationPage } from './types';

export const NOTIFICATIONS_PAGE_SIZE = 20;

const enc = encodeURIComponent;

export const notificationsApi = {
  list: (page: number, options: { unread?: boolean; limit?: number } = {}) =>
    api.request<NotificationPage>('/api/notifications', {
      query: { page, limit: options.limit ?? NOTIFICATIONS_PAGE_SIZE, unread: options.unread ? 'true' : undefined },
    }),
  markRead: (id: string) =>
    api.request<{ notification: AppNotification }>(`/api/notifications/${enc(id)}/read`, { method: 'PATCH' }),
  markAllRead: () => api.request<{ updated: number }>('/api/notifications/read-all', { method: 'POST' }),
};

/** Where tapping a notification leads in the app, or null when it only has text to read. */
export type NotificationTarget =
  | { pathname: '/my-bookings' }
  | { pathname: '/my-reports' }
  | { pathname: '/places/[id]'; params: { id: string } };

export function notificationTarget(notification: Pick<AppNotification, 'resourceType' | 'resourceId'>): NotificationTarget | null {
  switch (notification.resourceType) {
    case 'Booking':
      return { pathname: '/my-bookings' };
    case 'Report':
      return { pathname: '/my-reports' };
    case 'Place':
      return notification.resourceId ? { pathname: '/places/[id]', params: { id: notification.resourceId } } : null;
    default:
      return null;
  }
}
