import { api } from './client';
import type {
  Analytics,
  Approval,
  AuthTokens,
  CreatePlaceResponse,
  Credentials,
  MeResponse,
  PlaceInput,
  PlacePage,
  PlaceResponse,
  PlaceUpdate,
  ReportPage,
  ReportResponse,
  ReportStatus,
  ReviewPage,
  ReviewResponse,
  UploadImageResponse,
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
};

export const adminApi = {
  analytics: () => api.request<Analytics>('/api/admin/analytics'),

  listPlaces: (page: number, approval?: Approval) =>
    api.request<PlacePage>('/api/admin/places', { query: { page, limit: PAGE_SIZE, approval } }),
  updatePlace: (id: string, changes: PlaceUpdate) =>
    api.request<PlaceResponse>(`/api/admin/places/${enc(id)}`, { method: 'PATCH', body: changes }),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.request<UploadImageResponse>(`/api/admin/places/${enc(id)}/images`, { method: 'POST', body: form });
  },
  /** Places created by an admin are approved immediately. */
  createPlace: (input: PlaceInput) => api.request<CreatePlaceResponse>('/api/places', { method: 'POST', body: input }),

  listReports: (page: number, status?: ReportStatus) =>
    api.request<ReportPage>('/api/admin/reports', { query: { page, limit: PAGE_SIZE, status } }),
  updateReport: (id: string, status: 'resolved' | 'dismissed') =>
    api.request<ReportResponse>(`/api/admin/reports/${enc(id)}`, { method: 'PATCH', body: { status } }),

  listReviews: (page: number, hidden?: boolean) =>
    api.request<ReviewPage>('/api/admin/reviews', { query: { page, limit: PAGE_SIZE, hidden } }),
  updateReview: (id: string, hidden: boolean) =>
    api.request<ReviewResponse>(`/api/admin/reviews/${enc(id)}`, { method: 'PATCH', body: { hidden } }),
};
