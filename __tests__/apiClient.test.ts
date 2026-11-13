import { ApiError, createApiClient, Tokens, TokenStore } from '../app/api/client';

function memoryStore(initial: Tokens | null): TokenStore & { current: Tokens | null } {
  const s = {
    current: initial,
    load: async () => s.current,
    save: async (t: Tokens) => {
      s.current = t;
    },
    clear: async () => {
      s.current = null;
    },
  };
  return s;
}

const json = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const tokenBody = (a: string, r: string) => ({ access_token: a, refresh_token: r, token_type: 'bearer', expires_in: 900 });
const authHeader = (call: any[]) => (call[1].headers as Record<string, string>).Authorization;

describe('api client', () => {
  it('login stores tokens and sends no auth header', async () => {
    const store = memoryStore(null);
    const fetchImpl = jest.fn().mockResolvedValue(json(200, tokenBody('a1', 'r1')));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    await api.login('a@b.co', 'password1');
    expect(store.current).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/api/v1/auth/login');
    expect(authHeader(fetchImpl.mock.calls[0])).toBeUndefined();
  });

  it('maps the error envelope to ApiError', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(json(401, { error: { code: 'invalid_credentials', message: 'nope', request_id: 'rid' } }));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: memoryStore(null), fetchImpl: fetchImpl as any });
    await expect(api.login('a@b.co', 'x')).rejects.toMatchObject({ status: 401, code: 'invalid_credentials', requestId: 'rid' });
  });

  it('reports network failures as status 0', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: memoryStore(null), fetchImpl: fetchImpl as any });
    const err = await api.login('a@b.co', 'x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isNetwork).toBe(true);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const store = memoryStore({ accessToken: 'old', refreshToken: 'r-old' });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'x' } }))
      .mockResolvedValueOnce(json(200, tokenBody('new', 'r-new')))
      .mockResolvedValueOnce(json(200, { id: '1', email: 'a@b.co' }));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    const me = await api.me();
    expect(me.email).toBe('a@b.co');
    expect(authHeader(fetchImpl.mock.calls[0])).toBe('Bearer old');
    expect(authHeader(fetchImpl.mock.calls[2])).toBe('Bearer new');
    expect(store.current).toEqual({ accessToken: 'new', refreshToken: 'r-new' });
  });

  it('shares one refresh between concurrent 401s', async () => {
    const store = memoryStore({ accessToken: 'old', refreshToken: 'r-old' });
    let refreshCalls = 0;
    const fetchImpl = jest.fn(async (url: string, init: any) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return json(200, tokenBody('new', 'r-new'));
      }
      return init.headers.Authorization === 'Bearer new' ? json(200, { id: '1', email: 'e' }) : json(401, { error: { code: 'unauthorized', message: 'x' } });
    });
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    await Promise.all([api.me(), api.me(), api.me()]);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session and notifies when the refresh token is rejected', async () => {
    const store = memoryStore({ accessToken: 'old', refreshToken: 'r-old' });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'x' } }))
      .mockResolvedValueOnce(json(401, { error: { code: 'refresh_token_reused', message: 'x' } }));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    const expired = jest.fn();
    api.setOnSessionExpired(expired);
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(store.current).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh fails because the network is down', async () => {
    const store = memoryStore({ accessToken: 'old', refreshToken: 'r-old' });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'x' } }))
      .mockRejectedValueOnce(new TypeError('offline'));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    await expect(api.me()).rejects.toMatchObject({ status: 0 });
    expect(store.current).not.toBeNull();
  });

  it('syncActivity exposes 201 vs 200', async () => {
    const store = memoryStore({ accessToken: 'a', refreshToken: 'r' });
    const fetchImpl = jest.fn().mockResolvedValue(json(200, { id: 's1', client_activity_id: 'c1' }));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    const res = await api.syncActivity({} as any);
    expect(res.status).toBe(200);
    expect(res.activity.id).toBe('s1');
  });

  it('logout clears local tokens even when the server is unreachable', async () => {
    const store = memoryStore({ accessToken: 'a', refreshToken: 'r' });
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('offline'));
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    await api.logout();
    expect(store.current).toBeNull();
  });
});

describe('api client: social (M2)', () => {
  const setup = (res: Response) => {
    const store = memoryStore({ accessToken: 'a', refreshToken: 'r' });
    const fetchImpl = jest.fn().mockResolvedValue(res);
    const api = createApiClient({ baseUrl: 'http://x', tokenStore: store, fetchImpl: fetchImpl as any });
    return { api, fetchImpl };
  };

  it('updateProfile PATCHes /me/profile with only the given fields', async () => {
    const { api, fetchImpl } = setup(json(200, { handle: 'amine' }));
    await api.updateProfile({ handle: 'amine', city: null });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://x/api/v1/me/profile');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ handle: 'amine', city: null });
  });

  it('searchRunners builds the query string and skips empty values', async () => {
    const { api, fetchImpl } = setup(json(200, { items: [], next_cursor: null }));
    await api.searchRunners({ q: 'am', city: '', cursor: null, limit: 10 });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/api/v1/users?q=am&limit=10');
    await api.searchRunners();
    expect(fetchImpl.mock.calls[1][0]).toBe('http://x/api/v1/users');
  });

  it('encodes characters in handles and cursors', async () => {
    const { api, fetchImpl } = setup(json(200, { items: [], next_cursor: null }));
    await api.runnerActivities('a/b', { cursor: 'x=y&z' });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/api/v1/users/a%2Fb/activities?cursor=x%3Dy%26z');
  });

  it('follow and unfollow use POST and DELETE on the user id', async () => {
    const { api, fetchImpl } = setup(json(201, { is_following: true, followers_count: 1 }));
    expect(await api.follow('u1')).toEqual({ is_following: true, followers_count: 1 });
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST');
    const { api: api2, fetchImpl: f2 } = setup({ ok: true, status: 204, json: async () => undefined } as unknown as Response);
    await api2.unfollow('u1');
    expect(f2.mock.calls[0][0]).toBe('http://x/api/v1/users/u1/follow');
    expect(f2.mock.calls[0][1].method).toBe('DELETE');
  });

  it('setActivityVisibility sends the chosen level', async () => {
    const { api, fetchImpl } = setup(json(200, {}));
    await api.setActivityVisibility('s1', 'followers');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/api/v1/activities/s1/visibility');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ visibility: 'followers' });
  });

  it('surfaces server error codes for the UI (handle_taken)', async () => {
    const { api } = setup(json(409, { error: { code: 'handle_taken', message: 'taken' } }));
    await expect(api.updateProfile({ handle: 'x_1' })).rejects.toMatchObject({ status: 409, code: 'handle_taken' });
  });
});
