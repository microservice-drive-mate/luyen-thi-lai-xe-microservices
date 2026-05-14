# Identity Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Direct local:** `http://localhost:3001`  
**Swagger UI:** `http://localhost:3001/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/identity-service/docs`  
**OpenAPI JSON:** `http://localhost:3001/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/identity-service/docs-json`  
**Version:** 1.0.0

Qua Kong, auth business APIs dung prefix `/auth/*` cho login/logout va `/admin/*` cho admin APIs. Swagger/docs path la `/identity-service/docs`.

| Direct local path             | Kong public path              |
| ----------------------------- | ----------------------------- |
| `POST /login`                 | `POST /auth/login`            |
| `POST /logout`                | `POST /auth/logout`           |
| `POST /auth/refresh`          | `POST /auth/auth/refresh`     |
| `POST /admin/users`           | `POST /admin/users`           |
| `PATCH /admin/users/:id/role` | `PATCH /admin/users/:id/role` |
| `PATCH /admin/users/:id/lock` | `PATCH /admin/users/:id/lock` |

---

## Tổng Quan Xác Thực

Identity-service tích hợp Keycloak.

| Endpoint                      | Auth hiện tại                                               |
| ----------------------------- | ----------------------------------------------------------- |
| `POST /login`                 | Public                                                      |
| `POST /logout`                | Public, nhưng cần access token trong `Authorization` header |
| `POST /auth/refresh`          | Public                                                      |
| `GET /public`                 | Public, endpoint demo                                       |
| `GET /private`                | JWT hợp lệ, endpoint demo                                   |
| `GET /admin-check`            | `ADMIN`, endpoint demo                                      |
| `POST /admin/users`           | `ADMIN`, `CENTER_MANAGER`                                   |
| `PATCH /admin/users/:id/role` | `ADMIN`                                                     |
| `PATCH /admin/users/:id/lock` | `ADMIN`, `CENTER_MANAGER`                                   |

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

| HTTP | Code                           | Nguyên nhân                                          |
| ---: | ------------------------------ | ---------------------------------------------------- |
|  400 | `VALIDATION_ERROR`             | Body không hợp lệ                                    |
|  400 | `BAD_REQUEST`                  | Keycloak/Admin operation bị từ chối dạng bad request |
|  401 | `UNAUTHORIZED`                 | Sai credentials, token thiếu/hết hạn/không hợp lệ    |
|  403 | `FORBIDDEN`                    | Role không đủ quyền                                  |
|  404 | `IDENTITY_USER_NOT_FOUND`      | Không tìm thấy identity user                         |
|  409 | `IDENTITY_USER_ALREADY_EXISTS` | Identity user đã tồn tại                             |
|  500 | `INTERNAL_ERROR`               | Lỗi Keycloak hoặc lỗi server                         |

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
  "data": {
    "success": true,
    "message": "You have been logged out successfully. (MSG130)",
    "instruction": "Please delete your token from LocalStorage or Cookie"
  }
}
```

Nếu thiếu/sai access token:

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)"
}
```

---

### POST `/auth/refresh`

Lấy token mới bằng refresh token.

**Body**

```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response `200 OK`**

`data` có cùng cấu trúc với `/login`.

**Response `401 Unauthorized`**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Refresh token không hợp lệ hoặc đã hết hạn"
}
```

---

### POST `/admin/users`

Tạo user trong Keycloak, assign realm role, lưu record vào `identity_users`, rồi publish event.

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

### PATCH `/admin/users/:id/role`

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
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "role": "INSTRUCTOR"
  }
}
```

**Event published:** `identity.user.role-changed`.

---

### PATCH `/admin/users/:id/lock`

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
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "locked": true
  }
}
```

**Event published:** `identity.user.locked`.

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

| Event                        | Destination                         | Trigger                       |
| ---------------------------- | ----------------------------------- | ----------------------------- |
| `identity.user.created`      | user-service + notification-service | `POST /admin/users`           |
| `identity.user.role-changed` | user-service                        | `PATCH /admin/users/:id/role` |
| `identity.user.locked`       | notification-service                | `PATCH /admin/users/:id/lock` |

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

#### `identity.user.locked`

```json
{
  "eventName": "identity.user.locked",
  "userId": "keycloak-uuid",
  "locked": true
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
