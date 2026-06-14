# Services API Test Guide

This is the master manual test guide for the backend services. Use it together with the per-service API specs in `docs/api/api-spec-*.md`.

For the interactive UI, open Scalar:

```http
GET http://localhost:3007/analytics/me/progress
Authorization: Bearer <student_token>
```

Expected: dashboard returns `attemptCount`, `passRate`, study minutes, trend, and weak topics.

## Cache Check

Use Redis CLI and verify key:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "analytics:progress:*"
```

After `POST /enrollments/{id}/reset-progress`, the student's analytics key should be invalidated and rebuilt on next read.
## SRS UC34 Cache Scope Tests

1. Owner-only:
   call `GET /analytics/me/progress` as student and verify response `studentId` equals JWT `sub`.
2. Cache miss/hit:
   first call builds from PostgreSQL projection; second call should use Redis key `analytics:progress:{studentId}:{licenseTier|default}`.
3. Reset invalidation:
   after `course.enrollment.progress-reset`, verify all `analytics:progress:{studentId}:*` keys are invalidated and rebuilt on next read.
4. Weak topics:
   after wrong exam answers are projected, verify top weak topics are ranked by incorrect count.



<!-- Merged from docs/testing/services-test-guide.md -->
# Audit Service Testing Guide

Guide này dùng để test và demo Security tactic: **Access Logging + Centralized Audit Trail + Transactional Outbox**.

Mục tiêu demo:

1. Mọi HTTP request có access log và `x-correlation-id`.
2. Mutation nhạy cảm tạo audit event qua transactional outbox.
3. `audit-service` lưu audit trail tập trung, append-only, idempotent.
4. Khi RabbitMQ lỗi, business action vẫn commit và audit event không mất.

---

## 1. Scope Đã Triển Khai

| Capability | Service/File liên quan | Cách verify |
| --- | --- | --- |
| Correlation id + access log | `@repo/common`, mọi service | Response có `x-correlation-id`; log có `logType=access`. |
| Audit producer outbox | `user-service`, `course-service`, `exam-service` | Check `outbox_messages` trong DB producer. |
| Audit consumer | `audit-service` | Query `audit_db.audit_logs` hoặc `GET /admin/audit-logs`. |
| Idempotent audit record | `audit-service` | Publish cùng `eventId` 2 lần, chỉ có 1 row. |
| Outbox retry | Producer relay services | Stop RabbitMQ, gọi mutation, start lại RabbitMQ, event publish sau. |

Audited actions phase hiện tại:

| Service | Action |
| --- | --- |
| `user-service` | `USER_LICENSE_ASSIGNED` |
| `course-service` | `COURSE_CREATED`, `COURSE_UPDATED`, `COURSE_ARCHIVED`, `COURSE_ACTIVATED`, `COURSE_LESSON_ADDED`, `COURSE_LESSON_REMOVED`, `COURSE_MATERIAL_ADDED`, `ENROLLMENT_PROGRESS_RESET` |
| `exam-service` | `EXAM_TEMPLATE_CREATED`, `EXAM_TEMPLATE_UPDATED`, `EXAM_TEMPLATE_DELETED` |

---

## 2. Setup

### 2.1 Hybrid dev mode

```powershell
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:deploy
pnpm run db:seed
pnpm run dev
```

Sau khi service start, kiểm tra health:

```powershell
curl http://localhost:3011/health/ready
curl http://localhost:3002/health/ready
curl http://localhost:3004/health/ready
curl http://localhost:3003/health/ready
```

Expected: tất cả trả `200`.

### 2.2 Full Docker mode

```powershell
docker compose up -d --build
pnpm run docker:migrate
pnpm run db:seed
```

Kiểm tra container:

```powershell
docker compose ps audit-service user-service course-service exam-service rabbitmq elasticsearch logstash kibana
```

Expected:

- `audit-service`, `user-service`, `course-service`, `exam-service`: `healthy`.
- `rabbitmq`: running.
- `elasticsearch`: healthy.
- `logstash`, `kibana`: running.

---

## 3. Chuẩn Bị Token Demo

Demo chuẩn đi qua Kong và dùng JWT thật:

```powershell
$TOKEN_ADMIN = "<admin_access_token>"
$TOKEN_STUDENT = "<student_access_token>"
```

Nếu dùng seed demo, login bằng identity-service hoặc Keycloak token endpoint theo guide identity. Frontend/client không tự gửi `x-user-id`; actor lấy từ `Authorization: Bearer ...`.

DB connection nhanh từ máy host, không cần `docker compose exec`:

```powershell
psql "postgresql://user:password@localhost:5433/user_db"
psql "postgresql://user:password@localhost:5435/course_db"
psql "postgresql://user:password@localhost:5434/exam_db"
psql "postgresql://user:password@localhost:5441/audit_db"
```

---

## 4. Test Access Logging

### 4.1 Gọi request thành công

```powershell
curl -i http://localhost:8000/user-service/health/ready
```

Expected:

- HTTP `200`.
- Response header có `x-correlation-id`.
- Service log có access log metadata:
  - `correlationId`
  - `serviceName`
  - `method`
  - `path`
  - `statusCode`
  - `latencyMs`
  - `actorId` nếu request có JWT
  - `ipAddress`
  - `userAgent`

### 4.2 Gọi request lỗi

```powershell
curl -i http://localhost:8000/admin/audit-logs `
  -H "Authorization: Bearer invalid-token"
```

Expected:

- HTTP `401` hoặc `403`.
- Vẫn có `x-correlation-id`.
- Access log vẫn ghi request lỗi.
- Log không chứa raw token hoặc Authorization header.

### 4.3 Verify trong ELK

Kibana: http://localhost:5601

Search theo correlation id:

```text
correlationId : "<x-correlation-id>"
```

Hoặc query Elasticsearch trực tiếp:

```powershell
curl "http://localhost:9200/microservices-logs-*/_search?q=correlationId:<x-correlation-id>"
```

Expected:

- Có document access log.
- Không có field/password/token/Authorization/clientSecret/storage key dạng plaintext.

---

## 5. Test Audit API

### 5.1 Role guard

Student không được xem audit logs:

```http
POST /admin/users/:id/documents
```

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "...",
  "path": "/admin/audit-logs"
}
```

Admin xem được:

```powershell
curl -s "http://localhost:8000/admin/audit-logs?page=1&size=20" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

Expected:

- HTTP `200`.
- `data.items` là array.
- `data.page = 1`.
- `data.size = 20`.

### 5.2 Bounded pagination

```powershell
curl -i "http://localhost:8000/admin/audit-logs?size=101" `
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

Expected: HTTP `400`, `VALIDATION_ERROR`.

---

## 6. Demo User-Service Audit: Assign License

### 6.1 Gọi audited action

```powershell
$STUDENT_ID = "<student-user-id>"

curl -i -X PATCH "http://localhost:8000/admin/users/$STUDENT_ID/license-tier" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{ \"licenseTier\": \"B1\" }"
```

Expected response:

- HTTP `200`.
- Header `x-correlation-id`.
- `data.studentDetail.licenseTier = "B1"`.

### 6.2 Verify producer outbox trong user DB

```powershell
docker compose exec db-user psql -U user -d user_db -c "SELECT id, \"eventName\", status, attempts, \"publishedAt\", \"lastError\", payload->>'action' AS action FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 5;"
```

Expected:

- Có row `eventName = security.audit.recorded`.
- `action = USER_LICENSE_ASSIGNED`.
- Bình thường sau vài giây `status = PUBLISHED`.
- `publishedAt` khác null.

### 6.3 Verify centralized audit API

```powershell
curl -s "http://localhost:8000/admin/audit-logs?action=USER_LICENSE_ASSIGNED&resourceId=$STUDENT_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

Expected:

```json
{
  "data": {
    "items": [
      {
        "serviceName": "user-service",
        "action": "USER_LICENSE_ASSIGNED",
        "resourceType": "USER_PROFILE",
        "resourceId": "<student-user-id>",
        "outcome": "SUCCESS",
        "metadata": {
          "newLicenseTier": "B1"
        }
      }
    ]
  }
}
```

### 6.4 Verify audit DB trực tiếp

```powershell
docker compose exec db-audit psql -U user -d audit_db -c "SELECT \"serviceName\", action, \"resourceType\", \"resourceId\", outcome, metadata FROM audit_logs WHERE action = 'USER_LICENSE_ASSIGNED' ORDER BY \"occurredAt\" DESC LIMIT 5;"
```

Expected: có row tương ứng.

---

## 7. Demo Course-Service Audit

### 7.1 Create course

```powershell
curl -i -X POST "http://localhost:8000/admin/courses" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{
    \"title\": \"Khóa học B1 Audit Demo\",
    \"licenseCategory\": \"B1\",
    \"description\": \"Course created to verify audit trail\",
    \"duration\": \"3 tháng\",
    \"tuitionFee\": 5000000,
    \"capacity\": 30,
    \"instructorIds\": [],
    \"requirement\": {
      \"minAge\": 18,
      \"attendanceRate\": 80,
      \"minPassScore\": 80,
      \"requiredExams\": 1
    }
  }"
```

Lưu `data.id` thành `$COURSE_ID`.

Expected audit:

```powershell
curl -s "http://localhost:8000/admin/audit-logs?action=COURSE_CREATED&resourceId=$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.items[0]'
```

Expected fields:

- `serviceName = course-service`
- `resourceType = COURSE`
- `metadata.title = "Khóa học B1 Audit Demo"`
- `metadata.licenseCategory = "B1"`

### 7.2 Add lesson

```powershell
curl -i -X POST "http://localhost:8000/admin/courses/$COURSE_ID/lessons" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{ \"title\": \"Bài 1\", \"content\": \"Nội dung\", \"order\": 1 }"
```

Expected audit action: `COURSE_LESSON_ADDED`.

### 7.3 Archive course

```powershell
curl -i -X DELETE "http://localhost:8000/admin/courses/$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

Expected audit action: `COURSE_ARCHIVED`.

Verify DB:

```powershell
docker compose exec db-course psql -U user -d course_db -c "SELECT payload->>'action' AS action, status, attempts, \"publishedAt\" FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 10;"
```

---

## 8. Demo Exam-Service Audit

### 8.1 Create exam template

```powershell
curl -i -X POST "http://localhost:8000/admin/exams/templates" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{
    \"name\": \"Đề thi B1 Audit Demo\",
    \"description\": \"Template created to verify audit trail\",
    \"licenseCategory\": \"B1\",
    \"totalQuestions\": 1,
    \"passingScore\": 1,
    \"durationMinutes\": 20,
    \"criticalQuestions\": 0,
    \"maxCriticalMistakes\": 0,
    \"shuffleQuestions\": true,
    \"topicDistribution\": [
      {
        \"topicId\": \"10000000-0000-0000-0000-000000000101\",
        \"questionCount\": 1
      }
    ]
  }"
```

Lưu `data.id` thành `$TEMPLATE_ID`.

Expected audit action: `EXAM_TEMPLATE_CREATED`.

### 8.2 Update exam template

```powershell
curl -i -X PATCH "http://localhost:8000/admin/exams/templates/$TEMPLATE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{ \"name\": \"Đề thi B1 Audit Demo Updated\", \"version\": 1 }"
```

Expected audit action: `EXAM_TEMPLATE_UPDATED`.

### 8.3 Query audit log

```powershell
curl -s "http://localhost:8000/admin/audit-logs?serviceName=exam-service&resourceId=$TEMPLATE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.items | map({action, resourceId, metadata})'
```

Expected: thấy `EXAM_TEMPLATE_CREATED` và `EXAM_TEMPLATE_UPDATED`.

---

## 9. Test Transactional Outbox Retry

Mục tiêu: chứng minh RabbitMQ lỗi không làm mất audit event và không rollback business action đã thành công.

### 9.1 Stop RabbitMQ

```powershell
docker compose stop rabbitmq
```

### 9.2 Gọi audited action

Ví dụ archive một course:

```powershell
curl -i -X DELETE "http://localhost:8000/admin/courses/$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

Expected:

- Nếu HTTP service vẫn đang chạy và không cần RabbitMQ cho request path này, business response vẫn success.
- Course đã đổi trạng thái/archive trong `course_db`.
- Audit event nằm trong `course_db.outbox_messages`.
- Audit log chưa xuất hiện ngay trong `audit_db.audit_logs`.

### 9.3 Check pending/failed outbox

```powershell
docker compose exec db-course psql -U user -d course_db -c "SELECT id, \"eventName\", status, attempts, \"nextAttemptAt\", \"lastError\", payload->>'action' AS action FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 10;"
```

Expected:

- `status = PENDING` trong các lần retry đầu.
- Sau nhiều lần fail có thể thành `FAILED` khi `attempts >= 10`.
- `lastError` có lỗi connection RabbitMQ.

### 9.4 Start RabbitMQ lại

```powershell
docker compose start rabbitmq
```

Chờ khoảng 5-10 giây rồi kiểm tra:

```powershell
docker compose exec db-course psql -U user -d course_db -c "SELECT status, attempts, \"publishedAt\", \"lastError\", payload->>'action' AS action FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 10;"
```

Expected:

- Message quay về `PUBLISHED` nếu vẫn đang `PENDING` và relay publish thành công.
- Nếu message đã thành `FAILED`, phase hiện tại chưa có manual requeue API; có thể update DB thủ công trong demo dev để retry:

```sql
SELECT count(*) FROM questions WHERE "isCritical" = true;
```

Sau đó audit log xuất hiện:

```powershell
curl -s "http://localhost:8000/admin/audit-logs?action=COURSE_ARCHIVED&resourceId=$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.total'
```

---

## 10. Test Idempotency

Mục tiêu: cùng `eventId` chỉ tạo 1 audit row.

### 10.1 Lấy một `eventId` đã publish

```powershell
docker compose exec db-user psql -U user -d user_db -c "SELECT payload->>'eventId' AS event_id, payload->>'action' AS action, status FROM outbox_messages WHERE \"eventName\" = 'security.audit.recorded' ORDER BY \"createdAt\" DESC LIMIT 1;"
```

Copy `event_id`.

### 10.2 Tạo duplicate outbox message cùng payload

Thay `<new-outbox-id>` bằng một UUID mới bất kỳ và `<event-id>` bằng giá trị vừa copy. Cách này buộc producer relay publish lại cùng audit `eventId`, đúng với path thật của hệ thống hơn là publish raw message thủ công qua RabbitMQ UI.

```powershell
docker compose exec db-user psql -U user -d user_db -c "INSERT INTO outbox_messages (id, \"eventName\", payload, status, attempts, \"nextAttemptAt\", \"createdAt\", \"updatedAt\") SELECT '<new-outbox-id>', \"eventName\", payload, 'PENDING', 0, now(), now(), now() FROM outbox_messages WHERE payload->>'eventId' = '<event-id>' LIMIT 1;"
```

Chờ khoảng 5-10 giây để relay publish.

### 10.3 Verify chỉ có một row

```powershell
docker compose exec db-audit psql -U user -d audit_db -c "SELECT \"eventId\", count(*) FROM audit_logs GROUP BY \"eventId\" HAVING count(*) > 1;"
```

Expected: không có row nào.

Nếu câu insert duplicate trả `INSERT 0 0`, nghĩa là phần `SELECT ... WHERE payload->>'eventId' = '<event-id>'` không tìm thấy source row. Chạy query này trước để copy đúng `event_id`:

