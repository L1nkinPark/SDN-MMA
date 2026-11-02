import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authApi } from '@/api/auth';
import { api } from '@/api/client';
import { isApiError } from '@/api/errors';
import { queryKeys, userScopedKeys } from '@/api/queryKeys';
import type { AuthTokens, MeResponse, User } from '@/api/types';

export type SessionStatus = 'loading' | 'guest' | 'signed-in';

export type Session = {
  /** The signed-in user, or null for guests and while `/api/auth/me` hasn't answered (e.g. offline). */
  user: User | null;
  status: SessionStatus;
  /** Saves tokens from login, register or refresh and marks the session signed in. */
  signIn(result: AuthTokens): Promise<void>;
  /** Calls logout on the server, then always clears local tokens. */
  signOut(): Promise<void>;
  /** True when signed in. Otherwise opens login and returns false. */
  requireAuth(): boolean;
};

const SessionContext = createContext<Session | null>(null);

type TokenState = 'loading' | 'present' | 'absent';

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tokenState, setTokenState] = useState<TokenState>('loading');

  // Load saved tokens once at startup.
  useEffect(() => {
    let active = true;
    Promise.all([api.tokens.getAccessToken(), api.tokens.getRefreshToken()])
      .then(([access, refresh]) => {
        if (active) setTokenState(access || refresh ? 'present' : 'absent');
      })
      .catch(() => {
        if (active) setTokenState('absent');
      });
    return () => {
      active = false;
    };
  }, []);

  const dropUserData = useCallback(() => {
    for (const key of userScopedKeys) queryClient.removeQueries({ queryKey: key });
  }, [queryClient]);

  // The API client tells us when a refresh failed (tokens already cleared) or succeeded.
  useEffect(() => {
    api.setAuthLostHandler(() => {
      setTokenState('absent');
      dropUserData();
    });
    api.setTokensRefreshedHandler((result) => {
      if (result.user) queryClient.setQueryData<MeResponse>(queryKeys.me, { user: result.user });
    });
    return () => {
      api.setAuthLostHandler(null);
      api.setTokensRefreshedHandler(null);
    };
  }, [dropUserData, queryClient]);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled: tokenState === 'present',
    staleTime: 0,
  });

  // A 401 after the refresh attempt means the saved session is gone.
  useEffect(() => {
    if (tokenState === 'present' && isApiError(me.error) && me.error.status === 401) {
      api.tokens.clear().finally(() => setTokenState('absent'));
    }
  }, [me.error, tokenState]);

  const status: SessionStatus =
    tokenState === 'loading'
      ? 'loading'
      : tokenState === 'absent'
        ? 'guest'
        : me.data?.user
          ? 'signed-in'
          : me.isPending && me.fetchStatus === 'fetching'
            ? 'loading'
            : 'signed-in';

  const signIn = useCallback(
    async (result: AuthTokens) => {
      if (!result.accessToken || !result.refreshToken) throw new Error('Missing tokens');
      await api.tokens.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      if (result.user) queryClient.setQueryData<MeResponse>(queryKeys.me, { user: result.user });
      setTokenState('present');
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await api.tokens.getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Sign out locally even if the server can't be reached.
    } finally {
      await api.tokens.clear();
      setTokenState('absent');
      dropUserData();
    }
  }, [dropUserData]);

  const requireAuth = useCallback(() => {
    if (tokenState === 'present') return true;
    router.push('/login');
    return false;
  }, [tokenState]);

  const value = useMemo<Session>(
    () => ({ user: me.data?.user ?? null, status, signIn, signOut, requireAuth }),
    [me.data, status, signIn, signOut, requireAuth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
