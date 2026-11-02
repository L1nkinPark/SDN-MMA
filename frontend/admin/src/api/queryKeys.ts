export const queryKeys = {
  me: ['auth', 'me'] as const,
  analytics: ['admin', 'analytics'] as const,
  places: ['admin', 'places'] as const,
  placesPage: (approval: string, page: number) => ['admin', 'places', approval, page] as const,
  reports: ['admin', 'reports'] as const,
  reportsPage: (status: string, page: number) => ['admin', 'reports', status, page] as const,
  reviews: ['admin', 'reviews'] as const,
  reviewsPage: (hidden: string, page: number) => ['admin', 'reviews', hidden, page] as const,
};