```sql
SELECT id, payload->>'eventId' AS event_id, payload->>'action' AS action, status
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Nếu row duplicate đã insert nhưng chưa chuyển `PUBLISHED`, kiểm tra `nextAttemptAt`. Relay chỉ lấy row `PENDING` khi `nextAttemptAt <= now()`, nên sau broker failure có thể phải chờ theo backoff:

```sql
SELECT id, status, attempts, "nextAttemptAt", now() AS current_time, "lastError"
FROM outbox_messages
WHERE payload->>'eventId' = '<event-id>'
ORDER BY "createdAt" DESC;
```

---

## 11. Troubleshooting

### `GET /admin/audit-logs` trả 401/403

- Kiểm tra token có phải admin/center manager không.
- Frontend chỉ gửi `Authorization`, không gửi `x-user-id`.
- Kiểm tra Keycloak role mapping trong token.

### Audited action success nhưng audit API chưa thấy record

Check theo thứ tự:

1. Producer DB có `outbox_messages` chưa.
2. `outbox_messages.status` là `PUBLISHED`, `PENDING`, hay `FAILED`.
3. RabbitMQ có queue `audit_service_events` không.
4. `audit-service` có running/healthy không.
5. `audit_db.audit_logs` có row theo `eventId` chưa.

### Access log không vào Kibana

- Kiểm tra `elasticsearch`, `logstash`, `kibana` đang chạy.
- Kiểm tra app log có access log ở stdout trước.
- Kiểm tra Logstash pipeline và index `microservices-logs-*`.

### Không nên log gì?

Không log:

- Password hoặc temporary password.
- Access/refresh token.
- `Authorization` header.
- Keycloak client secret.
- Azure/storage account key.
- Raw request body chứa dữ liệu nhạy cảm.

---

## 12. Demo Script Nhanh 5 Phút

```powershell
# 1. Health
pnpm run smoke

# 2. Gọi audited action
curl -i -X PATCH "http://localhost:8000/admin/users/$STUDENT_ID/license-tier" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{ \"licenseTier\": \"B1\" }"

# 3. Check producer outbox
docker compose exec db-user psql -U user -d user_db -c "SELECT payload->>'action' AS action, status, \"publishedAt\" FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 3;"

# 4. Check centralized audit API
curl -s "http://localhost:8000/admin/audit-logs?action=USER_LICENSE_ASSIGNED&resourceId=$STUDENT_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.items[0]'

# 5. Check audit DB
docker compose exec db-audit psql -U user -d audit_db -c "SELECT \"serviceName\", action, \"resourceId\", metadata FROM audit_logs ORDER BY \"occurredAt\" DESC LIMIT 3;"
```

Expected: cùng một action xuất hiện ở outbox producer và audit trail tập trung, có `correlationId` để nối với access log.



<!-- Merged legacy testing guide -->
# Course Service — Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test toàn bộ API của `course-service`, cả khi gọi **trực tiếp** (bỏ qua Kong, dùng cho dev/debug) lẫn khi gọi **qua Kong** (production path).

---

## Mục lục

1. [Khởi động môi trường](#1-khởi-động-môi-trường)
2. [Kiến trúc luồng request](#2-kiến-trúc-luồng-request)
3. [Chuẩn bị — Tạo dữ liệu mẫu](#3-chuẩn-bị--tạo-dữ-liệu-mẫu)
4. [Test Course endpoints](#4-test-course-endpoints)
5. [Test Enrollment endpoints](#5-test-enrollment-endpoints)
6. [Test luồng RabbitMQ event](#6-test-luồng-rabbitmq-event)
7. [Kiểm tra Database trực tiếp](#7-kiểm-tra-database-trực-tiếp)
8. [Test Security Audit Và Outbox](#8-test-security-audit-và-outbox)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Khởi động môi trường

### Bước 1.1 — Start infrastructure

```bash
# Từ root của project
pnpm run infra:up
```

Chờ khoảng 10-15 giây để Consul khởi động và seed xong.

**Kiểm tra Consul healthy:**

```bash
curl http://localhost:8500/v1/status/leader
# Kết quả mong đợi: "..." (địa chỉ leader node)
```

**Consul UI:** http://localhost:8500/ui

### Bước 1.2 — Seed config vào Consul

```bash
pnpm run consul:seed:local
```

Sau khi seed, kiểm tra config course-service:

```bash
pnpm run consul:list
pnpm run consul:get -- config/development-local/course-service/redis.url
# Expected: redis://localhost:6379
# Tìm các key: config/development-local/course-service/...
```

### Bước 1.3 — Migrate database

```bash
cd apps/course-service
pnpm run db:generate
pnpm run db:migrate
```

Hoặc nếu migration đã tồn tại:

```bash
cd apps/course-service
pnpm run db:deploy
```

**Kiểm tra schema:**

```bash
pnpm run db:studio
# Mở browser tại http://localhost:5555
```

### Bước 1.4 — Start course-service

```bash
# Từ root
pnpm run dev --filter=course-service
```

**Kiểm tra service đang chạy:**

```bash
curl http://localhost:3004/docs-json
# Kết quả: OpenAPI JSON spec
```

**Swagger UI:** http://localhost:3004/docs

---

## 2. Kiến trúc luồng request

```
Client (curl/Postman)
    │
    ├─── DIRECT (dev/debug) ──→ http://localhost:3004  ←── Port course-service local
    │                            (Ưu tiên JWT thật; x-user-id chỉ là fallback legacy)
    │
    └─── VIA KONG ────────────→ http://localhost:8000  ←── Kong gateway
                                 (Cần JWT hợp lệ từ Keycloak)
                                 Service đọc actor từ JWT.sub
```

> **Lưu ý:** course-service hiện validate JWT/RBAC tại service và đọc user từ `@AuthenticatedUser()`. Các lệnh `x-user-id` trong guide này chỉ còn dùng cho debug legacy khi endpoint vẫn có fallback; frontend và demo chuẩn phải gửi `Authorization: Bearer <access_token>`.

---

## 3. Chuẩn bị — Tạo dữ liệu mẫu

### ID mẫu dùng xuyên suốt tài liệu này

```
INSTRUCTOR_ID = instructor-uuid-0001
STUDENT_ID    = student-uuid-0002
ADMIN_ID      = admin-uuid-0003
```

> Đây chỉ là UUID giả (user-service không cần chạy vì cross-service ref không có FK).

---

## 4. Test Course endpoints

> Course list/detail uses Redis cache-aside with 600-second TTL. If Redis is unavailable, requests fall back to PostgreSQL and keep the same response shape.

> Tất cả các lệnh curl sau gọi **trực tiếp** vào course-service (port 3004). Khi demo chuẩn, thay các header `x-user-id` bằng `Authorization: Bearer <access_token>` lấy từ Keycloak.

---

### 4.1 POST /admin/courses — Tạo khóa học

**Happy path — tạo khóa học đầy đủ:**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{
    "title": "Khóa học B2 – Cơ bản",
    "licenseCategory": "B2",
    "description": "Khóa học lý thuyết và thực hành thi bằng B2",
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "instructorIds": ["instructor-uuid-0001"],
    "requirement": {
      "minAge": 18,
      "prerequisites": "Có giấy phép B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    }
  }' | jq .
```

**Kết quả mong đợi (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses",
  "data": {
    "id": "<course-uuid>",
    "title": "Khóa học B2 – Cơ bản",
    "description": "Khóa học lý thuyết và thực hành thi bằng B2",
    "licenseCategory": "B2",
    "status": "DRAFT",
    "totalLessons": 0,
    "duration": "3 tháng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "createdById": "instructor-uuid-0001",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z",
    "lessons": [],
    "instructorIds": ["instructor-uuid-0001"],
    "requirement": {
      "id": "<requirement-uuid>",
      "minAge": 18,
      "prerequisites": "Có giấy phép B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    },
    "materials": []
  }
}
```

> **Lưu ý:** Lưu lại `course-uuid` từ response để dùng cho các bước tiếp theo.

```bash
# Lưu course ID
COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Test Course","licenseCategory":"B1"}' \
  | jq -r '.data.id')
echo "COURSE_ID=$COURSE_ID"
```

**Tạo thêm course A1 để test list/filter:**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{
    "title": "Khóa học A1 – Xe máy 50cc",
    "licenseCategory": "A1",
    "tuitionFee": 2000000
  }' | jq '.data.id'
```

**Case: Thiếu field bắt buộc (expect 400):**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title": "Không có licenseCategory"}' | jq .
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "...",
  "path": "/courses",
  "errors": ["licenseCategory should not be empty"]
}
```

---

### 4.2 GET /courses — Danh sách khóa học

**Lấy tất cả:**

```bash
curl -s "http://localhost:3004/admin/courses" | jq '.data | {total, page, size}'
```

**Lọc theo hạng bằng:**

```bash
curl -s "http://localhost:3004/courses?licenseCategory=B2" | jq '.data.items | length'
```

**Lọc theo status:**

```bash
curl -s "http://localhost:3004/courses?status=DRAFT" | jq '.data.items | map(.status)'
curl -s "http://localhost:3004/courses?status=ACTIVE" | jq '.data.items | map(.title)'
```

**Phân trang:**

```bash
curl -s "http://localhost:3004/courses?page=1&size=1" | jq '.data | {total, page, size, items_count: (.items | length)}'
```

**Kết hợp filter:**

```bash
curl -s "http://localhost:3004/courses?licenseCategory=B2&status=DRAFT" | jq .
```

---

### 4.3 GET /courses/:id — Chi tiết khóa học

```bash
curl -s "http://localhost:3004/courses/$COURSE_ID" | jq .data
```

**Case: ID không tồn tại (expect 404):**

```bash
curl -s "http://localhost:3004/courses/non-existent-uuid" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_NOT_FOUND",
  "message": "Course with id non-existent-uuid not found",
  "timestamp": "...",
  "path": "/courses/non-existent-uuid"
}
```

---

### 4.4 PATCH /admin/courses/:id — Cập nhật khóa học

**Cập nhật metadata:**

```bash
curl -s -X PATCH "http://localhost:3004/courses/$COURSE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Khóa học B2 – Nâng cao",
    "tuitionFee": 6000000,
    "duration": "4 tháng"
  }' | jq '.data | {title, tuitionFee, duration}'
```

**Cập nhật requirement:**

```bash
curl -s -X PATCH "http://localhost:3004/courses/$COURSE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": {
      "minAge": 21,
      "attendanceRate": 90,
      "minPassScore": 85,
      "requiredExams": 3
    }
  }' | jq '.data.requirement'
```

---

### 4.5 POST /admin/courses/:id/lessons — Thêm bài học

**Thêm bài học 1:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bài 1 – Biển báo giao thông",
    "order": 1,
    "content": "# Biển báo\nNội dung markdown..."
  }' | jq '.data | {totalLessons, lessons_count: (.lessons | length)}'
```

**Thêm bài học 2:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bài 2 – Kỹ năng lái xe",
    "order": 2
  }' | jq '.data.totalLessons'
# Kết quả mong đợi: 2
```

**Thêm bài học 3 (để test complete enrollment):**

```bash
LESSON_1_ID=$(curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson A","order":1}' | jq -r '.data.lessons[0].id')

# Lấy lesson IDs từ course
curl -s "http://localhost:3004/courses/$COURSE_ID" | jq '.data.lessons | map({id, title, order})'
```

> **Lưu ý:** Lưu các `lesson_id` từ response để dùng cho test complete-lesson.

**Case: Thiếu field bắt buộc (expect 400):**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"content": "Không có title và order"}' | jq .
```

---

### 4.6 PATCH /admin/courses/:id/activate — Kích hoạt khóa học

**Case: Kích hoạt khi chưa có lesson (expect 422):**

```bash
# Tạo course rỗng rồi thử activate
EMPTY_COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Empty Course","licenseCategory":"C"}' | jq -r '.data.id')

curl -s -X PATCH "http://localhost:3004/admin/courses/$EMPTY_COURSE_ID/activate" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_HAS_NO_LESSON",
  "message": "Course must have at least one lesson before activation",
  "timestamp": "...",
  "path": "/courses/.../activate"
}
```

**Happy path — Kích hoạt course có lesson:**

```bash
curl -s -X PATCH "http://localhost:3004/admin/courses/$COURSE_ID/activate" | jq '.data.status'
# Kết quả mong đợi: "ACTIVE"
```

**Xác nhận filter status=ACTIVE:**

```bash
curl -s "http://localhost:3004/courses?status=ACTIVE" | jq '.data.items | map(.title)'
# Phải thấy course vừa activate
```

---

### 4.7 DELETE /admin/courses/:id/lessons/:lessonId — Xóa bài học

```bash
# Lấy lessonId từ course
LESSON_ID=$(curl -s "http://localhost:3004/courses/$COURSE_ID" | jq -r '.data.lessons[-1].id')

curl -s -X DELETE "http://localhost:3004/admin/courses/$COURSE_ID/lessons/$LESSON_ID" \
  | jq '.data | {totalLessons}'
```

**Case: Lesson không tồn tại (expect 404):**

```bash
curl -s -X DELETE "http://localhost:3004/admin/courses/$COURSE_ID/lessons/non-existent-lesson-id" | jq .
```

```json
{
  "success": false,
  "code": "LESSON_NOT_FOUND",
  "message": "Lesson with id non-existent-lesson-id not found",
  "timestamp": "...",
  "path": "/courses/.../lessons/non-existent-lesson-id"
}
```

---

### 4.8 POST /admin/courses/:id/materials — Thêm tài liệu

**Thêm PDF:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Giáo trình lý thuyết B2",
    "fileUrl": "https://example.com/giao-trinh.pdf",
    "type": "PDF"
  }' | jq '.data.materials'
```

**Thêm video:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Video hướng dẫn thực hành",
    "fileUrl": "https://example.com/video.mp4",
    "type": "VIDEO"
  }' | jq '.data.materials | length'
```

---

### 4.9 POST /courses/:id/enroll — Đăng ký khóa học

> Đảm bảo course đang ở status ACTIVE trước khi test enroll.

**Chuẩn bị license tier read model cho student:**

Course-service enroll dựa trên read model được sync từ event `user.student.license-assigned`. Trước khi gọi enroll trực tiếp trong môi trường test, publish event vào queue `course_service_events` hoặc dùng flow user-service assign license tier.

Payload RabbitMQ mẫu cho course `$COURSE_ID` có `licenseCategory = B2`:

```json
{
  "studentId": "student-uuid-0002",
  "oldLicenseTier": null,
  "newLicenseTier": "B2",
  "changedById": "admin-uuid-0001"
}
```

