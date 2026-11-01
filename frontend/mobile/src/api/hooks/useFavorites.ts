import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { favoritesApi } from '../favorites';
import { queryKeys } from '../queryKeys';
import type { FavoritesResponse, MeResponse } from '../types';

/** `GET /api/favorites`: `{ items }` with no pagination. Only runs when signed in. */
export function useFavorites() {
  const { status } = useSession();
  return useQuery({ queryKey: queryKeys.favorites, queryFn: favoritesApi.list, enabled: status === 'signed-in' });
}

/** Keeps `user.favorites` in the me cache in step with a change. */
function updateMeFavorites(previous: MeResponse | undefined, placeId: string, saved: boolean): MeResponse | undefined {
  if (!previous?.user) return previous;
  const current = previous.user.favorites ?? [];
  const favorites = saved ? Array.from(new Set([...current, placeId])) : current.filter((id) => id !== placeId);
  return { ...previous, user: { ...previous.user, favorites } };
}

/** `DELETE /api/favorites/{placeId}` (204), then drops the place from the cached list. */
export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: favoritesApi.remove,
    onSuccess: (_, placeId) => {
      queryClient.setQueryData<FavoritesResponse>(queryKeys.favorites, (previous) =>
        previous ? { ...previous, items: (previous.items ?? []).filter((place) => place._id !== placeId) } : previous,
      );
      queryClient.setQueryData<MeResponse>(queryKeys.me, (previous) => updateMeFavorites(previous, placeId, false));
    },
  });
}

/** `PUT /api/favorites/{placeId}`, then refreshes the list and the user's favorites. */
export function useAddFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: favoritesApi.add,
    onSuccess: (result, placeId) => {
      if (result?.user) queryClient.setQueryData<MeResponse>(queryKeys.me, { user: result.user });
      else queryClient.setQueryData<MeResponse>(queryKeys.me, (previous) => updateMeFavorites(previous, placeId, true));
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });
}
