export const queryKeys = {
  me: ['auth', 'me'] as const,
  analytics: ['admin', 'analytics'] as const,
  places: ['admin', 'places'] as const,
  placesPage: (approval: string, page: number) => ['admin', 'places', approval, page] as const,
  reports: ['admin', 'reports'] as const,
  reportsPage: (status: string, page: number) => ['admin', 'reports', status, page] as const,
  reviews: ['admin', 'reviews'] as const,
  reviewsPage: (hidden: string, page: number) => ['admin', 'reviews', hidden, page] as const,

  notifications: ['notifications'] as const,
  notificationsPage: (unread: boolean, page: number) => ['notifications', 'list', unread, page] as const,
  unreadNotifications: ['notifications', 'unread'] as const,

  placeSearch: (q: string) => ['public', 'places', q] as const,

  merchantPlaces: ['merchant', 'places'] as const,
  merchantClaims: ['merchant', 'claims'] as const,
  merchantClaimsPage: (page: number) => ['merchant', 'claims', page] as const,
  merchantChanges: ['merchant', 'changes'] as const,
  merchantChangesPage: (page: number) => ['merchant', 'changes', page] as const,
  merchantBookings: (placeId: string) => ['merchant', 'bookings', placeId] as const,
  merchantBookingsPage: (placeId: string, status: string, page: number) =>
    ['merchant', 'bookings', placeId, status, page] as const,

  users: ['admin', 'users'] as const,
  usersPage: (filter: object) => ['admin', 'users', filter] as const,
  claims: ['admin', 'claims'] as const,
  claimsPage: (status: string, page: number) => ['admin', 'claims', status, page] as const,
  placeChanges: ['admin', 'place-changes'] as const,
  placeChangesPage: (status: string, page: number) => ['admin', 'place-changes', status, page] as const,
  bookings: ['admin', 'bookings'] as const,
  bookingsPage: (status: string, page: number) => ['admin', 'bookings', status, page] as const,
  fraud: ['admin', 'fraud'] as const,
  fraudPage: (status: string, page: number) => ['admin', 'fraud', status, page] as const,
  audit: ['admin', 'audit'] as const,
  auditPage: (page: number) => ['admin', 'audit', page] as const,
};
