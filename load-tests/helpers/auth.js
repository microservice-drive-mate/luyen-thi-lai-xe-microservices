/**
 * ============================================================
 * HELPER XÁC THỰC - ĐĂNG NHẬP VÀ QUẢN LÝ JWT TOKEN
 * ============================================================
 *
 * File này cung cấp các hàm hỗ trợ xác thực:
 * - Đăng nhập qua Keycloak (POST /auth/login)
 * - Lấy và cache JWT token
 * - Đăng ký tài khoản mới
 */

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../config.js';

/**
 * Đăng nhập và lấy JWT access token
 * Gửi POST request đến /auth/login với email và password
 *
 * @param {string} email - Địa chỉ email đăng nhập
 * @param {string} password - Mật khẩu đăng nhập
 * @returns {string|null} JWT access token hoặc null nếu thất bại
 */
export function login(username, password) {
  const payload = JSON.stringify({
    username,
    password,
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: JSON_HEADERS,
    tags: { name: 'login' },
  });

  // Kiểm tra kết quả đăng nhập
  const loginSuccess = check(res, {
    'Đăng nhập thành công (status 200 hoặc 201)': (r) =>
      r.status === 200 || r.status === 201,
    'Response có chứa access token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return (
          body.accessToken !== undefined ||
          body.access_token !== undefined ||
          (body.data && body.data.accessToken !== undefined) ||
          (body.data && body.data.access_token !== undefined)
        );
      } catch (e) {
        return false;
      }
    },
  });

  if (!loginSuccess) {
    console.error(
      `Đăng nhập thất bại cho ${username}: status=${res.status}, body=${res.body}`,
    );
    return null;
  }

  // Trích xuất access token từ response (hỗ trợ nhiều format)
  try {
    const body = JSON.parse(res.body);
    return (
      body.accessToken ||
      body.access_token ||
      (body.data && (body.data.accessToken || body.data.access_token)) ||
      null
    );
  } catch (e) {
    console.error(`Không thể parse response body: ${e.message}`);
    return null;
  }
}

/**
 * Đăng ký tài khoản mới
 * Gửi POST request đến /auth/register
 *
 * @param {object} userData - Thông tin người dùng { email, password, fullName, ... }
 * @returns {object} Response object từ k6
 */
export function register(userData) {
  const payload = JSON.stringify(userData);

  const res = http.post(`${BASE_URL}/auth/register`, payload, {
    headers: JSON_HEADERS,
    tags: { name: 'register' },
  });

  check(res, {
    'Đăng ký thành công (status 201)': (r) =>
      r.status === 201 || r.status === 200,
    'Response có chứa thông tin user': (r) => {
      try {
        const body = JSON.parse(r.body);
        return (
          body.id !== undefined || (body.data && body.data.id !== undefined)
        );
      } catch (e) {
        return false;
      }
    },
  });

  return res;
}

/**
 * Đăng nhập với tài khoản test mặc định
 * Sử dụng biến môi trường hoặc giá trị mặc định
 *
 * @returns {string|null} JWT access token
 */
export function loginAsDefaultUser() {
  const username =
    __ENV.TEST_USERNAME ||
    __ENV.TEST_USER_USERNAME ||
    __ENV.TEST_USER_EMAIL ||
    'testuser@example.com';
  const password = __ENV.TEST_USER_PASSWORD || 'Test@123456';
  return login(username, password);
}

/**
 * Đăng nhập với tài khoản admin
 * Sử dụng biến môi trường hoặc giá trị mặc định
 *
 * @returns {string|null} JWT access token
 */
export function loginAsAdmin() {
  const username =
    __ENV.ADMIN_USERNAME || __ENV.ADMIN_EMAIL || 'admin@example.com';
  const password = __ENV.ADMIN_PASSWORD || 'Admin@123456';
  return login(username, password);
}

/**
 * Làm mới (refresh) JWT token
 * Gửi POST request đến /auth/refresh
 *
 * @param {string} refreshToken - Refresh token hiện tại
 * @returns {string|null} JWT access token mới
 */
export function refreshToken(refreshToken) {
  const payload = JSON.stringify({
    refreshToken: refreshToken,
  });

  const res = http.post(`${BASE_URL}/auth/refresh`, payload, {
    headers: JSON_HEADERS,
    tags: { name: 'refresh_token' },
  });

  check(res, {
    'Refresh token thành công (status 200)': (r) => r.status === 200,
  });

  try {
    const body = JSON.parse(res.body);
    return (
      body.accessToken ||
      body.access_token ||
      (body.data && (body.data.accessToken || body.data.access_token)) ||
      null
    );
  } catch (e) {
    return null;
  }
}
