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
npm.cmd run infra:up
npm.cmd run consul:seed:local
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run dev
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
npm.cmd run docker:migrate
npm.cmd run db:seed
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

```powershell
curl -i "http://localhost:8000/admin/audit-logs" `
  -H "Authorization: Bearer $TOKEN_STUDENT"
```

Expected:

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
UPDATE outbox_messages
SET status = 'PENDING', "nextAttemptAt" = now(), "lastError" = null
WHERE status = 'FAILED';
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
npm.cmd run smoke

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
