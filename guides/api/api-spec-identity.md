# Identity Service API Specification

**Base URL (direct):** `http://localhost:3001`
**Base URL (qua Kong):** `http://localhost:8000` _(auth endpoints không yêu cầu JWT có thể gọi trực tiếp)_
**Version:** 1.0.0

---

## Tổng quan xác thực

### Auth endpoints (`/login`, `/logout`, `/auth/refresh`)

Không cần JWT — dùng `@Public()`.

### Admin endpoints (`/admin/*`)

Yêu cầu JWT hợp lệ với role **ADMIN** hoặc **CENTER_MANAGER** (tùy endpoint).
Kong inject header:
- `x-user-id` — Keycloak `sub` claim
- `x-user-role` — role của user

```
Authorization: Bearer <keycloak_access_token>
```

---

## Response Format

Tất cả response đều qua `ApiResponseInterceptor` và `ApiExceptionFilter` từ `@repo/common`:

```json
// Thành công
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/login",
  "data": { ... }
}

// Lỗi
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Tài khoản hoặc mật khẩu không chính xác",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/login"
}
```

---

## Error Codes

| HTTP Status | code                | Nguyên nhân                                         |
| ----------- | ------------------- | --------------------------------------------------- |
| 400         | `VALIDATION_ERROR`  | Request body không hợp lệ (class-validator)         |
| 400         | `BAD_REQUEST`       | User đã tồn tại trong Keycloak / role không tồn tại |
| 401         | `UNAUTHORIZED`      | Sai username/password, token hết hạn, bị revoke     |
| 403         | `FORBIDDEN`         | Không đủ quyền (role không phù hợp)                 |
| 500         | `INTERNAL_ERROR`    | Lỗi kết nối Keycloak Admin API                      |

---

## Enums

### UserRole

| Value            | Ý nghĩa                     |
| ---------------- | --------------------------- |
| `ADMIN`          | Quản trị viên hệ thống      |
| `CENTER_MANAGER` | Quản lý trung tâm đào tạo   |
| `INSTRUCTOR`     | Giáo viên / huấn luyện viên |
| `STUDENT`        | Học viên                    |

---

## Events Phát Sinh

Identity-service publish các event sau lên RabbitMQ sau khi admin operations thành công:

| Event                      | Queue đích            | Trigger                            |
| -------------------------- | --------------------- | ---------------------------------- |
| `identity.user.created`    | `user_service_events` + `notification_queue` | `POST /admin/users`         |
| `identity.user.role-changed` | `user_service_events` | `PATCH /admin/users/:id/role`    |
| `identity.user.locked`     | `notification_queue`  | `PATCH /admin/users/:id/lock`     |

---

## Endpoints

---

### POST /login

Đăng nhập bằng username/password, trả về JWT token từ Keycloak.

**Auth:** Không yêu cầu (`@Public`)

**Request Body:**

```json
{
  "username": "admin@gm.uit.edu.vn",
  "password": "Password@123"
}
```

| Field      | Type   | Required | Mô tả                     |
| ---------- | ------ | -------- | ------------------------- |
| `username` | string | ✅       | Email hoặc username Keycloak |
| `password` | string | ✅       | Mật khẩu                  |

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer",
    "scope": "openid profile email"
  }
}
```

**Response `401` — Sai credentials:**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Tài khoản hoặc mật khẩu không chính xác"
}
```

---

### POST /logout

Revoke session trên Keycloak (vô hiệu hóa cả refresh token) và đưa access token vào Redis blacklist.

**Auth:** Không yêu cầu (`@Public`) — access token lấy từ `Authorization` header

**Headers:**

| Header          | Required | Mô tả                   |
| --------------- | -------- | ----------------------- |
| `Authorization` | ✅       | `Bearer <access_token>` |

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field          | Type   | Required | Mô tả                          |
| -------------- | ------ | -------- | ------------------------------ |
| `refreshToken` | string | ✅       | Refresh token nhận từ `/login` |

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "success": true,
    "message": "You have been logged out successfully. (MSG130)",
    "instruction": "Please delete your token from LocalStorage or Cookie"
  }
}
```

**Response `401` — Token không hợp lệ:**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)"
}
```

---

### POST /auth/refresh

Lấy access token mới bằng refresh token (không cần đăng nhập lại).

**Auth:** Không yêu cầu (`@Public`)

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field          | Type   | Required | Mô tả                            |
| -------------- | ------ | -------- | -------------------------------- |
| `refreshToken` | string | ✅       | Refresh token nhận từ `/login`   |

