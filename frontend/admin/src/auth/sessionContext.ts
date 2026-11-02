import { createContext, useContext } from 'react';

import { NOT_ADMIN_MESSAGE } from '../api/errors';
import type { AuthTokens, User } from '../api/types';

export type SessionStatus = 'loading' | 'signed-out' | 'signed-in';

export type Session = {
  status: SessionStatus;
  user: User | null;
  /** Why the session ended on its own (expired, not an admin), shown on the login page. */
  notice: string | null;
  /** Keeps tokens only for admin accounts. Throws NotAdminError otherwise. */
  signIn(result: AuthTokens): Promise<void>;
  signOut(): Promise<void>;
};

export const SessionContext = createContext<Session | null>(null);

export class NotAdminError extends Error {
  constructor() {
    super(NOT_ADMIN_MESSAGE);
    this.name = 'NotAdminError';
  }
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
