import { createMemoryTokenStore } from '@/auth/tokens';

import { createApiClient } from '../client';
import { ApiError, NETWORK_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from '../errors';

const BASE = 'http://api.test';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}

function setup(handler: Handler, tokens = { accessToken: 'old-access', refreshToken: 'old-refresh' }) {
  const store = createMemoryTokenStore(tokens);
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  });
  const client = createApiClient({ baseUrl: BASE, tokens: store, fetch: fetchMock as unknown as typeof fetch });
  const onAuthLost = jest.fn();
  client.setAuthLostHandler(onAuthLost);
  return { client, store, calls, onAuthLost };
}

const refreshCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.endsWith('/api/auth/refresh'));

describe('api client', () => {
  it('attaches the bearer token and builds the query string', async () => {
    const { client, calls } = setup(() => json(200, { items: [] }));
    await client.request('/api/places', { query: { page: 2, q: 'thư viện', lat: undefined } });
    expect(calls[0].url).toBe(`${BASE}/api/places?page=2&q=th%C6%B0%20vi%E1%BB%87n`);
    expect(authHeader(calls[0].init)).toBe('Bearer old-access');
  });

  it('refreshes on 401, stores both new tokens and retries once', async () => {
    const { client, store, calls } = setup((url, init) => {
      if (url.endsWith('/api/auth/refresh')) {
        expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'old-refresh' });
        return json(200, { user: { id: 'u1' }, accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      return authHeader(init) === 'Bearer new-access' ? json(200, { items: [1] }) : json(401, { error: 'Invalid token' });
    });
    await expect(client.request('/api/favorites')).resolves.toEqual({ items: [1] });
    expect(refreshCalls(calls)).toHaveLength(1);
    expect(calls).toHaveLength(3);
    expect(await store.getAccessToken()).toBe('new-access');
    expect(await store.getRefreshToken()).toBe('new-refresh');
  });

  it('retries only once when the retried request is still 401', async () => {
    const { client, calls } = setup((url) =>
      url.endsWith('/api/auth/refresh')
        ? json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' })
        : json(401, { error: 'Invalid token' }),
    );
    await expect(client.request('/api/favorites')).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(3);
  });

  it('runs a single refresh for parallel 401s', async () => {
    let releaseRefresh: () => void = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const { client, calls } = setup(async (url, init) => {
      if (url.endsWith('/api/auth/refresh')) {
        await refreshGate;
        return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      return authHeader(init) === 'Bearer new-access' ? json(200, { ok: url }) : json(401, { error: 'Invalid token' });
    });
    const results = Promise.all([
      client.request('/api/favorites'),
      client.request('/api/reports/me'),
      client.request('/api/auth/me'),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRefresh();
    await expect(results).resolves.toHaveLength(3);
    expect(refreshCalls(calls)).toHaveLength(1);
  });

  it('does not refresh on a wrong password and maps the message', async () => {
    const { client, calls, store } = setup(() => json(401, { error: 'Invalid email or password' }));
    const error = await client
      .request('/api/auth/login', { method: 'POST', body: { email: 'a@b.vn', password: 'xxxxxxxx' } })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe(WRONG_CREDENTIALS_MESSAGE);
    expect(refreshCalls(calls)).toHaveLength(0);
    expect(await store.getRefreshToken()).toBe('old-refresh');
  });

  it.each(['/api/auth/register', '/api/auth/refresh', '/api/auth/logout'])('never refreshes for %s', async (path) => {
    const { client, calls } = setup(() => json(401, { error: 'Nope' }));
    await expect(client.request(path, { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
  });

  it('clears tokens and reports auth loss when the refresh fails', async () => {
    const { client, store, onAuthLost } = setup((url) =>
      url.endsWith('/api/auth/refresh')
        ? json(401, { error: 'Refresh token already used or revoked' })
        : json(401, { error: 'Invalid token' }),
    );
    await expect(client.request('/api/favorites')).rejects.toMatchObject({ status: 401 });
    expect(await store.getAccessToken()).toBeNull();
    expect(await store.getRefreshToken()).toBeNull();
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('keeps tokens on a network failure', async () => {
    const { client, store, onAuthLost } = setup(() => {
      throw new TypeError('Network request failed');
    });
    const error = await client.request('/api/favorites').catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'network', status: null, message: NETWORK_MESSAGE });
    expect(await store.getAccessToken()).toBe('old-access');
    expect(await store.getRefreshToken()).toBe('old-refresh');
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('keeps tokens when the refresh request itself fails on the network', async () => {
    const { client, store, onAuthLost } = setup((url) => {
      if (url.endsWith('/api/auth/refresh')) throw new TypeError('Network request failed');
      return json(401, { error: 'Invalid token' });
    });
    await expect(client.request('/api/favorites')).rejects.toMatchObject({ kind: 'network' });
    expect(await store.getRefreshToken()).toBe('old-refresh');
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('handles 204 with no body', async () => {
    const { client } = setup(() => new Response(null, { status: 204 }));
    await expect(client.request('/api/favorites/abc', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('handles a plain-text 429 from the rate limiter', async () => {
    const { client } = setup(
      () => new Response('Too many requests, please try again later.', { status: 429, headers: { 'Content-Type': 'text/html' } }),
    );
    await expect(client.request('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 429,
      message: 'Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.',
    });
  });

  it('sends no Authorization header for guests', async () => {
    const { client, calls } = setup(() => json(200, { items: [] }), { accessToken: '', refreshToken: '' });
    await client.request('/api/places');
    expect(authHeader(calls[0].init)).toBeUndefined();
  });

  it('ends the session when the account is suspended or deleted', async () => {
    const { client, store, onAuthLost } = setup(() => json(403, { error: 'Account unavailable' }));
    await expect(client.request('/api/favorites')).rejects.toMatchObject({ status: 403 });
    expect(onAuthLost).toHaveBeenCalledTimes(1);
    expect(await store.getRefreshToken()).toBeNull();
  });

  it('keeps tokens for other 403 answers', async () => {
    const { client, store, onAuthLost } = setup(() => json(403, { error: 'Owner cannot book own place' }));
    await expect(client.request('/api/bookings', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 403 });
    expect(onAuthLost).not.toHaveBeenCalled();
    expect(await store.getRefreshToken()).toBe('old-refresh');
  });
});
