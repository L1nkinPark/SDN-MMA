import { createContext, useContext } from 'react';

import type { AuthTokens, User } from '../api/types';

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in';

export type Session = {
  status: SessionStatus;
  user: User | null;
  /** Why the session ended (expired, suspended, password changed), shown on the login page. */
  notice: string | null;
  /** Keeps the tokens of any active account; the role decides which area the user sees. */
  signIn(result: AuthTokens): Promise<void>;
  /** Revokes the refresh token, then shows `notice` on the login page if given. */
  signOut(notice?: string): Promise<void>;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
