import { check } from 'k6';
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

export function login(username: string, password: string): string | null {
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
    return (
      body.accessToken ||
      body.access_token ||
      body.data?.accessToken ||
      body.data?.access_token ||
      null
    );
  } catch {
    return null;
  }
}

export function loginAsDefaultUser(): string | null {
  const username =
    __ENV.TEST_USERNAME ||
    __ENV.TEST_USER_USERNAME ||
    __ENV.TEST_USER_EMAIL ||
    'student.b2@test.com';
  const password = __ENV.TEST_USER_PASSWORD || '123456';
  return login(username, password);
}

export function loginAsAdmin(): string | null {
  const username =
    __ENV.ADMIN_USERNAME || __ENV.ADMIN_EMAIL || 'admin@test.com';
  const password = __ENV.ADMIN_PASSWORD || '123456';
  return login(username, password);
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
