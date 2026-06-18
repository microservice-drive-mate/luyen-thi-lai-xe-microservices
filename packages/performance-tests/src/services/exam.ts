import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from '../config';
import { http } from '../helpers/http';
import { loginAsDefaultUser } from '../helpers/auth';
import { generateExamSubmission, randomPagination } from '../helpers/data';
import { measureSocketIoEventLatency } from '../helpers/async';

function isExamResultNotification(payload: unknown): boolean {
  const notification = (payload as { notification?: { eventType?: string } })
    .notification;
  return (
    notification?.eventType === 'exam.session.passed' ||
    notification?.eventType === 'exam.session.failed'
  );
}

export function testListExams(): void {
  group('Exam - List', () => {
    const token = loginAsDefaultUser();
    const { page, limit } = randomPagination();
    const headers = token ? authHeaders(token) : JSON_HEADERS;
    const res = http.get(
      `${BASE_URL}/exams/available?page=${page}&limit=${limit}`,
      {
        headers,
        tags: { name: 'exam_list' },
      },
    );
    check(res, {
      'Exam list: 200': (r) => r.status === 200,
      'Exam list: valid JSON': (r) => {
        try {
          JSON.parse(r.body as string);
          return true;
        } catch {
          return false;
        }
      },
      'Exam list: <1s': (r) => r.timings.duration < 1000,
    });
    sleep(0.5);
  });
}

export function testGetExamDetail(examId?: string): void {
  group('Exam - Detail', () => {
    const id = examId ?? __ENV.TEST_EXAM_ID ?? '1';
    const res = http.get(`${BASE_URL}/exams/${id}`, {
      headers: JSON_HEADERS,
      tags: { name: 'exam_detail' },
    });
    check(res, {
      'Exam detail: 200/404': (r) => r.status === 200 || r.status === 404,
      'Exam detail: <500ms': (r) => r.timings.duration < 500,
    });
    sleep(0.3);
  });
}

export function testStartExam(examId?: string): string | null {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[exam] Skip start exam: login failed');
    return null;
  }

  let sessionId: string | null = null;
  const id = examId ?? __ENV.TEST_EXAM_ID ?? '1';

  group('Exam - Start', () => {
    sleep(0.3);

    const res = http.post(`${BASE_URL}/exams/${id}/start`, null, {
      headers: authHeaders(token),
      tags: { name: 'exam_start' },
    });
    check(res, {
      'Exam start: 200/201': (r) => r.status === 200 || r.status === 201,
      'Exam start: <2s': (r) => r.timings.duration < 2000,
    });
    try {
      const body = JSON.parse(res.body as string);
      sessionId = body.id ?? body.sessionId ?? body.data?.id ?? null;
    } catch {
      sessionId = null;
    }
    sleep(0.5);
  });

  return sessionId;
}

export function testSubmitExam(sessionId?: string): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[exam] Skip submit: login failed');
    return;
  }

  const id = sessionId ?? __ENV.TEST_SESSION_ID ?? '1';

  group('Exam - Submit', () => {
    sleep(0.3);

    const submission = generateExamSubmission();
    const submit = (): void => {
      const res = http.post(
        `${BASE_URL}/exam-sessions/${id}/submit`,
        JSON.stringify(submission),
        { headers: authHeaders(token), tags: { name: 'exam_submit' } },
      );
      check(res, {
        'Exam submit: 200/201': (r) => r.status === 200 || r.status === 201,
        'Exam submit: <3s': (r) => r.timings.duration < 3000,
      });
    };

    measureSocketIoEventLatency(
      {
        url: `${BASE_URL.replace('http', 'ws')}/notifications/socket.io`,
        namespace: '/notifications',
        token,
        expectedEvent: 'notification.created',
        conditionFn: isExamResultNotification,
        timeoutMs: 5000,
      },
      submit,
    );
    sleep(0.5);
  });
}

export function testFullExamFlow(examId?: string): void {
  const token = loginAsDefaultUser();
  if (!token) {
    console.error('[exam] Skip full exam flow: login failed');
    return;
  }

  const id = examId ?? __ENV.TEST_EXAM_ID ?? '1';
  let sessionId: string | null = null;

  group('Exam - Full Flow: Browse & Start', () => {
    const listRes = http.get(`${BASE_URL}/exams?page=1&limit=10`, {
      headers: authHeaders(token),
      tags: { name: 'exam_flow_list' },
    });
    check(listRes, { 'Flow list: 200': (r) => r.status === 200 });
    sleep(1);

    const startRes = http.post(`${BASE_URL}/exams/${id}/start`, null, {
      headers: authHeaders(token),
      tags: { name: 'exam_flow_start' },
    });
    check(startRes, {
      'Flow start: 200/201': (r) => r.status === 200 || r.status === 201,
    });

    try {
      const body = JSON.parse(startRes.body as string);
      sessionId = body.id ?? body.data?.id ?? null;
    } catch {
      sessionId = null;
    }

    sleep(2 + Math.random() * 2);
  });

  if (!sessionId) return;

  group('Exam - Full Flow: Submit', () => {
    const submission = generateExamSubmission();
    const submit = (): void => {
      const submitRes = http.post(
        `${BASE_URL}/exam-sessions/${sessionId}/submit`,
        JSON.stringify(submission),
        { headers: authHeaders(token), tags: { name: 'exam_flow_submit' } },
      );
      check(submitRes, {
        'Flow submit: 200/201': (r) => r.status === 200 || r.status === 201,
      });
    };

    measureSocketIoEventLatency(
      {
        url: `${BASE_URL.replace('http', 'ws')}/notifications/socket.io`,
        namespace: '/notifications',
        token,
        expectedEvent: 'notification.created',
        conditionFn: isExamResultNotification,
        timeoutMs: 5000,
      },
      submit,
    );
    sleep(0.5);
  });
}
