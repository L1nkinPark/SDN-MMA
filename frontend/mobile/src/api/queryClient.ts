import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './errors';

/** Don't retry client errors (4xx); they won't change. Retry network and server errors twice. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status !== null && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
