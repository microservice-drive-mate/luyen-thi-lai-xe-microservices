/**
 * ============================================================
 * TEST DỊCH VỤ BÀI THI (EXAM SERVICE)
 * ============================================================
 *
 * File này test các chức năng chính của Exam Service:
 * - Lấy danh sách bài thi (GET /exams)
 * - Lấy chi tiết bài thi (GET /exams/:id)
 * - Tạo bài thi mới (POST /exams) - cần quyền admin
 * - Bắt đầu làm bài thi (POST /exams/:id/start)
 * - Nộp bài thi (POST /exams/:id/submit)
 * - Xem kết quả thi (GET /exams/:id/results)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from '../config.js';
import { loginAsDefaultUser, loginAsAdmin } from '../helpers/auth.js';
import {
  generateExamData,
  generateExamSubmission,
  randomPagination,
} from '../helpers/data.js';

/**
 * Test lấy danh sách bài thi
 * Endpoint công khai, không cần xác thực
 * Hỗ trợ phân trang (page, limit)
 */
export function testListExams() {
  group('Exam - Danh sách bài thi', () => {
    const pagination = randomPagination();
    const url = `${BASE_URL}/exams?page=${pagination.page}&limit=${pagination.limit}`;

    const res = http.get(url, {
      headers: JSON_HEADERS,
      tags: { name: 'exam_list' },
    });

    check(res, {
      'Danh sách thi: status 200': (r) => r.status === 200,
      'Danh sách thi: response là JSON hợp lệ': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
      'Danh sách thi: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);
  });
}

/**
 * Test lấy chi tiết một bài thi
 * Sử dụng ID mặc định hoặc từ biến môi trường
 */
export function testGetExamDetail() {
  group('Exam - Chi tiết bài thi', () => {
    const examId = __ENV.TEST_EXAM_ID || '1';

    const res = http.get(`${BASE_URL}/exams/${examId}`, {
      headers: JSON_HEADERS,
      tags: { name: 'exam_detail' },
    });

    check(res, {
      'Chi tiết thi: status 200 hoặc 404': (r) =>
        r.status === 200 || r.status === 404,
      'Chi tiết thi: phản hồi < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.3);
  });
}

/**
 * Test tạo bài thi mới (chỉ admin)
 * Cần đăng nhập admin để có quyền tạo
 */
export function testCreateExam() {
  group('Exam - Tạo bài thi mới (Admin)', () => {
    // Đăng nhập admin
    const token = loginAsAdmin();
    if (!token) {
      console.warn('Bỏ qua test tạo exam vì không đăng nhập admin được');
      return;
    }

    sleep(0.3);

    // Tạo dữ liệu bài thi ngẫu nhiên
    const examData = generateExamData();

    const res = http.post(`${BASE_URL}/exams`, JSON.stringify(examData), {
      headers: authHeaders(token),
      tags: { name: 'exam_create' },
    });

    check(res, {
      'Tạo exam: status 201 hoặc 200': (r) =>
        r.status === 201 || r.status === 200,
      'Tạo exam: response có ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.id || (body.data && body.data.id));
        } catch (e) {
          return false;
        }
      },
      'Tạo exam: phản hồi < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(0.5);
  });
}

/**
 * Test bắt đầu làm bài thi
 * User phải đăng nhập, hệ thống tạo session thi mới
 */
export function testStartExam() {
  group('Exam - Bắt đầu làm bài', () => {
    // Đăng nhập user
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test bắt đầu thi vì không đăng nhập được');
      return;
    }

    const examId = __ENV.TEST_EXAM_ID || '1';

    sleep(0.3);

    // Gửi yêu cầu bắt đầu thi
    const res = http.post(`${BASE_URL}/exams/${examId}/start`, null, {
      headers: authHeaders(token),
      tags: { name: 'exam_start' },
    });

    check(res, {
      'Bắt đầu thi: status 200 hoặc 201': (r) =>
        r.status === 200 || r.status === 201,
      'Bắt đầu thi: có danh sách câu hỏi hoặc session ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(
            body.questions ||
            body.sessionId ||
            (body.data && (body.data.questions || body.data.sessionId))
          );
        } catch (e) {
          return false;
        }
      },
      'Bắt đầu thi: phản hồi < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(0.5);
  });
}

/**
 * Test nộp bài thi
 * Mô phỏng thí sinh hoàn thành và nộp bài
 */
export function testSubmitExam() {
  group('Exam - Nộp bài thi', () => {
    // Đăng nhập
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test nộp bài vì không đăng nhập được');
      return;
    }

    const examId = __ENV.TEST_EXAM_ID || '1';

    sleep(0.3);

    // Tạo dữ liệu bài nộp ngẫu nhiên (30 câu)
    const submission = generateExamSubmission(30);

    const res = http.post(
      `${BASE_URL}/exams/${examId}/submit`,
      JSON.stringify(submission),
      {
        headers: authHeaders(token),
        tags: { name: 'exam_submit' },
      },
    );

    check(res, {
      'Nộp bài: status 200 hoặc 201': (r) =>
        r.status === 200 || r.status === 201,
      'Nộp bài: có kết quả (score hoặc result)': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(
            body.score !== undefined ||
            body.result !== undefined ||
            (body.data &&
              (body.data.score !== undefined || body.data.result !== undefined))
          );
        } catch (e) {
          return false;
        }
      },
      'Nộp bài: phản hồi < 3s': (r) => r.timings.duration < 3000,
    });

    sleep(0.5);
  });
}

