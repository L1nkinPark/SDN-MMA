import { api } from './client';
import type { CreatePlaceResponse, PlaceInput, PlaceResponse } from './types';

export const placesApi = {
  get: (id: string) => api.request<PlaceResponse>(`/api/places/${encodeURIComponent(id)}`),
  create: (input: PlaceInput) => api.request<CreatePlaceResponse>('/api/places', { method: 'POST', body: input }),
};
