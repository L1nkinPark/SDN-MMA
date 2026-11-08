import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, authApi, merchantApi, notificationsApi, publicApi } from './endpoints';
import { queryKeys } from './queryKeys';
import type {
  Approval,
  BookingAction,
  BookingStatus,
  MerchantClaimInput,
  MerchantPlaceInput,
  MerchantPlaceUpdate,
  PlaceChangeFields,
  PlaceInput,
  PlaceUpdate,
  ReportStatus,
} from './types';

export function useAnalytics() {
  return useQuery({ queryKey: queryKeys.analytics, queryFn: adminApi.analytics });
}

export function usePlaces(approval: Approval | 'all', page: number) {
  return useQuery({
    queryKey: queryKeys.placesPage(approval, page),
    queryFn: () => adminApi.listPlaces(page, approval === 'all' ? undefined : approval),
    placeholderData: keepPreviousData,
  });
}

export function useReports(status: ReportStatus | 'all', page: number) {
  return useQuery({
    queryKey: queryKeys.reportsPage(status, page),
    queryFn: () => adminApi.listReports(page, status === 'all' ? undefined : status),
    placeholderData: keepPreviousData,
  });
}

export function useReviews(visibility: 'all' | 'visible' | 'hidden', page: number) {
  return useQuery({
    queryKey: queryKeys.reviewsPage(visibility, page),
    queryFn: () => adminApi.listReviews(page, visibility === 'all' ? undefined : visibility === 'hidden'),
    placeholderData: keepPreviousData,
  });
}

/** Lists and counts that a moderation change can affect. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: (readonly string[])[]) =>
    Promise.all([...keys, queryKeys.analytics].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useUpdatePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: PlaceUpdate }) => adminApi.updatePlace(id, changes),
    onSuccess: () => invalidate(queryKeys.places),
  });
}

export function useUploadImage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadImage(id, file),
    onSuccess: () => invalidate(queryKeys.places),
  });
}

export function useCreatePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: PlaceInput) => adminApi.createPlace(input),
    onSuccess: () => invalidate(queryKeys.places),
  });
}

export function useUpdateReport() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'resolved' | 'dismissed'; reason?: string }) => adminApi.updateReport(id, status, reason),
    onSuccess: () => invalidate(queryKeys.reports),
  });
}

export function useUpdateReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, hidden, reason }: { id: string; hidden: boolean; reason?: string }) => adminApi.updateReview(id, hidden, reason),
    onSuccess: () => invalidate(queryKeys.reviews),
  });
}

/* ---------- Notifications and account (every signed-in role) ---------- */

export function useNotificationsPage(unread: boolean, page: number) {
  return useQuery({
    queryKey: queryKeys.notificationsPage(unread, page),
    queryFn: () => notificationsApi.list(page, unread),
    placeholderData: keepPreviousData,
  });
}

/** Unread count for the top bar; refetched when the window regains focus. */
export function useUnreadNotificationCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: notificationsApi.unreadCount,
    select: (page) => page.unreadCount ?? 0,
    enabled,
    refetchInterval: 60000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
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

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword),
  });
}

/* ---------- Merchant area ---------- */

/** Public search used to find an approved place to claim. */
export function usePlaceSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.placeSearch(term),
    queryFn: () => publicApi.searchPlaces(term),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useMerchantPlaces() {
  return useQuery({ queryKey: queryKeys.merchantPlaces, queryFn: merchantApi.listPlaces });
}

export function useCreateMerchantPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MerchantPlaceInput) => merchantApi.createPlace(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantPlaces }),
  });
}

export function useMerchantClaims(page: number) {
  return useQuery({
    queryKey: queryKeys.merchantClaimsPage(page),
    queryFn: () => merchantApi.listClaims(page),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MerchantClaimInput) => merchantApi.submitClaim(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantClaims }),
  });
}

export function useUpdateMerchantPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: MerchantPlaceUpdate }) => merchantApi.updatePlace(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantPlaces }),
  });
}

export function useVisitCode() {
  return useMutation({ mutationFn: (placeId: string) => merchantApi.visitCode(placeId) });
}

export function useMerchantBookings(placeId: string, status: BookingStatus | 'all', page: number) {
  return useQuery({
    queryKey: queryKeys.merchantBookingsPage(placeId, status, page),
    queryFn: () => merchantApi.listBookings(placeId, page, status === 'all' ? undefined : status),
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
  });
}

export function useBookingDecision(placeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: BookingAction; reason?: string }) =>
      merchantApi.decideBooking(id, action, reason),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantBookings(placeId) }),
  });
}

export function useMerchantChanges(page: number) {
  return useQuery({
    queryKey: queryKeys.merchantChangesPage(page),
    queryFn: () => merchantApi.listChanges(page),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: PlaceChangeFields }) => merchantApi.submitChange(id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantChanges }),
  });
}

export function useSubmitImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => merchantApi.submitImage(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.merchantChanges }),
  });
}
