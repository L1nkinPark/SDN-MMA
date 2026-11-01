import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { authApi } from '../auth';
import { queryKeys } from '../queryKeys';

/** `GET /api/auth/me`, shared with the session. Only runs when signed in. */
export function useMe() {
  const { status } = useSession();
  return useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, enabled: status === 'signed-in' });
}
