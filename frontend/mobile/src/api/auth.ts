import { api } from './client';
import type {
  AuthTokens,
  ChangePasswordInput,
  Credentials,
  DataExport,
  DeleteAccountInput,
  MeResponse,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
} from './types';

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

  /** Name and notification settings. Answers `{ user }`. */
  updateMe: (input: UpdateMeInput) => api.request<MeResponse>('/api/auth/me', { method: 'PATCH', body: input }),
  /** 204; every session, this one included, is revoked afterwards. */
  changePassword: (input: ChangePasswordInput) =>
    api.request<void>('/api/auth/change-password', { method: 'POST', body: input }),
  requestEmailChange: (email: string, currentPassword: string) =>
    api.request<void>('/api/auth/change-email', { method: 'POST',
      body: { email: normalizeEmail(email), currentPassword } }),
  confirmEmailChange: (token: string) =>
    api.request<void>('/api/auth/confirm-email', { method: 'POST', body: { token: token.trim() } }),
  /** 202 whether or not the account exists; 503 when the server cannot send email. */
  forgotPassword: (email: string) =>
    api.request<void>('/api/auth/forgot-password', { method: 'POST', body: { email: normalizeEmail(email) } }),
  /** 204; the token is the code from the email. */
  resetPassword: (input: ResetPasswordInput) =>
    api.request<void>('/api/auth/reset-password', {
      method: 'POST',
      body: { token: input.token.trim(), newPassword: input.newPassword },
    }),
  exportData: () => api.request<DataExport>('/api/auth/me/export'),
  /** 204; personal history is deleted and the account disabled. */
  deleteAccount: (input: DeleteAccountInput) => api.request<void>('/api/auth/me', { method: 'DELETE', body: input }),
};
