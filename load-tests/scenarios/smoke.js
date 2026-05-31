/**
 * ============================================================
 * KỊCH BẢN SMOKE TEST - KIỂM TRA CƠ BẢN
 * ============================================================
 *
 * Mục đích: Kiểm tra nhanh xem hệ thống có hoạt động bình thường không
 * - Chỉ sử dụng 1 Virtual User (VU)
 * - Chạy trong 30 giây
 * - Test tất cả health endpoints của 10 services
 * - Thresholds nghiêm ngặt vì tải rất nhẹ
 *
 * Cách chạy:
 *   k6 run scenarios/smoke.js
 *   k6 run scenarios/smoke.js -e BASE_URL=http://your-gateway:8000
 *
 * Khi nào dùng:
 *   - Sau khi deploy phiên bản mới
 *   - Trước khi chạy các test nặng hơn (load, stress)
 *   - Trong CI/CD pipeline để xác nhận hệ thống chạy
 */

import { sleep } from 'k6';
import { SMOKE_THRESHOLDS } from '../config.js';
import { checkAllServicesHealth } from '../services/health.js';
import { testLogin, testGetProfile } from '../services/identity.js';
import { testListExams } from '../services/exam.js';
import { testListCourses } from '../services/course.js';

/**
 * Cấu hình k6 cho smoke test
 * - 1 VU: chỉ 1 người dùng ảo
 * - duration 30s: chạy trong 30 giây
 * - Thresholds nghiêm ngặt: p(95) < 300ms, lỗi < 1%
 */
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: SMOKE_THRESHOLDS,
  // Tag để phân biệt với các loại test khác trong báo cáo
  tags: {
    test_type: 'smoke',
  },
};

const includeBusinessFlows = __ENV.K6_INCLUDE_BUSINESS_FLOWS === 'true';

/**
 * Hàm chính - mỗi VU sẽ lặp lại hàm này cho đến hết thời gian
 *
 * Thứ tự test:
 * 1. Health check tất cả 10 services (liveness + readiness)
 * 2. Đăng nhập (kiểm tra Identity service)
 * 3. Lấy profile (kiểm tra xác thực JWT)
 * 4. Danh sách bài thi (kiểm tra Exam service)
 * 5. Danh sách khóa học (kiểm tra Course service)
 */
export default function () {
  // Kiểm tra sức khỏe tất cả services - đây là test quan trọng nhất
  checkAllServicesHealth();
  sleep(1);

  // Kiểm tra luồng đăng nhập cơ bản
  if (!includeBusinessFlows) {
    return;
  }

  testLogin();
  sleep(1);

  // Kiểm tra xác thực JWT qua endpoint profile
  testGetProfile();
  sleep(1);

  // Kiểm tra Exam service có phản hồi không
  testListExams();
  sleep(1);

  // Kiểm tra Course service có phản hồi không
  testListCourses();
  sleep(1);
}
