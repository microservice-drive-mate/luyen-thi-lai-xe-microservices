/**
 * ============================================================
 * KIỂM TRA SỨC KHỎE (HEALTH CHECK) CHO TẤT CẢ 10 SERVICES
 * ============================================================
 *
 * File này kiểm tra endpoint liveness và readiness của từng service:
 * - /identity-service/health/live & /identity-service/health/ready
 * - /user-service/health/live & /user-service/health/ready
 * - /exam-service/health/live & /exam-service/health/ready
 * - /course-service/health/live & /course-service/health/ready
 * - /question-service/health/live & /question-service/health/ready
 * - /notification-service/health/live & /notification-service/health/ready
 * - /analytics-service/health/live & /analytics-service/health/ready
 * - /simulation-service/health/live & /simulation-service/health/ready
 * - /media-service/health/live & /media-service/health/ready
 * - /audit-service/health/live & /audit-service/health/ready
 *
 * Mỗi endpoint được kiểm tra: status 200 và thời gian phản hồi < 500ms
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, SERVICES } from '../config.js';

/**
 * Kiểm tra liveness endpoint của một service
 * Liveness cho biết service có đang chạy hay không
 *
 * @param {object} service - Thông tin service từ config
 */
export function checkLiveness(service) {
  const res = http.get(`${BASE_URL}${service.healthLive}`, {
    tags: { name: `health_live_${service.name}` },
  });

  check(res, {
    [`${service.name} liveness - status 200`]: (r) => r.status === 200,
    [`${service.name} liveness - phản hồi < 500ms`]: (r) =>
      r.timings.duration < 500,
  });

  return res;
}

/**
 * Kiểm tra readiness endpoint của một service
 * Readiness cho biết service đã sẵn sàng nhận request chưa
 *
 * @param {object} service - Thông tin service từ config
 */
export function checkReadiness(service) {
  const res = http.get(`${BASE_URL}${service.healthReady}`, {
    tags: { name: `health_ready_${service.name}` },
  });

  check(res, {
    [`${service.name} readiness - status 200`]: (r) => r.status === 200,
    [`${service.name} readiness - phản hồi < 500ms`]: (r) =>
      r.timings.duration < 500,
  });

  return res;
}

/**
 * Kiểm tra cả liveness và readiness của một service
 * Dùng group để nhóm kết quả cho dễ đọc
 *
 * @param {object} service - Thông tin service từ config
 */
export function checkServiceHealth(service) {
  group(`Health Check - ${service.name}`, () => {
    // Kiểm tra liveness - service có đang sống không?
    checkLiveness(service);

    // Nghỉ 100ms giữa 2 request để không gây quá tải
    sleep(0.1);

    // Kiểm tra readiness - service đã sẵn sàng chưa?
    checkReadiness(service);
  });
}

/**
 * Kiểm tra sức khỏe của TẤT CẢ 10 services
 * Lặp qua danh sách services và kiểm tra từng cái
 */
export function checkAllServicesHealth() {
  group('Kiểm tra sức khỏe tất cả services', () => {
    for (const service of SERVICES) {
      checkServiceHealth(service);
      // Nghỉ 200ms giữa các services
      sleep(0.2);
    }
  });
}

/**
 * Chỉ kiểm tra liveness của tất cả services (nhanh hơn)
 * Phù hợp cho smoke test khi chỉ cần biết services có chạy không
 */
export function checkAllLiveness() {
  group('Liveness check - Tất cả services', () => {
    for (const service of SERVICES) {
      checkLiveness(service);
      sleep(0.1);
    }
  });
}

/**
 * Chỉ kiểm tra readiness của tất cả services
 * Phù hợp cho pre-deployment check
 */
export function checkAllReadiness() {
  group('Readiness check - Tất cả services', () => {
    for (const service of SERVICES) {
      checkReadiness(service);
      sleep(0.1);
    }
  });
}
