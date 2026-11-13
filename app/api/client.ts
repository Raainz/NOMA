/**
 * HTTP client for the NOMA backend.
 * Pure TypeScript (no React Native imports) so it can be unit-tested with a fake fetch.
 * Handles bearer auth, a single automatic refresh on 401 (single-flight) and normalised errors.
 */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStore {
  load(): Promise<Tokens | null>;
  save(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiUser {
  id: string;
  email: string;
  display_name: string | null;
  preferred_units: string;
  timezone: string;
  locale: string;
}

export interface SyncPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

export interface SyncPayload {
  client_activity_id: string;
  name: string;
  started_at: string;
  ended_at: string;
  points: SyncPoint[];
  client_metrics?: {
    distance_m?: number;
    duration_ms?: number;
    moving_time_ms?: number;
    elevation_gain_m?: number;
  };
}

export interface SyncResult {
  /** 201 = created, 200 = already stored with identical content. */
  status: number;
  activity: { id: string; client_activity_id: string };
}

/** status 0 means the server could not be reached (offline, DNS, timeout). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface SendOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

const API_PREFIX = '/api/v1';

export function createApiClient(opts: ApiClientOptions) {
  const doFetch: typeof fetch = opts.fetchImpl ?? ((...args) => fetch(...args));
  const timeoutMs = opts.timeoutMs ?? 20000;
  let refreshing: Promise<Tokens | null> | null = null;
  let onSessionExpired: (() => void) | null = null;

  async function rawSend(path: string, o: SendOptions, accessToken: string | null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${opts.baseUrl}${path}`, {
        method: o.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        signal: controller.signal,
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      const timedOut = controller.signal.aborted;
      throw new ApiError(
        0,
        'network_error',
        `Serveur injoignable (${opts.baseUrl}) : ${timedOut ? 'délai dépassé' : reason}`
      );
    } finally {
      clearTimeout(timer);
    }

    let data: any = undefined;
    if (res.status !== 204) {
      try {
        data = await res.json();
      } catch {
        data = undefined;
      }
    }
    if (!res.ok) {
      const err = data?.error;
      throw new ApiError(
        res.status,
        err?.code ?? 'http_error',
        err?.message ?? `Erreur serveur (${res.status})`,
        err?.request_id
      );
    }
    return { status: res.status, data };
  }

  function toTokens(data: any): Tokens {
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  /** Exchanges the refresh token. Network failures keep the session; a rejected token ends it. */
  function refresh(): Promise<Tokens | null> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const current = await opts.tokenStore.load();
      if (!current) return null;
      try {
        const { data } = await rawSend(
          `${API_PREFIX}/auth/refresh`,
          { method: 'POST', body: { refresh_token: current.refreshToken } },
          null
        );
        const next = toTokens(data);
        await opts.tokenStore.save(next);
        return next;
      } catch (e) {
        if (e instanceof ApiError && !e.isNetwork && e.status < 500) {
          await opts.tokenStore.clear();
          onSessionExpired?.();
          return null;
        }
        throw e;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send(path: string, o: SendOptions = {}) {
    const auth = o.auth ?? true;
    if (!auth) return rawSend(`${API_PREFIX}${path}`, o, null);

    const tokens = await opts.tokenStore.load();
    if (!tokens) throw new ApiError(401, 'no_session', 'Session expirée');
    try {
      return await rawSend(`${API_PREFIX}${path}`, o, tokens.accessToken);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const fresh = await refresh();
      if (!fresh) throw e;
      return rawSend(`${API_PREFIX}${path}`, o, fresh.accessToken);
    }
  }

  return {
    setOnSessionExpired(fn: (() => void) | null) {
      onSessionExpired = fn;
    },
    hasSession: async () => (await opts.tokenStore.load()) !== null,

    async register(email: string, password: string, displayName?: string): Promise<void> {
      const { data } = await send('/auth/register', {
        method: 'POST',
        auth: false,
        body: { email, password, ...(displayName ? { display_name: displayName } : {}) },
      });
      await opts.tokenStore.save(toTokens(data));
    },

    async login(email: string, password: string): Promise<void> {
      const { data } = await send('/auth/login', { method: 'POST', auth: false, body: { email, password } });
      await opts.tokenStore.save(toTokens(data));
    },

    /** Best effort: the local session is always cleared, even when the server is unreachable. */
    async logout(): Promise<void> {
      const tokens = await opts.tokenStore.load();
      await opts.tokenStore.clear();
      if (!tokens) return;
      try {
        await rawSend(`${API_PREFIX}/auth/logout`, { method: 'POST', body: { refresh_token: tokens.refreshToken } }, null);
      } catch {
        // The refresh token will expire on its own.
      }
    },

    async me(): Promise<ApiUser> {
      return (await send('/me')).data as ApiUser;
    },

    async syncActivity(payload: SyncPayload): Promise<SyncResult> {
      const { status, data } = await send('/activities/sync', { method: 'POST', body: payload });
      return { status, activity: data };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
