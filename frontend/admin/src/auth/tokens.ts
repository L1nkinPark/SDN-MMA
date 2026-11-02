export type Tokens = { accessToken: string; refreshToken: string };

export interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(tokens: Tokens): void;
  clear(): void;
}

const REFRESH_KEY = 'studyspot.admin.refreshToken';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private window): the session still works until the tab closes.
  }
}

/**
 * The access token stays in memory only. The refresh token is kept in localStorage so a reload
 * keeps the admin signed in; it rotates on every use and logout revokes it on the server.
 */
export function createBrowserTokenStore(): TokenStore {
  let access: string | null = null;
  return {
    getAccessToken: () => access,
    getRefreshToken: () => readStorage(REFRESH_KEY),
    setTokens: ({ accessToken, refreshToken }) => {
      access = accessToken;
      writeStorage(REFRESH_KEY, refreshToken);
    },
    clear: () => {
      access = null;
      writeStorage(REFRESH_KEY, null);
    },
  };
}

export function createMemoryTokenStore(initial?: Partial<Tokens>): TokenStore {
  let access = initial?.accessToken ?? null;
  let refresh = initial?.refreshToken ?? null;
  return {
    getAccessToken: () => access,
    getRefreshToken: () => refresh,
    setTokens: (tokens) => {
      access = tokens.accessToken;
      refresh = tokens.refreshToken;
    },
    clear: () => {
      access = null;
      refresh = null;
    },
  };
}
