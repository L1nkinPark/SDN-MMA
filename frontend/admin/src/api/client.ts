import { createBrowserTokenStore, type TokenStore } from '../auth/tokens';
import { ApiError } from './errors';
import type { AuthTokens } from './types';

/** Auth endpoints that must never trigger a refresh. A 401 there is a real answer (e.g. wrong password). */
const NO_REFRESH_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']);

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body, or FormData for file uploads. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

export type AuthLostReason = 'expired' | 'unavailable';

type RefreshResult = 'ok' | 'rejected' | 'network';

export type ApiClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  /** Called after a refresh fails for auth reasons and tokens were cleared. */
  /** `unavailable`: the account was suspended or deleted; `expired`: the refresh token no longer works. */
  setAuthLostHandler(handler: ((reason: AuthLostReason) => void) | null): void;
  tokens: TokenStore;
};

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
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
  if ((response.headers.get('content-type') ?? '').includes('application/json')) {
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

export function createApiClient(options: { baseUrl: string; tokens: TokenStore; fetch?: typeof fetch }): ApiClient {
  const { baseUrl, tokens } = options;
  const fetchImpl = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  let refreshing: Promise<RefreshResult> | null = null;
  let onAuthLost: ((reason: AuthLostReason) => void) | null = null;

  async function send(path: string, request: RequestOptions, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const isForm = typeof FormData !== 'undefined' && request.body instanceof FormData;
    // The browser sets the multipart boundary itself, so FormData gets no Content-Type.
    if (request.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await fetchImpl(buildUrl(baseUrl, path, request.query), {
        method: request.method ?? 'GET',
        headers,
        body: request.body === undefined ? undefined : isForm ? (request.body as FormData) : JSON.stringify(request.body),
        signal: request.signal,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw ApiError.network();
    }
  }

  async function doRefresh(): Promise<RefreshResult> {
    const refreshToken = tokens.getRefreshToken();
    if (!refreshToken) return 'rejected';
    let response: Response;
    try {
      response = await send('/api/auth/refresh', { method: 'POST', body: { refreshToken } }, null);
    } catch {
      return 'network'; // Not a logout: keep the tokens.
    }
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) return 'network';
      const unavailable = (await toError(response)).is(403, 'Account unavailable');
      tokens.clear();
      onAuthLost?.(unavailable ? 'unavailable' : 'expired');
      return 'rejected';
    }
    const body = (await readBody(response)) as AuthTokens | undefined;
    if (!body?.accessToken || !body.refreshToken) {
      tokens.clear();
      onAuthLost?.('expired');
      return 'rejected';
    }
    tokens.setTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    return 'ok';
  }

  /** One refresh at a time; concurrent callers share the result. */
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

  async function request<T>(path: string, req: RequestOptions = {}): Promise<T> {
    const canRefresh = !NO_REFRESH_PATHS.has(path);
    if (refreshing) await refreshing;
    // After a reload only the refresh token survives; get an access token before the first call.
    if (canRefresh && !tokens.getAccessToken() && tokens.getRefreshToken()) {
      const result = await refreshOnce();
      if (result === 'network') throw ApiError.network();
    }
    const usedToken = tokens.getAccessToken();
    let response = await send(path, req, usedToken);

    if (response.status === 401 && canRefresh && tokens.getRefreshToken()) {
      const current = tokens.getAccessToken();
      const result: RefreshResult = current && current !== usedToken ? 'ok' : await refreshOnce();
      if (result === 'network') throw ApiError.network();
      if (result === 'rejected') throw await toError(response);
      response = await send(path, req, tokens.getAccessToken());
    }

    if (!response.ok) {
      const error = await toError(response);
      // A suspended or deleted account gets 403 on every call: the session is over.
      if (canRefresh && error.is(403, 'Account unavailable')) {
        tokens.clear();
        onAuthLost?.('unavailable');
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
  };
}

/** Base URL without `/api`; the OpenAPI paths already include it. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = createApiClient({ baseUrl: API_URL, tokens: createBrowserTokenStore() });
