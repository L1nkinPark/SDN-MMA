/** All TanStack Query keys in one place so invalidation stays consistent. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  favorites: ['favorites'] as const,
  leaderboard: ['leaderboard'] as const,
  myReports: ['reports', 'me'] as const,
  places: ['places'] as const,
  place: (id: string) => ['places', id] as const,
  reviews: (placeId: string) => ['places', placeId, 'reviews'] as const,
};

/** Queries that belong to the signed-in user and must be dropped on sign-out. */
export const userScopedKeys = [queryKeys.me, queryKeys.favorites, queryKeys.myReports];
