import { api } from './client';
import type { ReviewInput, ReviewPage, ReviewResponse } from './types';

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