**Happy path:**

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-uuid-0002" | jq .data
```

**Kết quả mong đợi (201):**

```json
{
  "id": "<enrollment-uuid>",
  "courseId": "<course-uuid>",
  "studentId": "student-uuid-0002",
  "status": "ACTIVE",
  "progress": 0,
  "enrolledAt": "...",
  "completedAt": null
}
```

> **Lưu lại enrollment ID:**
> ```bash
> ENROLLMENT_ID=$(curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
>   -H "x-user-id: student-uuid-NEW" | jq -r '.data.id')
> ```

**Case: Đăng ký khóa học DRAFT (expect 422):**

```bash
curl -s -X POST "http://localhost:3004/courses/$EMPTY_COURSE_ID/enroll" \
  -H "x-user-id: student-uuid-0002" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_NOT_ACTIVE",
  "message": "Course is not active",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: Đăng ký lần 2 (expect 409):**

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-uuid-0002" | jq .
```

```json
{
  "success": false,
  "code": "ENROLLMENT_ALREADY_EXISTS",
  "message": "Student is already enrolled in this course",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: Student chưa có license tier sync sang course-service (expect 422):**

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-no-license" | jq .
```

```json
{
  "success": false,
  "code": "STUDENT_LICENSE_NOT_ASSIGNED",
  "message": "Student student-no-license has no assigned license tier",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: License tier không khớp licenseCategory của course (expect 422):**

Publish event `user.student.license-assigned` cho `student-wrong-license` với `newLicenseTier = "A1"`, rồi enroll vào course B2:

```bash
curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
  -H "x-user-id: student-wrong-license" | jq .
```

```json
{
  "success": false,
  "code": "STUDENT_LICENSE_MISMATCH",
  "message": "Student student-wrong-license has license tier A1, but course requires B2",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

**Case: Khóa học hết chỗ (expect 422):**

```bash
# Tạo course với capacity=1 và đăng ký student thứ 2
SMALL_COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Small Course","licenseCategory":"C","capacity":1}' | jq -r '.data.id')

# Thêm lesson và activate
curl -s -X POST "http://localhost:3004/admin/courses/$SMALL_COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Only lesson","order":1}' > /dev/null
curl -s -X PATCH "http://localhost:3004/admin/courses/$SMALL_COURSE_ID/activate" > /dev/null

# Đăng ký student 1 (thành công)
# Trước đó cần sync license tier C cho student-a qua event user.student.license-assigned.
curl -s -X POST "http://localhost:3004/courses/$SMALL_COURSE_ID/enroll" \
  -H "x-user-id: student-a" | jq '.success'  # → true

# Đăng ký student 2 (expect 422)
# Trước đó cần sync license tier C cho student-b qua event user.student.license-assigned.
curl -s -X POST "http://localhost:3004/courses/$SMALL_COURSE_ID/enroll" \
  -H "x-user-id: student-b" | jq .
```

```json
{
  "success": false,
  "code": "COURSE_CAPACITY_EXCEEDED",
  "message": "Course capacity has been exceeded",
  "timestamp": "...",
  "path": "/courses/.../enroll"
}
```

---

## 5. Test Enrollment endpoints

> Cần có `ENROLLMENT_ID` hợp lệ. Lấy từ bước 4.9 hoặc tạo mới.

---

### 5.1 GET /enrollments — Danh sách enrollment của student

```bash
curl -s "http://localhost:3004/enrollments" \
  -H "x-user-id: student-uuid-0002" | jq '.data | {total, items_count: (.items | length)}'
```

**Lọc theo status:**

```bash
curl -s "http://localhost:3004/enrollments?status=ACTIVE" \
  -H "x-user-id: student-uuid-0002" | jq '.data.items | map(.status)'
```

---

### 5.2 GET /enrollments/:id — Chi tiết enrollment

```bash
curl -s "http://localhost:3004/enrollments/$ENROLLMENT_ID" | jq .data
```

**Kết quả mong đợi:**

```json
{
  "id": "...",
  "courseId": "...",
  "studentId": "student-uuid-0002",
  "status": "ACTIVE",
  "progress": 0,
  "enrolledAt": "...",
  "completedAt": null
}
```

**Case: Không tìm thấy (expect 404):**

```bash
curl -s "http://localhost:3004/enrollments/non-existent-id" | jq .
```

---

### 5.3 POST /enrollments/:id/lessons/:lessonId/complete — Hoàn thành bài học

**Setup — Lấy lesson IDs từ course:**

```bash
LESSONS=$(curl -s "http://localhost:3004/courses/$COURSE_ID" | jq '.data.lessons | map(.id)')
LESSON_1_ID=$(echo $LESSONS | jq -r '.[0]')
LESSON_2_ID=$(echo $LESSONS | jq -r '.[1]')
echo "LESSON_1=$LESSON_1_ID"
echo "LESSON_2=$LESSON_2_ID"
```

**Hoàn thành bài học 1:**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_1_ID/complete" \
  | jq '.data | {progress, status}'
```

**Kết quả mong đợi (progress = 50% nếu có 2 bài):**

```json
{
  "progress": 50,
  "status": "ACTIVE"
}
```

**Hoàn thành bài học 2 → enrollment COMPLETED:**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_2_ID/complete" \
  | jq '.data | {progress, status, completedAt}'
```

**Kết quả mong đợi (progress = 100%):**

```json
{
  "progress": 100,
  "status": "COMPLETED",
  "completedAt": "2026-05-07T..."
}
```

> **Lưu ý:** Không có per-lesson tracking — mỗi lần gọi `complete` tăng `progress += 100/totalLessons`. Không có `LESSON_ALREADY_COMPLETED` vì không track per-lesson state.

**Case: Enrollment đã COMPLETED (expect 422):**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_1_ID/complete" \
  | jq .
```

```json
{
  "success": false,
  "code": "ENROLLMENT_ALREADY_COMPLETED",
  "message": "Enrollment is already completed",
  "timestamp": "...",
  "path": "/enrollments/.../lessons/.../complete"
}
```

---

## 6. Test luồng RabbitMQ event

### 6.1 Kiểm tra RabbitMQ đang chạy

**RabbitMQ Management UI:** http://localhost:15672
Username: `guest` / Password: `guest`

Vào tab **Queues** để thấy:

- `course_service_events` — queue course-service CONSUME (nhận event từ user-service)
- `course_service_publish` — queue course-service PUBLISH events vào

### 6.2 Kiểm tra events được publish sau enroll

Sau khi `POST /courses/:id/enroll` thành công, vào tab **Queues** → `course_service_publish` → **Get messages** để xem event `course.enrollment.created`.

### 6.3 Kiểm tra events sau complete lesson

Sau khi `POST /enrollments/:id/lessons/:lessonId/complete`:
- Tìm event `course.lesson.completed` trong queue
- Nếu enrollment = 100%, tìm thêm `course.enrollment.completed`

### 6.4 Simulate event `user.student.license-assigned`

Publish thủ công vào `course_service_events`:

**Cách 1: RabbitMQ Management UI**

1. Vào http://localhost:15672
2. Tab **Queues** → `course_service_events` → **Publish message**
3. Routing key: `user.student.license-assigned`
4. Payload theo Nest RMQ packet format:
```json
{
  "pattern": "user.student.license-assigned",
  "data": {
    "studentId": "student-uuid-0002",
    "oldLicenseTier": null,
    "newLicenseTier": "B2",
    "changedById": "admin-uuid-0001"
  }
}
```
5. Click **Publish message**

**Kết quả mong đợi:** Course-service log: `Received user.student.license-assigned for studentId=student-uuid-0002, newLicenseTier=B2` và table `student_license_profiles` có record tương ứng.

---

## 7. Kiểm tra Database trực tiếp

### Dùng Prisma Studio

```bash
cd apps/course-service
pnpm run db:studio
```

Mở http://localhost:5555 để xem các bảng:
- `courses`
- `lessons`
- `course_instructors`
- `course_requirements`
- `course_materials`
- `course_enrollments`
- `student_license_profiles`

### Dùng psql trực tiếp

```bash
psql postgresql://user:password@localhost:5435/course_db
```

```sql
-- Xem tất cả courses và số bài học
SELECT id, title, "licenseCategory", status, "totalLessons", "tuitionFee", capacity
FROM courses
ORDER BY "createdAt" DESC;

-- Xem lessons của một course
SELECT id, title, "order", content
FROM lessons
WHERE "courseId" = '<course-uuid>'
ORDER BY "order";

-- Xem enrollments và tiến độ
SELECT
  id,
  "studentId",
  status,
  progress,
  "enrolledAt",
  "completedAt"
FROM course_enrollments
ORDER BY "enrolledAt" DESC;

-- Xem license tier read model sync từ user-service
SELECT "studentId", "licenseTier", "syncedAt", "updatedAt"
FROM student_license_profiles
ORDER BY "updatedAt" DESC;

-- Đếm số enrollment theo course (kiểm tra capacity)
SELECT "courseId", COUNT(*) AS enrolled_count
FROM course_enrollments
WHERE status != 'DROPPED'
GROUP BY "courseId";
```

---

## 8. Test Security Audit Và Outbox

Mục tiêu: chứng minh các course mutation quan trọng ghi audit event bằng transactional outbox và xuất hiện trong `audit-service`.

### 8.1 Audited actions cần cover

| API | Expected audit action |
| --- | --- |
| `POST /admin/courses` | `COURSE_CREATED` |
| `PATCH /admin/courses/:id` | `COURSE_UPDATED` |
| `PATCH /admin/courses/:id/activate` | `COURSE_ACTIVATED` |
| `DELETE /admin/courses/:id` | `COURSE_ARCHIVED` |
| `POST /admin/courses/:id/lessons` | `COURSE_LESSON_ADDED` |
| `DELETE /admin/courses/:id/lessons/:lessonId` | `COURSE_LESSON_REMOVED` |
| `POST /admin/courses/:id/materials` | `COURSE_MATERIAL_ADDED` |
| `POST /enrollments/:id/reset-progress` | `ENROLLMENT_PROGRESS_RESET` |

### 8.2 Gọi một mutation và lấy correlation id

Ví dụ archive course:

```bash
curl -i -X DELETE http://localhost:8000/admin/courses/<course-id> \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>"
```

Expected:

- HTTP `200`.
- Response header có `x-correlation-id`.
- Course được archive/soft delete theo behavior hiện tại.

### 8.3 Verify outbox trong `course_db`

```sql
SELECT
  payload->>'action' AS action,
  payload->>'resourceType' AS resource_type,
  payload->>'resourceId' AS resource_id,
  status,
  attempts,
  "publishedAt",
  "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Expected:

- Có row `action = COURSE_ARCHIVED`.
- `resource_type = COURSE`.
- `resource_id = <course-id>`.
- Bình thường sau vài giây `status = PUBLISHED`.

### 8.4 Verify centralized audit-service

```bash
curl -s "http://localhost:8000/admin/audit-logs?serviceName=course-service&resourceId=<course-id>" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" | jq .
```

Expected:

- Có item `serviceName = course-service`.
- `action` đúng với API vừa gọi.
- `correlationId` tồn tại để join với access log.
- `metadata` đúng theo action, ví dụ `COURSE_ARCHIVED` có `{ "status": "ARCHIVED" }`.

### 8.5 Verify outbox retry khi RabbitMQ lỗi

```bash
docker compose stop rabbitmq

# Gọi một audited mutation, ví dụ update course title
curl -i -X PATCH http://localhost:8000/admin/courses/<course-id> \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Course updated while RabbitMQ down" }'
```

Expected:

- Business update vẫn thành công nếu request path không cần RabbitMQ trực tiếp.
- `course_db.outbox_messages` có row `PENDING` hoặc sau retry thành `FAILED`.
- `audit_db.audit_logs` chưa có ngay record mới.

Start RabbitMQ lại:

```bash
docker compose start rabbitmq
```

Expected: relay publish lại message còn `PENDING`; audit log xuất hiện trong `audit-service`.

---

## 9. Troubleshooting

### Service không start — PrismaClientConstructorValidationError

```
PrismaClientConstructorValidationError: Invalid value undefined for datasource "db"
```

→ Consul chưa chạy hoặc chưa seed. Chạy:

```bash
pnpm run infra:up
pnpm run consul:seed:local
```

Sau đó restart service.

---

### Database connection error

```
Error: Can't reach database server at localhost:5435
```

→ Chạy:

```bash
pnpm run infra:up
```

---

### Prisma schema chưa migrate

```
PrismaClientInitializationError
```

→ Chạy:

```bash
cd apps/course-service
pnpm run db:generate
pnpm run db:migrate
```

---

### `422 COURSE_HAS_NO_LESSON` khi activate

→ Đúng behavior. Phải thêm ít nhất 1 lesson trước khi activate.

---

### `409 ENROLLMENT_ALREADY_EXISTS`

→ Đúng behavior. Mỗi student chỉ được đăng ký một khóa học một lần. Dùng `studentId` khác hoặc tạo course mới để test lại.

---

### RabbitMQ event không được publish

1. Kiểm tra `rabbitmq.url` trong Consul KV đã được seed
2. Kiểm tra course-service log: `Course Service listening on port 3004` → microservice start OK
3. Vào RabbitMQ UI → tab Connections kiểm tra course-service đã connect

---

### Response format sai (không có `success` field)

→ `DomainExceptionFilter` hoặc `ApiExceptionFilter` chưa register. Kiểm tra `main.ts`:

```typescript
app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
```

---

## Checklist test nhanh (Happy Path)

Chạy từ root để verify toàn bộ flow sau mỗi thay đổi:

```bash
BASE="http://localhost:3004"
INSTRUCTOR="instructor-test-001"
STUDENT="student-test-002"

# 1. Tạo course
COURSE_ID=$(curl -s -X POST $BASE/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: $INSTRUCTOR" \
  -d '{"title":"Test Course","licenseCategory":"B1","capacity":10}' \
  | jq -r '.data.id')
echo "✓ Course created: $COURSE_ID"

# 2. Thêm 2 lessons
curl -s -X POST "$BASE/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson 1","order":1}' > /dev/null
curl -s -X POST "$BASE/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson 2","order":2}' > /dev/null
echo "✓ 2 lessons added"

# 3. Activate
STATUS=$(curl -s -X PATCH "$BASE/courses/$COURSE_ID/activate" | jq -r '.data.status')
echo "✓ Course activated: $STATUS"  # → ACTIVE

# 4. Enroll student
ENROLLMENT_ID=$(curl -s -X POST "$BASE/courses/$COURSE_ID/enroll" \
  -H "x-user-id: $STUDENT" | jq -r '.data.id')
echo "✓ Enrolled: $ENROLLMENT_ID"

# 5. Lấy lesson IDs
L1=$(curl -s "$BASE/courses/$COURSE_ID" | jq -r '.data.lessons[0].id')
L2=$(curl -s "$BASE/courses/$COURSE_ID" | jq -r '.data.lessons[1].id')

# 6. Complete lesson 1
PROGRESS=$(curl -s -X POST "$BASE/enrollments/$ENROLLMENT_ID/lessons/$L1/complete" \
  | jq '.data.progress')
echo "✓ Lesson 1 completed. Progress: $PROGRESS%"  # → 50

# 7. Complete lesson 2 → enrollment COMPLETED
FINAL=$(curl -s -X POST "$BASE/enrollments/$ENROLLMENT_ID/lessons/$L2/complete" \
  | jq '{progress: .data.progress, status: .data.status}')
echo "✓ Lesson 2 completed: $FINAL"  # → {progress:100, status:"COMPLETED"}

echo ""
echo "All checks passed!"
```
## ASR: Reset Progress And Archive Course

### Reset Learning Progress

```http
GET /analytics/instructor/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
```

Admin view of instructor dashboard:

```http
DELETE http://localhost:3004/admin/courses/{courseId}
Authorization: Bearer <admin_token>
```

Expected: course status becomes `ARCHIVED`; normal list endpoints no longer return it unless explicitly filtered.
## SRS UC08-UC10 Alignment Tests

1. Create with unique `courseCode`:
   `POST /admin/courses` with `courseCode=B1-FOUNDATION`; expect response includes `courseCode` and `version=1`.
2. Duplicate `courseCode`:
   repeat the same `courseCode`; expect HTTP 409 `COURSE_CODE_ALREADY_EXISTS`.
3. Optimistic update:
   `PATCH /admin/courses/{id}` with current `version`; expect success and incremented `version`.
4. Version conflict:
   repeat update with stale `version`; expect HTTP 409 `COURSE_VERSION_CONFLICT`.
5. Delete/archive dependency:
   create an active enrollment, then `DELETE /admin/courses/{id}`; expect HTTP 409 `COURSE_HAS_ACTIVE_ENROLLMENTS`.
6. Archive success:
   delete a course without active enrollments; expect `status=ARCHIVED`, `isDeleted=true`, `deletedAt`, and `deletedBy`.



<!-- Merged legacy testing guide -->
# Exam Service - Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test `exam-service` v1 khi chạy local hybrid mode, cả khi gọi trực tiếp port `3003` và khi gọi qua Kong `8000`.

---

## Mục Lục

1. [Khởi động môi trường](#1-khởi-động-môi-trường)
2. [Kiến trúc request flow](#2-kiến-trúc-request-flow)
3. [Biến môi trường test](#3-biến-môi-trường-test)
4. [Lấy access token](#4-lấy-access-token)
5. [Seed dữ liệu phụ thuộc](#5-seed-dữ-liệu-phụ-thuộc)
6. [Test exam template endpoints](#6-test-exam-template-endpoints)
7. [Test student exam session flow](#7-test-student-exam-session-flow)
8. [Negative scenarios](#8-negative-scenarios)
9. [Kiểm tra DB và RabbitMQ](#9-kiểm-tra-db-và-rabbitmq)
10. [Test Security Audit Và Outbox](#10-test-security-audit-và-outbox)
11. [Quality gates](#11-quality-gates)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Khởi Động Môi Trường

### 1.1 Start infrastructure

Từ root project:

```bash
pnpm run infra:up
```

Hybrid infra gồm:

- PostgreSQL databases: `5432..5440`
- RabbitMQ: `5672`, UI `15672`
- Redis: `6379`
- Consul: `8500`
- Keycloak: `8080`
- Kong dev gateway: proxy `8000`, admin `8001`

Kiểm tra nhanh:

```bash
curl -s http://localhost:8500/v1/status/leader
curl -s http://localhost:8001/services | jq '.data | map(.name)'
curl -s http://localhost:15672/api/overview -u guest:guest | jq '.rabbitmq_version'
```

### 1.2 Seed config vào Consul

```bash
pnpm run consul:seed:local
```

Kiểm tra config exam-service:

```bash
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/?recurse" | jq '.[].Key'
```

Cần có các key quan trọng:

```text
config/development-local/exam-service/port
config/development-local/exam-service/database.url
config/development-local/exam-service/rabbitmq.url
config/development-local/exam-service/keycloak.authServerUrl
config/development-local/exam-service/keycloak.realm
config/development-local/exam-service/keycloak.clientId
config/development-local/exam-service/keycloak.clientSecret
config/development-local/exam-service/services.question.baseUrl
config/development-local/exam-service/services.user.baseUrl
```

### 1.3 Generate và migrate database

Chạy migrate cho các service liên quan đến flow:

```bash
pnpm --filter=identity-service run db:generate
pnpm --filter=identity-service run db:migrate

