# User Service — Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test toàn bộ API của `user-service`, cả khi gọi **trực tiếp** (bỏ qua Kong, dùng cho dev/debug) lẫn khi gọi **qua Kong** (production path).

---

## Mục lục

1. [Khởi động môi trường](#1-khởi-động-môi-trường)
2. [Kiến trúc luồng request](#2-kiến-trúc-luồng-request)
3. [Chuẩn bị — Tạo dữ liệu mẫu trực tiếp](#3-chuẩn-bị--tạo-dữ-liệu-mẫu-trực-tiếp)
4. [Test từng endpoint](#4-test-từng-endpoint)
5. [Test luồng RabbitMQ event](#5-test-luồng-rabbitmq-event)
6. [Test qua Kong (production path)](#6-test-qua-kong-production-path)
7. [Kiểm tra Database trực tiếp](#7-kiểm-tra-database-trực-tiếp)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Khởi động môi trường

### Bước 1.1 — Start infrastructure (DB + RabbitMQ + Consul)

```bash
# Từ root của project
docker-compose up -d db-user rabbitmq consul consul-init
```

Chờ khoảng 10-15 giây để Consul khởi động xong.

**Kiểm tra Consul healthy:**

```bash
curl http://localhost:8500/v1/status/leader
# Kết quả mong đợi: "..." (địa chỉ leader node)
```

**Consul UI:** http://localhost:8500/ui

### Bước 1.2 — Seed config vào Consul

```bash
npm run consul:seed:local
```

Lệnh này đọc `consul-seed-development-local.json` và đẩy config vào Consul KV store.

**Kiểm tra:**

```bash
npm run consul:list
# Hoặc xem trực tiếp: http://localhost:8500/ui/dc1/kv
```

Sau khi seed thành công, bạn sẽ thấy các key như:

- `config/development-local/shared/log.level`
- `config/development-local/user-service/port`
- `config/development-local/user-service/database.url`

### Bước 1.3 — Migrate database

```bash
cd apps/user-service
npx prisma migrate dev --name init
```

Hoặc nếu migration đã tồn tại:

```bash
cd apps/user-service
npx prisma migrate deploy
```

**Kiểm tra schema đã tạo:**

```bash
npx prisma studio
# Mở browser tại http://localhost:5555 để xem DB
```

### Bước 1.4 — Start user-service

```bash
# Từ root
npm run dev --filter=user-service

# Hoặc vào thư mục service
cd apps/user-service
npm run start:dev
```

**Kiểm tra service đang chạy:**

```bash
curl http://localhost:3002/docs-json
# Kết quả: OpenAPI JSON spec
```

**Swagger UI:** http://localhost:3002/docs

---

## 2. Kiến trúc luồng request

```
Client (curl/Postman)
    │
    ├─── DIRECT (dev/debug) ──→ http://localhost:3002  ←── Port user-service local
    │                            (Không cần JWT, có thể set x-user-id thủ công)
    │
    └─── VIA KONG ────────────→ http://localhost:8000  ←── Kong gateway
                                 (Cần JWT hợp lệ từ Keycloak)
                                 Kong inject: x-user-id, x-user-role
```

> **Lưu ý:** user-service KHÔNG tự validate JWT — đó là việc của Kong. Khi test trực tiếp (port 3002), bạn phải tự set header `x-user-id` trong request nếu endpoint cần nó.

---

## 3. Chuẩn bị — Tạo dữ liệu mẫu trực tiếp

Trước khi test, cần có ít nhất 1 user trong DB. Dùng `POST /users` để tạo trực tiếp (bypass RabbitMQ).

### Tạo user ADMIN

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "admin-uuid-0001",
    "fullName": "Nguyễn Admin",
    "email": "admin@example.com",
    "role": "ADMIN"
  }' | jq .
```

**Kết quả mong đợi (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
  "data": {
    "id": "admin-uuid-0001",
    "fullName": "Nguyễn Admin",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

### Tạo user CENTER_MANAGER

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "manager-uuid-0002",
    "fullName": "Trần Manager",
    "email": "manager@example.com",
    "role": "CENTER_MANAGER"
  }' | jq .
```

### Tạo user STUDENT (với đầy đủ thông tin)

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "student-uuid-0003",
    "fullName": "Lê Học Viên",
    "email": "student@example.com",
    "role": "STUDENT",
    "phoneNumber": "0912345678",
    "dateOfBirth": "2000-01-15",
    "gender": "MALE",
    "address": "123 Đường ABC, TP.HCM",
    "enrolledAt": "2026-01-01"
  }' | jq .
```

**Kết quả mong đợi (201):**

```json
{
  "success": true,
  "data": {
    "id": "student-uuid-0003",
    "fullName": "Lê Học Viên",
    "email": "student@example.com",
    "role": "STUDENT"
  }
}
```

### Tạo user INSTRUCTOR

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "instructor-uuid-0004",
    "fullName": "Phạm Giáo Viên",
    "email": "instructor@example.com",
    "role": "INSTRUCTOR"
  }' | jq .
```

---

## 4. Test từng endpoint

> Tất cả các lệnh curl sau đây gọi **trực tiếp** vào user-service (port 3002), không qua Kong.
> Header `x-user-id` được set thủ công khi cần.

---

### 4.1 POST /users — Tạo user profile

**Case: Email đã tồn tại (expect 409)**

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "another-uuid",
    "fullName": "Người Khác",
    "email": "admin@example.com",
    "role": "ADMIN"
  }' | jq .
```

**Kết quả mong đợi (409):**

```json
{
  "success": false,
  "code": "USER_ALREADY_EXISTS",
  "message": "User with email admin@example.com already exists",
  "timestamp": "...",
  "path": "/users"
}
```

**Case: Body thiếu field bắt buộc (expect 400)**

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Thiếu email"
  }' | jq .
```

**Kết quả mong đợi (400):**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "...",
  "errors": ["email must be an email", "id must be a string"]
}
```

**Case: SĐT không hợp lệ (expect 400)**

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uuid-bad-phone",
    "fullName": "Test",
    "email": "test-phone@example.com",
    "role": "STUDENT",
    "phoneNumber": "12345"
  }' | jq .
```

---

### 4.2 GET /users — Danh sách user (có phân trang + filter)

**Lấy tất cả users (page 1, size 20):**

```bash
curl -s "http://localhost:3002/users" | jq .
```

**Kết quả mong đợi (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      /* mảng UserProfileResponse */
    ],
    "total": 4,
    "page": 1,
    "size": 20
  }
}
```

**Lọc theo role STUDENT:**

```bash
curl -s "http://localhost:3002/users?role=STUDENT" | jq .
```

**Lọc theo isActive:**

```bash
curl -s "http://localhost:3002/users?isActive=true" | jq .
```

**Tìm kiếm theo tên/email/SĐT:**

```bash
curl -s "http://localhost:3002/users?search=Học+Viên" | jq .
curl -s "http://localhost:3002/users?search=student@" | jq .
```

**Phân trang:**

```bash
curl -s "http://localhost:3002/users?page=1&size=2" | jq .
curl -s "http://localhost:3002/users?page=2&size=2" | jq .
```

**Kết hợp filter:**

```bash
curl -s "http://localhost:3002/users?role=STUDENT&isActive=true&page=1&size=10" | jq .
```

**Case: size vượt giới hạn (expect 400):**

```bash
curl -s "http://localhost:3002/users?size=200" | jq .
```

---

### 4.3 GET /users/me — Lấy profile của chính mình

> Endpoint này đọc `x-user-id` header. Set thủ công khi test trực tiếp.

**Happy path:**

```bash
curl -s http://localhost:3002/users/me \
  -H "x-user-id: student-uuid-0003" | jq .
```

**Kết quả mong đợi (200):**

```json
{
  "success": true,
  "data": {
    "id": "student-uuid-0003",
    "fullName": "Lê Học Viên",
    "email": "student@example.com",
    "phoneNumber": "0912345678",
    "dateOfBirth": "2000-01-15T00:00:00.000Z",
    "avatarUrl": null,
    "gender": "MALE",
    "address": "123 Đường ABC, TP.HCM",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "...",
    "studentDetail": {
      "licenseTier": null,
      "enrolledAt": "2026-01-01T00:00:00.000Z",
      "notes": null
    }
  }
}
```

**Case: x-user-id không tồn tại (expect 404):**

```bash
curl -s http://localhost:3002/users/me \
  -H "x-user-id: non-existent-uuid" | jq .
```

```json
{
  "success": false,
  "code": "USER_PROFILE_NOT_FOUND",
  "message": "User profile not found: non-existent-uuid"
}
```

---

### 4.4 GET /users/:id — Lấy profile theo ID

**Happy path:**

```bash
curl -s http://localhost:3002/users/admin-uuid-0001 | jq .
curl -s http://localhost:3002/users/student-uuid-0003 | jq .
```

**So sánh studentDetail:**

- User ADMIN/INSTRUCTOR: `studentDetail: null`
- User STUDENT: `studentDetail: { licenseTier, enrolledAt, notes }`

**Case: ID không tồn tại (expect 404):**

```bash
curl -s http://localhost:3002/users/does-not-exist | jq .
```

---

### 4.5 PATCH /users/me — Cập nhật profile bản thân

> Set `x-user-id` header để xác định user.

**Cập nhật một số field:**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{
    "fullName": "Lê Học Viên (Updated)",
    "address": "456 Đường Mới, Hà Nội",
    "gender": "FEMALE"
  }' | jq .
```

**Kết quả mong đợi (200)** — trả về profile đã update:

```json
{
  "success": true,
  "data": {
    "fullName": "Lê Học Viên (Updated)",
    "address": "456 Đường Mới, Hà Nội",
    "gender": "FEMALE",
    ...
  }
}
```

**Cập nhật SĐT hợp lệ:**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{ "phoneNumber": "0987654321" }' | jq .
```

**Cập nhật ghi chú (chỉ áp dụng cho STUDENT):**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{ "notes": "Học viên cần luyện thêm phần biển báo" }' | jq .
```

> Nếu user không phải STUDENT, `notes` bị bỏ qua (không lỗi, chỉ silent ignore).

**Case: SĐT không hợp lệ (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{ "phoneNumber": "0123" }' | jq .
```

---

### 4.6 PATCH /users/:id — Cập nhật profile bất kỳ (admin)

```bash
curl -s -X PATCH http://localhost:3002/users/instructor-uuid-0004 \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Phạm Giáo Viên (Admin Updated)",
    "address": "789 Đường Admin"
  }' | jq .
```

---

### 4.7 PATCH /users/:id/lock — Khóa / mở khóa user

**Khóa user (isActive → false):**

```bash
curl -s -X PATCH http://localhost:3002/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": true }'
# Kết quả mong đợi: HTTP 204 (không có body)
```

**Xác nhận user đã bị khóa:**

```bash
curl -s http://localhost:3002/users/student-uuid-0003 | jq '.data.isActive'
# Kết quả mong đợi: false
```

**Kiểm tra user không xuất hiện khi lọc isActive=true:**

```bash
curl -s "http://localhost:3002/users?isActive=true" | jq '.data.items | map(.id)'
# student-uuid-0003 không có trong danh sách
```

**Mở khóa user (isActive → true):**

```bash
curl -s -X PATCH http://localhost:3002/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": false }'
# Kết quả mong đợi: HTTP 204
```

**Xác nhận:**

```bash
curl -s http://localhost:3002/users/student-uuid-0003 | jq '.data.isActive'
# Kết quả mong đợi: true
```

**Case: ID không tồn tại (expect 404):**

```bash
curl -s -X PATCH http://localhost:3002/users/fake-uuid/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": true }' | jq .
```

**Case: Body không hợp lệ — thiếu field `lock` (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

### 4.8 PATCH /users/:id/license-tier — Gán hạng bằng lái

> Endpoint này đọc `x-user-id` làm `changedById` (người thực hiện) để ghi audit.

**Gán hạng B2 cho student:**

```bash
curl -s -X PATCH http://localhost:3002/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin-uuid-0001" \
  -d '{ "licenseTier": "B2" }'
# Kết quả mong đợi: HTTP 204
```

**Xác nhận license tier đã được gán:**

```bash
curl -s http://localhost:3002/users/student-uuid-0003 | jq '.data.studentDetail'
```

**Kết quả mong đợi:**

```json
{
  "licenseTier": "B2",
  "enrolledAt": "2026-01-01T00:00:00.000Z",
  "notes": "Học viên cần luyện thêm phần biển báo"
}
```

**Thay đổi hạng (từ B2 → C):**

```bash
curl -s -X PATCH http://localhost:3002/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: manager-uuid-0002" \
  -d '{ "licenseTier": "C" }'
```

**Kiểm tra audit trail trong DB (xem phần 7).**

**Case: Gán cho user KHÔNG phải STUDENT (expect 422):**

```bash
curl -s -X PATCH http://localhost:3002/users/admin-uuid-0001/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin-uuid-0001" \
  -d '{ "licenseTier": "B2" }' | jq .
```

**Kết quả mong đợi (422):**

```json
{
  "success": false,
  "code": "USER_NOT_STUDENT",
  "message": "User is not a student",
  "timestamp": "...",
  "path": "/users/admin-uuid-0001/license-tier"
}
```

**Case: licenseTier không hợp lệ (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin-uuid-0001" \
  -d '{ "licenseTier": "Z9" }' | jq .
```

---

## 5. Test luồng RabbitMQ event

### 5.1 Kiểm tra RabbitMQ đang chạy

**RabbitMQ Management UI:** http://localhost:15672  
Username: `guest` / Password: `guest`

Vào tab **Queues** để thấy:

- `user_service_events` — queue user-service đang CONSUME
- `user_service_publish` — queue user-service PUBLISH events vào

### 5.2 Simulate event `identity.user.created`

Thay vì dùng Keycloak, publish trực tiếp vào RabbitMQ queue bằng Management UI hoặc CLI:

**Cách 1: Dùng RabbitMQ Management UI**

1. Vào http://localhost:15672
2. Tab **Queues** → chọn queue `user_service_events`
3. Scroll xuống **Publish message**
4. Điền:
   - Routing key: `identity.user.created`
   - Payload:
   ```json
   {
     "userId": "rabbitmq-user-uuid-0005",
     "email": "rabbitmq-user@example.com",
     "fullName": "Người Dùng RabbitMQ",
     "role": "STUDENT"
   }
   ```
5. Click **Publish message**

**Xác nhận user đã được tạo:**

```bash
curl -s http://localhost:3002/users/rabbitmq-user-uuid-0005 | jq .
```

**Cách 2: Dùng amqp script**

```javascript
// scripts/test-rabbitmq-event.mjs
import amqp from "amqplib";

const conn = await amqp.connect("amqp://localhost:5672");
const channel = await conn.createChannel();

await channel.assertQueue("user_service_events", { durable: true });
channel.sendToQueue(
  "user_service_events",
  Buffer.from(
    JSON.stringify({
      userId: "rabbitmq-user-uuid-0005",
      email: "rabbitmq-user@example.com",
      fullName: "Người Dùng RabbitMQ",
      role: "STUDENT",
    }),
  ),
  { persistent: true },
);

console.log("Event published!");
await conn.close();
```

```bash
node scripts/test-rabbitmq-event.mjs
```

### 5.3 Simulate event `identity.user.role-changed`

```javascript
channel.sendToQueue(
  "user_service_events",
  Buffer.from(
    JSON.stringify({
      userId: "student-uuid-0003",
      newRole: "INSTRUCTOR",
    }),
  ),
  { persistent: true },
);
```

**Sau khi consume:**

```bash
curl -s http://localhost:3002/users/student-uuid-0003 | jq '.data | {role, studentDetail}'
```

**Kết quả mong đợi:**

```json
{
  "role": "INSTRUCTOR",
  "studentDetail": null
}
```

> `studentDetail` bị xóa vì user không còn là STUDENT nữa.

**Promote trở lại STUDENT:**

```javascript
channel.sendToQueue(
  "user_service_events",
  Buffer.from(
    JSON.stringify({
      userId: "student-uuid-0003",
      newRole: "STUDENT",
    }),
  ),
  { persistent: true },
);
```

**Sau khi consume:**

```bash
curl -s http://localhost:3002/users/student-uuid-0003 | jq '.data | {role, studentDetail}'
```

**Kết quả mong đợi:**

```json
{
  "role": "STUDENT",
  "studentDetail": {
    "licenseTier": null,
    "enrolledAt": null,
    "notes": null
  }
}
```

> `studentDetail` được tạo mới (empty) vì user vừa được promote.

---

## 6. Test qua Kong (production path)

> Cần start thêm Kong. Chỉ áp dụng khi đã cấu hình Keycloak và Kong đầy đủ.

### 6.1 Start Kong

```bash
docker-compose up -d kong
```

Kong chạy trên port `8000` (HTTP proxy) và `8001` (Admin API).

### 6.2 Lấy JWT từ Keycloak

```bash
curl -s -X POST http://localhost:8080/realms/<realm>/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=<client_id>" \
  -d "username=<email>" \
  -d "password=<password>" | jq .access_token
```

### 6.3 Gọi API qua Kong

```bash
TOKEN="eyJhbGci..."

curl -s http://localhost:8000/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

> Kong tự inject `x-user-id` và `x-user-role` từ JWT claims vào request trước khi forward xuống user-service.

---

## 7. Kiểm tra Database trực tiếp

### Dùng Prisma Studio

```bash
cd apps/user-service
npx prisma studio
```

Mở http://localhost:5555 để xem:

- Table `user_profiles`
- Table `student_details`
- Table `license_assignment_audits` — **quan trọng để verify audit trail**

### Dùng psql trực tiếp

```bash
psql postgresql://user:password@localhost:5433/user_db
```

```sql
-- Xem tất cả user profiles
SELECT id, "fullName", email, role, "isActive", "createdAt"
FROM user_profiles
ORDER BY "createdAt" DESC;

-- Xem student details
SELECT u."fullName", s."licenseTier", s."enrolledAt", s.notes
FROM user_profiles u
JOIN student_details s ON s."studentId" = u.id;

-- Xem audit trail của license assignment
SELECT
  u."fullName" as student,
  a."oldLicenseTier",
  a."newLicenseTier",
  a."changedById",
  a."changedAt"
FROM license_assignment_audits a
JOIN user_profiles u ON u.id = a."studentId"
ORDER BY a."changedAt" DESC;
```

---

## 8. Troubleshooting

### Service không start được

```
Error: Failed to connect to Consul
```

→ Chạy `docker-compose up -d consul consul-init` và seed lại: `npm run consul:seed:local`

---

### Database connection error

```
Error: Can't reach database server at localhost:5433
```

→ Chạy `docker-compose up -d db-user`

---

### Prisma schema chưa migrate

```
PrismaClientInitializationError: Unable to open a TLS connection
```

→ Chạy:

```bash
cd apps/user-service
npx prisma migrate dev
```

---

### RabbitMQ event không được consume

1. Kiểm tra queue `user_service_events` tồn tại trong RabbitMQ UI
2. Kiểm tra user-service log: event pattern phải là `identity.user.created` hoặc `identity.user.role-changed`
3. Đảm bảo `noAck: false` trong config — RabbitMQ chờ acknowledgment

---

### Response format sai (không có `success` field)

→ `DomainExceptionFilter` hoặc `ApiExceptionFilter` chưa được register. Kiểm tra `main.ts`:

```typescript
app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
```

---

### `422 USER_NOT_STUDENT` khi gán license tier

→ Đúng behavior. User cần có `role = STUDENT` mới được gán license tier.

---

## Checklist test nhanh

Dùng để verify toàn bộ happy path sau mỗi thay đổi:

```bash
BASE="http://localhost:3002"

# 1. Tạo user
curl -s -X POST $BASE/users -H "Content-Type: application/json" \
  -d '{"id":"test-001","fullName":"Test User","email":"test-001@test.com","role":"STUDENT"}' \
  | jq '.success'  # → true

# 2. Lấy profile bằng ID
curl -s $BASE/users/test-001 | jq '.data.role'  # → "STUDENT"

# 3. Lấy profile /me
curl -s $BASE/users/me -H "x-user-id: test-001" | jq '.data.email'  # → "test-001@test.com"

# 4. Update profile
curl -s -X PATCH $BASE/users/me -H "Content-Type: application/json" -H "x-user-id: test-001" \
  -d '{"address":"123 Test St"}' | jq '.data.address'  # → "123 Test St"

# 5. Gán license tier
curl -s -X PATCH $BASE/users/test-001/license-tier \
  -H "Content-Type: application/json" -H "x-user-id: test-001" \
  -d '{"licenseTier":"B2"}' -o /dev/null -w "%{http_code}"  # → 204

# 6. Verify license tier
curl -s $BASE/users/test-001 | jq '.data.studentDetail.licenseTier'  # → "B2"

# 7. Lock user
curl -s -X PATCH $BASE/users/test-001/lock -H "Content-Type: application/json" \
  -d '{"lock":true}' -o /dev/null -w "%{http_code}"  # → 204

# 8. Verify locked
curl -s $BASE/users/test-001 | jq '.data.isActive'  # → false

echo "All checks passed!"
```
