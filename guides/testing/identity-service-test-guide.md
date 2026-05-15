# Identity Service — Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test toàn bộ API của `identity-service`, bao gồm auth flow, admin user management, và xác nhận event propagation sang user-service.

---

## Mục lục

1. [Khởi động môi trường](#1-khởi-động-môi-trường)
2. [Cấu hình Keycloak Client](#2-cấu-hình-keycloak-client)
3. [Test Auth Flow](#3-test-auth-flow)
4. [Test Admin User Management](#4-test-admin-user-management) — create, list, get, update, delete, role, lock
5. [Xác nhận Event Propagation](#5-xác-nhận-event-propagation) — created, updated, role-changed, locked, deleted
6. [Test Token Blacklist (Redis)](#6-test-token-blacklist-redis)
7. [Kiểm tra Redis trực tiếp](#7-kiểm-tra-redis-trực-tiếp)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Khởi động môi trường

### Bước 1.1 — Start toàn bộ infra

```bash
# Từ root của project
npm run infra:up
```

Lệnh này khởi động: PostgreSQL, RabbitMQ, Consul, Keycloak, Kong, **Redis**.

Chờ khoảng 30-60 giây.

**Kiểm tra các service healthy:**

```bash
# Consul
curl http://localhost:8500/v1/status/leader

# RabbitMQ Management UI
open http://localhost:15672  # guest/guest

# Keycloak Admin UI
open http://localhost:8080   # admin/admin

# Redis
redis-cli ping               # PONG
```

### Bước 1.2 — Seed config vào Consul

```bash
npm run consul:seed:local
```

Kiểm tra config đã được seed:

```bash
npm run consul:list
# Phải thấy: config/development-local/identity-service/redis.url
#             config/development-local/identity-service/keycloak.authServerUrl
```

### Bước 1.3 — Cài dependencies (lần đầu)

```bash
npm install
```

### Bước 1.4 — Chạy identity-service và user-service

```bash
# Terminal 1 — identity-service
npm run dev --filter=identity-service

# Terminal 2 — user-service (để xác nhận event propagation)
npm run dev --filter=user-service
```

Kiểm tra khởi động thành công:

```
✓ Identity Service listening on port 3001
✓ User Service listening on port 3002
```

---

## 2. Cấu hình Keycloak Client

> **Bắt buộc** trước khi test admin endpoints.

### Bước 2.1 — Mở Keycloak Admin UI

```
http://localhost:8080
Username: admin
Password: admin
```

### Bước 2.2 — Enable Service Account cho client

1. Chọn realm: **luyen-thi-lai-xe-realm**
2. Menu trái: **Clients** → chọn **nestjs-backend**
3. Tab **Settings** → bật **Service accounts roles** → **Save**

### Bước 2.3 — Gán realm-management roles

1. Tab **Service accounts roles** (trên cùng client nestjs-backend)
2. Click **Assign role** → Filter by client → chọn **realm-management**
3. Tích chọn: `manage-users`, `view-realm` → **Assign**

### Bước 2.4 — Tạo Realm Roles (nếu chưa có)

1. Menu trái: **Realm roles** → **Create role**
2. Tạo lần lượt: `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

### Bước 2.5 — Tạo tài khoản admin để test

1. Menu trái: **Users** → **Add user**
2. Username: `admin_test`, Email: `admin@test.com`, **Save**
3. Tab **Credentials** → Set Password: `Admin@123`, Temporary: OFF
4. Tab **Role mapping** → Assign role: `ADMIN`

---

## 3. Test Auth Flow

### 3.1 — Login

```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@test.com",
    "password": "Admin@123"
  }'
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/login",
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

> Lưu `accessToken` và `refreshToken` vào biến môi trường để dùng cho các bước tiếp theo.

```bash
ACCESS_TOKEN="eyJhbGciOi..."
REFRESH_TOKEN="eyJhbGciOi..."
```

### 3.2 — Truy cập private endpoint

```bash
curl http://localhost:3001/private \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/private",
  "data": { "message": "Chào bạn, bạn đã đăng nhập thành công!" }
}
```

### 3.3 — Refresh token

```bash
curl -X POST http://localhost:3001/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Kết quả mong đợi `200`:** Cùng cấu trúc với login, `accessToken` mới.

> Cập nhật `ACCESS_TOKEN` với token mới.

### 3.4 — Logout

Logout cần cả access token (header) và refresh token (body) để revoke toàn bộ session trên Keycloak.

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/logout",
  "data": {
    "success": true,
    "message": "You have been logged out successfully. (MSG130)",
    "instruction": "Please delete your token from LocalStorage or Cookie"
  }
}
```

### 3.5 — Xác nhận access token bị blacklist

```bash
curl http://localhost:3001/private \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Kết quả mong đợi `401`:**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Token has been revoked. Please log in again. (MSG131)",
  "timestamp": "...",
  "path": "/private"
}
```

### 3.6 — Xác nhận refresh token bị revoke (không thể lấy token mới)

```bash
curl -X POST http://localhost:3001/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Kết quả mong đợi `401`** — Keycloak từ chối vì session đã bị revoke:

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Refresh token không hợp lệ hoặc đã hết hạn",
  "timestamp": "...",
  "path": "/refresh"
}
```

---

## 4. Test Admin User Management

> Cần `ACCESS_TOKEN` của tài khoản có role `ADMIN`.

```bash
# Login lại để lấy token mới (sau khi logout ở bước 3.4)
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com","password":"Admin@123"}' \
  | jq -r '.data.accessToken')
```

### 4.1 — Tạo user mới (STUDENT)

```bash
curl -X POST http://localhost:3001/admin/users \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT",
    "temporaryPassword": "Temp@1234"
  }'
```

**Kết quả mong đợi `201`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "...",
  "path": "/admin/users",
  "data": {
    "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "student1@gm.uit.edu.vn",
    "fullName": "Nguyễn Văn A",
    "role": "STUDENT"
  }
}
```

> Lưu `userId` để dùng ở các bước tiếp theo.

```bash
USER_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

### 4.2 — Tạo user trùng email (kiểm tra conflict)

```bash
curl -X POST http://localhost:3001/admin/users \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@gm.uit.edu.vn",
    "fullName": "Duplicate User",
    "role": "STUDENT",
    "temporaryPassword": "Temp@1234"
  }'
```

**Kết quả mong đợi `400`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "User with this email already exists in Keycloak",
  "timestamp": "...",
  "path": "/admin/users"
}
```

### 4.3 — Đổi role

```bash
curl -X PATCH "http://localhost:3001/admin/users/$USER_ID/role" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "INSTRUCTOR"}'
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/admin/users/.../role",
  "data": { "userId": "...", "role": "INSTRUCTOR" }
}
```

### 4.4 — Khoá tài khoản

```bash
curl -X PATCH "http://localhost:3001/admin/users/$USER_ID/lock" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": true}'
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/admin/users/.../lock",
  "data": { "userId": "...", "locked": true }
}
```

### 4.5 — Xác nhận user bị khoá không thể login

```bash
# Thử login bằng tài khoản vừa khoá
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1@gm.uit.edu.vn","password":"Temp@1234"}'
```

**Kết quả mong đợi `401`**

### 4.6 — Mở khoá tài khoản

```bash
curl -X PATCH "http://localhost:3001/admin/users/$USER_ID/lock" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": false}'
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/admin/users/.../lock",
  "data": { "userId": "...", "locked": false }
}
```

### 4.7 — List users

```bash
curl "http://localhost:3001/admin/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [{ "userId": "...", "email": "...", "role": "...", "isActive": true, "isDeleted": false }],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