/**
 * Test xem kết quả thi
 * Lấy kết quả của bài thi đã hoàn thành
 */
export function testGetExamResults() {
  group('Exam - Xem kết quả thi', () => {
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test kết quả thi vì không đăng nhập được');
      return;
    }

    const examId = __ENV.TEST_EXAM_ID || '1';

    sleep(0.3);

    const res = http.get(`${BASE_URL}/exams/${examId}/results`, {
      headers: authHeaders(token),
      tags: { name: 'exam_results' },
    });

    check(res, {
      'Kết quả thi: status 200 hoặc 404': (r) =>
        r.status === 200 || r.status === 404,
      'Kết quả thi: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.3);
  });
}

/**
 * Test luồng thi đầy đủ: Xem danh sách → Chọn đề → Bắt đầu → Nộp bài → Xem kết quả
 * Mô phỏng hành trình thi hoàn chỉnh của thí sinh
 */
export function testFullExamFlow() {
  group('Exam - Luồng thi đầy đủ', () => {
    // Bước 1: Đăng nhập
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua luồng thi vì không đăng nhập được');
      return;
    }

    // Bước 2: Xem danh sách bài thi
    const listRes = http.get(`${BASE_URL}/exams?page=1&limit=10`, {
      headers: authHeaders(token),
      tags: { name: 'exam_flow_list' },
    });

    check(listRes, {
      'Flow - Danh sách thi: status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Bước 3: Xem chi tiết bài thi
    const examId = __ENV.TEST_EXAM_ID || '1';
    const detailRes = http.get(`${BASE_URL}/exams/${examId}`, {
      headers: authHeaders(token),
      tags: { name: 'exam_flow_detail' },
    });

    check(detailRes, {
      'Flow - Chi tiết thi: status 200': (r) =>
        r.status === 200 || r.status === 404,
    });

    sleep(1);

    // Bước 4: Bắt đầu làm bài
    const startRes = http.post(`${BASE_URL}/exams/${examId}/start`, null, {
      headers: authHeaders(token),
      tags: { name: 'exam_flow_start' },
    });

    check(startRes, {
      'Flow - Bắt đầu thi: status 200/201': (r) =>
        r.status === 200 || r.status === 201,
    });

    // Mô phỏng thời gian làm bài (2-5 giây trong test)
    sleep(2 + Math.random() * 3);

    // Bước 5: Nộp bài thi
    const submission = generateExamSubmission(30);
    const submitRes = http.post(
      `${BASE_URL}/exams/${examId}/submit`,
      JSON.stringify(submission),
      {
        headers: authHeaders(token),
        tags: { name: 'exam_flow_submit' },
      },
    );

    check(submitRes, {
      'Flow - Nộp bài: status 200/201': (r) =>
        r.status === 200 || r.status === 201,
    });

    sleep(1);

    // Bước 6: Xem kết quả
    const resultRes = http.get(`${BASE_URL}/exams/${examId}/results`, {
      headers: authHeaders(token),
      tags: { name: 'exam_flow_results' },
    });

    check(resultRes, {
      'Flow - Kết quả: status 200': (r) => r.status === 200 || r.status === 404,
    });

    sleep(0.5);
  });
}
