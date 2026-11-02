import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '@/auth/session';

import { queryKeys } from '../queryKeys';
import { reviewsApi } from '../reviews';
import type { Review, ReviewInput } from '../types';
import { reviewUserId, useReviews } from './useReviews';

/** Pages searched for the user's review before treating it as new (20 reviews per page). */
const MAX_PAGES = 10;

/**
 * Finds the signed-in user's review in the public list, because the API has no endpoint for it.
 * Hidden reviews are not listed; saving one returns 403 instead.
 */
export function useMyReview(placeId: string | undefined) {
  const { user } = useSession();
  const reviews = useReviews(placeId);
  const mine: Review | undefined = user?.id ? reviews.items.find((review) => reviewUserId(review) === user.id) : undefined;
  const pagesLoaded = reviews.data?.pages.length ?? 0;
  const keepLooking = !mine && reviews.hasNextPage && pagesLoaded < MAX_PAGES && !reviews.isFetchNextPageError;

  useEffect(() => {
    if (keepLooking && !reviews.isFetchingNextPage) reviews.fetchNextPage();
  }, [keepLooking, reviews]);

  return {
    review: mine,
    isSearching: reviews.isPending || (keepLooking && !reviews.isError),
    error: reviews.isError && !reviews.data ? reviews.error : null,
    retry: reviews.refetch,
  };
}

/** Invalidates everything a review change touches: the place (rating), its reviews and the user's points. */
function useInvalidateReviewData(placeId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.place(placeId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews(placeId) }),
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
