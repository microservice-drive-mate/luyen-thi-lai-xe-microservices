/**
 * ============================================================
 * KỊCH BẢN LOAD TEST - KIỂM TRA TẢI BÌNH THƯỜNG
 * ============================================================
 *
 * Mục đích: Đánh giá hiệu suất hệ thống dưới tải bình thường
 * - Tăng dần từ 0 lên 50 VUs trong 5 phút
 * - Giữ 50 VUs trong 5 phút
 * - Giảm dần về 0 trong 2 phút
 * - Tổng thời gian: ~12 phút
 *
 * Cách chạy:
 *   k6 run scenarios/load.js
 *   k6 run scenarios/load.js -e BASE_URL=http://your-gateway:8000
 *   k6 run scenarios/load.js --out json=results/load_test.json
 *
 * Khi nào dùng:
 *   - Đánh giá hiệu suất baseline của hệ thống
 *   - Kiểm tra SLA (Service Level Agreement)
 *   - So sánh hiệu suất giữa các phiên bản
 */

import { sleep } from 'k6';
import { DEFAULT_THRESHOLDS } from '../config.js';
import { checkAllServicesHealth } from '../services/health.js';
import {
  testLogin,
  testGetProfile,
  testLoginFailure,
} from '../services/identity.js';
import {
  testListExams,
  testGetExamDetail,
  testStartExam,
  testSubmitExam,
} from '../services/exam.js';
import {
  testListCourses,
  testGetCourseDetail,
  testEnrollCourse,
  testListEnrollments,
} from '../services/course.js';

/**
 * Cấu hình k6 cho load test
 *
 * Các giai đoạn (stages):
 * 1. Ramp-up (5 phút): Tăng dần từ 0 → 50 VUs
 *    - Mô phỏng lượng người dùng tăng dần vào giờ cao điểm
 * 2. Steady state (5 phút): Giữ nguyên 50 VUs
 *    - Mô phỏng tải ổn định, đánh giá hiệu suất thực tế
 * 3. Ramp-down (2 phút): Giảm từ 50 → 0 VUs
 *    - Mô phỏng lượng người dùng giảm dần
 */
export const options = {
  stages: [
    // Giai đoạn 1: Tăng dần lên 50 VUs trong 5 phút
    { duration: '5m', target: 50 },
    // Giai đoạn 2: Giữ ổn định 50 VUs trong 5 phút
    { duration: '5m', target: 50 },
    // Giai đoạn 3: Giảm dần về 0 trong 2 phút
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    // Thresholds riêng cho từng nhóm request
    'http_req_duration{name:identity_login}': ['p(95)<800'],
    'http_req_duration{name:exam_list}': ['p(95)<600'],
    'http_req_duration{name:course_list}': ['p(95)<600'],
  },
  tags: {
    test_type: 'load',
  },
};

/**
 * Hàm chính - mỗi VU mô phỏng một người dùng thực
 *
 * Kịch bản người dùng:
 * 1. Kiểm tra sức khỏe hệ thống (10% xác suất - không phải lúc nào cũng kiểm tra)
 * 2. Đăng nhập
 * 3. Xem danh sách bài thi
 * 4. Xem chi tiết bài thi
 * 5. Xem danh sách khóa học
 * 6. Xem chi tiết khóa học
 * 7. Ghi danh khóa học (30% xác suất)
 * 8. Bắt đầu thi (20% xác suất)
 * 9. Nộp bài thi (10% xác suất)
 *
 * Xác suất khác nhau mô phỏng hành vi thực tế:
 * - Nhiều người xem, ít người đăng ký/thi
 */
export default function () {
  // 10% VUs kiểm tra health check
  if (Math.random() < 0.1) {
    checkAllServicesHealth();
    sleep(1);
  }

  // === LUỒNG CHÍNH: Đăng nhập và duyệt nội dung ===

  // Bước 1: Đăng nhập
  testLogin();
  sleep(1 + Math.random() * 2); // Nghỉ 1-3 giây mô phỏng thời gian đọc

  // Bước 2: Xem profile
  testGetProfile();
  sleep(0.5 + Math.random());

  // Bước 3: Xem danh sách bài thi
  testListExams();
  sleep(1 + Math.random() * 2);

  // Bước 4: Xem chi tiết bài thi
  testGetExamDetail();
  sleep(1 + Math.random());

  // Bước 5: Xem danh sách khóa học
  testListCourses();
  sleep(1 + Math.random() * 2);

  // Bước 6: Xem chi tiết khóa học
  testGetCourseDetail();
  sleep(1 + Math.random());

  // === LUỒNG PHỤ: Hành động cao cấp (xác suất thấp hơn) ===

  // 30% VUs ghi danh khóa học (không phải ai cũng đăng ký)
  if (Math.random() < 0.3) {
    testEnrollCourse();
    sleep(1);
  }

  // 30% VUs xem danh sách enrollment
  if (Math.random() < 0.3) {
    testListEnrollments();
    sleep(1);
  }

  // 20% VUs bắt đầu làm bài thi
  if (Math.random() < 0.2) {
    testStartExam();
    sleep(2);
  }

  // 10% VUs nộp bài thi
  if (Math.random() < 0.1) {
    testSubmitExam();
    sleep(1);
  }

  // 5% VUs test đăng nhập thất bại (mô phỏng nhập sai mật khẩu)
  if (Math.random() < 0.05) {
    testLoginFailure();
    sleep(0.5);
  }

  // Nghỉ giữa các iteration
  sleep(1 + Math.random() * 3);
}