pnpm --filter=user-service run db:generate
pnpm --filter=user-service run db:migrate

pnpm --filter=question-service run db:generate
pnpm --filter=question-service run db:migrate

pnpm --filter=exam-service run prisma:generate
pnpm --filter=exam-service run db:migrate
```

Nếu migration đã tồn tại và chỉ cần apply:

```bash
pnpm --filter=exam-service run db:deploy
```

### 1.4 Start required services

Exam flow cần tối thiểu 4 services:

```bash
pnpm run dev --filter=identity-service
pnpm run dev --filter=user-service
pnpm run dev --filter=question-service
pnpm run dev --filter=exam-service
```

Kiểm tra Swagger:

```bash
curl -s http://localhost:3003/docs-json | jq '.info.title'
curl -s http://localhost:8000/exam-service/docs-json | jq '.info.title'
```

Swagger UI:

- Direct: http://localhost:3003/docs
- Qua Kong: http://localhost:8000/exam-service/docs

---

## 2. Kiến Trúc Request Flow

```text
Client/Postman
  |
  |-- DIRECT --> http://localhost:3003/exams/...
  |              Vẫn cần Authorization header vì exam-service tự validate JWT
  |
  |-- KONG ----> http://localhost:8000/exams/...
                 Kong forward path /exams với strip_path=false
                 exam-service vẫn validate JWT/RBAC bằng nest-keycloak-connect

exam-service
  |-- validates student profile --> user-service GET /users/me
  |                                dùng incoming student bearer token
  |
  |-- fetches question pool -----> question-service POST /admin/questions/pool
                                   dùng service-account token
```

Endpoint path:

| Nhóm | Direct local | Qua Kong |
| --- | --- | --- |
| Templates | `http://localhost:3003/admin/exams/templates` | `http://localhost:8000/admin/exams/templates` |
| Sessions | `http://localhost:3003/exams/sessions` | `http://localhost:8000/exams/sessions` |
| Swagger | `http://localhost:3003/docs` | `http://localhost:8000/exam-service/docs` |

---

## 3. Biến Môi Trường Test

Dùng Git Bash/macOS/Linux style:

```bash
IDENTITY_BASE="http://localhost:8000"
USER_BASE="http://localhost:8000"
QUESTION_BASE="http://localhost:8000"
EXAM_BASE="http://localhost:8000"

ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="Admin@1234"

STUDENT_EMAIL="exam-student-b2@example.com"
STUDENT_PASSWORD="Temp@1234"

LICENSE_CATEGORY="B2"
```

Nếu test trực tiếp service, đổi:

```bash
IDENTITY_BASE="http://localhost:3001"
USER_BASE="http://localhost:3002"
QUESTION_BASE="http://localhost:3005"
EXAM_BASE="http://localhost:3003"
```

Lưu ý direct identity path khác Kong:

| Action | Direct local | Qua Kong |
| --- | --- | --- |
| Login | `POST /login` | `POST /auth/login` |
| Refresh | `POST /refresh` | `POST /auth/refresh` |
| Admin users | `POST /admin/identity-users` | `POST /admin/identity-users` |

Nếu dùng PowerShell, đổi `\` thành backtick `` ` `` hoặc viết trên một dòng.

---

## 4. Lấy Access Token

### 4.1 Login admin

Qua Kong:

```bash
ADMIN_TOKEN=$(curl -s -X POST "$IDENTITY_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }" | jq -r '.data.accessToken')

echo "$ADMIN_TOKEN" | cut -c1-25
```

Direct local:

```bash
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3001/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }" | jq -r '.data.accessToken')
```

Kiểm tra token có role admin:

```bash
curl -s "$IDENTITY_BASE/admin/identity-users?page=1&size=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.success, .data.total'
```

Expect `true` và HTTP `200`.

### 4.2 Tạo student test qua identity-service

`user-service` không expose HTTP `POST /users`. Tạo user bằng identity-service, identity-service sẽ publish RabbitMQ event `identity.user.created`, user-service sẽ tạo profile.

```bash
STUDENT_USER_ID=$(curl -s -X POST "$IDENTITY_BASE/admin/identity-users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"fullName\": \"Exam Student B2\",
    \"role\": \"STUDENT\",
    \"temporaryPassword\": \"$STUDENT_PASSWORD\"
  }" | jq -r '.data.userId')

echo "STUDENT_USER_ID=$STUDENT_USER_ID"
```

Nếu user đã tồn tại, lấy id từ list:

```bash
STUDENT_USER_ID=$(curl -s "$IDENTITY_BASE/admin/identity-users?search=$STUDENT_EMAIL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.items[0].id')
```

Chờ user-service consume event, rồi verify profile:

```bash
sleep 2
curl -s "$USER_BASE/users/$STUDENT_USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | {id,email,role,studentDetail}'
```

Expect:

```json
{
  "id": "...",
  "email": "exam-student-b2@example.com",
  "role": "STUDENT",
  "studentDetail": {
    "licenseTier": null
  }
}
```

### 4.3 Gắn license tier cho student

Exam start sẽ fail nếu `studentDetail.licenseTier` khác template `licenseCategory`.

```bash
curl -s -X PATCH "$USER_BASE/users/$STUDENT_USER_ID/license-tier" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseTier\": \"$LICENSE_CATEGORY\"
  }" -i
```

Expect HTTP `204 No Content`.

Verify:

```bash
curl -s "$USER_BASE/users/$STUDENT_USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.studentDetail'
```

### 4.4 Login student

```bash
STUDENT_TOKEN=$(curl -s -X POST "$IDENTITY_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"password\": \"$STUDENT_PASSWORD\"
  }" | jq -r '.data.accessToken')

echo "$STUDENT_TOKEN" | cut -c1-25
```

Kiểm tra current profile:

```bash
curl -s "$USER_BASE/users/me" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,email,role,studentDetail}'
```

---

## 5. Seed Dữ Liệu Phụ Thuộc

Exam-service cần active question pool từ question-service. Để test nhanh, tạo 3 câu hỏi `B2`, trong đó có 1 câu critical.

### 5.1 Tạo topic

```bash
TOPIC_ID=$(curl -s -X POST "$QUESTION_BASE/admin/questions/topics" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Exam B2 Seed Topic",
    "description": "Topic dùng để test exam-service"
  }' | jq -r '.data.id')

echo "TOPIC_ID=$TOPIC_ID"
```

Nếu topic đã tồn tại, có thể lấy topic đầu tiên:

```bash
TOPIC_ID=$(curl -s "$QUESTION_BASE/admin/questions/topics?page=1&size=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.items[0].id')
```

### 5.2 Tạo question 1

```bash
Q1=$(curl -s -X POST "$QUESTION_BASE/admin/questions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Khi gặp đèn đỏ, người lái xe phải làm gì?\",
    \"type\": \"SINGLE_CHOICE\",
    \"licenseCategories\": [\"$LICENSE_CATEGORY\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Đèn đỏ bắt buộc dừng lại trước vạch dừng.\",
    \"topicId\": \"$TOPIC_ID\",
    \"isCritical\": true,
    \"isActive\": true,
    \"options\": [
      {\"content\": \"Dừng lại trước vạch dừng\", \"isCorrect\": true, \"displayOrder\": 1},
      {\"content\": \"Tăng tốc đi qua\", \"isCorrect\": false, \"displayOrder\": 2},
      {\"content\": \"Bấm còi và tiếp tục đi\", \"isCorrect\": false, \"displayOrder\": 3}
    ]
  }" | jq -r '.data.id')

echo "Q1=$Q1"
```

### 5.3 Tạo question 2

```bash
Q2=$(curl -s -X POST "$QUESTION_BASE/admin/questions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Biển báo hình tròn nền xanh thường thể hiện điều gì?\",
    \"type\": \"SINGLE_CHOICE\",
    \"licenseCategories\": [\"$LICENSE_CATEGORY\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Biển tròn nền xanh thường là biển hiệu lệnh.\",
    \"topicId\": \"$TOPIC_ID\",
    \"isCritical\": false,
    \"isActive\": true,
    \"options\": [
      {\"content\": \"Biển hiệu lệnh\", \"isCorrect\": true, \"displayOrder\": 1},
      {\"content\": \"Biển cấm\", \"isCorrect\": false, \"displayOrder\": 2},
      {\"content\": \"Biển nguy hiểm\", \"isCorrect\": false, \"displayOrder\": 3}
    ]
  }" | jq -r '.data.id')

echo "Q2=$Q2"
```

### 5.4 Tạo question 3

```bash
Q3=$(curl -s -X POST "$QUESTION_BASE/admin/questions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Khoảng cách an toàn phụ thuộc vào yếu tố nào?\",
    \"type\": \"SINGLE_CHOICE\",
    \"licenseCategories\": [\"$LICENSE_CATEGORY\"],
    \"difficulty\": \"MEDIUM\",
    \"explanation\": \"Tốc độ, mặt đường, thời tiết và tình huống giao thông đều ảnh hưởng.\",
    \"topicId\": \"$TOPIC_ID\",
    \"isCritical\": false,
    \"isActive\": true,
    \"options\": [
      {\"content\": \"Tốc độ và điều kiện giao thông\", \"isCorrect\": true, \"displayOrder\": 1},
      {\"content\": \"Màu xe\", \"isCorrect\": false, \"displayOrder\": 2},
      {\"content\": \"Số ghế trên xe\", \"isCorrect\": false, \"displayOrder\": 3}
    ]
  }" | jq -r '.data.id')

echo "Q3=$Q3"
```

### 5.5 Kiểm tra question pool

Endpoint pool là internal/admin endpoint, student không gọi trực tiếp.

```bash
curl -s -X POST "$QUESTION_BASE/admin/questions/pool" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"size\": 3
  }" | jq '.data | {count: (.items | length), first: .items[0].id}'
```

Expect `count >= 3`.

---

## 6. Test Exam Template Endpoints

Tất cả template endpoints cần role `ADMIN`.

### 6.1 POST /admin/exams/templates - tạo template

```bash
TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Đề thi $LICENSE_CATEGORY smoke test\",
    \"description\": \"Smoke test strict topic distribution\",
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"totalQuestions\": 3,
    \"passingScore\": 2,
    \"durationMinutes\": 20,
    \"criticalQuestions\": 1,
    \"maxCriticalMistakes\": 0,
    \"shuffleQuestions\": false,
    \"topicDistribution\": [
      {\"topicId\": \"$TOPIC_ID\", \"questionCount\": 3}
    ]
  }" | jq -r '.data.id')

echo "TEMPLATE_ID=$TEMPLATE_ID"
```

Kiểm tra response đầy đủ:

```bash
curl -s "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data'
```

Expect:

- HTTP `201 Created` khi tạo
- `data.id` là UUID
- `data.licenseCategory = "B2"`
- `data.totalQuestions = 3`
- `data.passingScore = 2`
- `data.durationMinutes = 20`
- `data.criticalQuestions = 1`
- `data.maxCriticalMistakes = 0`
- `data.shuffleQuestions = false`
- `data.topicDistribution[0].questionCount = 3`
- `data.isActive = true`
- `data.isDeleted = false`
- `data.version = 1`
- `data.createdById` bằng admin user id trong token

### 6.2 GET /admin/exams/templates - list/filter

```bash
curl -s "$EXAM_BASE/admin/exams/templates?page=1&size=20&licenseCategory=$LICENSE_CATEGORY&isActive=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | {total,page,size,items: [.items[] | {id,name,version}]}'
```

Expect:

- HTTP `200`
- `data.items` có template vừa tạo
- `page`, `size`, `total` hợp lệ

### 6.3 PATCH /admin/exams/templates/:id - update với version

Lấy version hiện tại:

```bash
TEMPLATE_VERSION=$(curl -s "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.version')

echo "TEMPLATE_VERSION=$TEMPLATE_VERSION"
```

Update:

```bash
curl -s -X PATCH "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $TEMPLATE_VERSION,
    \"name\": \"Đề thi $LICENSE_CATEGORY smoke test updated\",
    \"durationMinutes\": 25,
    \"isActive\": true
  }" | jq '.data | {id,name,durationMinutes,version}'
```

Expect:

- HTTP `200`
- `version` tăng lên 1
- `durationMinutes = 25`

### 6.4 PATCH stale version - expect conflict

Gọi lại version cũ:

```bash
curl -s -X PATCH "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $TEMPLATE_VERSION,
    \"name\": \"Should conflict\"
  }" | jq .
```

Expect:

- HTTP `409`
- `code = "EXAM_TEMPLATE_VERSION_CONFLICT"`

### 6.5 DELETE /admin/exams/templates/:id - soft delete unused template

Chỉ test với template chưa có session. Tạo template tạm:

```bash
DELETE_TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Template delete smoke\",
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"totalQuestions\": 3,
    \"passingScore\": 2,
    \"durationMinutes\": 10,
    \"criticalQuestions\": 1,
    \"maxCriticalMistakes\": 0,
    \"shuffleQuestions\": false,
    \"topicDistribution\": [
      {\"topicId\": \"$TOPIC_ID\", \"questionCount\": 3}
    ]
  }" | jq -r '.data.id')

DELETE_TEMPLATE_VERSION=$(curl -s "$EXAM_BASE/admin/exams/templates/$DELETE_TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.version')
```

Delete:

```bash
curl -s -X DELETE "$EXAM_BASE/admin/exams/templates/$DELETE_TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $DELETE_TEMPLATE_VERSION
  }" | jq '.data | {id,isDeleted,version}'
```

Expect:

- HTTP `200`
- `isDeleted = true`

---

## 7. Test Student Exam Session Flow

Tất cả session endpoints cần role `STUDENT` và owner-scope theo `JWT.sub`.

### 7.1 GET /exams/available - list exams student can start

```bash
curl -s "$EXAM_BASE/exams/available?page=1&size=10" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data'
```

Expect:

- HTTP `200`
- `data.items[]` only includes active templates matching `studentDetail.licenseTier`
- item fields are student-safe: `id`, `name`, `description`, `licenseCategory`, `totalQuestions`, `passingScore`, `durationMinutes`, `criticalQuestions`, `maxCriticalMistakes`, `shuffleQuestions`
- no `createdById`, `isDeleted`, or `version`

### 7.2 POST /exams/sessions - start exam

```bash
SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq -r '.data.id')

echo "SESSION_ID=$SESSION_ID"
```

Inspect bootstrap:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data.items'
```

Expect start response:

- HTTP `201 Created`
- `data.status = "IN_PROGRESS"`
- `data.studentId = STUDENT_USER_ID`
- `data.templateId = TEMPLATE_ID`
- `data.licenseCategory = "B2"`
- `data.score = null`
- `data.isPassed = null`
- `data.failedByCritical = false`
- `data.questions.length = 3`
- mỗi question có `questionId`, `content`, `options`, `displayOrder`, `isBookmarked`, `selectedOptionId`

### 7.3 Confidentiality check cho active questions

Active question payload không được leak đáp án.

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data.items[] | keys'
```

Không được có:

- `correctOptionId`
- `isCritical`
- `isCorrect`
- `explanation`

Kiểm tra options:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data.items[0].options[0] | keys'
```

Expect chỉ có:

```json
[
  "content",
  "displayOrder",
  "id"
]
```

### 7.4 Lấy question/option ids để autosave

```bash
QUESTIONS_JSON=$(curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

QUESTION_1_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[0].questionId')
OPTION_1_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[0].options[0].id')
QUESTION_2_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[1].questionId')
OPTION_2_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[1].options[0].id')
QUESTION_3_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[2].questionId')
OPTION_3_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[2].options[0].id')

echo "$QUESTION_1_ID $OPTION_1_ID"
```

### 7.5 PATCH /exams/sessions/:id/answers - autosave answer

```bash
curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_1_ID\",
    \"selectedOptionId\": \"$OPTION_1_ID\",
    \"isBookmarked\": true
  }" | jq '.data.questions[] | select(.questionId == "'$QUESTION_1_ID'")'
