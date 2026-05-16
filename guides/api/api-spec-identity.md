# Identity Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Direct local:** `http://localhost:3001`  
**Swagger UI:** `http://localhost:3001/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/identity-service/docs`  
**OpenAPI JSON:** `http://localhost:3001/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/identity-service/docs-json`  
**Version:** 1.0.0

Qua Kong, auth business APIs dùng prefix `/auth/*` cho login/logout/refresh/forgot-password và `/admin/*` cho admin APIs. Swagger/docs path là `/identity-service/docs`.

| Direct local path             | Kong public path              |
| ----------------------------- | ----------------------------- |
| `POST /login`                 | `POST /auth/login`            |
| `POST /logout`                | `POST /auth/logout`           |
| `POST /refresh`               | `POST /auth/refresh`          |
| `POST /forgot-password`       | `POST /auth/forgot-password`  |
| `GET /admin/identity-users`            | `GET /admin/identity-users`            |
| `GET /admin/identity-users/:id`        | `GET /admin/identity-users/:id`        |
| `POST /admin/identity-users`           | `POST /admin/identity-users`           |
| `PATCH /admin/identity-users/:id`      | `PATCH /admin/identity-users/:id`      |
| `PATCH /admin/identity-users/:id/role` | `PATCH /admin/identity-users/:id/role` |
| `PATCH /admin/identity-users/:id/lock` | `PATCH /admin/identity-users/:id/lock` |
| `DELETE /admin/identity-users/:id`     | `DELETE /admin/identity-users/:id`     |

Identity-service owns Keycloak account lifecycle. The public admin resource is named `identity-users` to avoid confusion with `user-service /users`, which manages profile and student detail data. There is no backward-compatible alias for the previous generic admin user resource.

---

## Tổng Quan Xác Thực

Identity-service tích hợp Keycloak.

| Endpoint                      | Auth hiện tại                                               |
| ----------------------------- | ----------------------------------------------------------- |
| `POST /login`                 | Public                                                      |
| `POST /logout`                | Public, nhưng cần access token trong `Authorization` header |
| `POST /refresh`               | Public                                                      |
| `POST /forgot-password`       | Public                                                      |
| `GET /admin/identity-users`            | `ADMIN`, `CENTER_MANAGER`                                   |
| `GET /admin/identity-users/:id`        | `ADMIN`, `CENTER_MANAGER`                                   |
| `GET /public`                 | Public, endpoint demo                                       |
| `GET /private`                | JWT hợp lệ, endpoint demo                                   |
| `GET /admin-check`            | `ADMIN`, endpoint demo                                      |
| `POST /admin/identity-users`           | `ADMIN`, `CENTER_MANAGER`                                   |
| `PATCH /admin/identity-users/:id`      | `ADMIN`                                                     |
| `PATCH /admin/identity-users/:id/role` | `ADMIN`                                                     |
| `PATCH /admin/identity-users/:id/lock` | `ADMIN`, `CENTER_MANAGER`                                   |
| `DELETE /admin/identity-users/:id`     | `ADMIN`                                                     |

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

### POST `/refresh`

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

### POST `/forgot-password`

UC02 - yeu cau dat lai mat khau. Identity-service tim user trong Keycloak theo email va goi Keycloak Admin API `execute-actions-email` voi action `UPDATE_PASSWORD`.

Endpoint luon tra response generic de tranh leak email co ton tai hay khong. Neu email ton tai va account dang enabled, Keycloak se gui email reset password.

**Luu y cau hinh:** Keycloak realm phai bat reset password va phai cau hinh SMTP hop le. Local Docker dung Mailpit tai `http://localhost:8025`, SMTP host trong container la `mailpit:1025`. Docker Compose co sidecar `keycloak-smtp-config` de apply SMTP config vao realm dang ton tai, nen khong can xoa Keycloak volume khi doi SMTP provider.

Flow reset: API nay chi trigger email reset. User mo email, click link reset cua Keycloak, nhap mat khau moi tren trang Keycloak, sau do quay lai app de login bang mat khau moi.

**SMTP real-inbox dev/demo qua env**

Khi chua co private domain, cach it ma sat nhat de test inbox that la Gmail SMTP bang App Password. Gmail SMTP phu hop dev/demo; production nen dung private domain da verify voi transactional provider.

