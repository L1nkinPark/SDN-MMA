import { secureTokenStore, type TokenStore } from '@/auth/tokens';

import { ApiError } from './errors';
import type { AuthTokens } from './types';

/** Auth endpoints that must never trigger a refresh. A 401 there is a real answer (e.g. wrong password). */
const NO_REFRESH_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']);

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

export type ApiClientOptions = {
  baseUrl: string;
  tokens: TokenStore;
  fetch?: typeof fetch;
};

type RefreshResult = 'ok' | 'rejected' | 'network';

export type ApiClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  /** Called after a refresh fails for auth reasons and tokens were cleared. */
  setAuthLostHandler(handler: (() => void) | null): void;
  /** Called after a refresh succeeded, with the user from the refresh response. */
  setTokensRefreshedHandler(handler: ((result: AuthTokens) => void) | null): void;
  tokens: TokenStore;
};

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const base = baseUrl.replace(/\/+$/, '');
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${base}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

/** Reads a body without assuming JSON: 204 has none and the auth rate limiter answers in plain text. */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function serverMessageOf(body: unknown): string | null {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error;
  return null;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createApiClient({ baseUrl, tokens, fetch: fetchImpl = fetch }: ApiClientOptions): ApiClient {
  let refreshing: Promise<RefreshResult> | null = null;
  let onAuthLost: (() => void) | null = null;
  let onRefreshed: ((result: AuthTokens) => void) | null = null;

  async function send(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await fetchImpl(buildUrl(baseUrl, path, options.query), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw ApiError.network();
    }
  }

  async function doRefresh(): Promise<RefreshResult> {
    const refreshToken = await tokens.getRefreshToken();
    if (!refreshToken) return 'rejected';
    let response: Response;
    try {
      response = await send('/api/auth/refresh', { method: 'POST', body: { refreshToken } }, null);
    } catch {
      // A network failure is not a logout: keep the tokens.
      return 'network';
    }
    if (!response.ok) {
      // 429 or 5xx: the refresh token may still be valid, so keep it and let the caller retry later.
      if (response.status === 429 || response.status >= 500) return 'network';
      await tokens.clear();
      onAuthLost?.();
      return 'rejected';
    }
    const body = (await readBody(response)) as AuthTokens | undefined;
    if (!body?.accessToken || !body.refreshToken) {
      await tokens.clear();
      onAuthLost?.();
      return 'rejected';
    }
    await tokens.setTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    onRefreshed?.(body);
    return 'ok';
  }

  /** Runs one refresh at a time; concurrent callers share the same result. */
  function refreshOnce(): Promise<RefreshResult> {
    if (!refreshing) {
      refreshing = doRefresh().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function toError(response: Response): Promise<ApiError> {
    return new ApiError(response.status, serverMessageOf(await readBody(response)));
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    // Wait for a refresh in progress so this request doesn't use a token that is being replaced.
    if (refreshing) await refreshing;
    const usedToken = await tokens.getAccessToken();
    let response = await send(path, options, usedToken);

    if (response.status === 401 && !NO_REFRESH_PATHS.has(path)) {
      const currentToken = await tokens.getAccessToken();
      // Another request may have refreshed already; then just retry with the new token.
      const result: RefreshResult =
        currentToken && currentToken !== usedToken ? 'ok' : await refreshOnce();
      if (result === 'network') throw ApiError.network();
      if (result === 'rejected') throw await toError(response);
      response = await send(path, options, await tokens.getAccessToken());
    }

    if (!response.ok) {
      const error = await toError(response);
      // A suspended or deleted account gets 403 on every call: the session is over.
      if (error.is(403, 'Account unavailable') && !NO_REFRESH_PATHS.has(path)) {
        await tokens.clear();
        onAuthLost?.();
      }
      throw error;
    }
    return (await readBody(response)) as T;
  }

  return {
    request,
    tokens,
    setAuthLostHandler(handler) {
      onAuthLost = handler;
    },
    setTokensRefreshedHandler(handler) {
      onRefreshed = handler;
    },
  };
}

/** Base URL without `/api`; the OpenAPI paths already include it. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

/** The app's single API client. Screens use the hooks in src/api, never fetch. */
export const api = createApiClient({ baseUrl: API_URL, tokens: secureTokenStore });