```

Expect:

- HTTP `200`
- question đó có `selectedOptionId = OPTION_1_ID`
- `isBookmarked = true`
- response vẫn không có `isCorrect`
- nếu session đã quá `expiresAt`, API không lưu answer mới; service tự grade timeout và trả về `status = "TIMED_OUT"`

Autosave thêm câu 2 và câu 3:

```bash
curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_2_ID\",
    \"selectedOptionId\": \"$OPTION_2_ID\"
  }" | jq '.data.status'

curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_3_ID\",
    \"selectedOptionId\": \"$OPTION_3_ID\"
  }" | jq '.data.status'
```

### 7.6 Bookmark-only update

```bash
curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_2_ID\",
    \"isBookmarked\": true
  }" | jq '.data.questions[] | select(.questionId == "'$QUESTION_2_ID'") | {selectedOptionId,isBookmarked}'
```

Expect selected answer được giữ nguyên, bookmark đổi thành `true`.

### 7.7 GET /exams/sessions - history khi đang làm bài

```bash
curl -s "$EXAM_BASE/exams/sessions?page=1&size=10&status=IN_PROGRESS" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {total,page,size,items: [.items[] | {id,status,score,isPassed}]}'
```

Expect có session hiện tại, `status = "IN_PROGRESS"`.

### 7.8 POST /exams/sessions/:id/submit - submit và grade

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,status,score,isPassed,failedByCritical,questions}'
```

Expect:

- HTTP `200`
- `status = "COMPLETED"` nếu chưa hết giờ
- `score` là số câu đúng
- `criticalMistakes` là số câu critical sai hoặc bỏ trống
- `isPassed = true` nếu `score >= passingScore` và `criticalMistakes <= maxCriticalMistakes`
- `failedByCritical = true` nếu `criticalMistakes > maxCriticalMistakes`
- result payload được phép có `questions[].isCorrect`
- result payload does not expose `questions[].isCritical`; fatal-question outcome is visible only through `failedByCritical` and `criticalMistakes`

Retry submit with the same session:

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .data | {id,status,score,isPassed,failedByCritical,criticalMistakes}
```

Expect:

- HTTP `200`
- returns the already graded result
- does not grade again, duplicate answers, or publish another event

### 7.9 GET /exams/sessions/:id/result - xem kết quả

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,status,score,isPassed,failedByCritical,questions}'
```

Expect:

- HTTP `200`
- data giống submit result
- `questions[].isCorrect` có giá trị `true/false/null`
- result does not expose `correctOptionId`, `options[].isCorrect`, or `questions[].isCritical`
- nếu session đã quá `expiresAt` nhưng DB vẫn đang `IN_PROGRESS`, endpoint này tự finalize thành `TIMED_OUT` và trả result thay vì báo `EXAM_SESSION_NOT_FINISHED`

### 7.10 GET /exams/sessions - history sau submit

```bash
curl -s "$EXAM_BASE/exams/sessions?page=1&size=10&status=COMPLETED" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data.items[] | {id,status,score,isPassed,failedByCritical}'
```

Expect có session vừa submit.

---

## 8. Negative Scenarios

### 8.1 Student license tier mismatch

Tạo template license khác:

```bash
MISMATCH_TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Đề thi A1 mismatch",
    "licenseCategory": "A1",
    "totalQuestions": 1,
    "passingScore": 1,
    "durationMinutes": 10,
    "criticalQuestions": 0,
    "maxCriticalMistakes": 0,
    "shuffleQuestions": false,
    "topicDistribution": [
      {"topicId": "'$TOPIC_ID'", "questionCount": 1}
    ]
  }' | jq -r '.data.id')

curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$MISMATCH_TEMPLATE_ID\"
  }" | jq .
```

Expect:

- HTTP `403`
- `code = "STUDENT_LICENSE_MISMATCH"`

### 8.2 Insufficient question pool

Tạo template yêu cầu nhiều câu hơn pool:

```bash
BIG_TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Đề thi $LICENSE_CATEGORY insufficient pool\",
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"totalQuestions\": 999,
    \"passingScore\": 900,
    \"durationMinutes\": 20,
    \"criticalQuestions\": 0,
    \"maxCriticalMistakes\": 0,
    \"shuffleQuestions\": false,
    \"topicDistribution\": [
      {\"topicId\": \"$TOPIC_ID\", \"questionCount\": 999}
    ]
  }" | jq -r '.data.id')

curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$BIG_TEMPLATE_ID\"
  }" | jq .
```

Expect:

- HTTP `422`
- `code = "INSUFFICIENT_QUESTION_POOL"`

### 8.3 Get result before submit

Start session mới:

```bash
OPEN_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq -r '.data.id')

curl -s "$EXAM_BASE/exams/sessions/$OPEN_SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expect:

- HTTP `422`
- `code = "EXAM_SESSION_NOT_FINISHED"`

### 8.4 Submit lần 2

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expect:

- HTTP `409`
- `code = "EXAM_SESSION_ALREADY_FINISHED"`

### 8.5 Autosave sau khi submit

```bash
curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_1_ID\",
    \"selectedOptionId\": \"$OPTION_1_ID\"
  }" | jq .
```

Expect:

- HTTP `409`
- `code = "EXAM_SESSION_ALREADY_FINISHED"` hoặc domain conflict từ session state

### 8.6 Session timeout lazy finalization

Mục tiêu: chứng minh session hết giờ được server finalize khi student gọi `result` hoặc `answers`, không cần background cron.

Start một session riêng để test timeout:

```bash
TIMEOUT_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq -r '.data.id')

echo "$TIMEOUT_SESSION_ID"
```

Để demo nhanh, chỉnh `expiresAt` về quá khứ trong DB local:

```bash
docker exec -i luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db \
  -c "update exam_sessions set \"expiresAt\" = now() - interval '1 minute' where id = '$TIMEOUT_SESSION_ID';"
```

Gọi result:

```bash
curl -s "$EXAM_BASE/exams/sessions/$TIMEOUT_SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,finishedAt,expiresAt}'
```

Expect:

- HTTP `200`
- `status = "TIMED_OUT"`
- `finishedAt` khác `null`
- `score`, `isPassed`, `failedByCritical`, `criticalMistakes` đã được tính
- RabbitMQ có `exam.session.completed` và `exam.session.passed` hoặc `exam.session.failed`

Nếu gọi autosave sau khi đã quá hạn, API cũng finalize timeout và không apply answer mới:

```bash
TIMEOUT_AUTOSAVE_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq -r '.data.id')

TIMEOUT_AUTOSAVE_QUESTIONS=$(curl -s "$EXAM_BASE/exams/sessions/$TIMEOUT_AUTOSAVE_SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

TIMEOUT_QUESTION_ID=$(echo "$TIMEOUT_AUTOSAVE_QUESTIONS" | jq -r '.data.items[0].questionId')
TIMEOUT_OPTION_ID=$(echo "$TIMEOUT_AUTOSAVE_QUESTIONS" | jq -r '.data.items[0].options[0].id')

docker exec -i luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db \
  -c "update exam_sessions set \"expiresAt\" = now() - interval '1 minute' where id = '$TIMEOUT_AUTOSAVE_SESSION_ID';"

curl -s -X PATCH "$EXAM_BASE/exams/sessions/$TIMEOUT_AUTOSAVE_SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$TIMEOUT_QUESTION_ID\",
    \"selectedOptionId\": \"$TIMEOUT_OPTION_ID\"
  }" | jq '.data | {id,status,score,finishedAt}'
```

Expect `status = "TIMED_OUT"`.

Nếu session đã được finalize bằng `result` trước đó, autosave tiếp theo có thể trả `EXAM_SESSION_ALREADY_FINISHED`; đó là đúng vì session không còn `IN_PROGRESS`.

### 8.7 Student không được gọi template admin endpoints

```bash
curl -s "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expect:

- HTTP `403`
- `code = "FORBIDDEN"`

### 8.8 Admin không được start student session

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq .
```

Expect:

- HTTP `403`
- `code = "FORBIDDEN"`

### 8.9 Student A không được đọc session của Student B

Tạo student B tương tự mục 4.2, login lấy `STUDENT_B_TOKEN`, sau đó:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_B_TOKEN" | jq .
```

Expect:

- HTTP `403`
- `code = "EXAM_SESSION_UNAUTHORIZED"`

### 8.10 Delete template đã có session

Lấy version template đã có session:

```bash
TEMPLATE_VERSION_NOW=$(curl -s "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.version')

curl -s -X DELETE "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $TEMPLATE_VERSION_NOW
  }" | jq .
```

Expect:

- HTTP `409`
- `code = "EXAM_TEMPLATE_IN_USE"`

### 8.11 Invalid template body

```bash
curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Invalid passing score\",
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"totalQuestions\": 3,
    \"passingScore\": 4,
    \"durationMinutes\": 20,
    \"criticalQuestions\": 1,
    \"maxCriticalMistakes\": 0,
    \"shuffleQuestions\": false,
    \"topicDistribution\": [
      {\"topicId\": \"$TOPIC_ID\", \"questionCount\": 3}
    ]
  }" | jq .
```

Expect:

- HTTP `400`
- `code = "INVALID_EXAM_TEMPLATE"` hoặc `VALIDATION_ERROR`
- domain invariant: `passingScore <= totalQuestions`

---

## 9. Kiểm Tra DB Và RabbitMQ

### 9.1 Kiểm tra DB exam-service

Nếu dùng Docker Postgres local:

```bash
docker exec -it luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db
```

Query:

```sql
select id, name, "licenseCategory", "totalQuestions", "passingScore", "durationMinutes", "criticalQuestions", "maxCriticalMistakes", "shuffleQuestions", "topicDistribution", "isActive", "isDeleted", version
from exam_templates
order by "createdAt" desc
limit 5;

select id, "studentId", "templateId", status, score, "isPassed", "failedByCritical", "criticalMistakes", "maxCriticalMistakes", "startedAt", "finishedAt", "expiresAt"
from exam_sessions
order by "startedAt" desc
limit 5;

select "sessionId", "questionId", "selectedOptionId", "isCorrect", "isBookmarked", "displayOrder"
from exam_session_questions
where "sessionId" = '<SESSION_ID>'
order by "displayOrder";
```

Kiểm tra snapshot security:

- DB có `correctOptionId` để grade.
- Student active endpoints do not expose `correctOptionId` or `questions[].isCritical`.
- Result endpoint chỉ expose `isCorrect`, không expose correct answer id.

### 9.2 Kiểm tra RabbitMQ events

Sau khi submit, exam-service publish:

| Event | Queue target |
| --- | --- |
| `exam.session.completed` | `analytics_service_events` |
| `exam.session.passed` | `notification_service_events` |
| `exam.session.failed` | `notification_service_events` |

RabbitMQ UI:

```text
http://localhost:15672
username: guest
password: guest
```

CLI/API check queue:

```bash
curl -s -u guest:guest http://localhost:15672/api/queues/%2F/analytics_service_events | jq '{name,messages,messages_ready,messages_unacknowledged}'
curl -s -u guest:guest http://localhost:15672/api/queues/%2F/notification_service_events | jq '{name,messages,messages_ready,messages_unacknowledged}'
```

Payload expected:

```json
{
  "sessionId": "session-uuid",
  "studentId": "student-user-id",
  "score": 2,
  "isPassed": true,
  "licenseCategory": "B2"
}
```

Failed event có thêm:

```json
{
  "failedByCritical": true
}
```

---

## 10. Test Security Audit Và Outbox

Mục tiêu: chứng minh admin exam-template mutations được audit bằng transactional outbox. Student exam session/answer flow không nằm trong audit phase 1; chúng đã được lưu như business state trong `exam_db`.

### 10.1 Audited actions cần cover

| API | Expected audit action |
| --- | --- |
| `POST /admin/exams/templates` | `EXAM_TEMPLATE_CREATED` |
| `PATCH /admin/exams/templates/:id` | `EXAM_TEMPLATE_UPDATED` |
| `DELETE /admin/exams/templates/:id` | `EXAM_TEMPLATE_DELETED` |

### 10.2 Create template và verify audit

```bash
curl -i -X POST http://localhost:8000/admin/exams/templates \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Đề thi B1 Audit Demo",
    "description": "Template created to verify audit trail",
    "licenseCategory": "B1",
    "totalQuestions": 1,
    "passingScore": 1,
    "durationMinutes": 20,
    "criticalQuestions": 0,
    "maxCriticalMistakes": 0,
    "shuffleQuestions": true,
    "topicDistribution": [
      {
        "topicId": "10000000-0000-0000-0000-000000000101",
        "questionCount": 1
      }
    ]
  }'
```

Expected:

- HTTP `201`.
- Response header có `x-correlation-id`.
- Response body có `data.id`; lưu lại thành `<template-id>`.

Verify `exam_db.outbox_messages`:

```sql
SELECT payload->>'action' AS action, status, attempts, "publishedAt", "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Expected:

- `action = EXAM_TEMPLATE_CREATED`.
- `resource_type = EXAM_TEMPLATE`.
- `resource_id = <template-id>`.
- Bình thường sau vài giây `status = PUBLISHED`.

### 10.3 Update template và query centralized audit

```bash
curl -i -X PATCH http://localhost:8000/admin/exams/templates/<template-id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Đề thi B1 Audit Demo Updated", "version": 1 }'
```

Query audit-service:

```bash
curl -s "http://localhost:8000/admin/audit-logs?serviceName=exam-service&resourceId=<template-id>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq '.data.items | map({action, resourceId, metadata, correlationId})'
```

Expected:

- Có `EXAM_TEMPLATE_CREATED`.
- Có `EXAM_TEMPLATE_UPDATED`.
- Metadata update có `name` và `version`.

### 10.4 Delete template audit

Chỉ delete được template chưa có session:

```bash
curl -i -X DELETE "http://localhost:8000/admin/exams/templates/<template-id>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "version": 2 }'
```

Expected:

- HTTP `200`.
- Audit action `EXAM_TEMPLATE_DELETED`.
- Nếu template đã có session, API trả `EXAM_TEMPLATE_IN_USE` và không tạo success audit event phase này.

### 10.5 Outbox failure demo

```bash
docker compose stop rabbitmq

curl -i -X PATCH http://localhost:8000/admin/exams/templates/<template-id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "description": "Updated while RabbitMQ is down", "version": 2 }'
```

Expected:

- Business update vẫn commit nếu request path không cần RabbitMQ trực tiếp.
- `exam_db.outbox_messages` có row `PENDING` hoặc `FAILED`.
- Audit-service chưa có record mới ngay.

Start RabbitMQ:

```bash
docker compose start rabbitmq
```

Expected: pending outbox được relay và audit record xuất hiện.

---

## 11. Quality Gates

Chạy hẹp trước:

```bash
pnpm --filter=exam-service run prisma:generate
pnpm --filter=exam-service run check-types
pnpm --filter=exam-service run build
```

Nếu có sửa common/config/Kong:

```bash
pnpm run check-types
docker compose config --quiet
docker compose -f docker-compose.infra.yml config --quiet
```

Test focused nếu có:

```bash
pnpm --filter=exam-service run test
```

---

## 12. Troubleshooting

### 11.1 `401 UNAUTHORIZED`

Nguyên nhân thường gặp:

- Thiếu `Authorization: Bearer <token>`.
- Token hết hạn.
- Direct local vẫn cần JWT vì exam-service tự validate token.
- `keycloak.authServerUrl`, `realm`, `clientId` trong Consul sai.

Kiểm tra:

```bash
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/keycloak.authServerUrl?raw"
curl -s http://localhost:8080/realms/luyen-thi-lai-xe-realm/.well-known/openid-configuration | jq '.issuer'
```

### 11.2 `403 FORBIDDEN`

Kiểm tra role trong token:

- Template endpoints cần `ADMIN`.
- Session endpoints cần `STUDENT`.
- Question seed endpoints cần `ADMIN` hoặc `CENTER_MANAGER`.

Nếu service account gọi question-service pool fail, kiểm tra client `nestjs-backend` có service account role phù hợp để gọi `POST /admin/questions/pool`.

### 11.3 `STUDENT_PROFILE_INVALID`

Exam-service start session gọi `user-service /users/me` bằng bearer token của student. Lỗi này thường do:

- user-service chưa chạy.
- profile chưa được tạo từ event `identity.user.created`.
- student profile không active.
- role không phải `STUDENT`.
- `studentDetail` bị thiếu.

Kiểm tra:

```bash
curl -s "$USER_BASE/users/me" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

