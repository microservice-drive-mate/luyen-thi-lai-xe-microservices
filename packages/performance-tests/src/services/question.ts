import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from '../config';
import { http } from '../helpers/http';
import { loginAsAdmin, loginAsDefaultUser } from '../helpers/auth';
import { randomLicenseCategory, randomPagination } from '../helpers/data';

export function testListQuestions(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[question] Skip list questions: login failed');
    return;
  }

  group('Question - List', () => {
    const { page, limit } = randomPagination();
    const category = randomLicenseCategory();
    const res = http.get(
      `${BASE_URL}/questions/practice?page=${page}&limit=${limit}&licenseCategory=${category}`,
      { headers: authHeaders(token), tags: { name: 'question_list' } },
    );
    check(res, {
      'Question list: 200': (r) => r.status === 200,
      'Question list: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testGetQuestionDetail(questionId?: string): void {
  group('Question - Detail', () => {
    const id = questionId ?? __ENV.TEST_QUESTION_ID ?? '1';
    const res = http.get(`${BASE_URL}/questions/${id}`, {
      headers: JSON_HEADERS,
      tags: { name: 'question_detail' },
    });
    check(res, {
      'Question detail: 200/404': (r) => r.status === 200 || r.status === 404,
      'Question detail: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}

export function testFetchQuestionPool(): void {
  const token = loginAsAdmin();
  if (!token) {
    console.error('[question] Skip question pool: admin login failed');
    return;
  }

  const category = randomLicenseCategory();

  group('Question - Pool (Admin)', () => {
    sleep(0.3);

    const res = http.get(
      `${BASE_URL}/admin/questions?page=1&limit=50&licenseCategory=${category}`,
      { headers: authHeaders(token), tags: { name: 'question_pool' } },
    );
    check(res, {
      'Question pool: 200': (r) => r.status === 200,
      'Question pool: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testSearchQuestions(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[question] Skip search: login failed');
    return;
  }

  group('Question - Search', () => {
    sleep(0.3);

    const res = http.get(
      `${BASE_URL}/questions?search=${encodeURIComponent('đèn đỏ')}&page=1&limit=10`,
      { headers: authHeaders(token), tags: { name: 'question_search' } },
    );
    check(res, { 'Question search: 200': (r) => r.status === 200 });
    sleep(0.3);
  });
}
