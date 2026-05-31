/**
 * ============================================================
 * CẤU HÌNH CHUNG CHO TẤT CẢ CÁC BÀI TEST K6
 * ============================================================
 *
 * File này chứa các cấu hình dùng chung:
 * - BASE_URL: địa chỉ Kong API Gateway
 * - Thresholds: ngưỡng hiệu suất chấp nhận được
 * - Danh sách services và routes
 */

// URL cơ sở - lấy từ biến môi trường hoặc mặc định là localhost:8000 (Kong Gateway)
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// Thời gian timeout mặc định cho mỗi request (ms)
export const DEFAULT_TIMEOUT = '30s';

/**
 * Ngưỡng hiệu suất (thresholds) mặc định
 * - http_req_duration p(95) < 500ms: 95% request phải hoàn thành trong 500ms
 * - http_req_duration p(99) < 1500ms: 99% request phải hoàn thành trong 1.5s
 * - http_req_failed < 1%: tỷ lệ lỗi phải dưới 1%
 * - http_reqs: tổng số request (chỉ để theo dõi, không đặt ngưỡng)
 */
export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.01'],
};

/**
 * Ngưỡng hiệu suất cho smoke test (nhẹ nhàng hơn)
 * - p(95) < 300ms: phản hồi nhanh vì chỉ có 1 VU
 * - Không cho phép lỗi nào (rate<0.01)
 */
export const SMOKE_THRESHOLDS = {
  http_req_duration: ['p(95)<300', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};

/**
 * Ngưỡng hiệu suất cho stress test (nới lỏng hơn)
 * - p(95) < 2000ms: cho phép chậm hơn khi tải cao
 * - Tỷ lệ lỗi cho phép dưới 5%
 */
export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.05'],
};

/**
 * Ngưỡng hiệu suất cho spike test (nới lỏng nhất)
 * - p(95) < 3000ms: cho phép chậm khi tải đột ngột
 * - Tỷ lệ lỗi cho phép dưới 10%
 */
export const SPIKE_THRESHOLDS = {
  http_req_duration: ['p(95)<3000', 'p(99)<8000'],
  http_req_failed: ['rate<0.10'],
};

/**
 * Danh sách tất cả microservices trong hệ thống
 * Mỗi service gồm: tên, route trên Kong, và đường dẫn health check
 */
export const SERVICES = [
  {
    name: 'identity',
    route: '/auth',
    healthLive: '/identity-service/health/live',
    healthReady: '/identity-service/health/ready',
  },
  {
    name: 'user',
    route: '/users',
    healthLive: '/user-service/health/live',
    healthReady: '/user-service/health/ready',
  },
  {
    name: 'exam',
    route: '/exams',
    healthLive: '/exam-service/health/live',
    healthReady: '/exam-service/health/ready',
  },
  {
    name: 'course',
    route: '/courses',
    healthLive: '/course-service/health/live',
    healthReady: '/course-service/health/ready',
  },
  {
    name: 'question',
    route: '/admin/questions',
    healthLive: '/question-service/health/live',
    healthReady: '/question-service/health/ready',
  },
  {
    name: 'notification',
    route: '/notifications',
    healthLive: '/notification-service/health/live',
    healthReady: '/notification-service/health/ready',
  },
  {
    name: 'analytics',
    route: '/analytics',
    healthLive: '/analytics-service/health/live',
    healthReady: '/analytics-service/health/ready',
  },
  {
    name: 'simulation',
    route: '/simulation',
    healthLive: '/simulation-service/health/live',
    healthReady: '/simulation-service/health/ready',
  },
  {
    name: 'media',
    route: '/media',
    healthLive: '/media-service/health/live',
    healthReady: '/media-service/health/ready',
  },
  {
    name: 'audit',
    route: '/admin/audit-logs',
    healthLive: '/audit-service/health/live',
    healthReady: '/audit-service/health/ready',
  },
];

/**
 * Headers mặc định cho các request JSON
 */
export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

/**
 * Tạo headers có kèm JWT token để xác thực
 * @param {string} token - JWT access token
 * @returns {object} headers object
 */
export function authHeaders(token) {
  return {
    ...JSON_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}