Thử filter: `?role=STUDENT`, `?isActive=true`, `?search=student1`, `?includeDeleted=true`.

### 4.8 — Get user by ID

```bash
curl "http://localhost:3001/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Kết quả mong đợi `200`:** object `IdentityUserResponseDto` với `userId`, `email`, `fullName`, `role`, `isActive`, `isDeleted`, `createdAt`, `updatedAt`.

### 4.9 — Cập nhật user (email + fullName)

```bash
curl -X PATCH "http://localhost:3001/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "student1-updated@gm.uit.edu.vn", "fullName": "Nguyễn Văn A (updated)"}'
```

**Kết quả mong đợi `200`:** object với `email` và `fullName` đã được cập nhật.

> Sau bước này, user-service sẽ nhận event `identity.user.updated` và đồng bộ email/fullName trong `UserProfile`.

### 4.10 — Soft delete user

```bash
curl -X DELETE "http://localhost:3001/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deletedById": "<admin_keycloak_id>"}'
```

**Kết quả mong đợi `200`:** object với `isDeleted: true`, `isActive: false`, `deletedAt` có giá trị.

> Sau bước này, user-service nhận event `identity.user.deleted` và set `isActive = false` trong `UserProfile`.

### 4.11 — Test không đủ quyền (dùng STUDENT token)

```bash
# Tạo student token (nếu student đã đổi password)
STUDENT_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1@gm.uit.edu.vn","password":"<new_password>"}' \
  | jq -r '.data.accessToken')

curl -X POST http://localhost:3001/admin/users \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@test.com","fullName":"X","role":"STUDENT","temporaryPassword":"Pass@123"}'
```

**Kết quả mong đợi `403`**

---

## 5. Xác nhận Event Propagation

Sau khi tạo user ở bước 4.1, user-service phải tự động tạo `UserProfile`.

### 5.1 — Kiểm tra UserProfile được tạo

```bash
# Cần ADMIN token của user-service (x-user-id header)
# Gọi trực tiếp user-service (port 3002)
curl "http://localhost:3002/users/$USER_ID" \
  -H "x-user-id: <admin_keycloak_id>" \
  -H "x-user-role: ADMIN"