**Response `200` — Token mới (cùng cấu trúc với `/login`):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer",
    "scope": "openid profile email"
  }
}
```

**Response `401` — Refresh token hết hạn hoặc không hợp lệ:**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Refresh token không hợp lệ hoặc đã hết hạn"
}
```

---

### POST /admin/users

Tạo user mới trong Keycloak và phát sinh event `identity.user.created`.

**Auth:** Yêu cầu role `ADMIN` hoặc `CENTER_MANAGER`

**Headers:**

| Header          | Required | Mô tả                   |
| --------------- | -------- | ----------------------- |
| `Authorization` | ✅       | `Bearer <access_token>` |

**Request Body:**

```json
{
  "email": "nguyenvana@gm.uit.edu.vn",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT",
  "temporaryPassword": "Temp@1234"
}
```

| Field               | Type     | Required | Validation                            |
| ------------------- | -------- | -------- | ------------------------------------- |
| `email`             | string   | ✅       | Email hợp lệ (dùng làm Keycloak username) |
| `fullName`          | string   | ✅       | Non-empty                             |
| `role`              | UserRole | ✅       | Một trong các giá trị `UserRole`      |
| `temporaryPassword` | string   | ✅       | Tối thiểu 8 ký tự, user phải đổi lần đầu đăng nhập |

**Response `201`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "nguyenvana@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT"
  }
}
```

**Response `400` — Email đã tồn tại:**

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "User with this email already exists in Keycloak"
}
```

**Side effect:**
- Record được lưu vào bảng `identity_users` trong `identity_db` (id = Keycloak UUID)
- user-service tự động nhận event và tạo `UserProfile` + `StudentDetail` (nếu role = STUDENT)
- notification-service nhận event để gửi email chào mừng

---

### PATCH /admin/users/:id/role

Đổi realm role của user trong Keycloak và phát sinh event `identity.user.role-changed`.

**Auth:** Yêu cầu role `ADMIN`

**Headers:**

| Header          | Required | Mô tả                   |
| --------------- | -------- | ----------------------- |
| `Authorization` | ✅       | `Bearer <access_token>` |

**Path Params:**

| Param | Type   | Mô tả                   |
| ----- | ------ | ----------------------- |
| `id`  | string | Keycloak user UUID      |

**Request Body:**

```json
{
  "role": "INSTRUCTOR"
}
```

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "role": "INSTRUCTOR"
  }
}
```

**Side effect:**
- user-service cập nhật role trên `UserProfile`, tạo hoặc xóa `StudentDetail` tùy role mới

---

### PATCH /admin/users/:id/lock

Khoá hoặc mở khoá tài khoản trong Keycloak và phát sinh event `identity.user.locked`.

**Auth:** Yêu cầu role `ADMIN` hoặc `CENTER_MANAGER`

**Headers:**

| Header          | Required | Mô tả                   |
| --------------- | -------- | ----------------------- |
| `Authorization` | ✅       | `Bearer <access_token>` |

**Path Params:**

| Param | Type   | Mô tả              |
| ----- | ------ | ------------------ |
| `id`  | string | Keycloak user UUID |

**Request Body:**

```json
{
  "locked": true
}
```

| Field    | Type    | Mô tả                                   |
| -------- | ------- | --------------------------------------- |
| `locked` | boolean | `true` = khoá tài khoản, `false` = mở khoá |

**Response `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "locked": true
  }
}
```

**Side effect:**
- notification-service nhận event để gửi thông báo khoá tài khoản cho user

---

## Luồng Tạo User Đầy Đủ

```
Admin                identity-service          Keycloak          RabbitMQ
  │                        │                      │                  │
  │──POST /admin/users────►│                      │                  │
  │                        │──POST /admin/realms/{realm}/users──────►│
  │                        │◄──201 + Location ────│                  │
  │                        │──POST /users/{id}/role-mappings/realm──►│
  │                        │◄──204 ───────────────│                  │
  │                        │──emit identity.user.created────────────►│
  │◄──201 CreateUserResponse│                      │                  │
  │                        │                      │                  │
  │                 user_service_events queue (user-service consumes) │
  │                 notification_queue (notification-service consumes)│
```

---

## Keycloak Client Prerequisites

Trước khi dùng admin endpoints, đảm bảo Keycloak client `nestjs-backend` được cấu hình:

1. **Service Accounts Enabled:** `ON`
2. **Service Account Roles** → tab `realm-management`:
   - `manage-users` ✅
   - `view-realm` ✅
3. **Realm Roles** đã tạo: `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`
