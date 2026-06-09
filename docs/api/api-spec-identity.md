# Identity Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Direct local:** `http://localhost:3001`  
**Swagger UI:** `http://localhost:3001/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/identity-service/docs`  
**OpenAPI JSON:** `http://localhost:3001/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/identity-service/docs-json`  
**Version:** 1.0.0

Qua Kong, auth business APIs dùng prefix `/auth/*` cho login/logout/refresh/forgot-password và `/admin/*` cho admin APIs. Swagger/docs path là `/identity-service/docs`.

| Direct local path                      | Kong public path                       |
| -------------------------------------- | -------------------------------------- |
| `POST /login`                          | `POST /auth/login`                     |
| `POST /logout`                         | `POST /auth/logout`                    |
| `POST /refresh`                        | `POST /auth/refresh`                   |
| `POST /forgot-password`                | `POST /auth/forgot-password`           |
| `POST /admin/identity-users`           | `POST /admin/identity-users`           |
| `GET /admin/identity-users`            | `GET /admin/identity-users`            |
| `GET /admin/identity-users/:id`        | `GET /admin/identity-users/:id`        |
| `PATCH /admin/identity-users/:id`      | `PATCH /admin/identity-users/:id`      |
| `PATCH /admin/identity-users/:id/role` | `PATCH /admin/identity-users/:id/role` |
| `PATCH /admin/identity-users/:id/lock` | `PATCH /admin/identity-users/:id/lock` |
| `DELETE /admin/identity-users/:id`     | `DELETE /admin/identity-users/:id`     |

Identity-service owns Keycloak account lifecycle. The public admin resource is named `identity-users` to avoid confusion with `user-service /users`, which manages profile and student detail data.

---

## Frontend Account/Profile Flow

Trong hệ thống này, tạo người dùng được tách thành 2 bounded context:

| Service | Chịu trách nhiệm |
| ------- | ---------------- |
| `identity-service` | Tạo account Keycloak, password, login token, role, lock/unlock/delete account. |
| `user-service` | Lưu profile hiển thị, avatar, số điện thoại, ngày sinh, địa chỉ, `StudentDetail`, hạng giấy phép. |

Flow tạo user bình thường cho admin dashboard:

1. Frontend gọi `POST /admin/identity-users` để tạo account đăng nhập trong Keycloak.
2. Response trả về `data.userId`. Đây là Keycloak user id và cũng là profile id bên `user-service`.
3. Identity-service publish event `identity.user.created`.
4. User-service consume event và tạo profile tối thiểu cùng `id = userId`.
5. Frontend gọi `GET /admin/users/:userId` bên user-service để lấy profile. Nếu vừa tạo xong mà nhận `404`, retry vài lần trong thời gian ngắn vì bước đồng bộ qua RabbitMQ là eventual consistency.
6. Frontend gọi `PATCH /admin/users/:userId` để bổ sung profile như `phoneNumber`, `dateOfBirth`, `gender`, `address`, `avatarUrl`, `mediaFileId`.
7. Nếu user là học viên, frontend gọi `PATCH /admin/users/:userId/license-tier` để gán hạng bằng lái.
8. User đăng nhập bằng `POST /auth/login`, sau đó app lấy profile của chính user bằng `GET /users/me` bên user-service.

Flow backfill/manual:

- Chỉ dùng `POST /admin/users` bên user-service khi đã có account Keycloak nhưng profile chưa tồn tại, ví dụ dữ liệu cũ hoặc event chưa chạy.
- Không dùng `POST /admin/users` để tạo account đăng nhập. Account đăng nhập phải tạo qua `POST /admin/identity-users`.

Role, lock, delete:

- Đổi role, lock/unlock, delete account nên gọi identity-service trước vì Keycloak là nguồn đúng cho quyền đăng nhập.
- User-service sẽ đồng bộ profile qua event `identity.user.role-changed`, `identity.user.locked`, `identity.user.deleted`.
- `PATCH /admin/users/:id/lock` bên user-service chỉ đổi trạng thái profile, không khóa login Keycloak.

---

## Tổng Quan Xác Thực

Identity-service tích hợp Keycloak.

| Endpoint                               | Auth hiện tại                                             |
| -------------------------------------- | --------------------------------------------------------- |
| `POST /login`                          | Public                                                    |
| `POST /logout`                         | Public, nhưng cần access token trong `Authorization`      |
| `POST /refresh`                        | Public                                                    |
| `POST /forgot-password`                | Public                                                    |
| `POST /admin/identity-users`           | `ADMIN`, `CENTER_MANAGER`                                 |
| `GET /admin/identity-users`            | `ADMIN`, `CENTER_MANAGER`                                 |
| `GET /admin/identity-users/:id`        | `ADMIN`, `CENTER_MANAGER`                                 |
| `PATCH /admin/identity-users/:id`      | `ADMIN`                                                   |
| `PATCH /admin/identity-users/:id/role` | `ADMIN`                                                   |
| `PATCH /admin/identity-users/:id/lock` | `ADMIN`, `CENTER_MANAGER`                                 |
| `DELETE /admin/identity-users/:id`     | `ADMIN`                                                   |
| `GET /public`                          | Public, endpoint demo                                     |
| `GET /private`                         | JWT hợp lệ, endpoint demo                                 |
| `GET /admin-check`                     | `ADMIN`, endpoint demo                                    |

