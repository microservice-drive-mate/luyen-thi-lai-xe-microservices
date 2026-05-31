/**
 * ============================================================
 * TEST DỊCH VỤ KHÓA HỌC (COURSE SERVICE)
 * ============================================================
 *
 * File này test các chức năng chính của Course Service:
 * - Lấy danh sách khóa học (GET /courses)
 * - Lấy chi tiết khóa học (GET /courses/:id)
 * - Ghi danh khóa học (POST /enrollments)
 * - Xem danh sách ghi danh (GET /enrollments)
 * - Xem tiến độ học (GET /enrollments/:id/progress)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from '../config.js';
import { loginAsDefaultUser } from '../helpers/auth.js';
import { generateEnrollmentData, randomPagination } from '../helpers/data.js';

/**
 * Test lấy danh sách khóa học
 * Endpoint công khai, hỗ trợ phân trang và lọc theo loại bằng lái
 */
export function testListCourses() {
  group('Course - Danh sách khóa học', () => {
    const pagination = randomPagination();
    const url = `${BASE_URL}/courses?page=${pagination.page}&limit=${pagination.limit}`;

    const res = http.get(url, {
      headers: JSON_HEADERS,
      tags: { name: 'course_list' },
    });

    check(res, {
      'Danh sách khóa học: status 200': (r) => r.status === 200,
      'Danh sách khóa học: response JSON hợp lệ': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
      'Danh sách khóa học: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);
  });
}

/**
 * Test lấy chi tiết một khóa học
 * Bao gồm thông tin khóa học, số bài học, giá, v.v.
 */
export function testGetCourseDetail() {
  group('Course - Chi tiết khóa học', () => {
    const courseId = __ENV.TEST_COURSE_ID || '1';

    const res = http.get(`${BASE_URL}/courses/${courseId}`, {
      headers: JSON_HEADERS,
      tags: { name: 'course_detail' },
    });

    check(res, {
      'Chi tiết khóa học: status 200 hoặc 404': (r) =>
        r.status === 200 || r.status === 404,
      'Chi tiết khóa học: phản hồi < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.3);
  });
}

/**
 * Test tìm kiếm khóa học theo từ khóa
 * Kiểm tra tính năng search với các query khác nhau
 */
export function testSearchCourses() {
  group('Course - Tìm kiếm khóa học', () => {
    const searchTerms = ['B2', 'lái xe', 'A1', 'ô tô', 'xe máy'];
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const res = http.get(
      `${BASE_URL}/courses?search=${encodeURIComponent(term)}&page=1&limit=10`,
      {
        headers: JSON_HEADERS,
        tags: { name: 'course_search' },
      },
    );

    check(res, {
      'Tìm kiếm khóa học: status 200': (r) => r.status === 200,
      'Tìm kiếm khóa học: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);
  });
}

/**
 * Test ghi danh (enroll) vào khóa học
 * Cần đăng nhập, gửi POST /enrollments
 */
export function testEnrollCourse() {
  group('Course - Ghi danh khóa học', () => {
    // Đăng nhập user
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test ghi danh vì không đăng nhập được');
      return;
    }

    const courseId = __ENV.TEST_COURSE_ID || '1';

    sleep(0.3);

    // Gửi yêu cầu ghi danh
    const enrollmentData = generateEnrollmentData(courseId);

    const res = http.post(
      `${BASE_URL}/enrollments`,
      JSON.stringify(enrollmentData),
      {
        headers: authHeaders(token),
        tags: { name: 'course_enroll' },
      },
    );

    check(res, {
      'Ghi danh: status 201 hoặc 200 hoặc 409 (đã ghi danh)': (r) =>
        r.status === 201 || r.status === 200 || r.status === 409,
      'Ghi danh: phản hồi < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(0.5);
  });
}

/**
 * Test xem danh sách khóa học đã ghi danh
 * Lấy tất cả enrollment của user hiện tại
 */
export function testListEnrollments() {
  group('Course - Danh sách ghi danh', () => {
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test danh sách ghi danh vì không đăng nhập được');
      return;
    }

    sleep(0.3);

    const pagination = randomPagination();
    const res = http.get(
      `${BASE_URL}/enrollments?page=${pagination.page}&limit=${pagination.limit}`,
      {
        headers: authHeaders(token),
        tags: { name: 'enrollment_list' },
      },
    );

    check(res, {
      'Danh sách ghi danh: status 200': (r) => r.status === 200,
      'Danh sách ghi danh: response JSON hợp lệ': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
      'Danh sách ghi danh: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.3);
  });
}

/**
 * Test xem tiến độ học của một enrollment
 * Bao gồm: phần trăm hoàn thành, bài học đã xong, v.v.
 */
export function testGetEnrollmentProgress() {
  group('Course - Tiến độ học', () => {
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test tiến độ vì không đăng nhập được');
      return;
    }

    const enrollmentId = __ENV.TEST_ENROLLMENT_ID || '1';

    sleep(0.3);

    const res = http.get(`${BASE_URL}/enrollments/${enrollmentId}/progress`, {
      headers: authHeaders(token),
      tags: { name: 'enrollment_progress' },
    });

    check(res, {
      'Tiến độ: status 200 hoặc 404': (r) =>
        r.status === 200 || r.status === 404,
      'Tiến độ: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.3);
  });
}

/**
 * Test luồng khóa học đầy đủ:
 * Xem danh sách → Chọn khóa → Xem chi tiết → Ghi danh → Xem tiến độ
 * Mô phỏng hành trình học viên mới
 */
export function testFullCourseFlow() {
  group('Course - Luồng khóa học đầy đủ', () => {
    // Bước 1: Xem danh sách khóa học (không cần đăng nhập)
    const listRes = http.get(`${BASE_URL}/courses?page=1&limit=10`, {
      headers: JSON_HEADERS,
      tags: { name: 'course_flow_list' },
    });

    check(listRes, {
      'Flow - Danh sách khóa học: status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Bước 2: Xem chi tiết khóa học
    const courseId = __ENV.TEST_COURSE_ID || '1';
    const detailRes = http.get(`${BASE_URL}/courses/${courseId}`, {
      headers: JSON_HEADERS,
      tags: { name: 'course_flow_detail' },
    });

    check(detailRes, {
      'Flow - Chi tiết: status 200 hoặc 404': (r) =>
        r.status === 200 || r.status === 404,
    });

    sleep(1);

    // Bước 3: Đăng nhập để ghi danh
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Flow bị dừng vì không đăng nhập được');
      return;
    }

    sleep(0.5);

    // Bước 4: Ghi danh khóa học
    const enrollmentData = generateEnrollmentData(courseId);
    const enrollRes = http.post(
      `${BASE_URL}/enrollments`,
      JSON.stringify(enrollmentData),
      {
        headers: authHeaders(token),
        tags: { name: 'course_flow_enroll' },
      },
    );

    check(enrollRes, {
      'Flow - Ghi danh: status 200/201/409': (r) =>
        r.status === 200 || r.status === 201 || r.status === 409,
    });

    sleep(1);

    // Bước 5: Xem danh sách enrollment
    const enrollListRes = http.get(`${BASE_URL}/enrollments?page=1&limit=10`, {
      headers: authHeaders(token),
      tags: { name: 'course_flow_enrollments' },
    });

    check(enrollListRes, {
      'Flow - Danh sách ghi danh: status 200': (r) => r.status === 200,
    });

    sleep(0.5);
  });
}
