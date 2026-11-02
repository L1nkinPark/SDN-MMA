import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../queryKeys';
import { reputationApi } from '../reputation';

/** Public `GET /api/reputation/leaderboard`: `{ items }` of `_id`, `name`, `reputation`. */
export function useLeaderboard() {
  return useQuery({ queryKey: queryKeys.leaderboard, queryFn: () => reputationApi.leaderboard() });
}
