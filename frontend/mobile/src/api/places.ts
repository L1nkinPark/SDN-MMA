import { api } from './client';
import type {
  CheckinInput,
  CheckinResponse,
  CreatePlaceResponse,
  PlaceInput,
  PlaceListQuery,
  PlacePage,
  PlaceResponse,
} from './types';

export const placesApi = {
  list: (query: PlaceListQuery) => api.request<PlacePage>('/api/places', { query }),
  get: (id: string) => api.request<PlaceResponse>(`/api/places/${encodeURIComponent(id)}`),
  create: (input: PlaceInput) => api.request<CreatePlaceResponse>('/api/places', { method: 'POST', body: input }),
  checkin: (id: string, input: CheckinInput) =>
    api.request<CheckinResponse>(`/api/places/${encodeURIComponent(id)}/checkins`, { method: 'POST', body: input }),
};
