import { api } from './client';
import type { AuthTokens, Credentials, MeResponse, RegisterInput } from './types';

/** Lowercases and trims the email, as the backend expects. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const authApi = {
  login: (input: Credentials) =>
    api.request<AuthTokens>('/api/auth/login', {
      method: 'POST',
      body: { email: normalizeEmail(input.email), password: input.password },
    }),
  register: (input: RegisterInput & { name: string }) =>
    api.request<AuthTokens>('/api/auth/register', {
      method: 'POST',
      body: { name: input.name.trim(), email: normalizeEmail(input.email), password: input.password },
    }),
  logout: (refreshToken: string) =>
    api.request<void>('/api/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => api.request<MeResponse>('/api/auth/me'),
};
