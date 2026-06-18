import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import encoding from 'k6/encoding';
import type { Options } from 'k6/options';
import {
  BASE_URL,
  JSON_HEADERS,
  authHeaders,
  SECURITY_THRESHOLDS,
} from '../config';
import { http } from '../helpers/http';
import { loginAsDefaultUser } from '../helpers/auth';
import { randomEmail, randomString } from '../helpers/data';

const rateLimitedRequests = new Counter('rate_limited_requests');
const unauthorizedRequests = new Counter('unauthorized_requests');
const blockedRequests = new Counter('blocked_requests');

export const options: Options = {
  scenarios: {
    brute_force: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      tags: { attack_type: 'brute_force' },
    },
    jwt_bypass: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '30s',
      tags: { attack_type: 'jwt_bypass' },
    },
    registration_flood: {
      executor: 'constant-vus',
      vus: 15,
      duration: '1m',
      startTime: '1m',
      tags: { attack_type: 'registration_flood' },
    },
  },
  thresholds: {
    ...SECURITY_THRESHOLDS,
    rate_limited_requests: ['count>0'],
    unauthorized_requests: ['count>0'],
  },
  tags: { test_type: 'security', scenario: __ENV.K6_SCENARIO || 'security' },
};

function testBruteForceLogin(): void {
  group('Security - Brute Force Login', () => {
    const fakeUsername = `attacker_${randomString(6)}@hack.com`;
    const fakePassword = randomString(12);

    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: fakeUsername, password: fakePassword }),
      { headers: JSON_HEADERS, tags: { name: 'security_brute_force' } },
    );

    const is401 =
      res.status === 401 || res.status === 400 || res.status === 403;
    const is429 = res.status === 429;

    check(res, {
      'Brute force: rejected (401/403/429)': () => is401 || is429,
    });

    if (is429) rateLimitedRequests.add(1);
    if (is401) unauthorizedRequests.add(1);
    if (is429 || is401) blockedRequests.add(1);

    sleep(0.1);
  });
}

function testJwtBypass(): void {
  group('Security - JWT Bypass', () => {
    const protectedEndpoints = [
      '/auth/profile',
      '/users/me',
      '/enrollments',
      '/exam-sessions',
    ];

    const endpoint =
      protectedEndpoints[Math.floor(Math.random() * protectedEndpoints.length)];

    const resNoToken = http.get(`${BASE_URL}${endpoint}`, {
      headers: JSON_HEADERS,
      tags: { name: 'security_no_token' },
    });
    check(resNoToken, {
      'No token: 401/429': (r) => r.status === 401 || r.status === 429,
    });
    if (resNoToken.status === 401) unauthorizedRequests.add(1);
    if (resNoToken.status === 429) rateLimitedRequests.add(1);

    sleep(0.2);

    const fakeTokenPayload = JSON.stringify({ sub: 'hacker', exp: 9999999999 });
    const fakeToken = `eyJhbGciOiJSUzI1NiJ9.${encoding.b64encode(fakeTokenPayload)}.fakesignature`;
    const resFakeToken = http.get(`${BASE_URL}${endpoint}`, {
      headers: authHeaders(fakeToken),
      tags: { name: 'security_fake_token' },
    });
    check(resFakeToken, {
      'Fake token: 401': (r) => r.status === 401,
    });
    if (resFakeToken.status === 401) unauthorizedRequests.add(1);

    sleep(0.3);
  });
}

function testRegistrationFlood(): void {
  group('Security - Registration Flood', () => {
    const payload = {
      email: randomEmail(),
      password: 'Test@123456',
      fullName: 'Spam User',
      phoneNumber: `090${Math.floor(Math.random() * 10000000)
        .toString()
        .padStart(7, '0')}`,
    };

    const res = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify(payload),
      { headers: JSON_HEADERS, tags: { name: 'security_reg_flood' } },
    );

    const is429 = res.status === 429;
    const isBlocked = res.status === 429 || res.status === 403;

    check(res, {
      'Reg flood: either created or rate-limited': (r) =>
        r.status === 201 ||
        r.status === 200 ||
        r.status === 429 ||
        r.status === 403,
    });

    if (is429) rateLimitedRequests.add(1);
    if (isBlocked) blockedRequests.add(1);

    sleep(0.05);
  });
}

function testExamFlood(): void {
  const token = loginAsDefaultUser();
  if (!token) return;

  const examId = __ENV.TEST_EXAM_ID ?? '1';

  group('Security - Exam Session Flood', () => {
    for (let i = 0; i < 5; i++) {
      const res = http.post(`${BASE_URL}/exams/${examId}/start`, null, {
        headers: authHeaders(token),
        tags: { name: 'security_exam_flood' },
      });

      check(res, {
        'Exam flood: 200/201 or 409/429': (r) =>
          r.status === 200 ||
          r.status === 201 ||
          r.status === 409 ||
          r.status === 429,
      });

      if (res.status === 429) rateLimitedRequests.add(1);
      sleep(0.1);
    }
  });
}

export default function (): void {
  const attackType = __ENV.K6_ATTACK_TYPE ?? 'all';

  if (attackType === 'brute_force' || attackType === 'all') {
    testBruteForceLogin();
  }

  if (attackType === 'jwt_bypass' || attackType === 'all') {
    testJwtBypass();
  }

  if (attackType === 'registration_flood' || attackType === 'all') {
    testRegistrationFlood();
  }

  if (Math.random() < 0.2) {
    testExamFlood();
  }

  sleep(0.1 + Math.random() * 0.5);
}
