/**
 * ============================================================
 * KỊCH BẢN STRESS TEST - KIỂM TRA ĐẾN GIỚI HẠN
 * ============================================================
 *
 * Mục đích: Tìm giới hạn chịu tải của hệ thống
 * - Tăng dần từ 0 → 100 → 200 VUs trong 10 phút
 * - Tìm điểm mà hệ thống bắt đầu chậm hoặc lỗi
 * - Kiểm tra khả năng phục hồi khi giảm tải
 *
 * Cách chạy:
 *   k6 run scenarios/stress.js
 *   k6 run scenarios/stress.js -e BASE_URL=http://your-gateway:8000
 *   k6 run scenarios/stress.js --out json=results/stress_test.json
 *
 * Khi nào dùng:
 *   - Đánh giá giới hạn chịu tải (capacity planning)
 *   - Tìm bottleneck trong hệ thống
 *   - Kiểm tra autoscaling hoạt động đúng
 *
 * ⚠️ CHÚ Ý: Test này tạo tải nặng, chỉ chạy trên môi trường staging/test!
 */

import { sleep } from 'k6';
import { STRESS_THRESHOLDS } from '../config.js';
import { checkAllServicesHealth } from '../services/health.js';
import {
  testLogin,
  testGetProfile,
  testLoginFailure,
  testRegister,
} from '../services/identity.js';
import {
  testListExams,
  testGetExamDetail,
  testStartExam,
  testSubmitExam,
  testFullExamFlow,
} from '../services/exam.js';
import {
  testListCourses,
  testGetCourseDetail,
  testSearchCourses,
  testEnrollCourse,
  testListEnrollments,
} from '../services/course.js';

/**
 * Cấu hình k6 cho stress test
 *
 * Các giai đoạn:
 * 1. Warm-up (2 phút): 0 → 50 VUs - Khởi động nhẹ
 * 2. Tải trung bình (2 phút): 50 → 100 VUs - Tải bình thường cao
 * 3. Giữ 100 VUs (2 phút): Đánh giá ổn định ở mức cao
 * 4. Tải nặng (2 phút): 100 → 200 VUs - Vượt tải bình thường
 * 5. Giữ 200 VUs (2 phút): Đánh giá giới hạn
 * 6. Recovery (2 phút): 200 → 0 VUs - Kiểm tra phục hồi
 *
 * Tổng thời gian: ~12 phút
 */
export const options = {
  stages: [
    // Giai đoạn 1: Khởi động - tăng dần lên 50 VUs
    { duration: '2m', target: 50 },
    // Giai đoạn 2: Tăng lên 100 VUs - mức tải cao bình thường
    { duration: '2m', target: 100 },
    // Giai đoạn 3: Giữ 100 VUs để đánh giá ổn định
    { duration: '2m', target: 100 },
    // Giai đoạn 4: Đẩy lên 200 VUs - vượt mức tải bình thường
    { duration: '2m', target: 200 },
    // Giai đoạn 5: Giữ 200 VUs - kiểm tra tại giới hạn
    { duration: '2m', target: 200 },
    // Giai đoạn 6: Giảm về 0 - kiểm tra khả năng phục hồi
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    ...STRESS_THRESHOLDS,
    // Stress test cho phép phản hồi chậm hơn nhưng vẫn theo dõi
    'http_req_duration{name:identity_login}': ['p(95)<2000'],
    'http_req_duration{name:exam_list}': ['p(95)<1500'],
    'http_req_duration{name:course_list}': ['p(95)<1500'],
  },
  tags: {
    test_type: 'stress',
  },
};

/**
 * Hàm chính - mỗi VU mô phỏng người dùng dưới tải nặng
 *
 * Khác với load test:
 * - Thời gian nghỉ ngắn hơn (tạo nhiều request hơn)
 * - Nhiều hành động nặng hơn (đăng ký, nộp bài)
 * - Thêm các luồng phức tạp (full exam flow)
 *
 * Mục tiêu: Đẩy hệ thống đến giới hạn để tìm điểm yếu
 */
export default function () {
  // Lấy số VU hiện tại để điều chỉnh hành vi
  const vuId = __VU;
  const iteration = __ITER;

  // === LUỒNG 1: Người dùng duyệt nội dung (tất cả VUs) ===

  // Đăng nhập
  testLogin();
  sleep(0.5 + Math.random());

  // Xem danh sách bài thi
  testListExams();
  sleep(0.5 + Math.random());

  // Xem danh sách khóa học
  testListCourses();
  sleep(0.5 + Math.random());

  // === LUỒNG 2: Tương tác trung bình (50% VUs) ===

  if (Math.random() < 0.5) {
    testGetExamDetail();
    sleep(0.5);
  }

  if (Math.random() < 0.5) {
    testGetCourseDetail();
    sleep(0.5);
  }

  if (Math.random() < 0.4) {
    testSearchCourses();
    sleep(0.5);
  }

  if (Math.random() < 0.3) {
    testGetProfile();
    sleep(0.5);
  }

  // === LUỒNG 3: Hành động nặng (xác suất thấp hơn) ===

  // 20% VUs ghi danh khóa học
  if (Math.random() < 0.2) {
    testEnrollCourse();
    sleep(0.5);
  }

  // 15% VUs xem danh sách enrollment
  if (Math.random() < 0.15) {
    testListEnrollments();
    sleep(0.5);
  }

  // 10% VUs bắt đầu thi
  if (Math.random() < 0.1) {
    testStartExam();
    sleep(1);
  }

  // 5% VUs nộp bài thi
  if (Math.random() < 0.05) {
    testSubmitExam();
    sleep(0.5);
  }

  // 5% VUs đăng ký tài khoản mới
  if (Math.random() < 0.05) {
    testRegister();
    sleep(0.5);
  }

  // 3% VUs chạy luồng thi đầy đủ (rất nặng)
  if (Math.random() < 0.03) {
    testFullExamFlow();
    sleep(1);
  }

  // 5% VUs test đăng nhập thất bại
  if (Math.random() < 0.05) {
    testLoginFailure();
    sleep(0.3);
  }

  // 5% VUs kiểm tra health (giám sát trong lúc stress)
  if (Math.random() < 0.05) {
    checkAllServicesHealth();
    sleep(0.5);
  }

  // Nghỉ ngắn giữa các iteration (ngắn hơn load test để tạo áp lực)
  sleep(0.5 + Math.random());
}
