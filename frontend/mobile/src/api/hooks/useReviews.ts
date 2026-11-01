import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '../queryKeys';
import { REVIEWS_PAGE_SIZE, reviewsApi } from '../reviews';
import type { Review, ReviewPage } from '../types';

/** Next page number, or undefined when every review is loaded. */
export function nextReviewPage(last: ReviewPage): number | undefined {
  const page = last.page ?? 1;
  const limit = last.limit ?? REVIEWS_PAGE_SIZE;
  const total = last.total ?? 0;
  return page * limit < total ? page + 1 : undefined;
}

/** Public, paged `GET /api/places/{id}/reviews`, loaded page by page. */
export function useReviews(placeId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.reviews(placeId ?? ''),
    queryFn: ({ pageParam }) => reviewsApi.list(placeId as string, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextReviewPage,
    enabled: Boolean(placeId),
  });
  const items: Review[] = query.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  return { ...query, items, total };
}

/** The user's id on a review, whether `user` is populated or only an id. */
export function reviewUserId(review: Review): string | undefined {
  return typeof review.user === 'string' ? review.user : review.user?._id;
}