---

## Response Format

HTTP response được bọc bởi `ApiResponseInterceptor`.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/login",
  "data": {}
}
```

Lỗi:

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Tài khoản hoặc mật khẩu không chính xác",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/login"
}
```

---

## Error Codes

| HTTP | Code                           | Nguyên nhân                                           |
| ---: | ------------------------------ | ----------------------------------------------------- |
|  400 | `VALIDATION_ERROR`             | Body không hợp lệ                                     |
|  400 | `BAD_REQUEST`                  | Keycloak/Admin operation bị từ chối dạng bad request  |
|  401 | `UNAUTHORIZED`                 | Sai credentials, token thiếu/hết hạn/không hợp lệ     |
|  403 | `FORBIDDEN`                    | Role không đủ quyền                                   |
|  404 | `IDENTITY_USER_NOT_FOUND`      | Không tìm thấy identity user                          |
|  409 | `IDENTITY_USER_ALREADY_EXISTS` | Identity user đã tồn tại                              |
|  500 | `INTERNAL_ERROR`               | Lỗi Keycloak hoặc lỗi server                          |

---

## Enums

### UserRole

`ADMIN` | `CENTER_MANAGER` | `INSTRUCTOR` | `STUDENT`

---

## Endpoints

### POST `/login`

Đăng nhập bằng username/password. Service gọi Keycloak token endpoint với grant type `password`.

**Body**

```json
{
  "username": "admin@gm.uit.edu.vn",
  "password": "Password@123"
}
```

| Field      | Type   | Required | Validation |
| ---------- | ------ | -------- | ---------- |
| `username` | string | Yes      | Non-empty  |
| `password` | string | Yes      | Non-empty  |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer",
    "scope": "openid profile email"
  }
}
```

---

### POST `/logout`

Revoke refresh token trên Keycloak và đưa access token vào Redis blacklist đến khi token hết hạn.

**Headers**

```http
Authorization: Bearer <access_token>
```

**Body**

```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "success": true,
    "message": "You have been logged out successfully. (MSG130)",
    "instruction": "Please delete your token from LocalStorage or Cookie"
  }
}
```

---

### POST `/refresh`

Lấy token mới bằng refresh token.

**Body**

```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer",
    "scope": "openid profile email"
  }
}
```

**Response `401 Unauthorized`**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Refresh token không hợp lệ hoặc đã hết hạn"
}
```

---

### POST `/forgot-password`

Yêu cầu đặt lại mật khẩu. Identity-service tìm user trong Keycloak theo email và gọi Keycloak Admin API `execute-actions-email` với action `UPDATE_PASSWORD`.

Endpoint luôn trả response generic để tránh leak email có tồn tại hay không. Nếu email tồn tại và account đang enabled, Keycloak sẽ gửi email reset password.

**Body**

```json
{
  "email": "student1@gm.uit.edu.vn"
}
```

| Field   | Type   | Required | Validation |
| ------- | ------ | -------- | ---------- |
| `email` | string | Yes      | Email      |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "success": true,
    "message": "If this email exists, password reset instructions have been sent."
  }
}
```

---

### POST `/admin/identity-users`

Tạo user trong Keycloak, assign realm role, lưu record vào `identity_users`, rồi publish event.

Account Keycloak được tạo với password permanent, `enabled=true`, `emailVerified=true`, và không có required action, nên user có thể login ngay bằng `POST /auth/login`.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Body**

```json
{
  "email": "nguyenvana@gm.uit.edu.vn",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT",
  "temporaryPassword": "Temp@1234"
}
```

| Field               | Type     | Required | Validation   |
| ------------------- | -------- | -------- | ------------ |
| `email`             | string   | Yes      | Email        |
| `fullName`          | string   | Yes      | Non-empty    |
| `role`              | UserRole | Yes      | Enum         |
| `temporaryPassword` | string   | Yes      | Min length 8 |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "nguyenvana@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT"
  }
}
```

**Event published:** `identity.user.created`.

---

### GET `/admin/identity-users`

List identity users trong `identity_db`.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Query**

