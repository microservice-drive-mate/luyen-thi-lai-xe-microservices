/**
 * ============================================================
 * KỊCH BẢN SPIKE TEST - KIỂM TRA TẢI ĐỘT NGỘT
 * ============================================================
 *
 * Mục đích: Kiểm tra hệ thống phản ứng thế nào với tải đột ngột
 * - Bình thường: 5 VUs (tải nhẹ)
 * - Đột ngột: nhảy lên 100 VUs trong 10 giây
 * - Quay lại: giảm về 5 VUs
 *
 * Mô phỏng tình huống thực tế:
 * - Flash sale / sự kiện đặc biệt
 * - Nhiều thí sinh bắt đầu thi cùng lúc
 * - Viral trên mạng xã hội → lượng truy cập tăng đột biến
 *
 * Cách chạy:
 *   k6 run scenarios/spike.js
 *   k6 run scenarios/spike.js -e BASE_URL=http://your-gateway:8000
 *
 * ⚠️ CHÚ Ý: Test tạo tải đột ngột, có thể gây ảnh hưởng đến hệ thống!
 */

import { sleep } from 'k6';
import { SPIKE_THRESHOLDS } from '../config.js';
import { checkAllServicesHealth } from '../services/health.js';
import { testLogin, testGetProfile } from '../services/identity.js';
import {
  testListExams,
  testGetExamDetail,
  testStartExam,
} from '../services/exam.js';
import { testListCourses, testGetCourseDetail } from '../services/course.js';

/**
 * Cấu hình k6 cho spike test
 *
 * Các giai đoạn:
 * 1. Tải bình thường (30s): 5 VUs - baseline
 * 2. Tăng đột ngột (10s): 5 → 100 VUs - SPIKE!
 * 3. Giữ spike (30s): 100 VUs - hệ thống chịu tải đột ngột
 * 4. Giảm đột ngột (10s): 100 → 5 VUs - hệ thống phục hồi
 * 5. Tải bình thường (30s): 5 VUs - kiểm tra phục hồi
 * 6. Spike lần 2 (10s): 5 → 100 VUs - test lại sau phục hồi
 * 7. Giữ spike (30s): 100 VUs - đánh giá lần 2
 * 8. Ramp down (30s): 100 → 0 VUs - kết thúc
 *
 * Tổng thời gian: ~3 phút
 */
export const options = {
  stages: [
    // === ĐỢT 1 ===
    // Giai đoạn 1: Tải bình thường - thiết lập baseline
    { duration: '30s', target: 5 },
    // Giai đoạn 2: 💥 SPIKE! Tăng đột ngột lên 100 VUs trong 10 giây
    { duration: '10s', target: 100 },
    // Giai đoạn 3: Giữ tải đỉnh - hệ thống phải xử lý 100 người dùng cùng lúc
    { duration: '30s', target: 100 },
    // Giai đoạn 4: Giảm đột ngột - kiểm tra hệ thống có phục hồi nhanh không
    { duration: '10s', target: 5 },
    // Giai đoạn 5: Phục hồi - hệ thống phải trở lại bình thường
    { duration: '30s', target: 5 },

    // === ĐỢT 2 (kiểm tra lại sau phục hồi) ===
    // Giai đoạn 6: 💥 SPIKE lần 2! Kiểm tra hệ thống sau khi đã phục hồi
    { duration: '10s', target: 100 },
    // Giai đoạn 7: Giữ tải đỉnh lần 2
    { duration: '30s', target: 100 },
    // Giai đoạn 8: Giảm dần về 0 - kết thúc test
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ...SPIKE_THRESHOLDS,
    // Spike test cho phép độ trễ cao hơn vì tải đột ngột
    'http_req_duration{name:identity_login}': ['p(95)<3000'],
    'http_req_duration{name:exam_list}': ['p(95)<2000'],
    'http_req_duration{name:course_list}': ['p(95)<2000'],
  },
  tags: {
    test_type: 'spike',
  },
};

/**
 * Hàm chính - mỗi VU mô phỏng người dùng trong tình huống spike
 *
 * Trong tình huống spike, hành vi người dùng thường là:
 * - Nhiều người cùng đăng nhập
 * - Nhiều người cùng xem danh sách bài thi/khóa học
 * - Một số người bắt đầu thi
 *
 * Thời gian nghỉ ngắn vì mô phỏng nhiều người truy cập nhanh
 */
export default function () {
  // === Hành động chính (mọi VU đều thực hiện) ===

  // Đăng nhập - hành động phổ biến nhất khi spike
  testLogin();
  sleep(0.3 + Math.random() * 0.5);

  // Xem danh sách bài thi - người dùng tìm đề thi
  testListExams();
  sleep(0.3 + Math.random() * 0.5);

  // Xem danh sách khóa học
  testListCourses();
  sleep(0.3 + Math.random() * 0.5);

  // === Hành động phụ (xác suất) ===

  // 40% xem chi tiết bài thi
  if (Math.random() < 0.4) {
    testGetExamDetail();
    sleep(0.3);
  }

  // 40% xem chi tiết khóa học
  if (Math.random() < 0.4) {
    testGetCourseDetail();
    sleep(0.3);
  }

  // 20% xem profile
  if (Math.random() < 0.2) {
    testGetProfile();
    sleep(0.3);
  }

  // 10% bắt đầu thi (mô phỏng nhiều người thi cùng lúc)
  if (Math.random() < 0.1) {
    testStartExam();
    sleep(0.5);
  }

  // 5% kiểm tra health (giám sát hệ thống trong spike)
  if (Math.random() < 0.05) {
    checkAllServicesHealth();
    sleep(0.3);
  }

  // Nghỉ rất ngắn vì spike = nhiều request dồn dập
  sleep(0.2 + Math.random() * 0.5);
}
