import { check, group, sleep } from 'k6';
import { authHeaders, BASE_URL } from '../config';
import { loginAsDefaultUser } from '../helpers/auth';
import { randomPhoneNumber, randomVietnameseName } from '../helpers/data';
import { expected2xxOr404, http } from '../helpers/http';

export function testGetUserProfile(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[user] Skip profile: login failed');
    return;
  }

  group('User - Get Profile', () => {
    sleep(0.3);

    const res = http.get(`${BASE_URL}/users/me`, {
      headers: authHeaders(token),
      tags: { name: 'user_profile' },
    });
    check(res, {
      'User profile: 200': (r) => r.status === 200,
      'User profile: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}

export function testUpdateUserProfile(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[user] Skip update profile: login failed');
    return;
  }

  group('User - Update Profile', () => {
    sleep(0.3);

    const payload = {
      fullName: randomVietnameseName(),
      phoneNumber: randomPhoneNumber(),
    };
    const res = http.patch(`${BASE_URL}/users/me`, JSON.stringify(payload), {
      headers: authHeaders(token),
      tags: { name: 'user_update' },
    });
    check(res, {
      'User update: 200': (r) => r.status === 200,
      'User update: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testGetUserById(userId?: string): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[user] Skip get by id: login failed');
    return;
  }

  const id = userId ?? __ENV.TEST_USER_ID ?? 'me';

  group('User - Get By ID', () => {
    sleep(0.3);

    const res = http.get(`${BASE_URL}/users/${id}`, {
      headers: authHeaders(token),
      tags: { name: 'user_by_id' },
      responseCallback: expected2xxOr404,
    });
    check(res, {
      'User by ID: 200/404': (r) => r.status === 200 || r.status === 404,
      'User by ID: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}
