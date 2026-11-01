import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'studyspot.accessToken';
const REFRESH_KEY = 'studyspot.refreshToken';

export type Tokens = { accessToken: string; refreshToken: string };

/** Storage the API client needs. The app uses `secureTokenStore`; tests pass an in-memory one. */
export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Tokens in expo-secure-store, with an in-memory copy so each request
 * doesn't read the keystore.
 */
function createSecureTokenStore(): TokenStore {
  let cache: { access: string | null; refresh: string | null } | null = null;

  async function load() {
    if (!cache) {
      const [access, refresh] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      cache = { access, refresh };
    }
    return cache;
  }

  return {
    async getAccessToken() {
      return (await load()).access;
    },
    async getRefreshToken() {
      return (await load()).refresh;
    },
    async setTokens({ accessToken, refreshToken }) {
      cache = { access: accessToken, refresh: refreshToken };
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_KEY, accessToken),
        SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
      ]);
    },
    async clear() {
      cache = { access: null, refresh: null };
      await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
    },
  };
}

export const secureTokenStore = createSecureTokenStore();

/** In-memory store for tests. */
export function createMemoryTokenStore(initial?: Partial<Tokens>): TokenStore {
  let access = initial?.accessToken ?? null;
  let refresh = initial?.refreshToken ?? null;
  return {
    getAccessToken: async () => access,
    getRefreshToken: async () => refresh,
    setTokens: async (tokens) => {
      access = tokens.accessToken;
      refresh = tokens.refreshToken;
    },
    clear: async () => {
      access = null;
      refresh = null;
    },
  };
}
