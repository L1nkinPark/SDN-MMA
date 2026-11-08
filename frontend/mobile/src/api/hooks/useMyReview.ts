import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../queryKeys';
import { reviewsApi } from '../reviews';
import type { ReviewInput } from '../types';

/**
 * The private endpoint includes hidden reviews, so users can see moderation and appeal it.
 */
export function useMyReview(placeId: string | undefined) {
  const query = useQuery({ queryKey: queryKeys.myReview(placeId ?? ''),
    queryFn: () => reviewsApi.mine(placeId as string), enabled: Boolean(placeId) });

  return {
    review: query.data?.review ?? undefined,
    isSearching: query.isPending,
    error: query.isError ? query.error : null,
    retry: query.refetch,
  };
}

/** Invalidates everything a review change touches: the place (rating), its reviews and the user's points. */
function useInvalidateReviewData(placeId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.place(placeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews(placeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myReview(placeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.me }),
      queryClient.invalidateQueries({ queryKey: queryKeys.places }),
    ]);
}

/** `PUT /api/places/{id}/reviews/me` creates or updates the user's review. */
export function useSaveReview(placeId: string) {
  const invalidate = useInvalidateReviewData(placeId);
  return useMutation({
    mutationFn: (input: ReviewInput) => reviewsApi.upsertMine(placeId, input),
    onSuccess: invalidate,
  });
}

/** `DELETE /api/places/{id}/reviews/me` removes the user's review (204). */
export function useDeleteReview(placeId: string) {
  const invalidate = useInvalidateReviewData(placeId);
  return useMutation({
    mutationFn: () => reviewsApi.deleteMine(placeId),
    onSuccess: invalidate,
  });
}
