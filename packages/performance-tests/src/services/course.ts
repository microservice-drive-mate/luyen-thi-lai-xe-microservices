import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from '../config';
import { http } from '../helpers/http';
import { loginAsDefaultUser } from '../helpers/auth';
import { generateEnrollmentData, randomPagination } from '../helpers/data';

export function testListCourses(): void {
  group('Course - List', () => {
    const token = loginAsDefaultUser();
    const { page, limit } = randomPagination();
    const headers = token ? authHeaders(token) : JSON_HEADERS;
    const res = http.get(`${BASE_URL}/courses?page=${page}&limit=${limit}`, {
      headers,
      tags: { name: 'course_list' },
    });
    check(res, {
      'Course list: 200': (r) => r.status === 200,
      'Course list: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testGetCourseDetail(courseId?: string): void {
  group('Course - Detail', () => {
    const id = courseId ?? __ENV.TEST_COURSE_ID ?? '1';
    const res = http.get(`${BASE_URL}/courses/${id}`, {
      headers: JSON_HEADERS,
      tags: { name: 'course_detail' },
    });
    check(res, {
      'Course detail: 200/404': (r) => r.status === 200 || r.status === 404,
    });
    sleep(0.3);
  });
}

export function testSearchCourses(): void {
  group('Course - Search', () => {
    const terms = ['B2', 'lái xe', 'A1', 'ô tô'];
    const term = terms[Math.floor(Math.random() * terms.length)];
    const res = http.get(
      `${BASE_URL}/courses?search=${encodeURIComponent(term ?? 'B2')}&page=1&limit=10`,
      { headers: JSON_HEADERS, tags: { name: 'course_search' } },
    );
    check(res, { 'Course search: 200': (r) => r.status === 200 });
    sleep(0.5);
  });
}

export function testEnrollCourse(courseId?: string): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[course] Skip enroll: login failed');
    return;
  }

  const id = courseId ?? __ENV.TEST_COURSE_ID ?? '1';

  group('Course - Enroll', () => {
    sleep(0.3);

    const res = http.post(
      `${BASE_URL}/enrollments`,
      JSON.stringify(generateEnrollmentData(id)),
      { headers: authHeaders(token), tags: { name: 'course_enroll' } },
    );
    check(res, {
      'Enroll: 200/201/409': (r) =>
        r.status === 200 || r.status === 201 || r.status === 409,
      'Enroll: <2s': (r) => r.timings.duration < 2000,
    });
    sleep(0.5);
  });
}

export function testListEnrollments(): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[course] Skip enrollments: login failed');
    return;
  }

  group('Course - List Enrollments', () => {
    sleep(0.3);

    const { page, limit } = randomPagination();
    const res = http.get(
      `${BASE_URL}/enrollments?page=${page}&limit=${limit}`,
      {
        headers: authHeaders(token),
        tags: { name: 'enrollment_list' },
      },
    );
    check(res, {
      'Enrollments: 200': (r) => r.status === 200,
      'Enrollments: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.3);
  });
}
