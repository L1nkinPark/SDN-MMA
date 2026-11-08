import { api } from './client';
import type {
  AdminPermission,
  AdminUser,
  Analytics,
  Approval,
  AuditEvent,
  AuthTokens,
  Booking,
  BookingAction,
  BookingResponse,
  BookingStatus,
  ClaimStatus,
  CreatePlaceResponse,
  Credentials,
  FraudFlag,
  FraudStatus,
  MeResponse,
  MerchantClaim,
  MerchantClaimInput,
  MerchantClaimResponse,
  MerchantPlaceInput,
  MerchantPlaceList,
  MerchantPlaceUpdate,
  NotificationPage,
  Page,
  Place,
  PlaceChangeFields,
  PlaceChangeRequest,
  PlaceInput,
  PlacePage,
  PlaceResponse,
  PlaceUpdate,
  ReportPage,
  ReportResponse,
  ReportStatus,
  SupportCase,
  ReviewPage,
  ReviewResponse,
  UploadImageResponse,
  UserRole,
  UserHistory,
  UserStatus,
  VisitCode,
} from './types';

/** Rows per page in admin tables. The backend caps `limit` at 100. */
export const PAGE_SIZE = 20;

const enc = encodeURIComponent;

export const authApi = {
  login: (input: Credentials) =>
    api.request<AuthTokens>('/api/auth/login', {
      method: 'POST',
      body: { email: input.email.trim().toLowerCase(), password: input.password },
    }),
  logout: (refreshToken: string) => api.request<void>('/api/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => api.request<MeResponse>('/api/auth/me'),
  /** 204; the backend revokes every session afterwards. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.request<void>('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  /** 202 whether or not the account exists; 503 when the server cannot send email. */
  forgotPassword: (email: string) =>
    api.request<void>('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() } }),
  resetPassword: (token: string, newPassword: string) =>
    api.request<void>('/api/auth/reset-password', { method: 'POST', body: { token: token.trim(), newPassword } }),
};

export const notificationsApi = {
  list: (page: number, unread?: boolean) =>
    api.request<NotificationPage>('/api/notifications', {
      query: { page, limit: PAGE_SIZE, unread: unread ? 'true' : undefined },
    }),
  unreadCount: () =>
    api.request<NotificationPage>('/api/notifications', { query: { page: 1, limit: 1, unread: 'true' } }),
  markRead: (id: string) => api.request<unknown>(`/api/notifications/${enc(id)}/read`, { method: 'PATCH' }),
  markAllRead: () => api.request<{ updated: number }>('/api/notifications/read-all', { method: 'POST' }),
};

/** Public endpoints the merchant pages reuse, e.g. to find a place to claim. */
export const publicApi = {
  searchPlaces: (q: string) => api.request<PlacePage>('/api/places', { query: { q, page: 1, limit: 10 } }),
};

export const merchantApi = {
  listPlaces: () => api.request<MerchantPlaceList>('/api/merchant/places'),
  createPlace: (input: MerchantPlaceInput) =>
    api.request<CreatePlaceResponse>('/api/merchant/places', { method: 'POST', body: input }),
  updatePlace: (id: string, changes: MerchantPlaceUpdate) =>
    api.request<PlaceResponse>(`/api/merchant/places/${enc(id)}`, { method: 'PATCH', body: changes }),
  visitCode: (id: string) => api.request<VisitCode>(`/api/merchant/places/${enc(id)}/visit-code`, { method: 'POST' }),
  listBookings: (id: string, page: number, status?: BookingStatus) =>
    api.request<Page<Booking>>(`/api/merchant/places/${enc(id)}/bookings`, { query: { page, limit: PAGE_SIZE, status } }),
  decideBooking: (bookingId: string, action: BookingAction, reason?: string) =>
    api.request<BookingResponse>(`/api/bookings/${enc(bookingId)}/merchant-decision`, {
      method: 'PATCH',
      body: { action, ...(reason ? { reason } : {}) },
    }),
  submitClaim: (input: MerchantClaimInput) =>
    api.request<MerchantClaimResponse>('/api/merchant/claims', { method: 'POST', body: input }),
  listClaims: (page: number) =>
    api.request<Page<MerchantClaim>>('/api/merchant/claims/me', { query: { page, limit: PAGE_SIZE } }),
  submitChange: (id: string, changes: PlaceChangeFields) =>
    api.request<{ change: PlaceChangeRequest }>(`/api/merchant/places/${enc(id)}/change-requests`, {
      method: 'POST',
      body: changes,
    }),
  submitImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.request<{ change: PlaceChangeRequest }>(`/api/merchant/places/${enc(id)}/images`, { method: 'POST', body: form });
  },
  uploadInitialImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.request<{ place: Place; imageUrl: string }>(`/api/merchant/places/${enc(id)}/images`,
      { method: 'POST', body: form });
  },
  listChanges: (page: number) =>
    api.request<Page<PlaceChangeRequest>>('/api/merchant/change-requests/me', { query: { page, limit: PAGE_SIZE } }),
};

export type UserFilter = { page: number; q?: string; role?: UserRole; status?: UserStatus };

