import { check } from 'k6';
import encoding from 'k6/encoding';
import { BASE_URL, JSON_HEADERS } from '../config';
import { http } from './http';

export interface LoginResponse {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  data?: {
    accessToken?: string;
    access_token?: string;
  };
}

interface CachedSession {
  username: string;
  password: string;
  accessToken: string;
  refreshToken?: string;
  expiresAtMs: number;
}

const TOKEN_REFRESH_SKEW_MS = 30_000;
const DEFAULT_TOKEN_TTL_MS = 4 * 60_000;

let defaultUserSession: CachedSession | null = null;
let adminSession: CachedSession | null = null;

function extractAccessToken(body: LoginResponse): string | null {
  return (
    body.accessToken ||
    body.access_token ||
    body.data?.accessToken ||
    body.data?.access_token ||
    null
  );
}

function extractRefreshToken(body: LoginResponse): string | undefined {
  return body.refreshToken || body.refresh_token;
}

function tokenExpiresAtMs(token: string): number {
  const payload = token.split('.')[1];
  if (!payload) return Date.now() + DEFAULT_TOKEN_TTL_MS;

  try {
    const decoded = JSON.parse(encoding.b64decode(payload, 'rawurl', 's')) as {
      exp?: number;
    };
    return typeof decoded.exp === 'number'
      ? decoded.exp * 1000
      : Date.now() + DEFAULT_TOKEN_TTL_MS;
  } catch {
    return Date.now() + DEFAULT_TOKEN_TTL_MS;
  }
}

function isSessionUsable(
  session: CachedSession | null,
): session is CachedSession {
  return (
    session !== null && session.expiresAtMs - TOKEN_REFRESH_SKEW_MS > Date.now()
  );
}

export function login(username: string, password: string): string | null {
  return loginWithSession(username, password)?.accessToken ?? null;
}

function loginWithSession(
  username: string,
  password: string,
): CachedSession | null {
  const payload = JSON.stringify({ username, password });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: JSON_HEADERS,
    tags: { name: 'auth_login' },
  });

  const loginSuccess = check(res, {
    'Login: status 200/201': (r) => r.status === 200 || r.status === 201,
    'Login: has access token': (r) => {
      try {
        const body = JSON.parse(r.body as string) as LoginResponse;
        return !!(
          body.accessToken ||
          body.access_token ||
          body.data?.accessToken ||
          body.data?.access_token
        );
      } catch {
        return false;
      }
    },
  });

  if (!loginSuccess) {
    console.error(`Login failed for ${username}: status=${res.status}`);
    return null;
  }

  try {
    const body = JSON.parse(res.body as string) as LoginResponse;
    const accessToken = extractAccessToken(body);
    if (!accessToken) return null;
    return {
      username,
      password,
      accessToken,
      refreshToken: extractRefreshToken(body),
      expiresAtMs: tokenExpiresAtMs(accessToken),
    };
  } catch {
    return null;
  }
}

function getCachedSession(
  current: CachedSession | null,
  username: string,
  password: string,
): CachedSession | null {
  if (
    isSessionUsable(current) &&
    current.username === username &&
    current.password === password
  ) {
    return current;
  }

  if (current?.refreshToken && current.username === username) {
    const refreshedToken = refreshToken(current.refreshToken);
    if (refreshedToken) {
      return {
        ...current,
        accessToken: refreshedToken,
        expiresAtMs: tokenExpiresAtMs(refreshedToken),
      };
    }
  }

  return loginWithSession(username, password);
}

export function loginAsDefaultUser(): string | null {
  const username =
    __ENV.TEST_USERNAME ||
    __ENV.TEST_USER_USERNAME ||
    __ENV.TEST_USER_EMAIL ||
    'student.b2@test.com';
  const password = __ENV.TEST_USER_PASSWORD || '123456';
  defaultUserSession = getCachedSession(defaultUserSession, username, password);
  return defaultUserSession?.accessToken ?? null;
}

export function loginAsAdmin(): string | null {
  const username =
    __ENV.ADMIN_USERNAME || __ENV.ADMIN_EMAIL || 'admin@test.com';
  const password = __ENV.ADMIN_PASSWORD || '123456';
  adminSession = getCachedSession(adminSession, username, password);
  return adminSession?.accessToken ?? null;
}

export function refreshToken(currentRefreshToken: string): string | null {
  const payload = JSON.stringify({ refreshToken: currentRefreshToken });

  const res = http.post(`${BASE_URL}/auth/refresh`, payload, {
    headers: JSON_HEADERS,
    tags: { name: 'auth_refresh' },
  });

  check(res, {
    'Refresh: status 200': (r) => r.status === 200,
  });

  try {
    const body = JSON.parse(res.body as string) as LoginResponse;
    return (
      body.accessToken || body.access_token || body.data?.accessToken || null
    );
  } catch {
    return null;
  }
}
