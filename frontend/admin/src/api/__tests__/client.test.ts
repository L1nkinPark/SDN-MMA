import { describe, expect, it, vi } from 'vitest';

import { createMemoryTokenStore } from '../../auth/tokens';
import { createApiClient } from '../client';
import { NETWORK_MESSAGE, WRONG_CREDENTIALS_MESSAGE } from '../errors';

const BASE = 'http://api.test';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function auth(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>, tokens: { accessToken?: string; refreshToken?: string } = { accessToken: 'old-access', refreshToken: 'old-refresh' }) {
  const store = createMemoryTokenStore(tokens);
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return handler(String(input), init);
  });
  const client = createApiClient({ baseUrl: BASE, tokens: store, fetch: fetchMock as unknown as typeof fetch });
  const onAuthLost = vi.fn();
  client.setAuthLostHandler(onAuthLost);
  return { client, store, calls, onAuthLost };
}

const refreshes = (calls: { url: string }[]) => calls.filter((c) => c.url.endsWith('/api/auth/refresh')).length;

describe('admin api client', () => {
  it('refreshes on 401 and retries once with the new token', async () => {
    const { client, store, calls } = setup((url, init) => {
      if (url.endsWith('/refresh')) return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      return auth(init) === 'Bearer new-access' ? json(200, { ok: true }) : json(401, { error: 'Invalid or expired access token' });
    });
    await expect(client.request('/api/admin/analytics')).resolves.toEqual({ ok: true });
    expect(refreshes(calls)).toBe(1);
    expect(store.getRefreshToken()).toBe('new-refresh');
  });

  it('gets an access token first when only the refresh token survived a reload', async () => {
    const { client, calls } = setup(
      (url, init) => {
        if (url.endsWith('/refresh')) return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
        return auth(init) === 'Bearer new-access' ? json(200, { user: { role: 'admin' } }) : json(401, { error: 'x' });
      },
      { refreshToken: 'saved-refresh' },
    );
    await client.request('/api/auth/me');
    expect(calls.map((c) => c.url.replace(BASE, ''))).toEqual(['/api/auth/refresh', '/api/auth/me']);
  });

  it('shares one refresh between parallel 401s', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { client, calls } = setup(async (url, init) => {
      if (url.endsWith('/refresh')) {
        await gate;
        return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      return auth(init) === 'Bearer new-access' ? json(200, {}) : json(401, { error: 'x' });
    });
    const all = Promise.all([client.request('/api/admin/places'), client.request('/api/admin/reports'), client.request('/api/admin/reviews')]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await all;
    expect(refreshes(calls)).toBe(1);
  });

  it('never refreshes on a wrong password', async () => {
    const { client, calls } = setup(() => json(401, { error: 'Invalid email or password' }));
    await expect(client.request('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      message: WRONG_CREDENTIALS_MESSAGE,
    });
    expect(calls).toHaveLength(1);
  });

  it('clears tokens and reports auth loss when the refresh is rejected', async () => {
    const { client, store, onAuthLost } = setup((url) =>
      url.endsWith('/refresh') ? json(401, { error: 'Refresh token already used or revoked' }) : json(401, { error: 'x' }),
    );
    await expect(client.request('/api/admin/places')).rejects.toMatchObject({ status: 401 });
    expect(store.getRefreshToken()).toBeNull();
    expect(onAuthLost).toHaveBeenCalledOnce();
  });

  it('keeps tokens on a network failure', async () => {
    const { client, store, onAuthLost } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(client.request('/api/admin/places')).rejects.toMatchObject({ kind: 'network', message: NETWORK_MESSAGE });
    expect(store.getRefreshToken()).toBe('old-refresh');
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it('sends FormData without a JSON content type', async () => {
    const { client, calls } = setup(() => json(201, { imageUrl: 'https://x/y.png' }));
    const form = new FormData();
    form.append('image', new Blob(['x'], { type: 'image/png' }), 'a.png');
    await client.request('/api/admin/places/1/images', { method: 'POST', body: form });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(calls[0].init.body).toBe(form);
  });

  it('handles 204 and plain-text 429', async () => {
    const { client } = setup((url) =>
      url.endsWith('/logout') ? new Response(null, { status: 204 }) : new Response('Too many requests', { status: 429 }),
    );
    await expect(client.request('/api/auth/logout', { method: 'POST', body: {} })).resolves.toBeUndefined();
    await expect(client.request('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 429 });
  });

  it('drops empty query values', async () => {
    const { client, calls } = setup(() => json(200, {}));
    await client.request('/api/admin/places', { query: { page: 2, limit: 20, approval: undefined } });
    expect(calls[0].url).toBe(`${BASE}/api/admin/places?page=2&limit=20`);
  });
});