| Param            | Type     | Default | Validation        | Description                         |
| ---------------- | -------- | ------: | ----------------- | ----------------------------------- |
| `page`           | number   |       1 | integer, `>= 1`   | Page index                          |
| `size`           | number   |      20 | integer, `1..100` | Items per page                      |
| `role`           | UserRole |       - | optional enum     | Filter by realm role                |
| `isActive`       | boolean  |       - | optional boolean  | Filter enabled/disabled records     |
| `includeDeleted` | boolean  |   false | optional boolean  | Include soft-deleted accounts       |
| `search`         | string   |       - | optional          | Search by email/full name           |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "items": [
      {
        "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "email": "nguyenvana@gm.uit.edu.vn",
        "fullName": "Nguyễn Văn A",
        "role": "STUDENT",
        "isActive": true,
        "isDeleted": false,
        "deletedAt": null,
        "createdAt": "2026-05-14T10:00:00.000Z",
        "updatedAt": "2026-05-14T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/admin/identity-users/:id`

Lấy chi tiết identity user.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description                |
| ----- | ---- | -------- | -------------------------- |
| `id`  | UUID | Yes      | Keycloak/identity user id  |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "nguyenvana@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT",
    "isActive": true,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z"
  }
}
```

---

### PATCH `/admin/identity-users/:id`

Cập nhật identity user trên Keycloak và `identity_db`.

**Auth:** `ADMIN`

**Path params**

| Param | Type | Required | Description                |
| ----- | ---- | -------- | -------------------------- |
| `id`  | UUID | Yes      | Keycloak/identity user id  |

**Body**

```json
{
  "email": "new-email@example.com",
  "fullName": "Nguyễn Văn B"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "new-email@example.com",
    "fullName": "Nguyễn Văn B",
    "role": "STUDENT",
    "isActive": true,
    "isDeleted": false,
    "deletedAt": null,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:05:00.000Z"
  }
}
```

**Event published:** `identity.user.updated`.

---

### PATCH `/admin/identity-users/:id/role`

Đổi realm role của user trên Keycloak.

**Auth:** `ADMIN`

**Body**

```json
{
  "role": "INSTRUCTOR"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "role": "INSTRUCTOR"
  }
}
```

**Event published:** `identity.user.role-changed`.

---

### PATCH `/admin/identity-users/:id/lock`

Khóa/mở khóa tài khoản trong Keycloak bằng cách set `enabled = !locked`.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Body**

```json
{
  "locked": true
}
```

| Field    | Type    | Required |
| -------- | ------- | -------- |
| `locked` | boolean | Yes      |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "locked": true
  }
}
```

**Event published:** `identity.user.locked`.

---

### DELETE `/admin/identity-users/:id`

Soft delete identity user: disable account trên Keycloak, set `isDeleted=true`, `isActive=false`, `deletedAt` trong `identity_db`.

**Auth:** `ADMIN`

**Body**

```json
{
  "deletedById": "admin-keycloak-user-id"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "nguyenvana@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT",
    "isActive": false,
    "isDeleted": true,
    "deletedAt": "2026-05-14T10:10:00.000Z",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:10:00.000Z"
  }
}
```

**Event published:** `identity.user.deleted`.

---

## Demo Endpoints

Các endpoint sau đang tồn tại trong `AuthController`, chủ yếu dùng để kiểm thử guard:

| Method | Path           | Auth    | Response               |
| ------ | -------------- | ------- | ---------------------- |
| `GET`  | `/public`      | Public  | `{ "message": "..." }` |
| `GET`  | `/private`     | JWT     | `{ "message": "..." }` |
| `GET`  | `/admin-check` | `ADMIN` | `{ "message": "..." }` |

---

## Domain Events

### Published

| Event                        | Destination                         | Trigger                               |
| ---------------------------- | ----------------------------------- | ------------------------------------- |
| `identity.user.created`      | user-service + notification-service | `POST /admin/identity-users`          |
| `identity.user.updated`      | user-service                        | `PATCH /admin/identity-users/:id`     |
| `identity.user.role-changed` | user-service                        | `PATCH /admin/identity-users/:id/role` |
| `identity.user.locked`       | user-service + notification-service | `PATCH /admin/identity-users/:id/lock` |
| `identity.user.deleted`      | user-service                        | `DELETE /admin/identity-users/:id`    |

#### `identity.user.created`

```json
{
  "eventName": "identity.user.created",
  "userId": "keycloak-uuid",
  "email": "a@example.com",
  "fullName": "Nguyễn Văn A",
  "role": "STUDENT"
}
```

#### `identity.user.role-changed`

```json
{
  "eventName": "identity.user.role-changed",
  "userId": "keycloak-uuid",
  "newRole": "INSTRUCTOR"
}
```

#### `identity.user.updated`

```json
{
  "eventName": "identity.user.updated",
  "userId": "keycloak-uuid",
  "email": "new-email@example.com",
  "fullName": "New Name"
}
```

#### `identity.user.locked`

```json
{
  "eventName": "identity.user.locked",
  "userId": "keycloak-uuid",
  "locked": true
}
```

#### `identity.user.deleted`

```json
{
  "eventName": "identity.user.deleted",
  "userId": "keycloak-uuid",
  "deletedById": "admin-keycloak-user-id"
}
```

---

## Keycloak Client Prerequisites

Client backend cần có:

| Cấu hình               | Giá trị                                            |
| ---------------------- | -------------------------------------------------- |
| Service accounts       | Enabled                                            |
| Realm management roles | `manage-users`, `view-realm`                       |
| Realm roles            | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
## Logout Blacklist Enforcement

`POST /logout` stores the access token `jti` in Redis until the JWT expires. `identity-service` has a global `TokenBlacklistGuard`, so protected identity/admin APIs reject a logged-out access token with `401`.

Kong still validates JWT signature/expiry. Redis blacklist enforcement is service-side and must be enabled in each service that needs immediate revocation beyond identity APIs.