```

**Kết quả mong đợi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/users/...",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyễn Văn A",
    "email": "student1@gm.uit.edu.vn",
    "role": "STUDENT",
    "isActive": true,
    "studentDetail": {
      "licenseTier": null,
      "enrolledAt": null
    }
  }
}
```

> Nếu `404` sau 2-3 giây, kiểm tra RabbitMQ và user-service logs.

### 5.2 — Kiểm tra event role-changed

Sau bước 4.3 (đổi sang INSTRUCTOR):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "x-user-id: <admin_keycloak_id>" \
  -H "x-user-role: ADMIN"
```

**Kết quả mong đợi:** `"role": "INSTRUCTOR"`, `"studentDetail": null`

### 5.3 — Kiểm tra event identity.user.updated

Sau bước 4.9 (cập nhật email + fullName):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "x-user-id: <admin_keycloak_id>" \
  -H "x-user-role: ADMIN"
```

**Kết quả mong đợi:** `"email": "student1-updated@gm.uit.edu.vn"`, `"fullName": "Nguyễn Văn A (updated)"`.

### 5.4 — Kiểm tra event identity.user.locked

Sau bước 4.4 (lock user):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "x-user-id: <admin_keycloak_id>" \
  -H "x-user-role: ADMIN"
```

**Kết quả mong đợi:** `"isActive": false`.

Sau bước 4.6 (unlock):

**Kết quả mong đợi:** `"isActive": true`.

### 5.5 — Kiểm tra event identity.user.deleted

Sau bước 4.10 (soft delete):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "x-user-id: <admin_keycloak_id>" \
  -H "x-user-role: ADMIN"
```

**Kết quả mong đợi:** `"isActive": false` (profile bị deactivate nhưng vẫn tồn tại trong user-service).

### 5.6 — Theo dõi RabbitMQ events

Mở RabbitMQ Management: http://localhost:15672 (guest/guest)

- Tab **Queues** → `user_service_events` → **Get messages** → xem payload events
- Tab **Queues** → `notification_queue` → tương tự

---

## 6. Test Token Blacklist (Redis)

### 6.1 — Logout và verify blacklist trong Redis

```bash
# Login
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com","password":"Admin@123"}' \
  | jq -r '.data.accessToken')

# Lấy jti từ JWT payload
JTI=$(echo $ACCESS_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.jti')
echo "JTI: $JTI"

# Logout (cần cả access token + refresh token)
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# Kiểm tra Redis
redis-cli GET "bl:$JTI"
# Kết quả mong đợi: "1"

redis-cli TTL "bl:$JTI"
# Kết quả mong đợi: số giây còn lại của token
```

### 6.2 — Restart service, token vẫn bị blacklist

```bash
# Restart identity-service
# (Ctrl+C terminal 1, rồi npm run dev --filter=identity-service)

# Thử dùng token đã logout
curl http://localhost:3001/private \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Kết quả mong đợi: 401 (Redis vẫn giữ key sau restart)
```

---

## 7. Kiểm tra Redis trực tiếp

```bash
# Kết nối Redis CLI
redis-cli

# Xem tất cả blacklist keys
KEYS bl:*

# Xem TTL của một key cụ thể
TTL bl:<jti>

# Số keys trong blacklist
DBSIZE
```

---

## 8. Troubleshooting

### identity-service không start được

```bash
# Kiểm tra Consul có đang chạy
curl http://localhost:8500/v1/status/leader

# Kiểm tra Redis có đang chạy
redis-cli ping

# Kiểm tra logs
npm run dev --filter=identity-service 2>&1 | head -50
```

### Admin API trả về 500 "Failed to obtain Keycloak admin token"

→ Client `nestjs-backend` chưa enable Service Accounts. Xem [Bước 2.2](#bước-22--enable-service-account-cho-client).

### Admin API trả về 500 "Keycloak createUser failed"

→ Service account chưa có `manage-users` role. Xem [Bước 2.3](#bước-23--gán-realm-management-roles).

### user-service không nhận được event (UserProfile không được tạo)

```bash
# Kiểm tra queue user_service_events có tồn tại
curl http://localhost:15672/api/queues/%2F/user_service_events \
  -u guest:guest | jq '.messages'

# Kiểm tra user-service đang consume queue
# Mở http://localhost:15672 → Queues → user_service_events → Consumers
```

→ Nếu queue chưa tồn tại: user-service chưa start hoặc chưa connect RabbitMQ.

### Token blacklist không hoạt động sau restart

→ Kiểm tra `redis.url` trong Consul:

```bash
curl http://localhost:8500/v1/kv/config/development-local/identity-service/redis.url?raw
# Kết quả mong đợi: redis://localhost:6379
```

### Lỗi "Role 'STUDENT' not found in Keycloak realm"

→ Realm roles chưa được tạo. Xem [Bước 2.4](#bước-24--tạo-realm-roles-nếu-chưa-có).
