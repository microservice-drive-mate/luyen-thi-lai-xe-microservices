/**
 * ============================================================
 * TEST DỊCH VỤ XÁC THỰC (IDENTITY SERVICE)
 * ============================================================
 *
 * File này test các chức năng chính của Identity Service:
 * - Đăng nhập (POST /auth/login)
 * - Đăng ký tài khoản mới (POST /auth/register)
 * - Lấy thông tin profile (GET /auth/profile)
 * - Đăng xuất (POST /auth/logout)
 *
 * Identity service kết nối với Keycloak để quản lý JWT token.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from '../config.js';
import { login, loginAsDefaultUser } from '../helpers/auth.js';
import { generateRegistrationData, randomEmail } from '../helpers/data.js';

/**
 * Test luồng đăng nhập thành công
 * Kiểm tra: status, token, thời gian phản hồi
 */
export function testLogin() {
  group('Identity - Đăng nhập', () => {
    const username =
      __ENV.TEST_USERNAME ||
      __ENV.TEST_USER_USERNAME ||
      __ENV.TEST_USER_EMAIL ||
      'testuser@example.com';
    const password = __ENV.TEST_USER_PASSWORD || 'Test@123456';

    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username, password }),
      { headers: JSON_HEADERS, tags: { name: 'identity_login' } },
    );

    check(res, {
      'Đăng nhập: status 200': (r) => r.status === 200 || r.status === 201,
      'Đăng nhập: có access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(
            body.accessToken ||
            body.access_token ||
            (body.data && (body.data.accessToken || body.data.access_token))
          );
        } catch (e) {
          return false;
        }
      },
      'Đăng nhập: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);
  });
}

/**
 * Test luồng đăng nhập thất bại (sai mật khẩu)
 * Hệ thống phải trả về lỗi 401 Unauthorized
 */
export function testLoginFailure() {
  group('Identity - Đăng nhập thất bại', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        username: 'wrong_user@example.com',
        password: 'WrongPassword123',
      }),
      { headers: JSON_HEADERS, tags: { name: 'identity_login_fail' } },
    );

    check(res, {
      'Đăng nhập sai: status 401 hoặc 400': (r) =>
        r.status === 401 || r.status === 400 || r.status === 403,
      'Đăng nhập sai: phản hồi < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.3);
  });
}

/**
 * Test đăng ký tài khoản mới
 * Tạo dữ liệu ngẫu nhiên và gửi POST /auth/register
 */
export function testRegister() {
  group('Identity - Đăng ký tài khoản', () => {
    const userData = generateRegistrationData();

    const res = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify(userData),
      { headers: JSON_HEADERS, tags: { name: 'identity_register' } },
    );

    check(res, {
      'Đăng ký: status 201 hoặc 200': (r) =>
        r.status === 201 || r.status === 200,
      'Đăng ký: phản hồi < 2s': (r) => r.timings.duration < 2000,
      'Đăng ký: response body hợp lệ': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body !== null && body !== undefined;
        } catch (e) {
          return false;
        }
      },
    });

    sleep(0.5);
  });
}

/**
 * Test lấy thông tin profile người dùng hiện tại
 * Cần đăng nhập trước để có JWT token
 */
export function testGetProfile() {
  group('Identity - Lấy thông tin profile', () => {
    // Bước 1: Đăng nhập để lấy token
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test profile vì không đăng nhập được');
      return;
    }

    sleep(0.3);

    // Bước 2: Gọi API lấy profile
    const res = http.get(`${BASE_URL}/auth/profile`, {
      headers: authHeaders(token),
      tags: { name: 'identity_profile' },
    });

    check(res, {
      'Profile: status 200': (r) => r.status === 200,
      'Profile: có thông tin email': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.email || (body.data && body.data.email));
        } catch (e) {
          return false;
        }
      },
      'Profile: phản hồi < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.3);
  });
}

/**
 * Test đăng xuất
 * Gửi POST /auth/logout với JWT token
 */
export function testLogout() {
  group('Identity - Đăng xuất', () => {
    // Đăng nhập trước
    const token = loginAsDefaultUser();
    if (!token) {
      console.warn('Bỏ qua test logout vì không đăng nhập được');
      return;
    }

    sleep(0.3);

    // Thực hiện đăng xuất
    const res = http.post(`${BASE_URL}/auth/logout`, null, {
      headers: authHeaders(token),
      tags: { name: 'identity_logout' },
    });

    check(res, {
      'Đăng xuất: status 200 hoặc 204': (r) =>
        r.status === 200 || r.status === 204,
      'Đăng xuất: phản hồi < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.3);
  });
}

/**
 * Test luồng đầy đủ: Đăng ký → Đăng nhập → Profile → Đăng xuất
 * Mô phỏng hành trình người dùng mới hoàn chỉnh
 */
export function testFullAuthFlow() {
  group('Identity - Luồng xác thực đầy đủ', () => {
    // Bước 1: Đăng ký tài khoản mới
    const userData = generateRegistrationData();
    const registerRes = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify(userData),
      { headers: JSON_HEADERS, tags: { name: 'identity_flow_register' } },
    );

    check(registerRes, {
      'Flow - Đăng ký thành công': (r) => r.status === 201 || r.status === 200,
    });

    sleep(1);

    // Bước 2: Đăng nhập với tài khoản vừa tạo
    const token = login(userData.username || userData.email, userData.password);

    check(null, {
      'Flow - Đăng nhập thành công': () => token !== null,
    });

    if (!token) {
      console.warn('Flow bị dừng vì không đăng nhập được');
      return;
    }

    sleep(0.5);

    // Bước 3: Lấy thông tin profile
    const profileRes = http.get(`${BASE_URL}/auth/profile`, {
      headers: authHeaders(token),
      tags: { name: 'identity_flow_profile' },
    });

    check(profileRes, {
      'Flow - Lấy profile thành công': (r) => r.status === 200,
    });

    sleep(0.5);

    // Bước 4: Đăng xuất
    const logoutRes = http.post(`${BASE_URL}/auth/logout`, null, {
      headers: authHeaders(token),
      tags: { name: 'identity_flow_logout' },
    });

    check(logoutRes, {
      'Flow - Đăng xuất thành công': (r) =>
        r.status === 200 || r.status === 204,
    });

    sleep(0.3);
  });
}
