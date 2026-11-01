import { useInfiniteQuery } from '@tanstack/react-query';

import { placesApi } from '../places';
import { queryKeys } from '../queryKeys';
import type { Place, PlaceListQuery, PlacePage } from '../types';

/** Places per page on Khám phá. The map shows every loaded page. */
export const PLACES_PAGE_SIZE = 50;

export function nextPlacePage(last: PlacePage): number | undefined {
  const page = last.page ?? 1;
  const limit = last.limit ?? PLACES_PAGE_SIZE;
  return page * limit < (last.total ?? 0) ? page + 1 : undefined;
}

/**
 * Public `GET /api/places`, loaded page by page. With `lat` and `lng` the API sorts by distance,
 * otherwise by newest. `enabled` lets the screen wait for the first location answer.
 */
export function usePlaces(query: Omit<PlaceListQuery, 'page' | 'limit'>, enabled = true) {
  const result = useInfiniteQuery({
    queryKey: queryKeys.placeList(query),
    queryFn: ({ pageParam }) => placesApi.list({ ...query, page: pageParam, limit: PLACES_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPlacePage,
    enabled,
  });
  const items: Place[] = result.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const total = result.data?.pages[0]?.total ?? 0;
  return { ...result, items, total };
}