### 11.4 `STUDENT_LICENSE_MISMATCH`

License tier trong user profile khác template:

```bash
curl -s "$USER_BASE/users/me" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data.studentDetail.licenseTier'

curl -s "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.licenseCategory'
```

Sửa bằng:

```bash
curl -s -X PATCH "$USER_BASE/users/$STUDENT_USER_ID/license-tier" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseTier\": \"$LICENSE_CATEGORY\"
  }" -i
```

### 11.5 `INSUFFICIENT_QUESTION_POOL`

Question-service không có đủ câu active cho license category:

```bash
curl -s -X POST "$QUESTION_BASE/admin/questions/pool" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"size\": 3
  }" | jq '.data.items | length'
```

Cần đảm bảo:

- `licenseCategories` của question có category template.
- `isActive = true`.
- Question chưa bị soft delete.
- Mỗi question có đúng 1 option `isCorrect = true`.

### 11.6 Kong `502 Bad Gateway`

Kong dev route forward về local host port:

- exam-service: `3003`
- user-service: `3002`
- question-service: `3005`
- identity-service: `3001`

Kiểm tra service local:

```bash
curl -s http://localhost:3003/docs-json | jq '.info.title'
curl -s http://localhost:3002/docs-json | jq '.info.title'
curl -s http://localhost:3005/docs-json | jq '.info.title'
```

Kiểm tra Kong logs:

```bash
docker logs luyen-thi-lai-xe-microservices-kong-dev-1 --tail 100
```

### 11.7 Consul config stale

Nếu vừa sửa `.env` hoặc `docker/consul/init.sh`, reseed:

```bash
docker compose -f docker-compose.infra.yml up -d --force-recreate consul-init
pnpm run consul:seed:local
```

Kiểm tra key:

```bash
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/services.question.baseUrl?raw"
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/services.user.baseUrl?raw"
```

### 11.8 Windows PowerShell note

Các command trong guide dùng Bash syntax. Nếu dùng PowerShell:

- Thay `\` thành backtick `` ` ``.
- Thay `VAR=value` bằng `$env:VAR="value"` hoặc `$VAR="value"` tùy nhu cầu.
- Nếu `curl` bị alias sang `Invoke-WebRequest`, dùng `curl.exe`.
## ASR: Admin History And Missed Questions

### Admin Exam History

```http
GET http://localhost:3003/admin/exams/sessions?studentId=<studentId>&isPassed=false&from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z
Authorization: Bearer <admin_or_instructor_token>
```

Expected: paginated sessions ordered by `startedAt desc`.

### Missed Question Review

```http
GET http://localhost:3003/exams/review/missed-questions?limit=20
Authorization: Bearer <student_token>
```

Expected: response contains question snapshots and options only. It must not contain `correctOptionId`, `isCorrect`, or explanation.

### Template Snapshot

After starting a session, verify `exam_sessions` stores template snapshot columns. Updating the template later must not change existing session grading/history context.
## SRS UC32 Missed Review Tests

1. Empty history:
   `GET /exams/review/missed-questions?limit=20`; expect `items=[]`.
2. Frequent mode:
   after multiple wrong answers for the same question, call `mode=frequent`; expect that question first and `missedCount > 1`.
3. Recent mode:
   call `mode=recent`; expect latest wrong question first.
4. Period filter:
   call `periodDays=1`; expect only recent completed/timed-out sessions to contribute.
5. Safety:
   verify response does not include `correctOptionId`.



<!-- Merged from docs/testing/services-test-guide.md -->
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
pnpm run infra:up
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
pnpm run consul:seed:local
```

Kiểm tra config đã được seed:

```bash
pnpm run consul:list
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
pnpm run dev --filter=identity-service

# Terminal 2 — user-service (để xác nhận event propagation)
pnpm run dev --filter=user-service
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

### 3.4 — Forgot password

Endpoint forgot-password la public. Direct local path la `POST /forgot-password`; qua Kong la `POST /auth/forgot-password`.

```bash
curl -X POST http://localhost:3001/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@gm.uit.edu.vn"
  }'
```

**Ket qua mong doi `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/forgot-password",
  "data": {
    "success": true,
    "message": "If this email exists, password reset instructions have been sent."
  }
}
```

**Kiem tra response khong leak email ton tai hay khong:**

```bash
curl -X POST http://localhost:3001/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-found@example.com"
  }'
```

Van expect `200` va message generic nhu tren.

**Kiem tra qua Kong:**

```bash
curl -X POST http://localhost:8000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@gm.uit.edu.vn"
  }'
```

Sau khi goi API, mo Mailpit de xem email reset:

```text
http://localhost:8025
```

Click link trong email. Link se mo trang reset password cua Keycloak, user nhap mat khau moi tai do, sau do quay lai app/login endpoint de dang nhap bang mat khau moi.

Luu y:

- Local Docker dung Mailpit SMTP `mailpit:1025`.
- Neu realm Keycloak da ton tai tu truoc, file `realm-export.json` moi se khong tu apply lai. Hay chay lai sidecar `keycloak-smtp-config` de apply SMTP config hien tai tu `.env`.
- Neu SMTP chua cau hinh, Keycloak se tra `500 Failed to send execute actions email`.

**Test gui inbox that bang SMTP provider**

Khi chua co private domain, cach it ma sat nhat de test inbox that la Gmail SMTP bang App Password. Gmail SMTP phu hop dev/demo; production nen dung private domain da verify voi transactional provider.

Bat 2-Step Verification tren Google account, tao App Password, roi dat SMTP provider trong root `.env`:

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

Apply SMTP config vao Keycloak realm:

```bash
docker compose up -d --force-recreate keycloak-smtp-config

# Hoac neu dang chay infra-only:
docker compose -f docker-compose.infra.yml up -d --force-recreate keycloak-smtp-config
```

Sau do goi lai `POST /forgot-password` voi email that. Expect API van tra `200` generic, va email reset password se vao inbox that thay vi Mailpit.

Neu email khong toi inbox:

- Kiem tra container `keycloak-smtp-config` exited code `0`.
- Kiem tra Keycloak logs co loi SMTP auth/TLS hay sender/domain chua verify.
- Kiem tra Gmail App Password co dung 16 ky tu va account da bat 2-Step Verification.
- Kiem tra provider yeu cau verify sender domain, SPF/DKIM/DMARC, hoac sandbox recipient.
- Thu lai bang Mailpit default de tach loi forgot-password API khoi loi SMTP provider.

### 3.5 — Logout

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

### 3.6 — Xác nhận access token bị blacklist

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

### 3.7 — Xác nhận refresh token bị revoke (không thể lấy token mới)

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
# Login lại để lấy token mới (sau khi logout ở bước 3.5)
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com","password":"Admin@123"}' \
  | jq -r '.data.accessToken')
```

### 4.1 — Tạo user mới (STUDENT)

```bash
curl -X POST http://localhost:3001/admin/identity-users \
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
  "path": "/admin/identity-users",
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
curl -X POST http://localhost:3001/admin/identity-users \
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
  "path": "/admin/identity-users"
}
```

### 4.3 — Đổi role

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID/role" \
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
  "path": "/admin/identity-users/.../role",
  "data": { "userId": "...", "role": "INSTRUCTOR" }
}
```

### 4.4 — Khoá tài khoản

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID/lock" \
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
  "path": "/admin/identity-users/.../lock",
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
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID/lock" \
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
  "path": "/admin/identity-users/.../lock",
  "data": { "userId": "...", "locked": false }
}
```

### 4.7 — List users

```bash
curl "http://localhost:3001/admin/identity-users" \
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
curl "http://localhost:3001/admin/identity-users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Kết quả mong đợi `200`:** object `IdentityUserResponseDto` với `userId`, `email`, `fullName`, `role`, `isActive`, `isDeleted`, `createdAt`, `updatedAt`.

### 4.9 — Cập nhật user (email + fullName)

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "student1-updated@gm.uit.edu.vn", "fullName": "Nguyễn Văn A (updated)"}'
```

**Kết quả mong đợi `200`:** object với `email` và `fullName` đã được cập nhật.

> Sau bước này, user-service sẽ nhận event `identity.user.updated` và đồng bộ email/fullName trong `UserProfile`.

### 4.10 — Soft delete user

```bash
curl -X DELETE "http://localhost:3001/admin/identity-users/$USER_ID" \
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

curl -X POST http://localhost:3001/admin/identity-users \
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
# Cần ADMIN token; user-service đọc actor từ JWT.sub.
# Gọi trực tiếp user-service (port 3002)
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
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
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Kết quả mong đợi:** `"role": "INSTRUCTOR"`, `"studentDetail": null`

### 5.3 — Kiểm tra event identity.user.updated

Sau bước 4.9 (cập nhật email + fullName):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Kết quả mong đợi:** `"email": "student1-updated@gm.uit.edu.vn"`, `"fullName": "Nguyễn Văn A (updated)"`.

### 5.4 — Kiểm tra event identity.user.locked

Sau bước 4.4 (lock user):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Kết quả mong đợi:** `"isActive": false`.

Sau bước 4.6 (unlock):

**Kết quả mong đợi:** `"isActive": true`.

### 5.5 — Kiểm tra event identity.user.deleted

Sau bước 4.10 (soft delete):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
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
# (Ctrl+C terminal 1, rồi pnpm run dev --filter=identity-service)

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
pnpm run dev --filter=identity-service 2>&1 | head -50
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



<!-- Merged legacy testing guide -->
# Notification Service Test Guide

## Setup

```powershell
docker compose up -d db-notification rabbitmq redis consul consul-init
pnpm --filter=notification-service run db:deploy
pnpm run db:seed
pnpm --filter=notification-service run start:dev
```

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

Redis is required because notification-service uses the Socket.IO Redis adapter. In hybrid dev, Consul should expose `config/development-local/notification-service/redis.url=redis://localhost:6379`.

## Firebase Push Setup

Root `.env` cần có `FCM_CREDENTIALS` là Firebase service-account JSON trên một dòng. Không commit file JSON credential rời vào repo.

Sau khi cập nhật `.env`, seed lại Consul rồi restart notification-service:

```powershell
pnpm run consul:seed:local
pnpm --filter=notification-service run start:dev
```

Nếu `FCM_CREDENTIALS` trống, service vẫn chạy và PUSH sẽ được skip có kiểm soát. In-app/email không bị ảnh hưởng.

## Frontend Device Token Flow

Trên thiết bị thật hoặc emulator có Firebase Messaging:

1. Cấu hình Firebase app:
   - Android: thêm `google-services.json`.
   - iOS: thêm `GoogleService-Info.plist` và cấu hình APNs key/certificate trong Firebase Console.
2. Xin quyền notification từ hệ điều hành.
3. Lấy FCM registration token từ Firebase Messaging SDK.
4. Đăng ký token với backend:

```http
POST http://localhost:3006/notifications/devices
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "token": "<fcm_registration_token>",
  "platform": "android"
}
```

5. Khi Firebase refresh token, gọi lại endpoint trên với token mới.
6. Khi logout hoặc tắt push, URL-encode token rồi hủy đăng ký:

```http
DELETE http://localhost:3006/notifications/devices/<url_encoded_fcm_registration_token>
Authorization: Bearer <student_token>
```

Foreground test: app cần tự hiển thị local notification nếu muốn thấy banner khi đang mở app. Background/quit test: đưa app xuống background, trigger event có kênh PUSH, rồi kiểm tra system tray của thiết bị.

## Send Academic Warning

```http
POST http://localhost:3006/admin/academic-warnings
Authorization: Bearer <admin_or_instructor_token>
Content-Type: application/json

{
  "studentId": "<studentId>",
  "reason": "LOW_EXAM_SCORE",
  "severity": "HIGH",
  "message": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp."
}
```

Expected: response is an in-app notification for the student.

## Realtime In-App Notification Test

Install a temporary Socket.IO client if your frontend is not ready yet:

```powershell
npm install --no-save socket.io-client
```

Create a short local script outside tracked source or run the equivalent in the frontend:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3006/notifications', {
  path: '/notifications/socket.io',
  auth: { token: process.env.STUDENT_TOKEN },
});

socket.on('notification.connected', console.log);
socket.on('notification.created', console.log);
socket.on('notification.unread_count.updated', console.log);
socket.on('notification.auth_failed', console.error);
```

With the socket connected, call `POST /admin/academic-warnings`. Expected realtime events:

- `notification.created` with the new `IN_APP` notification and `unreadCount`.
- `notification.unread_count.updated` with the latest unread count.

Then call `PATCH /notifications/{notificationId}/read`. Expected realtime event:

- `notification.unread_count.updated` with the unread count after marking the notification as read.

## Student Reads Notifications

```http
GET http://localhost:3006/notifications/me?page=1&size=20
Authorization: Bearer <student_token>
```

Then mark read:

```http
PATCH http://localhost:3006/notifications/{notificationId}/read
Authorization: Bearer <student_token>
```
## SRS UC29 Retry Test Scenarios

1. Happy path:
   call `POST /admin/academic-warnings`; expect `persisted=1`, `queued=1`, `pendingRetry=0`, and an in-app notification for the student.
2. Retry path:
   simulate repository/notification creation failure during dispatch; warning remains persisted with `deliveryStatus=PENDING_RETRY`.
3. Retry worker:
   set `nextRetryAt` in the past, wait for `notification.warningRetryIntervalMs`, and verify the worker creates the notification and marks warning `QUEUED`.
4. Failure cap:
   after 3 failed retry attempts, expect `deliveryStatus=FAILED`.



<!-- Merged legacy testing guide -->
# Question Service - Hướng Dẫn Test API Chi Tiết

> Tài liệu này hướng dẫn test API của `question-service` khi gọi trực tiếp local port 3005 và khi gọi qua Kong.

---

## 1. Khởi động môi trường

### 1.1 Start infra

```bash
pnpm run infra:up
pnpm run consul:seed:local
```

Kiểm tra Consul:

```bash
curl http://localhost:8500/v1/status/leader
```

`pnpm run infra:up` dùng `docker-compose.infra.yml` cho hybrid mode, gồm:

- PostgreSQL databases: `5432..5440`
- RabbitMQ: `5672`, UI `15672`
- Redis: `6379`
- Consul: `8500`
- Keycloak: `8080`
- Kong dev gateway: proxy `8000`, admin `8001`
- ELK: Elasticsearch `9200`, Logstash `5044`, Kibana `5601`

Kiểm tra nhanh:

```bash
docker compose -f docker-compose.infra.yml ps
curl -s http://localhost:8001/services | jq '.data | map(.name)'
curl -s http://localhost:9200/_cluster/health | jq .
curl -I http://localhost:5601
```

Nếu chỉ muốn bật riêng ELK:

```bash
docker compose -f docker-compose.infra.yml up -d elasticsearch logstash kibana
```

### 1.2 Generate và migrate database

```bash
cd apps/question-service
pnpm run db:generate
pnpm run db:migrate
```

Nếu migration đã tồn tại:

```bash
cd apps/question-service
pnpm run db:deploy
```

### 1.3 Seed question topics and questions

Seed 6 topic gốc và toàn bộ 600 câu hỏi từ `seed/600-cau-hoi.docx`:

```bash
cd apps/question-service
pnpm run db:seed
```

Hoặc chạy từ root:

```bash
pnpm run db:seed:question
```

Khi nhiều service có seed riêng, chạy toàn bộ seed từ root:

```bash
pnpm run db:seed
```

Seed này idempotent, có thể chạy lại nhiều lần mà không tạo trùng topic/question/option.
Các câu có hình vẫn được seed phần text và đáp án; chạy seed ảnh ở bước kế tiếp để upload Azure và link `imageUrl`/`mediaFileId`.

Seed ảnh nhúng từ DOCX lên Azure Blob Storage và link vào question:

```bash
pnpm run db:seed:question-images
```

Seed ảnh cần config `media-service` trong Consul: `storage.accountName`, `storage.accountKey`, `storage.containerName`, cùng database URL của `question-service` và `media-service`. Frontend nên dùng `mediaFileId` để gọi `GET /media/files/:id/url` lấy presigned URL rồi render ảnh.

Kiểm tra nhanh sau khi start service:

```bash
curl -s "http://localhost:3005/admin/questions/topics?page=1&size=20" | jq '.data | {total, topics: [.items[] | {name, description}]}'
curl -s "http://localhost:3005/admin/questions?page=1&size=1" | jq '.data.total'
curl -s "http://localhost:3005/admin/questions?type=TRAFFIC_SIGN&page=1&size=5" | jq '.data.items[] | {id, imageUrl, mediaFileId}'
```

Expect có 6 topic gốc:

- Quy định chung và quy tắc giao thông đường bộ
- Văn hóa giao thông, đạo đức người lái xe, kỹ năng PCCC và cứu hộ cứu nạn
- Kỹ thuật lái xe
- Cấu tạo và sửa chữa
- Báo hiệu đường bộ
- Giải thế sa hình và kỹ năng xử lý tình huống giao thông

Expect question total là `600`.

### 1.4 Start question-service

```bash
pnpm run dev --filter=question-service
```

Kiểm tra:

```bash
curl http://localhost:3005/docs-json
```

Swagger UI: http://localhost:3005/docs

---

## 2. Request Flow

```
Client
  |-- DIRECT --> http://localhost:3005
  |              Ưu tiên JWT thật; x-user-id chỉ là fallback legacy
  |
  |-- KONG ----> http://localhost:8000/admin/questions
                 Service đọc actor từ JWT.sub