Bat 2-Step Verification tren Google account, tao App Password, dat cac bien sau trong root `.env`, sau do chay lai sidecar `keycloak-smtp-config`.

```env
KEYCLOAK_SMTP_HOST=smtp.gmail.com
KEYCLOAK_SMTP_PORT=587
KEYCLOAK_SMTP_FROM=your-gmail-address@gmail.com
KEYCLOAK_SMTP_FROM_DISPLAY_NAME=Luyen Thi Lai Xe
KEYCLOAK_SMTP_REPLY_TO=your-gmail-address@gmail.com
KEYCLOAK_SMTP_REPLY_TO_DISPLAY_NAME=Luyen Thi Lai Xe
KEYCLOAK_SMTP_AUTH=true
KEYCLOAK_SMTP_USER=your-gmail-address@gmail.com
KEYCLOAK_SMTP_PASSWORD=<gmail-app-password>
KEYCLOAK_SMTP_SSL=false
KEYCLOAK_SMTP_STARTTLS=true
```

Apply lai config:

```bash
docker compose up -d --force-recreate keycloak-smtp-config

# Neu dang dung infra-only mode:
docker compose -f docker-compose.infra.yml up -d --force-recreate keycloak-smtp-config
```

Trong production, nen dung email domain da verify, cau hinh SPF/DKIM/DMARC tai DNS provider, va luu SMTP secret bang secret manager/CI secret thay vi commit vao repo.

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
  "data": {
    "success": true,
    "message": "If this email exists, password reset instructions have been sent."
  }
}
```

---

### POST `/admin/identity-users`

Account Keycloak được tạo với password permanent, `enabled=true`, `emailVerified=true`, và không có required action, nên user có thể login ngay bằng `POST /auth/login`.

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

### GET `/admin/identity-users`

**Query details**

| Param | Type | Default | Validation | Description |
| --- | --- | ---: | --- | --- |
| `page` | number | 1 | integer, `>= 1` | Page index. |
| `size` | number | 20 | integer, `1..100` | Items per page. |
| `role` | UserRole | - | optional enum | Filter by realm role. |
| `isActive` | boolean | - | optional boolean | Filter enabled/disabled identity records. |
| `includeDeleted` | boolean | false | optional boolean | Include soft-deleted accounts. |
| `search` | string | - | optional | Search by email/full name. |

List identity users trong `identity_db`.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Query:** `page`, `size`, `role`, `isActive`, `includeDeleted`, `search`.

**Response `200 OK`:** `data` gồm `{ items, total, page, size }`.

---

### GET `/admin/identity-users/:id`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Keycloak/identity user id. |

Lấy chi tiết identity user.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Response `200 OK`:** `data` là `IdentityUserResponse`.

---

### PATCH `/admin/identity-users/:id`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Keycloak/identity user id. |

Cập nhật identity user trên Keycloak và `identity_db`.

**Auth:** `ADMIN`

```json
{
  "email": "new-email@example.com",
  "fullName": "New Name"
}
```

**Event published:** `identity.user.updated`.

---

### PATCH `/admin/identity-users/:id/role`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Keycloak/identity user id. |

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

### PATCH `/admin/identity-users/:id/lock`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Keycloak/identity user id. |

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

### DELETE `/admin/identity-users/:id`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Keycloak/identity user id. |

Soft delete identity user: disable account trên Keycloak, set `isDeleted=true`, `isActive=false`, `deletedAt` trong `identity_db`.

**Auth:** `ADMIN`

```json
{
  "deletedById": "admin-keycloak-user-id"
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

| Event                        | Destination                         | Trigger                       |
| ---------------------------- | ----------------------------------- | ----------------------------- |
| `identity.user.created`      | user-service + notification-service | `POST /admin/identity-users`           |
| `identity.user.updated`      | user-service                        | `PATCH /admin/identity-users/:id`      |
| `identity.user.role-changed` | user-service                        | `PATCH /admin/identity-users/:id/role` |
| `identity.user.locked`       | user-service + notification-service | `PATCH /admin/identity-users/:id/lock` |
| `identity.user.deleted`      | user-service                        | `DELETE /admin/identity-users/:id`     |

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
