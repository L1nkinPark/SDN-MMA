import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '../api/client';
import { authApi } from '../api/endpoints';
import { ACCOUNT_UNAVAILABLE_MESSAGE, isApiError, SESSION_EXPIRED_MESSAGE } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import type { AuthTokens, User } from '../api/types';
import { SessionContext, type Session, type SessionStatus } from './sessionContext';

async function revoke(refreshToken: string | null | undefined) {
  if (!refreshToken) return;
  try {
    await authApi.logout(refreshToken);
  } catch {
    // Local sign-out still happens.
  }
}

/**
 * Web session for admins, merchants and students. Students sign in here to apply as a merchant;
 * once an admin approves them their role becomes `merchant`, which the focus refresh below picks up.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>(() => (api.tokens.getRefreshToken() ? 'loading' : 'signed-out'));
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const endSession = useCallback(
    (message: string | null) => {
      api.tokens.clear();
      queryClient.clear();
      setUser(null);
      setNotice(message);
      setStatus('signed-out');
    },
    [queryClient],
  );

  useEffect(() => {
    api.setAuthLostHandler((reason) =>
      endSession(reason === 'unavailable' ? ACCOUNT_UNAVAILABLE_MESSAGE : SESSION_EXPIRED_MESSAGE),
    );
    return () => api.setAuthLostHandler(null);
  }, [endSession]);

  // Restore a saved session once at startup.
  useEffect(() => {
    if (status !== 'loading') return;
    let active = true;
    authApi
      .me()
      .then(({ user: me }) => {
        if (!active) return;
        if (!me) {
          endSession(null);
          return;
        }
        queryClient.setQueryData(queryKeys.me, { user: me });
        setUser(me);
        setStatus('signed-in');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isApiError(error) && error.kind === 'network') {
          // Keep the refresh token; the login page explains the connection problem.
          setNotice(error.message);
          setStatus('signed-out');
          return;
        }
        // The client already ended the session with its own notice.
        if (isApiError(error) && error.is(403, 'Account unavailable')) return;
        endSession(isApiError(error) && error.status === 401 ? SESSION_EXPIRED_MESSAGE : null);
      });
    return () => {
      active = false;
    };
  }, [status, endSession, queryClient]);

  // Role and permissions can change on the server (claim approved, permissions edited): reload on focus.
  useEffect(() => {
    if (status !== 'signed-in') return;
    const reload = () => {
      if (document.visibilityState !== 'visible') return;
      authApi
        .me()
        .then(({ user: me }) => {
          if (me) setUser(me);
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', reload);
    return () => document.removeEventListener('visibilitychange', reload);
  }, [status]);

  const signIn = useCallback(
    async (result: AuthTokens) => {
      if (!result.accessToken || !result.refreshToken || !result.user) throw new Error('Missing tokens');
      api.tokens.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      queryClient.setQueryData(queryKeys.me, { user: result.user });
      setUser(result.user);
      setNotice(null);
      setStatus('signed-in');
    },
    [queryClient],
  );

  const signOut = useCallback(
    async (message?: string) => {
      await revoke(api.tokens.getRefreshToken());
      endSession(message ?? null);
    },
    [endSession],
  );

  const value = useMemo<Session>(() => ({ status, user, notice, signIn, signOut }), [status, user, notice, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
