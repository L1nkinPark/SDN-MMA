import { api } from './client';
import type { FavoritesResponse, User } from './types';

export const favoritesApi = {
  list: () => api.request<FavoritesResponse>('/api/favorites'),
  add: (placeId: string) =>
    api.request<{ user?: User }>(`/api/favorites/${encodeURIComponent(placeId)}`, { method: 'PUT' }),
  remove: (placeId: string) => api.request<void>(`/api/favorites/${encodeURIComponent(placeId)}`, { method: 'DELETE' }),
};
