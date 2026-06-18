import { check, group, sleep } from 'k6';
import { authHeaders, BASE_URL, JSON_HEADERS } from '../config';
import { login, loginAsDefaultUser } from '../helpers/auth';
import { generateRegistrationData } from '../helpers/data';
import { expected2xxOr400Or401Or403, http } from '../helpers/http';

export function testLogin(): void {
  group('Identity - Login', () => {
    const username =
      __ENV.TEST_USERNAME || __ENV.TEST_USER_EMAIL || 'student.b2@test.com';
    const password = __ENV.TEST_USER_PASSWORD || '123456';

    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username, password }),
      { headers: JSON_HEADERS, tags: { name: 'identity_login' } },
    );

    check(res, {
      'Login: 200/201': (r) => r.status === 200 || r.status === 201,
      'Login: has token': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return !!(
            body.accessToken ||
            body.access_token ||
            body.data?.accessToken
          );
        } catch {
          return false;
        }
      },
      'Login: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testLoginFailure(): void {
  group('Identity - Login Failure (Brute Force Sim)', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        username: 'wrong@example.com',
        password: 'WrongPass123',
      }),
      {
        headers: JSON_HEADERS,
        tags: { name: 'identity_login_fail' },
        responseCallback: expected2xxOr400Or401Or403,
      },
    );

    check(res, {
      'Login fail: 401/400/403': (r) =>
        r.status === 401 || r.status === 400 || r.status === 403,
      'Login fail: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.3);
  });
}

export function testRegister(): void {
  group('Identity - Register', () => {
    const userData = generateRegistrationData();
    const res = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify(userData),
      { headers: JSON_HEADERS, tags: { name: 'identity_register' } },
    );

    check(res, {
      'Register: 201/200': (r) => r.status === 201 || r.status === 200,
      'Register: <2s': (r) => r.timings.duration < 2000,
    });
    sleep(0.5);
  });
}

export function testGetProfile(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[identity] Skip profile: login failed');
    return;
  }

  group('Identity - Get Profile', () => {
    sleep(0.3);

    const res = http.get(`${BASE_URL}/users/me`, {
      headers: authHeaders(token),
      tags: { name: 'identity_profile' },
    });

    check(res, {
      'Profile: 200': (r) => r.status === 200,
      'Profile: has email': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return !!(body.email || body.data?.email);
        } catch {
          return false;
        }
      },
      'Profile: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}

export function testLogout(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[identity] Skip logout: login failed');
    return;
  }

  group('Identity - Logout', () => {
    sleep(0.3);

    const res = http.post(`${BASE_URL}/auth/logout`, null, {
      headers: authHeaders(token),
      tags: { name: 'identity_logout' },
    });

    check(res, {
      'Logout: 200/204': (r) => r.status === 200 || r.status === 204,
      'Logout: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}

export function testFullAuthFlow(): void {
  const userData = generateRegistrationData();

  group('Identity - Full Auth Flow: Register', () => {
    const registerRes = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify(userData),
      { headers: JSON_HEADERS, tags: { name: 'identity_flow_register' } },
    );
    check(registerRes, {
      'Flow register: 200/201': (r) => r.status === 201 || r.status === 200,
    });
    sleep(1);
  });

  const token = login(userData.email, userData.password);
  if (!token) {
    console.error('[identity] Full auth flow: login failed after register');
    return;
  }

  group('Identity - Full Auth Flow: Profile', () => {
    sleep(0.5);
    const profileRes = http.get(`${BASE_URL}/auth/profile`, {
      headers: authHeaders(token),
      tags: { name: 'identity_flow_profile' },
    });
    check(profileRes, { 'Flow profile: 200': (r) => r.status === 200 });
    sleep(0.5);
  });

  group('Identity - Full Auth Flow: Logout', () => {
    const logoutRes = http.post(`${BASE_URL}/auth/logout`, null, {
      headers: authHeaders(token),
      tags: { name: 'identity_flow_logout' },
    });
    check(logoutRes, {
      'Flow logout: 200/204': (r) => r.status === 200 || r.status === 204,
    });
    sleep(0.3);
  });
}