export const adminApi = {
  analytics: (from?: string, to?: string) => api.request<Analytics>('/api/admin/analytics', { query: { from, to } }),

  listPlaces: (page: number, approval?: Approval) =>
    api.request<PlacePage>('/api/admin/places', { query: { page, limit: PAGE_SIZE, approval } }),
  updatePlace: (id: string, changes: PlaceUpdate) =>
    api.request<PlaceResponse>(`/api/admin/places/${enc(id)}`, { method: 'PATCH', body: changes }),
  uploadImage: (id: string, file: File, reason: string) => {
    const form = new FormData();
    form.append('image', file);
    form.append('reason', reason);
    return api.request<UploadImageResponse>(`/api/admin/places/${enc(id)}/images`, { method: 'POST', body: form });
  },
  removeImage: (id: string, imageUrl: string, reason: string) =>
    api.request<PlaceResponse>(`/api/admin/places/${enc(id)}/images`, { method: 'DELETE', body: { imageUrl, reason } }),
  transferOwner: (id: string, ownerId: string | null, reason: string) =>
    api.request<PlaceResponse>(`/api/admin/places/${enc(id)}/owner`, { method: 'PATCH', body: { ownerId, reason } }),
  /** Places created by an admin are approved immediately. */
  createPlace: (input: PlaceInput) => api.request<CreatePlaceResponse>('/api/places', { method: 'POST', body: input }),

  listReports: (page: number, status?: ReportStatus) =>
    api.request<ReportPage>('/api/admin/reports', { query: { page, limit: PAGE_SIZE, status } }),
  updateReport: (id: string, status: 'resolved' | 'dismissed', reason?: string) =>
    api.request<ReportResponse>(`/api/admin/reports/${enc(id)}`, {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    }),

  listReviews: (page: number, hidden?: boolean) =>
    api.request<ReviewPage>('/api/admin/reviews', { query: { page, limit: PAGE_SIZE, hidden } }),
  updateReview: (id: string, hidden: boolean, reason?: string) =>
    api.request<ReviewResponse>(`/api/admin/reviews/${enc(id)}`, {
      method: 'PATCH',
      body: { hidden, ...(reason ? { reason } : {}) },
    }),

  listUsers: ({ page, q, role, status }: UserFilter) =>
    api.request<Page<AdminUser>>('/api/admin/users', { query: { page, limit: PAGE_SIZE, q, role, status } }),
  userHistory: (id: string) => api.request<UserHistory>(`/api/admin/users/${enc(id)}/history`),
  updateUserStatus: (id: string, status: 'active' | 'suspended', reason?: string) =>
    api.request<{ user: AdminUser }>(`/api/admin/users/${enc(id)}`, {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    }),
  promoteAdmin: (userId: string, permissions: AdminPermission[]) =>
    api.request<{ user: AdminUser }>('/api/admin/admins', { method: 'POST', body: { userId, permissions } }),
  updateAdminPermissions: (id: string, permissions: AdminPermission[]) =>
    api.request<{ user: AdminUser }>(`/api/admin/admins/${enc(id)}/permissions`, { method: 'PATCH', body: { permissions } }),
  demoteAdmin: (id: string) => api.request<{ user: AdminUser }>(`/api/admin/admins/${enc(id)}`, { method: 'DELETE' }),

  listClaims: (page: number, status?: ClaimStatus) =>
    api.request<Page<MerchantClaim>>('/api/admin/merchant-claims', { query: { page, limit: PAGE_SIZE, status } }),
  decideClaim: (id: string, status: 'approved' | 'rejected', decisionNote: string) =>
    api.request<MerchantClaimResponse>(`/api/admin/merchant-claims/${enc(id)}`, {
      method: 'PATCH',
      body: { status, decisionNote },
    }),

  listPlaceChanges: (page: number, status?: ClaimStatus) =>
    api.request<Page<PlaceChangeRequest>>('/api/admin/place-changes', { query: { page, limit: PAGE_SIZE, status } }),
  decidePlaceChange: (id: string, status: 'approved' | 'rejected', decisionNote: string) =>
    api.request<{ change: PlaceChangeRequest }>(`/api/admin/place-changes/${enc(id)}`, {
      method: 'PATCH',
      body: { status, decisionNote },
    }),

  listBookings: (page: number, status?: BookingStatus, q?: string, date?: string) =>
    api.request<Page<Booking>>('/api/admin/bookings', { query: { page, limit: PAGE_SIZE, status, q, date } }),
  cancelBooking: (id: string, reason: string) =>
    api.request<BookingResponse>(`/api/admin/bookings/${enc(id)}/cancel`, { method: 'POST', body: { reason } }),
  listCases: (kind: SupportCase['kind'], page: number, status?: SupportCase['status']) =>
    api.request<Page<SupportCase>>(kind === 'review_appeal' ? '/api/admin/review-appeals' : '/api/admin/booking-disputes',
      { query: { page, limit: PAGE_SIZE, status } }),
  decideCase: (kind: SupportCase['kind'], id: string, status: 'accepted' | 'rejected', decisionNote: string) =>
    api.request<{ case: SupportCase }>(`${kind === 'review_appeal' ? '/api/admin/review-appeals' : '/api/admin/booking-disputes'}/${enc(id)}`,
      { method: 'PATCH', body: { status, decisionNote } }),

  listFraudFlags: (page: number, status?: FraudStatus) =>
    api.request<Page<FraudFlag>>('/api/admin/fraud-flags', { query: { page, limit: PAGE_SIZE, status } }),
  decideFraudFlag: (id: string, status: 'resolved' | 'dismissed', reason?: string) =>
    api.request<{ flag: FraudFlag }>(`/api/admin/fraud-flags/${enc(id)}`, {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    }),

  listAudit: (page: number) => api.request<Page<AuditEvent>>('/api/admin/audit', { query: { page, limit: PAGE_SIZE } }),
};
