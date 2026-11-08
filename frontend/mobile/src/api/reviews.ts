import { api } from './client';
import type { Review, ReviewInput, ReviewPage, ReviewResponse } from './types';

/** Reviews per page when scrolling the list. */
export const REVIEWS_PAGE_SIZE = 20;

const path = (placeId: string) => `/api/places/${encodeURIComponent(placeId)}/reviews`;

export const reviewsApi = {
  list: (placeId: string, page: number, limit = REVIEWS_PAGE_SIZE) =>
    api.request<ReviewPage>(path(placeId), { query: { page, limit } }),
  upsertMine: (placeId: string, input: ReviewInput) =>
    api.request<ReviewResponse>(`${path(placeId)}/me`, { method: 'PUT', body: input }),
  deleteMine: (placeId: string) => api.request<void>(`${path(placeId)}/me`, { method: 'DELETE' }),
};

/**
 * Label for a review whose author has a recent proof of visit, or null when there is none.
 * `verifiedVisit` is populated with `method` on the public list; a bare ID still means verified.
 */
export function verifiedVisitLabel(review: Pick<Review, 'verifiedVisit'>): string | null {
  const proof = review.verifiedVisit;
  if (!proof) return null;
  if (typeof proof === 'object' && proof.method === 'staff_booking') return 'Đã xác minh: nhân viên quán xác nhận khách đến';
  return 'Đã xác minh: quét mã QR tại quán';
}