```

Trong local hybrid mode, Kong container `kong-dev` đọc `kong/kong.dev.yaml` và forward `/admin/questions` về `host.docker.internal:3005`. Vì vậy frontend/Postman nên test qua `http://localhost:8000` để giống production path hơn. Các lệnh `x-user-id` trong guide này chỉ còn dùng cho debug legacy; frontend/demo chuẩn gửi `Authorization: Bearer <access_token>`.

Kiểm tra Kong đã nạp route:

```bash
curl -s http://localhost:8001/routes | jq '.data[] | {name, paths}'
curl -s http://localhost:8001/services/question-service | jq .
```

Kiểm tra Swagger qua Kong:

```bash
curl -s http://localhost:8000/question-service/docs-json | jq '.info.title'
```

Kiểm tra API qua Kong:

```bash
curl -s "http://localhost:8000/admin/questions?page=1&size=5" | jq .
```

Nếu gọi qua Kong bị `502`, thử:

```bash
curl -s http://localhost:3005/docs-json | jq '.info.title'
docker logs luyen-thi-lai-xe-microservices-kong-dev-1 --tail 100
```

`502` thường có nghĩa question-service local chưa chạy ở port 3005 hoặc Kong container không reach được `host.docker.internal`.

---

## 3. Biến môi trường test

```bash
BASE="http://localhost:3005"
KONG_BASE="http://localhost:8000"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"
```

---

## 4. Test Topic Endpoints

### 4.1 Tạo topic

```bash
TOPIC_ID=$(curl -s -X POST "$BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Biển báo giao thông",
    "description": "Câu hỏi về biển báo"
  }' | jq -r '.data.id')

echo "TOPIC_ID=$TOPIC_ID"
```

Expect `201 Created`, response có `data.id`.

Qua Kong thì đổi `$BASE` thành `$KONG_BASE`:

```bash
curl -s -X POST "$KONG_BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{"name":"Topic via Kong"}' | jq .
```

### 4.2 List topics

```bash
curl -s "$BASE/admin/questions/topics?page=1&size=20" | jq '.data | {total, page, size}'
```

### 4.3 Get topic detail

```bash
curl -s "$BASE/admin/questions/topics/$TOPIC_ID" | jq .data
```

### 4.4 Update topic

```bash
curl -s -X PATCH "$BASE/admin/questions/topics/$TOPIC_ID" \
  -H "Content-Type: application/json" \
  -d '{"description":"Mô tả mới"}' | jq '.data.description'
```

---

## 5. Test Question Endpoints

### 5.1 Tạo question

```bash
QUESTION_ID=$(curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Khi gặp đèn đỏ, người lái xe phải làm gì?\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Đèn đỏ yêu cầu dừng lại trước vạch dừng.\",
    \"mediaFileId\": null,
    \"isCritical\": false,
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"Dừng lại\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"Đi tiếp\", \"isCorrect\": false, \"displayOrder\": 2 }
    ]
  }" | jq -r '.data.id')

echo "QUESTION_ID=$QUESTION_ID"
```

Tạo question qua Kong:

```bash
curl -s -X POST "$KONG_BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Kong smoke question?\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Smoke via Kong\",
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"A\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"B\", \"isCorrect\": false, \"displayOrder\": 2 }
    ]
  }" | jq .
```

Expect:

```bash
curl -s "$BASE/admin/questions/$QUESTION_ID" | jq '.data | {id, version, isActive, isDeleted, correct: [.options[] | select(.isCorrect == true)]}'
```

### 5.2 Validation: không có đúng 1 đáp án đúng

```bash
curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Invalid question\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Invalid\",
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"A\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"B\", \"isCorrect\": true, \"displayOrder\": 2 }
    ]
  }" | jq .
```

Expect `400 INVALID_QUESTION`.

### 5.3 Search/list questions

```bash
curl -s "$BASE/admin/questions?licenseCategory=B2&type=THEORY&page=1&size=10" \
  | jq '.data | {total, items_count: (.items | length)}'
```

Filter booleans:

```bash
curl -s "$BASE/admin/questions?isActive=true&isCritical=false" | jq '.data.items | map({id, isActive, isCritical})'
```

### 5.4 Get question detail

```bash
curl -s "$BASE/admin/questions/$QUESTION_ID" | jq .data
```

### 5.5 Update question với version đúng

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"difficulty\": \"MEDIUM\",
    \"explanation\": \"Giải thích đã cập nhật\"
  }" | jq '.data | {difficulty, explanation, version}'
```

Expect `version` tăng lên 1.

### 5.6 Version conflict

```bash
curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "content": "Update bằng version cũ"
  }' | jq .
```

Expect `409 QUESTION_VERSION_CONFLICT`.

### 5.7 Deactivate question

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"isActive\": false
  }" | jq '.data | {isActive, version}'
```

Kiểm tra RabbitMQ queue `question_service_publish` có event `question.deactivated`.

### 5.8 Gắn ảnh từ media-service

Upload/initiate file qua media-service trước để lấy `mediaFileId`, sau đó tạo hoặc update question với `mediaFileId`.

```bash
MEDIA_FILE_ID="550e8400-e29b-41d4-a716-446655440001"
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"mediaFileId\": \"$MEDIA_FILE_ID\"
  }" | jq '.data | {mediaFileId, version}'
```

Expect question-service publish event `question.image.linked` vào queue `media_service_events`; media-service consume event và mark FileObject `LINKED`. Question-service chỉ lưu UUID reference, không gọi trực tiếp Azure Blob.

### 5.9 Question pool

Tạo thêm question active nếu question trên đã deactivate, sau đó:

```bash
curl -s -X POST "$BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseCategory": "B2",
    "size": 10,
    "type": "THEORY"
  }' | jq '.data.items | map({id, isActive, isDeleted, options})'
```

Expect chỉ trả về question `isActive=true`, `isDeleted=false`. Pool response có `options[].isCorrect` để exam-service snapshot/grade nội bộ.

Qua Kong:

```bash
curl -s -X POST "$KONG_BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{"licenseCategory":"B2","size":5}' | jq '.data.items | length'
```

### 5.10 Soft delete question

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X DELETE "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{\"version\": $VERSION}" | jq '.data | {isDeleted, isActive, deletedById}'
```

Expect `isDeleted=true`, `isActive=false`.

Mặc định list không trả về question đã xóa:

```bash
curl -s "$BASE/admin/questions" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

Nếu cần debug:

```bash
curl -s "$BASE/admin/questions?includeDeleted=true" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

---

## 6. Test RabbitMQ Events

RabbitMQ UI: http://localhost:15672  
Username/password: `guest` / `guest`

Queues liên quan:

- `question_service_events`: queue consume của question-service
- `question_service_publish`: queue publish domain events

Sau `POST /admin/questions`, kiểm tra `question.created`.

Sau deactivate hoặc delete, kiểm tra `question.deactivated`.

Sau create/update có `mediaFileId`, kiểm tra event `question.image.linked` trong `media_service_events` và FileObject chuyển sang `LINKED`.

---

## 7. Kiểm tra Database

### Prisma Studio

```bash
cd apps/question-service
pnpm run db:studio
```

Mở http://localhost:5555 và xem:

- `QuestionTopic`
- `Question`
- `QuestionOption`

### psql

```bash
psql postgresql://user:password@localhost:5436/question_db
```

```sql
SELECT id, content, type, "licenseCategories", difficulty, "isActive", "isDeleted", version
FROM questions
ORDER BY "createdAt" DESC;

SELECT id, "questionId", content, "isCorrect", "displayOrder"
FROM question_options
ORDER BY "questionId", "displayOrder";
```

---

## 8. Troubleshooting

### Prisma client chưa generate

```bash
cd apps/question-service
pnpm run db:generate
```

### Database chưa sẵn sàng

```bash
pnpm run infra:up
pnpm run consul:seed:local
```

### `QUESTION_TOPIC_NOT_FOUND`

Tạo topic trước khi tạo question, hoặc kiểm tra `topicId`.

### `QUESTION_VERSION_CONFLICT`

Client đang gửi version cũ. Gọi `GET /admin/questions/:id` để lấy version mới nhất rồi retry.

### Pool không có items

Kiểm tra question phải:

- `isActive=true`
- `isDeleted=false`
- có `licenseCategories` chứa license đang query
- khớp `type`, `difficulty`, `topicId` nếu có filter

---

## 9. Checklist Happy Path

```bash
BASE="http://localhost:3005"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"

