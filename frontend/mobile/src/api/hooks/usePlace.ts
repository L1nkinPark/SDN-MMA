import { useQuery } from '@tanstack/react-query';

import { placesApi } from '../places';
import { queryKeys } from '../queryKeys';

/** Public `GET /api/places/{id}`. Returns `{ place }`; 404 when missing or not approved. */
export function usePlace(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.place(id ?? ''),
    queryFn: () => placesApi.get(id as string),
    enabled: Boolean(id),
  });
}
