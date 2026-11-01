import { api } from './client';
import type { LeaderboardResponse } from './types';

/** Backend default size of the leaderboard. */
export const LEADERBOARD_LIMIT = 20;

export const reputationApi = {
  leaderboard: (limit = LEADERBOARD_LIMIT) =>
    api.request<LeaderboardResponse>('/api/reputation/leaderboard', { query: { limit } }),
};