TOPIC_ID=$(curl -s -X POST "$BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{"name":"Topic smoke"}' | jq -r '.data.id')
echo "Topic: $TOPIC_ID"

QUESTION_ID=$(curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\":\"Smoke question?\",
    \"type\":\"THEORY\",
    \"licenseCategories\":[\"B2\"],
    \"difficulty\":\"EASY\",
    \"explanation\":\"Smoke explanation\",
    \"topicId\":\"$TOPIC_ID\",
    \"options\":[
      {\"content\":\"A\",\"isCorrect\":true,\"displayOrder\":1},
      {\"content\":\"B\",\"isCorrect\":false,\"displayOrder\":2}
    ]
  }" | jq -r '.data.id')
echo "Question: $QUESTION_ID"

curl -s "$BASE/admin/questions?licenseCategory=B2" | jq '.data.total'
curl -s -X POST "$BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{"licenseCategory":"B2","size":5}' | jq '.data.items | length'

VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')
curl -s -X DELETE "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{\"version\": $VERSION}" | jq '.data.isDeleted'
```



<!-- Merged legacy testing guide -->
# Simulation Service Test Guide

## Setup

```powershell
docker compose up -d db-simulation redis consul consul-init
pnpm --filter=simulation-service run db:deploy
pnpm run db:seed
pnpm --filter=simulation-service run start:dev
```

The root seed creates deterministic maneuver/checkpoint/error data. If this guide is run against an empty database without seed data, read APIs return empty arrays by design.

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

## Maneuver Read APIs

```http
GET http://localhost:3008/simulation/maneuvers?licenseCategory=B1
GET http://localhost:3008/simulation/maneuver-errors?licenseCategory=B1
```

Expected: errors endpoint is cacheable. Verify Redis key:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "simulation:maneuver-errors:*"
```

## Session State Machine

```http
POST http://localhost:3008/simulation/sessions
Authorization: Bearer <student_token>
Content-Type: application/json

{ "licenseCategory": "B1" }
```

Save answer while `IN_PROGRESS`, then submit. A later answer save should fail because the backend owns the state transition.
## SRS UC35/UC36 Test Scenarios

1. Start 2D practice:
   `POST /simulation/practice2d/sessions` as `STUDENT` with `licenseCategory` and `clientCapabilities` containing either `canvas` or `webgl`, plus `keyboard` or `touch`.
2. Unsupported client:
   send capabilities without rendering/input support and expect `PRACTICE2D_UNSUPPORTED_CLIENT`.
3. Telemetry feedback:
   send `POST /simulation/practice2d/sessions/{id}/telemetry` with `collision=true`, `speedKmh > 60`, or `laneOffset > 1`; expect feedback severity/penalty and persisted event.
4. Owner mismatch:
   call telemetry/get/end with a different student token; expect forbidden.
5. End session:
   `POST /simulation/practice2d/sessions/{id}/end`; expect summary with `score`, `errorCount`, and `totalPenalty`.



<!-- Merged legacy testing guide -->
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
8. [Test Security Audit Và Outbox](#8-test-security-audit-và-outbox)
9. [Troubleshooting](#9-troubleshooting)

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
pnpm run consul:seed:local
```

Lệnh này đọc `consul-seed-development-local.json` và đẩy config vào Consul KV store.

**Kiểm tra:**

```bash
pnpm run consul:list
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
pnpm run dev --filter=user-service

# Hoặc vào thư mục service
cd apps/user-service
pnpm run start:dev
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
    │                            (Ưu tiên JWT thật; x-user-id chỉ là fallback legacy)
    │
    └─── VIA KONG ────────────→ http://localhost:8000  ←── Kong gateway
                                 (Cần JWT hợp lệ từ Keycloak)
                                 Service đọc actor từ JWT.sub
```

> **Lưu ý:** user-service hiện validate JWT/RBAC tại service và đọc actor từ `@AuthenticatedUser()`. Middleware vẫn có thể map `JWT.sub` sang `x-user-id` để tương thích code cũ, nhưng frontend/demo chuẩn không tự gửi `x-user-id`.

---

## 3. Chuẩn bị — Tạo dữ liệu mẫu trực tiếp

Trước khi test, cần có ít nhất 1 user trong DB. Production flow nên tạo account qua `identity-service` admin API để publish RabbitMQ event `identity.user.created`; user-service cũng expose `POST /admin/users` cho ADMIN/CENTER_MANAGER khi cần backfill profile với Keycloak user id đã có.

Các lệnh `POST http://localhost:3001/admin/identity-users` bên dưới cần thêm header `Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>` khi chạy với guard Keycloak.

### Tạo user ADMIN

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyễn Admin",
    "email": "admin@example.com",
    "role": "ADMIN",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

**Kết quả mong đợi (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
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
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Trần Manager",
    "email": "manager@example.com",
    "role": "CENTER_MANAGER",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

### Tạo user STUDENT (với đầy đủ thông tin)

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Lê Học Viên",
    "email": "student@example.com",
    "role": "STUDENT",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

**Kết quả mong đợi (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
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
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Phạm Giáo Viên",
    "email": "instructor@example.com",
    "role": "INSTRUCTOR",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

---

## 4. Test từng endpoint

> Tất cả các lệnh curl sau đây gọi **trực tiếp** vào user-service (port 3002), không qua Kong. Khi demo chuẩn, dùng `Authorization: Bearer <access_token>`. Các ví dụ còn dùng `x-user-id` là debug legacy cho endpoint/case cũ, không phải contract cho frontend.

---

### 4.1 POST /admin/users — tạo user profile

**Happy path — tạo profile trực tiếp bằng Keycloak user id đã có**

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "keycloak-user-uuid",
    "fullName": "Lê Học Viên",
    "email": "student-profile@example.com",
    "role": "STUDENT",
    "phoneNumber": "0912345678",
    "dateOfBirth": "2000-01-15",
    "gender": "MALE",
    "address": "TP.HCM",
    "licenseTier": "B2",
    "enrolledAt": "2026-01-01"
  }' | jq .
```

Best practice: không dùng endpoint này để tạo account đăng nhập; account vẫn phải được tạo ở identity-service/Keycloak trước.

**Case: Email đã tồn tại (expect 409)**

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Người Khác",
    "email": "admin@example.com",
    "role": "ADMIN",
    "temporaryPassword": "Temp@1234"
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
curl -s -X POST http://localhost:3001/admin/identity-users \
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
  "message": "Validation failed",
  "timestamp": "...",
  "path": "/users",
  "errors": ["email must be an email", "id must be a string"]
}
```

---

### 4.2 GET /admin/users — Danh sách user profile (có phân trang + filter)

**Lấy tất cả users (page 1, size 20):**

```bash
curl -s "http://localhost:3002/users" | jq .
```

**Kết quả mong đợi (200):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
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
curl -s "http://localhost:3002/admin/users?role=STUDENT" | jq .
```

**Lọc theo isActive:**

```bash
curl -s "http://localhost:3002/admin/users?isActive=true" | jq .
```

**Tìm kiếm theo tên/email/SĐT:**

```bash
curl -s "http://localhost:3002/admin/users?search=Học+Viên" | jq .
curl -s "http://localhost:3002/admin/users?search=student@" | jq .
```

**Phân trang:**

```bash
curl -s "http://localhost:3002/admin/users?page=1&size=2" | jq .
curl -s "http://localhost:3002/admin/users?page=2&size=2" | jq .
```

**Kết hợp filter:**

```bash
curl -s "http://localhost:3002/admin/users?role=STUDENT&isActive=true&page=1&size=10" | jq .
```

**Case: size vượt giới hạn (expect 400):**

```bash
curl -s "http://localhost:3002/admin/users?size=200" | jq .
```

---

### 4.3 GET /users/me — Lấy profile của chính mình

> Endpoint này lấy user hiện tại từ `JWT.sub` qua `@AuthenticatedUser()`.

**Happy path:**

```bash
curl -s http://localhost:3002/users/me \
  -H "Authorization: Bearer <STUDENT_TOKEN>" | jq .
```

**Kết quả mong đợi (200):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/me",
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

**Case: token hợp lệ nhưng profile tương ứng chưa tồn tại (expect 404):**

```bash
curl -s http://localhost:3002/users/me \
  -H "Authorization: Bearer <TOKEN_WITHOUT_USER_PROFILE>" | jq .
```

```json
{
  "success": false,
  "code": "USER_PROFILE_NOT_FOUND",
  "message": "User profile not found: non-existent-uuid",
  "timestamp": "...",
  "path": "/users/me"
}
```

---

### 4.4 GET /admin/users/:id — Lấy profile theo ID

**Happy path:**

```bash
curl -s http://localhost:3002/admin/users/admin-uuid-0001 | jq .
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq .
```

**So sánh studentDetail:**

- User ADMIN/INSTRUCTOR: `studentDetail: null`
- User STUDENT: `studentDetail: { licenseTier, enrolledAt, notes }`

**Case: ID không tồn tại (expect 404):**

```bash
curl -s http://localhost:3002/admin/users/does-not-exist | jq .
```

---

### 4.5 PATCH /users/me — Cập nhật profile bản thân

> User được xác định bằng `JWT.sub`.

**Cập nhật một số field:**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
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
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/users/me",
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

### 4.6 PATCH /admin/users/:id — Cập nhật profile bất kỳ (admin)

```bash
curl -s -X PATCH http://localhost:3002/admin/users/instructor-uuid-0004 \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Phạm Giáo Viên (Admin Updated)",
    "address": "789 Đường Admin"
  }' | jq .
```

---

### 4.7 PATCH /admin/users/:id/lock — Khóa / mở khóa user

**Khóa user (isActive → false):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": true }'
# Kết quả mong đợi: HTTP 204 (không có body)
```

**Xác nhận user đã bị khóa:**

```bash
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data.isActive'
# Kết quả mong đợi: false
```

**Kiểm tra user không xuất hiện khi lọc isActive=true:**

```bash
curl -s "http://localhost:3002/admin/users?isActive=true" | jq '.data.items | map(.id)'
# student-uuid-0003 không có trong danh sách
```

**Mở khóa user (isActive → true):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": false }'
# Kết quả mong đợi: HTTP 204
```

**Xác nhận:**

```bash
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data.isActive'
# Kết quả mong đợi: true
```

**Case: ID không tồn tại (expect 404):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/fake-uuid/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": true }' | jq .
```

**Case: Body không hợp lệ — thiếu field `lock` (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

### 4.8 PATCH /admin/users/:id/license-tier — Gán hạng bằng lái

> Endpoint này lấy `changedById` từ `JWT.sub` của ADMIN/CENTER_MANAGER để ghi audit.

**Gán hạng B2 cho student:**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -d '{ "licenseTier": "B2" }' | jq '.data.studentDetail.licenseTier'
# Kết quả mong đợi: "B2"
```

**Xác nhận license tier đã được gán:**

```bash
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data.studentDetail'
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
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: manager-uuid-0002" \
  -d '{ "licenseTier": "C" }'
```

**Kiểm tra audit trail trong DB (xem phần 7).**

**Case: Gán cho user KHÔNG phải STUDENT (expect 422):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/admin-uuid-0001/license-tier \
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
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/license-tier \
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
- `course_service_events` — nhận event `user.student.license-assigned` từ user-service để course-service sync license tier read model

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
curl -s http://localhost:3002/admin/users/rabbitmq-user-uuid-0005 | jq .
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
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data | {role, studentDetail}'
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
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data | {role, studentDetail}'
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

> Frontend chỉ gửi `Authorization`. Service tự validate token và lấy actor từ `JWT.sub`.

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

## 8. Test Security Audit Và Outbox

Mục tiêu: chứng minh `PATCH /admin/users/:id/license-tier` vừa update profile thành công, vừa tạo centralized audit trail qua transactional outbox.

### 8.1 Gọi audited action

```bash
curl -i -X PATCH http://localhost:8000/admin/users/<student-id>/license-tier \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "licenseTier": "B1" }'
```

Expected:

- HTTP `200`.
- Response header có `x-correlation-id`.
- Response body có `data.studentDetail.licenseTier = "B1"`.

### 8.2 Verify local bounded-context audit

```sql
SELECT "studentId", "oldLicenseTier", "newLicenseTier", "changedById", "changedAt"
FROM license_assignment_audits
WHERE "studentId" = '<student-id>'
ORDER BY "changedAt" DESC
LIMIT 5;
```

Expected: có row với `newLicenseTier = B1`.

### 8.3 Verify transactional outbox

```sql
SELECT
  payload->>'action' AS action,
  payload->>'resourceId' AS resource_id,
  status,
  attempts,
  "publishedAt",
  "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 5;
```

Expected:

- `action = USER_LICENSE_ASSIGNED`.
- `resource_id = <student-id>`.
- Bình thường sau vài giây `status = PUBLISHED`.
- Nếu RabbitMQ đang down, row vẫn còn `PENDING` hoặc `FAILED`, không mất.

### 8.4 Verify centralized audit-service

```bash
curl -s "http://localhost:8000/admin/audit-logs?action=USER_LICENSE_ASSIGNED&resourceId=<student-id>" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" | jq .
```

Expected:

- `data.total >= 1`.
- Item mới nhất có:
  - `serviceName = user-service`
  - `resourceType = USER_PROFILE`
  - `resourceId = <student-id>`
  - `metadata.newLicenseTier = B1`
  - `correlationId` khớp response header nếu copy lại lúc gọi API.

---

## 9. Troubleshooting

### Service không start được

```
Error: Failed to connect to Consul
```

→ Chạy `docker-compose up -d consul consul-init` và seed lại: `pnpm run consul:seed:local`

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

# 3. Lấy profile /me - cần token có sub = test-001 nếu guard đang bật
curl -s $BASE/users/me -H "Authorization: Bearer <STUDENT_TOKEN>" | jq '.data.email'

# 4. Update profile
curl -s -X PATCH $BASE/users/me -H "Content-Type: application/json" -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -d '{"address":"123 Test St"}' | jq '.data.address'  # → "123 Test St"

# 5. Gán license tier
curl -s -X PATCH $BASE/admin/users/test-001/license-tier \
  -H "Content-Type: application/json" -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -d '{"licenseTier":"B2"}' | jq '.data.studentDetail.licenseTier'  # → "B2"

# 6. Verify license tier
curl -s $BASE/users/test-001 | jq '.data.studentDetail.licenseTier'  # → "B2"

# 7. Lock user
curl -s -X PATCH $BASE/users/test-001/lock -H "Content-Type: application/json" \
  -d '{"lock":true}' -o /dev/null -w "%{http_code}"  # → 204

# 8. Verify locked
curl -s $BASE/users/test-001 | jq '.data.isActive'  # → false

echo "All checks passed!"
```



<!-- Merged legacy testing guide -->
# UC33: Logout - Implementation & Testing Guide

## Overview

UC33 Logout đã được triển khai tại `identity-service` với các thành phần:

- Endpoint: `POST /logout`
- Yêu cầu: JWT access token (Authorization header) + refresh token (request body)
- Response: Thông báo logout thành công với hướng dẫn xóa token
- Backend: Revoke session trên Keycloak + Redis blacklist theo `jti`/token TTL

## Architecture

```
Client → POST /logout
           Authorization: Bearer <access_token>
           Body: { "refreshToken": "<refresh_token>" }
           ↓
         Kong Gateway (truyền token qua)
           ↓
         identity-service: AuthController.logout()
           ↓
         AppService.logout(token, refreshToken)
           • Decode JWT → lấy exp claim
           • Revoke session trên Keycloak (dùng refreshToken)
           • Thêm access token vào blacklist với TTL
           ↓
         TokenBlacklistService
           • Lưu key `bl:<jti>` vào Redis
           • TTL theo `exp` của access token
           ↓
         LogoutResponseDto (MSG130)
           ↓
         Client: Xóa token từ LocalStorage/Cookie
```

## Files Changed

### Core Implementation

- `apps/identity-service/src/presentation/dtos/logout.response.dto.ts` — Response DTO
- `apps/identity-service/src/presentation/dtos/logout.request.dto.ts` — Request DTO
- `apps/identity-service/src/infrastructure/token-blacklist/token-blacklist.service.ts` — Blacklist service
- `apps/identity-service/src/app.service.ts` — Logout business logic + JWT decode
- `apps/identity-service/src/presentation/http/auth.controller.ts` — Logout endpoint
- `apps/identity-service/src/app.module.ts` — DI wiring

### Infrastructure

- `docker-compose.infra.yml` — Thêm Redis service
- `docker-compose.yaml` — Thêm Redis service
- `consul-seed-development-local.json` — Thêm redis.url config
- `consul-seed-development.json` — Thêm redis.url config

## Behavior

### Success Case: 200 OK

```http
POST /logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/logout",
  "data": {
    "success": true,
    "message": "You have been logged out successfully. (MSG130)",
    "instruction": "Please delete your token from LocalStorage or Cookie"
  }
}
```

### Error Cases

#### 1. Token Missing (401)

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "timestamp": "...",
  "path": "/logout"
}
```

#### 2. Token Invalid/Malformed (401)

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "timestamp": "...",
  "path": "/logout"
}
```

#### 3. Token Expired (401)

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "timestamp": "...",
  "path": "/logout"
}
```

## Manual Testing Steps

### 1. Khởi động Infrastructure

```bash
# Terminal 1: Khởi động infra (PostgreSQL, RabbitMQ, Consul, Keycloak, Redis)
pnpm run infra:up

# Chờ khoảng 30 giây để tất cả services healthy
```

### 2. Khởi động Services

```bash
# Terminal 2: Khởi động identity-service local
pnpm run dev --filter=identity-service
```

### 3. Test Login

```bash
# Lấy access token từ Keycloak
curl -X POST http://localhost:8080/realms/luyen-thi-lai-xe-realm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=nestjs-backend" \
  -d "client_secret=${KEYCLOAK_CLIENT_SECRET}" \
  -d "grant_type=password" \
  -d "username=demo" \
  -d "password=demo"

# Hoặc qua identity-service login endpoint
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo"}'

# Lưu lại accessToken và refreshToken từ response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Test Logout — Success Case

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# Expected response: 200 OK
# {
#   "success": true,
#   "code": "SUCCESS",
#   "message": "OK",
#   "timestamp": "...",
#   "path": "/logout",
#   "data": {
#     "success": true,
#     "message": "You have been logged out successfully. (MSG130)",
#     "instruction": "Please delete your token from LocalStorage or Cookie"
#   }
# }
```

### 5. Test Logout — Missing Token

```bash
curl -X POST http://localhost:3001/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "any-value"}'
# Expected: 401 Unauthorized
```

### 6. Test Logout — Invalid Token

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "any-value"}'
# Expected: 401 Unauthorized
```

### 7. Test Blacklist Enforcement (After Logout)

```bash
# Logout thành công → Token vào blacklist
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# Lúc này, token vẫn hợp lệ về cấu trúc, nhưng đã bị blacklist
# Khi gọi protected API của identity-service, TokenBlacklistGuard check Redis
# Expected: 401 Token has been revoked
```

## Integration Points

### Current enforcement

Hiện tại blacklist được enforce ở service layer của `identity-service` bằng global `TokenBlacklistGuard` và Redis. Kong vẫn validate/route request nhưng không tự check Redis blacklist.

1. `POST /logout` decode access token, lấy `exp`, revoke refresh token/session trên Keycloak.
2. `TokenBlacklistService` lưu key `bl:<jti>` vào Redis với TTL đến khi access token hết hạn.
3. Protected API trong `identity-service` reject token đã logout bằng `401`.

### Gateway/backlog note

Nếu muốn chặn token đã logout trước khi request tới mọi service, cần thêm blacklist guard/plugin dùng chung ở API gateway hoặc shared guard trong từng service. Đây là hardening mở rộng, không giả định frontend phải gửi header nào khác ngoài `Authorization`.

### Redis Integration

Hiện tại: `TokenBlacklistService` dùng `ioredis` client được inject từ `identity-service` app module.

**Cấu hình**:

```typescript
// In AppModule
RedisModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    url: configService.get<string>('redis.url'),
  }),
})
```

## SRS Reference

**UC33: Logout**

| BR | Mô tả | Status |
| -- | -- | -- |
| BR01 | JWT Validation: Extract từ header, validate | ✅ Implemented |
| BR02 | Token Blacklisting: Add to blacklist với TTL | ✅ Implemented (in-memory) |
| BR03 | Client-Side Cleanup: Return instruction | ✅ Implemented |
| BR04 | Post-Logout Verification: Check blacklist O(1) | 🟡 In-memory only |
| BR05 | Success Response: Return MSG130 | ✅ Implemented |

| Message | Use Case | Status |
| -- | -- | -- |
| MSG129 | Token missing/invalid | ✅ Implemented |
| MSG130 | Logout success | ✅ Implemented |

## Next Steps

1. **Integrate Redis** (optional, for production)
   - Update TokenBlacklistService to use ioredis
   - Add Redis module to AppModule
   - Verify TTL enforcement

2. **Integrate Kong** (optional, for enforce blacklist at gateway level)
   - Add Kong Redis plugin config
   - Test post-logout requests are blocked

3. **Add Unit Tests**
   - Test JWT decode
   - Test token validation
   - Test blacklist add/check
   - Test error cases

4. **Add E2E Tests**
   - Full flow: Login → Logout → Try to use old token

5. **Add Monitoring**
   - Log logout events
   - Monitor blacklist size
   - Alert if blacklist grows unexpectedly

## Swagger Documentation

Endpoint tự động được documented ở:

- Swagger UI: `http://localhost:3001/swagger`
- Endpoint: `POST /logout`
- Auth: JWT Bearer token trong Authorization header + refreshToken trong body

## Troubleshooting

### Token TTL not working

- Check system clock is synchronized
- Verify `exp` claim is present in JWT
- Check TTL calculation: `exp - now` should be positive

### Blacklist not persisting across restarts

- Current: In-memory only (by design, services restart often)
- Fix: Migrate to Redis for persistence

### CORS issues with logout

- Ensure Kong/Gateway allows POST requests to /logout
- Check CORS headers in response
- Verify client sends Authorization header correctly

## References

- SRS UC33: docs/requirements/srs-document.md (lines 1050-1082)
- DDD Conventions: docs/architecture/clean-ddd-conventions.md
- CLAUDE.md: Architecture overview