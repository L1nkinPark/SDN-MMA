import { api } from './client';

export type SupportCase = {
  _id: string;
  kind: 'review_appeal' | 'booking_dispute';
  targetId: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  decisionNote?: string | null;
  createdAt: string;
};

export const casesApi = {
  create: (kind: SupportCase['kind'], targetId: string, reason: string) =>
    api.request<{ case: SupportCase }>('/api/cases', { method: 'POST', body: { kind, targetId, reason } }),
  mine: () => api.request<{ items: SupportCase[]; total: number }>('/api/cases/me', { query: { page: 1, limit: 100 } }),
};
