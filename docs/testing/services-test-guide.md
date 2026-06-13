<!-- Merged legacy testing guide -->

# Analytics Service Test Guide

## Setup

```powershell
docker compose up -d db-analytics redis rabbitmq consul consul-init
pnpm --filter=analytics-service run db:deploy
pnpm run db:seed
pnpm --filter=analytics-service run start:dev
```

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

## Demo Flow

1. Complete an exam in `exam-service`.
2. Complete a course lesson in `course-service`.
3. Call:

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

Guide nÃ y dÃ¹ng Ä‘á»ƒ test vÃ  demo Security tactic: **Access Logging + Centralized Audit Trail + Transactional Outbox**.

Má»¥c tiÃªu demo:

1. Má»i HTTP request cÃ³ access log vÃ  `x-correlation-id`.
2. Mutation nháº¡y cáº£m táº¡o audit event qua transactional outbox.
3. `audit-service` lÆ°u audit trail táº­p trung, append-only, idempotent.
4. Khi RabbitMQ lá»—i, business action váº«n commit vÃ  audit event khÃ´ng máº¥t.

---

## 1. Scope ÄÃ£ Triá»ƒn Khai

| Capability                  | Service/File liÃªn quan                          | CÃ¡ch verify                                                           |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Correlation id + access log | `@repo/common`, má»i service                     | Response cÃ³ `x-correlation-id`; log cÃ³ `logType=access`.             |
| Audit producer outbox       | `user-service`, `course-service`, `exam-service` | Check `outbox_messages` trong DB producer.                             |
| Audit consumer              | `audit-service`                                  | Query `audit_db.audit_logs` hoáº·c `GET /admin/audit-logs`.            |
| Idempotent audit record     | `audit-service`                                  | Publish cÃ¹ng `eventId` 2 láº§n, chá»‰ cÃ³ 1 row.                      |
| Outbox retry                | Producer relay services                          | Stop RabbitMQ, gá»i mutation, start láº¡i RabbitMQ, event publish sau. |

Audited actions phase hiá»‡n táº¡i:

| Service          | Action                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user-service`   | `USER_LICENSE_ASSIGNED`                                                                                                                                                         |
| `course-service` | `COURSE_CREATED`, `COURSE_UPDATED`, `COURSE_ARCHIVED`, `COURSE_ACTIVATED`, `COURSE_LESSON_ADDED`, `COURSE_LESSON_REMOVED`, `COURSE_MATERIAL_ADDED`, `ENROLLMENT_PROGRESS_RESET` |
| `exam-service`   | `EXAM_TEMPLATE_CREATED`, `EXAM_TEMPLATE_UPDATED`, `EXAM_TEMPLATE_DELETED`                                                                                                       |

---

## 2. Setup

### 2.1 Hybrid dev mode

```powershell
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:deploy
pnpm run dev
```

Sau khi service start, kiá»ƒm tra health:

```powershell
curl http://localhost:3011/health/ready
curl http://localhost:3002/health/ready
curl http://localhost:3004/health/ready
curl http://localhost:3003/health/ready
```

Expected: táº¥t cáº£ tráº£ `200`.

### 2.2 Full Docker mode

```powershell
docker compose up -d --build
pnpm run docker:migrate
pnpm run db:seed
```

Kiá»ƒm tra container:

```powershell
docker compose ps audit-service user-service course-service exam-service rabbitmq elasticsearch logstash kibana
```

Expected:

- `audit-service`, `user-service`, `course-service`, `exam-service`: `healthy`.
- `rabbitmq`: running.
- `elasticsearch`: healthy.
- `logstash`, `kibana`: running.

---

## 3. Chuáº©n Bá»‹ Token Demo

Demo chuáº©n Ä‘i qua Kong vÃ  dÃ¹ng JWT tháº­t:

```powershell
$TOKEN_ADMIN = "<admin_access_token>"
$TOKEN_STUDENT = "<student_access_token>"
```

Náº¿u dÃ¹ng seed demo, login báº±ng identity-service hoáº·c Keycloak token endpoint theo guide identity. Frontend/client khÃ´ng tá»± gá»­i `x-user-id`; actor láº¥y tá»« `Authorization: Bearer ...`.

DB connection nhanh tá»« mÃ¡y host, khÃ´ng cáº§n `docker compose exec`:

```powershell
psql "postgresql://user:password@localhost:5433/user_db"
psql "postgresql://user:password@localhost:5435/course_db"
psql "postgresql://user:password@localhost:5434/exam_db"
psql "postgresql://user:password@localhost:5441/audit_db"
```

---

## 4. Test Access Logging

### 4.1 Gá»i request thÃ nh cÃ´ng

```powershell
curl -i http://localhost:8000/user-service/health/ready
```

Expected:

- HTTP `200`.
- Response header cÃ³ `x-correlation-id`.
- Service log cÃ³ access log metadata:
  - `correlationId`
  - `serviceName`
  - `method`
  - `path`
  - `statusCode`
  - `latencyMs`
  - `actorId` náº¿u request cÃ³ JWT
  - `ipAddress`
  - `userAgent`

### 4.2 Gá»i request lá»—i

```powershell
curl -i http://localhost:8000/admin/audit-logs `
  -H "Authorization: Bearer invalid-token"
```

Expected:

- HTTP `401` hoáº·c `403`.
- Váº«n cÃ³ `x-correlation-id`.
- Access log váº«n ghi request lá»—i.
- Log khÃ´ng chá»©a raw token hoáº·c Authorization header.

### 4.3 Verify trong ELK

Kibana: http://localhost:5601

Search theo correlation id:

```text
correlationId : "<x-correlation-id>"
```

Hoáº·c query Elasticsearch trá»±c tiáº¿p:

```powershell
curl "http://localhost:9200/microservices-logs-*/_search?q=correlationId:<x-correlation-id>"
```

Expected:

- CÃ³ document access log.
- KhÃ´ng cÃ³ field/password/token/Authorization/clientSecret/storage key dáº¡ng plaintext.

---

## 5. Test Audit API

### 5.1 Role guard

Student khÃ´ng Ä‘Æ°á»£c xem audit logs:

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

Admin xem Ä‘Æ°á»£c:

```powershell
curl -s "http://localhost:8000/admin/audit-logs?page=1&size=20" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
```

Expected:

- HTTP `200`.
- `data.items` lÃ  array.
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

### 6.1 Gá»i audited action

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

- CÃ³ row `eventName = security.audit.recorded`.
- `action = USER_LICENSE_ASSIGNED`.
- BÃ¬nh thÆ°á»ng sau vÃ i giÃ¢y `status = PUBLISHED`.
- `publishedAt` khÃ¡c null.

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

### 6.4 Verify audit DB trá»±c tiáº¿p

```powershell
docker compose exec db-audit psql -U user -d audit_db -c "SELECT \"serviceName\", action, \"resourceType\", \"resourceId\", outcome, metadata FROM audit_logs WHERE action = 'USER_LICENSE_ASSIGNED' ORDER BY \"occurredAt\" DESC LIMIT 5;"
```

Expected: cÃ³ row tÆ°Æ¡ng á»©ng.

---

## 7. Demo Course-Service Audit

### 7.1 Create course

```powershell
curl -i -X POST "http://localhost:8000/admin/courses" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{
    \"title\": \"KhÃ³a há»c B1 Audit Demo\",
    \"licenseCategory\": \"B1\",
    \"description\": \"Course created to verify audit trail\",
    \"duration\": \"3 thÃ¡ng\",
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

LÆ°u `data.id` thÃ nh `$COURSE_ID`.

Expected audit:

```powershell
curl -s "http://localhost:8000/admin/audit-logs?action=COURSE_CREATED&resourceId=$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.items[0]'
```

Expected fields:

- `serviceName = course-service`
- `resourceType = COURSE`
- `metadata.title = "KhÃ³a há»c B1 Audit Demo"`
- `metadata.licenseCategory = "B1"`

### 7.2 Add lesson

```powershell
curl -i -X POST "http://localhost:8000/admin/courses/$COURSE_ID/lessons" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{ \"title\": \"BÃ i 1\", \"content\": \"Ná»™i dung\", \"order\": 1 }"
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
    \"name\": \"Äá» thi B1 Audit Demo\",
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

LÆ°u `data.id` thÃ nh `$TEMPLATE_ID`.

Expected audit action: `EXAM_TEMPLATE_CREATED`.

### 8.2 Update exam template

```powershell
curl -i -X PATCH "http://localhost:8000/admin/exams/templates/$TEMPLATE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" `
  -H "Content-Type: application/json" `
  -d "{ \"name\": \"Äá» thi B1 Audit Demo Updated\", \"version\": 1 }"
```

Expected audit action: `EXAM_TEMPLATE_UPDATED`.

### 8.3 Query audit log

```powershell
curl -s "http://localhost:8000/admin/audit-logs?serviceName=exam-service&resourceId=$TEMPLATE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.items | map({action, resourceId, metadata})'
```

Expected: tháº¥y `EXAM_TEMPLATE_CREATED` vÃ  `EXAM_TEMPLATE_UPDATED`.

---

## 9. Test Transactional Outbox Retry

Má»¥c tiÃªu: chá»©ng minh RabbitMQ lá»—i khÃ´ng lÃ m máº¥t audit event vÃ  khÃ´ng rollback business action Ä‘Ã£ thÃ nh cÃ´ng.

### 9.1 Stop RabbitMQ

```powershell
docker compose stop rabbitmq
```

### 9.2 Gá»i audited action

VÃ­ dá»¥ archive má»™t course:

```powershell
curl -i -X DELETE "http://localhost:8000/admin/courses/$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

Expected:

- Náº¿u HTTP service váº«n Ä‘ang cháº¡y vÃ  khÃ´ng cáº§n RabbitMQ cho request path nÃ y, business response váº«n success.
- Course Ä‘Ã£ Ä‘á»•i tráº¡ng thÃ¡i/archive trong `course_db`.
- Audit event náº±m trong `course_db.outbox_messages`.
- Audit log chÆ°a xuáº¥t hiá»‡n ngay trong `audit_db.audit_logs`.

### 9.3 Check pending/failed outbox

```powershell
docker compose exec db-course psql -U user -d course_db -c "SELECT id, \"eventName\", status, attempts, \"nextAttemptAt\", \"lastError\", payload->>'action' AS action FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 10;"
```

Expected:

- `status = PENDING` trong cÃ¡c láº§n retry Ä‘áº§u.
- Sau nhiá»u láº§n fail cÃ³ thá»ƒ thÃ nh `FAILED` khi `attempts >= 10`.
- `lastError` cÃ³ lá»—i connection RabbitMQ.

### 9.4 Start RabbitMQ láº¡i

```powershell
docker compose start rabbitmq
```

Chá» khoáº£ng 5-10 giÃ¢y rá»“i kiá»ƒm tra:

```powershell
docker compose exec db-course psql -U user -d course_db -c "SELECT status, attempts, \"publishedAt\", \"lastError\", payload->>'action' AS action FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 10;"
```

Expected:

- Message quay vá» `PUBLISHED` náº¿u váº«n Ä‘ang `PENDING` vÃ  relay publish thÃ nh cÃ´ng.
- Náº¿u message Ä‘Ã£ thÃ nh `FAILED`, phase hiá»‡n táº¡i chÆ°a cÃ³ manual requeue API; cÃ³ thá»ƒ update DB thá»§ cÃ´ng trong demo dev Ä‘á»ƒ retry:

```sql
UPDATE outbox_messages
SET status = 'PENDING', "nextAttemptAt" = now(), "lastError" = null
WHERE status = 'FAILED';
```

Sau Ä‘Ã³ audit log xuáº¥t hiá»‡n:

```powershell
curl -s "http://localhost:8000/admin/audit-logs?action=COURSE_ARCHIVED&resourceId=$COURSE_ID" `
  -H "Authorization: Bearer $TOKEN_ADMIN" | jq '.data.total'
```

---

## 10. Test Idempotency

Má»¥c tiÃªu: cÃ¹ng `eventId` chá»‰ táº¡o 1 audit row.

### 10.1 Láº¥y má»™t `eventId` Ä‘Ã£ publish

```powershell
docker compose exec db-user psql -U user -d user_db -c "SELECT payload->>'eventId' AS event_id, payload->>'action' AS action, status FROM outbox_messages WHERE \"eventName\" = 'security.audit.recorded' ORDER BY \"createdAt\" DESC LIMIT 1;"
```

Copy `event_id`.

### 10.2 Táº¡o duplicate outbox message cÃ¹ng payload

Thay `<new-outbox-id>` báº±ng má»™t UUID má»›i báº¥t ká»³ vÃ  `<event-id>` báº±ng giÃ¡ trá»‹ vá»«a copy. CÃ¡ch nÃ y buá»™c producer relay publish láº¡i cÃ¹ng audit `eventId`, Ä‘Ãºng vá»›i path tháº­t cá»§a há»‡ thá»‘ng hÆ¡n lÃ  publish raw message thá»§ cÃ´ng qua RabbitMQ UI.

```powershell
docker compose exec db-user psql -U user -d user_db -c "INSERT INTO outbox_messages (id, \"eventName\", payload, status, attempts, \"nextAttemptAt\", \"createdAt\", \"updatedAt\") SELECT '<new-outbox-id>', \"eventName\", payload, 'PENDING', 0, now(), now(), now() FROM outbox_messages WHERE payload->>'eventId' = '<event-id>' LIMIT 1;"
```

Chá» khoáº£ng 5-10 giÃ¢y Ä‘á»ƒ relay publish.

### 10.3 Verify chá»‰ cÃ³ má»™t row

```powershell
docker compose exec db-audit psql -U user -d audit_db -c "SELECT \"eventId\", count(*) FROM audit_logs GROUP BY \"eventId\" HAVING count(*) > 1;"
```

Expected: khÃ´ng cÃ³ row nÃ o.

Náº¿u cÃ¢u insert duplicate tráº£ `INSERT 0 0`, nghÄ©a lÃ  pháº§n `SELECT ... WHERE payload->>'eventId' = '<event-id>'` khÃ´ng tÃ¬m tháº¥y source row. Cháº¡y query nÃ y trÆ°á»›c Ä‘á»ƒ copy Ä‘Ãºng `event_id`:

```sql
SELECT id, payload->>'eventId' AS event_id, payload->>'action' AS action, status
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Náº¿u row duplicate Ä‘Ã£ insert nhÆ°ng chÆ°a chuyá»ƒn `PUBLISHED`, kiá»ƒm tra `nextAttemptAt`. Relay chá»‰ láº¥y row `PENDING` khi `nextAttemptAt <= now()`, nÃªn sau broker failure cÃ³ thá»ƒ pháº£i chá» theo backoff:

```sql
SELECT id, status, attempts, "nextAttemptAt", now() AS current_time, "lastError"
FROM outbox_messages
WHERE payload->>'eventId' = '<event-id>'
ORDER BY "createdAt" DESC;
```

---

## 11. Troubleshooting

### `GET /admin/audit-logs` tráº£ 401/403

- Kiá»ƒm tra token cÃ³ pháº£i admin/center manager khÃ´ng.
- Frontend chá»‰ gá»­i `Authorization`, khÃ´ng gá»­i `x-user-id`.
- Kiá»ƒm tra Keycloak role mapping trong token.

### Audited action success nhÆ°ng audit API chÆ°a tháº¥y record

Check theo thá»© tá»±:

1. Producer DB cÃ³ `outbox_messages` chÆ°a.
2. `outbox_messages.status` lÃ  `PUBLISHED`, `PENDING`, hay `FAILED`.
3. RabbitMQ cÃ³ queue `audit_service_events` khÃ´ng.
4. `audit-service` cÃ³ running/healthy khÃ´ng.
5. `audit_db.audit_logs` cÃ³ row theo `eventId` chÆ°a.

### Access log khÃ´ng vÃ o Kibana

- Kiá»ƒm tra `elasticsearch`, `logstash`, `kibana` Ä‘ang cháº¡y.
- Kiá»ƒm tra app log cÃ³ access log á»Ÿ stdout trÆ°á»›c.
- Kiá»ƒm tra Logstash pipeline vÃ  index `microservices-logs-*`.

### KhÃ´ng nÃªn log gÃ¬?

KhÃ´ng log:

- Password hoáº·c temporary password.
- Access/refresh token.
- `Authorization` header.
- Keycloak client secret.
- Azure/storage account key.
- Raw request body chá»©a dá»¯ liá»‡u nháº¡y cáº£m.

---

## 12. Demo Script Nhanh 5 PhÃºt

```powershell
# 1. Health
pnpm run smoke

# 2. Gá»i audited action
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

Expected: cÃ¹ng má»™t action xuáº¥t hiá»‡n á»Ÿ outbox producer vÃ  audit trail táº­p trung, cÃ³ `correlationId` Ä‘á»ƒ ná»‘i vá»›i access log.

<!-- Merged legacy testing guide -->

# Course Service â€” HÆ°á»›ng Dáº«n Test API Chi Tiáº¿t

> TÃ i liá»‡u nÃ y hÆ°á»›ng dáº«n test toÃ n bá»™ API cá»§a `course-service`, cáº£ khi gá»i **trá»±c tiáº¿p** (bá» qua Kong, dÃ¹ng cho dev/debug) láº«n khi gá»i **qua Kong** (production path).

---

## Má»¥c lá»¥c

1. [Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng](#1-khá»Ÿi-Ä‘á»™ng-mÃ´i-trÆ°á»ng)
2. [Kiáº¿n trÃºc luá»“ng request](#2-kiáº¿n-trÃºc-luá»“ng-request)
3. [Chuáº©n bá»‹ â€” Táº¡o dá»¯ liá»‡u máº«u](#3-chuáº©n-bá»‹--táº¡o-dá»¯-liá»‡u-máº«u)
4. [Test Course endpoints](#4-test-course-endpoints)
5. [Test Enrollment endpoints](#5-test-enrollment-endpoints)
6. [Test luá»“ng RabbitMQ event](#6-test-luá»“ng-rabbitmq-event)
7. [Kiá»ƒm tra Database trá»±c tiáº¿p](#7-kiá»ƒm-tra-database-trá»±c-tiáº¿p)
8. [Test Security Audit VÃ  Outbox](#8-test-security-audit-vÃ -outbox)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng

### BÆ°á»›c 1.1 â€” Start infrastructure

```bash
# Tá»« root cá»§a project
pnpm run infra:up
```

Chá» khoáº£ng 10-15 giÃ¢y Ä‘á»ƒ Consul khá»Ÿi Ä‘á»™ng vÃ  seed xong.

**Kiá»ƒm tra Consul healthy:**

```bash
curl http://localhost:8500/v1/status/leader
# Káº¿t quáº£ mong Ä‘á»£i: "..." (Ä‘á»‹a chá»‰ leader node)
```

**Consul UI:** http://localhost:8500/ui

### BÆ°á»›c 1.2 â€” Seed config vÃ o Consul

```bash
pnpm run consul:seed:local
```

Sau khi seed, kiá»ƒm tra config course-service:

```bash
pnpm run consul:list
pnpm run consul:get -- config/development-local/course-service/redis.url
# Expected: redis://localhost:6379
# TÃ¬m cÃ¡c key: config/development-local/course-service/...
```

### BÆ°á»›c 1.3 â€” Migrate database

```bash
cd apps/course-service
pnpm run db:generate
pnpm run db:migrate
```

Hoáº·c náº¿u migration Ä‘Ã£ tá»“n táº¡i:

```bash
cd apps/course-service
pnpm run db:deploy
```

**Kiá»ƒm tra schema:**

```bash
pnpm run db:studio
# Má»Ÿ browser táº¡i http://localhost:5555
```

### BÆ°á»›c 1.4 â€” Start course-service

```bash
# Tá»« root
pnpm run dev --filter=course-service
```

**Kiá»ƒm tra service Ä‘ang cháº¡y:**

```bash
curl http://localhost:3004/docs-json
# Káº¿t quáº£: OpenAPI JSON spec
```

**Swagger UI:** http://localhost:3004/docs

---

## 2. Kiáº¿n trÃºc luá»“ng request

```
Client (curl/Postman)
    â”‚
    â”œâ”€â”€â”€ DIRECT (dev/debug) â”€â”€â†’ http://localhost:3004  â†â”€â”€ Port course-service local
    â”‚                            (Æ¯u tiÃªn JWT tháº­t; x-user-id chá»‰ lÃ  fallback legacy)
    â”‚
    â””â”€â”€â”€ VIA KONG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â†’ http://localhost:8000  â†â”€â”€ Kong gateway
                                 (Cáº§n JWT há»£p lá»‡ tá»« Keycloak)
                                 Service Ä‘á»c actor tá»« JWT.sub
```

> **LÆ°u Ã½:** course-service hiá»‡n validate JWT/RBAC táº¡i service vÃ  Ä‘á»c user tá»« `@AuthenticatedUser()`. CÃ¡c lá»‡nh `x-user-id` trong guide nÃ y chá»‰ cÃ²n dÃ¹ng cho debug legacy khi endpoint váº«n cÃ³ fallback; frontend vÃ  demo chuáº©n pháº£i gá»­i `Authorization: Bearer <access_token>`.

---

## 3. Chuáº©n bá»‹ â€” Táº¡o dá»¯ liá»‡u máº«u

### ID máº«u dÃ¹ng xuyÃªn suá»‘t tÃ i liá»‡u nÃ y

```
INSTRUCTOR_ID = instructor-uuid-0001
STUDENT_ID    = student-uuid-0002
ADMIN_ID      = admin-uuid-0003
```

> ÄÃ¢y chá»‰ lÃ  UUID giáº£ (user-service khÃ´ng cáº§n cháº¡y vÃ¬ cross-service ref khÃ´ng cÃ³ FK).

---

## 4. Test Course endpoints

> Course list/detail uses Redis cache-aside with 600-second TTL. If Redis is unavailable, requests fall back to PostgreSQL and keep the same response shape.

> Táº¥t cáº£ cÃ¡c lá»‡nh curl sau gá»i **trá»±c tiáº¿p** vÃ o course-service (port 3004). Khi demo chuáº©n, thay cÃ¡c header `x-user-id` báº±ng `Authorization: Bearer <access_token>` láº¥y tá»« Keycloak.

---

### 4.1 POST /admin/courses â€” Táº¡o khÃ³a há»c

**Happy path â€” táº¡o khÃ³a há»c Ä‘áº§y Ä‘á»§:**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{
    "title": "KhÃ³a há»c B2 â€“ CÆ¡ báº£n",
    "licenseCategory": "B2",
    "description": "KhÃ³a há»c lÃ½ thuyáº¿t vÃ  thá»±c hÃ nh thi báº±ng B2",
    "duration": "3 thÃ¡ng",
    "tuitionFee": 5000000,
    "capacity": 30,
    "instructorIds": ["instructor-uuid-0001"],
    "requirement": {
      "minAge": 18,
      "prerequisites": "CÃ³ giáº¥y phÃ©p B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    }
  }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/courses",
  "data": {
    "id": "<course-uuid>",
    "title": "KhÃ³a há»c B2 â€“ CÆ¡ báº£n",
    "description": "KhÃ³a há»c lÃ½ thuyáº¿t vÃ  thá»±c hÃ nh thi báº±ng B2",
    "licenseCategory": "B2",
    "status": "DRAFT",
    "totalLessons": 0,
    "duration": "3 thÃ¡ng",
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
      "prerequisites": "CÃ³ giáº¥y phÃ©p B1",
      "attendanceRate": 80,
      "minPassScore": 80,
      "requiredExams": 2
    },
    "materials": []
  }
}
```

> **LÆ°u Ã½:** LÆ°u láº¡i `course-uuid` tá»« response Ä‘á»ƒ dÃ¹ng cho cÃ¡c bÆ°á»›c tiáº¿p theo.

```bash
# LÆ°u course ID
COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Test Course","licenseCategory":"B1"}' \
  | jq -r '.data.id')
echo "COURSE_ID=$COURSE_ID"
```

**Táº¡o thÃªm course A1 Ä‘á»ƒ test list/filter:**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{
    "title": "KhÃ³a há»c A1 â€“ Xe mÃ¡y 50cc",
    "licenseCategory": "A1",
    "tuitionFee": 2000000
  }' | jq '.data.id'
```

**Case: Thiáº¿u field báº¯t buá»™c (expect 400):**

```bash
curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title": "KhÃ´ng cÃ³ licenseCategory"}' | jq .
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

### 4.2 GET /courses â€” Danh sÃ¡ch khÃ³a há»c

**Láº¥y táº¥t cáº£:**

```bash
curl -s "http://localhost:3004/admin/courses" | jq '.data | {total, page, size}'
```

**Lá»c theo háº¡ng báº±ng:**

```bash
curl -s "http://localhost:3004/courses?licenseCategory=B2" | jq '.data.items | length'
```

**Lá»c theo status:**

```bash
curl -s "http://localhost:3004/courses?status=DRAFT" | jq '.data.items | map(.status)'
curl -s "http://localhost:3004/courses?status=ACTIVE" | jq '.data.items | map(.title)'
```

**PhÃ¢n trang:**

```bash
curl -s "http://localhost:3004/courses?page=1&size=1" | jq '.data | {total, page, size, items_count: (.items | length)}'
```

**Káº¿t há»£p filter:**

```bash
curl -s "http://localhost:3004/courses?licenseCategory=B2&status=DRAFT" | jq .
```

---

### 4.3 GET /courses/:id â€” Chi tiáº¿t khÃ³a há»c

```bash
curl -s "http://localhost:3004/courses/$COURSE_ID" | jq .data
```

**Case: ID khÃ´ng tá»“n táº¡i (expect 404):**

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

### 4.4 PATCH /admin/courses/:id â€” Cáº­p nháº­t khÃ³a há»c

**Cáº­p nháº­t metadata:**

```bash
curl -s -X PATCH "http://localhost:3004/courses/$COURSE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "KhÃ³a há»c B2 â€“ NÃ¢ng cao",
    "tuitionFee": 6000000,
    "duration": "4 thÃ¡ng"
  }' | jq '.data | {title, tuitionFee, duration}'
```

**Cáº­p nháº­t requirement:**

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

### 4.5 POST /admin/courses/:id/lessons â€” ThÃªm bÃ i há»c

**ThÃªm bÃ i há»c 1:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "BÃ i 1 â€“ Biá»ƒn bÃ¡o giao thÃ´ng",
    "order": 1,
    "content": "# Biá»ƒn bÃ¡o\nNá»™i dung markdown..."
  }' | jq '.data | {totalLessons, lessons_count: (.lessons | length)}'
```

**ThÃªm bÃ i há»c 2:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "BÃ i 2 â€“ Ká»¹ nÄƒng lÃ¡i xe",
    "order": 2
  }' | jq '.data.totalLessons'
# Káº¿t quáº£ mong Ä‘á»£i: 2
```

**ThÃªm bÃ i há»c 3 (Ä‘á»ƒ test complete enrollment):**

```bash
LESSON_1_ID=$(curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson A","order":1}' | jq -r '.data.lessons[0].id')

# Láº¥y lesson IDs tá»« course
curl -s "http://localhost:3004/courses/$COURSE_ID" | jq '.data.lessons | map({id, title, order})'
```

> **LÆ°u Ã½:** LÆ°u cÃ¡c `lesson_id` tá»« response Ä‘á»ƒ dÃ¹ng cho test complete-lesson.

**Case: Thiáº¿u field báº¯t buá»™c (expect 400):**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"content": "KhÃ´ng cÃ³ title vÃ  order"}' | jq .
```

---

### 4.6 PATCH /admin/courses/:id/activate â€” KÃ­ch hoáº¡t khÃ³a há»c

**Case: KÃ­ch hoáº¡t khi chÆ°a cÃ³ lesson (expect 422):**

```bash
# Táº¡o course rá»—ng rá»“i thá»­ activate
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

**Happy path â€” KÃ­ch hoáº¡t course cÃ³ lesson:**

```bash
curl -s -X PATCH "http://localhost:3004/admin/courses/$COURSE_ID/activate" | jq '.data.status'
# Káº¿t quáº£ mong Ä‘á»£i: "ACTIVE"
```

**XÃ¡c nháº­n filter status=ACTIVE:**

```bash
curl -s "http://localhost:3004/courses?status=ACTIVE" | jq '.data.items | map(.title)'
# Pháº£i tháº¥y course vá»«a activate
```

---

### 4.7 DELETE /admin/courses/:id/lessons/:lessonId â€” XÃ³a bÃ i há»c

```bash
# Láº¥y lessonId tá»« course
LESSON_ID=$(curl -s "http://localhost:3004/courses/$COURSE_ID" | jq -r '.data.lessons[-1].id')

curl -s -X DELETE "http://localhost:3004/admin/courses/$COURSE_ID/lessons/$LESSON_ID" \
  | jq '.data | {totalLessons}'
```

**Case: Lesson khÃ´ng tá»“n táº¡i (expect 404):**

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

### 4.8 POST /admin/courses/:id/materials â€” ThÃªm tÃ i liá»‡u

**ThÃªm PDF:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "GiÃ¡o trÃ¬nh lÃ½ thuyáº¿t B2",
    "fileUrl": "https://example.com/giao-trinh.pdf",
    "type": "PDF"
  }' | jq '.data.materials'
```

**ThÃªm video:**

```bash
curl -s -X POST "http://localhost:3004/admin/courses/$COURSE_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Video hÆ°á»›ng dáº«n thá»±c hÃ nh",
    "fileUrl": "https://example.com/video.mp4",
    "type": "VIDEO"
  }' | jq '.data.materials | length'
```

---

### 4.9 POST /courses/:id/enroll â€” ÄÄƒng kÃ½ khÃ³a há»c

> Äáº£m báº£o course Ä‘ang á»Ÿ status ACTIVE trÆ°á»›c khi test enroll.

**Chuáº©n bá»‹ license tier read model cho student:**

Course-service enroll dá»±a trÃªn read model Ä‘Æ°á»£c sync tá»« event `user.student.license-assigned`. TrÆ°á»›c khi gá»i enroll trá»±c tiáº¿p trong mÃ´i trÆ°á»ng test, publish event vÃ o queue `course_service_events` hoáº·c dÃ¹ng flow user-service assign license tier.

Payload RabbitMQ máº«u cho course `$COURSE_ID` cÃ³ `licenseCategory = B2`:

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

**Káº¿t quáº£ mong Ä‘á»£i (201):**

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

> **LÆ°u láº¡i enrollment ID:**
>
> ```bash
> ENROLLMENT_ID=$(curl -s -X POST "http://localhost:3004/courses/$COURSE_ID/enroll" \
>   -H "x-user-id: student-uuid-NEW" | jq -r '.data.id')
> ```

**Case: ÄÄƒng kÃ½ khÃ³a há»c DRAFT (expect 422):**

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

**Case: ÄÄƒng kÃ½ láº§n 2 (expect 409):**

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

**Case: Student chÆ°a cÃ³ license tier sync sang course-service (expect 422):**

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

**Case: License tier khÃ´ng khá»›p licenseCategory cá»§a course (expect 422):**

Publish event `user.student.license-assigned` cho `student-wrong-license` vá»›i `newLicenseTier = "A1"`, rá»“i enroll vÃ o course B2:

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

**Case: KhÃ³a há»c háº¿t chá»— (expect 422):**

```bash
# Táº¡o course vá»›i capacity=1 vÃ  Ä‘Äƒng kÃ½ student thá»© 2
SMALL_COURSE_ID=$(curl -s -X POST http://localhost:3004/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: instructor-uuid-0001" \
  -d '{"title":"Small Course","licenseCategory":"C","capacity":1}' | jq -r '.data.id')

# ThÃªm lesson vÃ  activate
curl -s -X POST "http://localhost:3004/admin/courses/$SMALL_COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Only lesson","order":1}' > /dev/null
curl -s -X PATCH "http://localhost:3004/admin/courses/$SMALL_COURSE_ID/activate" > /dev/null

# ÄÄƒng kÃ½ student 1 (thÃ nh cÃ´ng)
# TrÆ°á»›c Ä‘Ã³ cáº§n sync license tier C cho student-a qua event user.student.license-assigned.
curl -s -X POST "http://localhost:3004/courses/$SMALL_COURSE_ID/enroll" \
  -H "x-user-id: student-a" | jq '.success'  # â†’ true

# ÄÄƒng kÃ½ student 2 (expect 422)
# TrÆ°á»›c Ä‘Ã³ cáº§n sync license tier C cho student-b qua event user.student.license-assigned.
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

> Cáº§n cÃ³ `ENROLLMENT_ID` há»£p lá»‡. Láº¥y tá»« bÆ°á»›c 4.9 hoáº·c táº¡o má»›i.

---

### 5.1 GET /enrollments â€” Danh sÃ¡ch enrollment cá»§a student

```bash
curl -s "http://localhost:3004/enrollments" \
  -H "x-user-id: student-uuid-0002" | jq '.data | {total, items_count: (.items | length)}'
```

**Lá»c theo status:**

```bash
curl -s "http://localhost:3004/enrollments?status=ACTIVE" \
  -H "x-user-id: student-uuid-0002" | jq '.data.items | map(.status)'
```

---

### 5.2 GET /enrollments/:id â€” Chi tiáº¿t enrollment

```bash
curl -s "http://localhost:3004/enrollments/$ENROLLMENT_ID" | jq .data
```

**Káº¿t quáº£ mong Ä‘á»£i:**

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

**Case: KhÃ´ng tÃ¬m tháº¥y (expect 404):**

```bash
curl -s "http://localhost:3004/enrollments/non-existent-id" | jq .
```

---

### 5.3 POST /enrollments/:id/lessons/:lessonId/complete â€” HoÃ n thÃ nh bÃ i há»c

**Setup â€” Láº¥y lesson IDs tá»« course:**

```bash
LESSONS=$(curl -s "http://localhost:3004/courses/$COURSE_ID" | jq '.data.lessons | map(.id)')
LESSON_1_ID=$(echo $LESSONS | jq -r '.[0]')
LESSON_2_ID=$(echo $LESSONS | jq -r '.[1]')
echo "LESSON_1=$LESSON_1_ID"
echo "LESSON_2=$LESSON_2_ID"
```

**HoÃ n thÃ nh bÃ i há»c 1:**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_1_ID/complete" \
  | jq '.data | {progress, status}'
```

**Káº¿t quáº£ mong Ä‘á»£i (progress = 50% náº¿u cÃ³ 2 bÃ i):**

```json
{
  "progress": 50,
  "status": "ACTIVE"
}
```

**HoÃ n thÃ nh bÃ i há»c 2 â†’ enrollment COMPLETED:**

```bash
curl -s -X POST "http://localhost:3004/enrollments/$ENROLLMENT_ID/lessons/$LESSON_2_ID/complete" \
  | jq '.data | {progress, status, completedAt}'
```

**Káº¿t quáº£ mong Ä‘á»£i (progress = 100%):**

```json
{
  "progress": 100,
  "status": "COMPLETED",
  "completedAt": "2026-05-07T..."
}
```

> **LÆ°u Ã½:** KhÃ´ng cÃ³ per-lesson tracking â€” má»—i láº§n gá»i `complete` tÄƒng `progress += 100/totalLessons`. KhÃ´ng cÃ³ `LESSON_ALREADY_COMPLETED` vÃ¬ khÃ´ng track per-lesson state.

**Case: Enrollment Ä‘Ã£ COMPLETED (expect 422):**

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

## 6. Test luá»“ng RabbitMQ event

### 6.1 Kiá»ƒm tra RabbitMQ Ä‘ang cháº¡y

**RabbitMQ Management UI:** http://localhost:15672
Username: `guest` / Password: `guest`

VÃ o tab **Queues** Ä‘á»ƒ tháº¥y:

- `course_service_events` â€” queue course-service CONSUME (nháº­n event tá»« user-service)
- `course_service_publish` â€” queue course-service PUBLISH events vÃ o

### 6.2 Kiá»ƒm tra events Ä‘Æ°á»£c publish sau enroll

Sau khi `POST /courses/:id/enroll` thÃ nh cÃ´ng, vÃ o tab **Queues** â†’ `course_service_publish` â†’ **Get messages** Ä‘á»ƒ xem event `course.enrollment.created`.

### 6.3 Kiá»ƒm tra events sau complete lesson

Sau khi `POST /enrollments/:id/lessons/:lessonId/complete`:

- TÃ¬m event `course.lesson.completed` trong queue
- Náº¿u enrollment = 100%, tÃ¬m thÃªm `course.enrollment.completed`

### 6.4 Simulate event `user.student.license-assigned`

Publish thá»§ cÃ´ng vÃ o `course_service_events`:

**CÃ¡ch 1: RabbitMQ Management UI**

1. VÃ o http://localhost:15672
2. Tab **Queues** â†’ `course_service_events` â†’ **Publish message**
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

**Káº¿t quáº£ mong Ä‘á»£i:** Course-service log: `Received user.student.license-assigned for studentId=student-uuid-0002, newLicenseTier=B2` vÃ  table `student_license_profiles` cÃ³ record tÆ°Æ¡ng á»©ng.

---

## 7. Kiá»ƒm tra Database trá»±c tiáº¿p

### DÃ¹ng Prisma Studio

```bash
cd apps/course-service
pnpm run db:studio
```

Má»Ÿ http://localhost:5555 Ä‘á»ƒ xem cÃ¡c báº£ng:

- `courses`
- `lessons`
- `course_instructors`
- `course_requirements`
- `course_materials`
- `course_enrollments`
- `student_license_profiles`

### DÃ¹ng psql trá»±c tiáº¿p

```bash
psql postgresql://user:password@localhost:5435/course_db
```

```sql
-- Xem táº¥t cáº£ courses vÃ  sá»‘ bÃ i há»c
SELECT id, title, "licenseCategory", status, "totalLessons", "tuitionFee", capacity
FROM courses
ORDER BY "createdAt" DESC;

-- Xem lessons cá»§a má»™t course
SELECT id, title, "order", content
FROM lessons
WHERE "courseId" = '<course-uuid>'
ORDER BY "order";

-- Xem enrollments vÃ  tiáº¿n Ä‘á»™
SELECT
  id,
  "studentId",
  status,
  progress,
  "enrolledAt",
  "completedAt"
FROM course_enrollments
ORDER BY "enrolledAt" DESC;

-- Xem license tier read model sync tá»« user-service
SELECT "studentId", "licenseTier", "syncedAt", "updatedAt"
FROM student_license_profiles
ORDER BY "updatedAt" DESC;

-- Äáº¿m sá»‘ enrollment theo course (kiá»ƒm tra capacity)
SELECT "courseId", COUNT(*) AS enrolled_count
FROM course_enrollments
WHERE status != 'DROPPED'
GROUP BY "courseId";
```

---

## 8. Test Security Audit VÃ  Outbox

Má»¥c tiÃªu: chá»©ng minh cÃ¡c course mutation quan trá»ng ghi audit event báº±ng transactional outbox vÃ  xuáº¥t hiá»‡n trong `audit-service`.

### 8.1 Audited actions cáº§n cover

| API                                           | Expected audit action       |
| --------------------------------------------- | --------------------------- |
| `POST /admin/courses`                         | `COURSE_CREATED`            |
| `PATCH /admin/courses/:id`                    | `COURSE_UPDATED`            |
| `PATCH /admin/courses/:id/activate`           | `COURSE_ACTIVATED`          |
| `DELETE /admin/courses/:id`                   | `COURSE_ARCHIVED`           |
| `POST /admin/courses/:id/lessons`             | `COURSE_LESSON_ADDED`       |
| `DELETE /admin/courses/:id/lessons/:lessonId` | `COURSE_LESSON_REMOVED`     |
| `POST /admin/courses/:id/materials`           | `COURSE_MATERIAL_ADDED`     |
| `POST /enrollments/:id/reset-progress`        | `ENROLLMENT_PROGRESS_RESET` |

### 8.2 Gá»i má»™t mutation vÃ  láº¥y correlation id

VÃ­ dá»¥ archive course:

```bash
curl -i -X DELETE http://localhost:8000/admin/courses/<course-id> \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>"
```

Expected:

- HTTP `200`.
- Response header cÃ³ `x-correlation-id`.
- Course Ä‘Æ°á»£c archive/soft delete theo behavior hiá»‡n táº¡i.

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

- CÃ³ row `action = COURSE_ARCHIVED`.
- `resource_type = COURSE`.
- `resource_id = <course-id>`.
- BÃ¬nh thÆ°á»ng sau vÃ i giÃ¢y `status = PUBLISHED`.

### 8.4 Verify centralized audit-service

```bash
curl -s "http://localhost:8000/admin/audit-logs?serviceName=course-service&resourceId=<course-id>" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" | jq .
```

Expected:

- CÃ³ item `serviceName = course-service`.
- `action` Ä‘Ãºng vá»›i API vá»«a gá»i.
- `correlationId` tá»“n táº¡i Ä‘á»ƒ join vá»›i access log.
- `metadata` Ä‘Ãºng theo action, vÃ­ dá»¥ `COURSE_ARCHIVED` cÃ³ `{ "status": "ARCHIVED" }`.

### 8.5 Verify outbox retry khi RabbitMQ lá»—i

```bash
docker compose stop rabbitmq

# Gá»i má»™t audited mutation, vÃ­ dá»¥ update course title
curl -i -X PATCH http://localhost:8000/admin/courses/<course-id> \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Course updated while RabbitMQ down" }'
```

Expected:

- Business update váº«n thÃ nh cÃ´ng náº¿u request path khÃ´ng cáº§n RabbitMQ trá»±c tiáº¿p.
- `course_db.outbox_messages` cÃ³ row `PENDING` hoáº·c sau retry thÃ nh `FAILED`.
- `audit_db.audit_logs` chÆ°a cÃ³ ngay record má»›i.

Start RabbitMQ láº¡i:

```bash
docker compose start rabbitmq
```

Expected: relay publish láº¡i message cÃ²n `PENDING`; audit log xuáº¥t hiá»‡n trong `audit-service`.

---

## 9. Troubleshooting

### Service khÃ´ng start â€” PrismaClientConstructorValidationError

```
PrismaClientConstructorValidationError: Invalid value undefined for datasource "db"
```

â†’ Consul chÆ°a cháº¡y hoáº·c chÆ°a seed. Cháº¡y:

```bash
pnpm run infra:up
pnpm run consul:seed:local
```

Sau Ä‘Ã³ restart service.

---

### Database connection error

```
Error: Can't reach database server at localhost:5435
```

â†’ Cháº¡y:

```bash
pnpm run infra:up
```

---

### Prisma schema chÆ°a migrate

```
PrismaClientInitializationError
```

â†’ Cháº¡y:

```bash
cd apps/course-service
pnpm run db:generate
pnpm run db:migrate
```

---

### `422 COURSE_HAS_NO_LESSON` khi activate

â†’ ÄÃºng behavior. Pháº£i thÃªm Ã­t nháº¥t 1 lesson trÆ°á»›c khi activate.

---

### `409 ENROLLMENT_ALREADY_EXISTS`

â†’ ÄÃºng behavior. Má»—i student chá»‰ Ä‘Æ°á»£c Ä‘Äƒng kÃ½ má»™t khÃ³a há»c má»™t láº§n. DÃ¹ng `studentId` khÃ¡c hoáº·c táº¡o course má»›i Ä‘á»ƒ test láº¡i.

---

### RabbitMQ event khÃ´ng Ä‘Æ°á»£c publish

1. Kiá»ƒm tra `rabbitmq.url` trong Consul KV Ä‘Ã£ Ä‘Æ°á»£c seed
2. Kiá»ƒm tra course-service log: `Course Service listening on port 3004` â†’ microservice start OK
3. VÃ o RabbitMQ UI â†’ tab Connections kiá»ƒm tra course-service Ä‘Ã£ connect

---

### Response format sai (khÃ´ng cÃ³ `success` field)

â†’ `DomainExceptionFilter` hoáº·c `ApiExceptionFilter` chÆ°a register. Kiá»ƒm tra `main.ts`:

```typescript
app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
```

---

## Checklist test nhanh (Happy Path)

Cháº¡y tá»« root Ä‘á»ƒ verify toÃ n bá»™ flow sau má»—i thay Ä‘á»•i:

```bash
BASE="http://localhost:3004"
INSTRUCTOR="instructor-test-001"
STUDENT="student-test-002"

# 1. Táº¡o course
COURSE_ID=$(curl -s -X POST $BASE/admin/courses \
  -H "Content-Type: application/json" \
  -H "x-user-id: $INSTRUCTOR" \
  -d '{"title":"Test Course","licenseCategory":"B1","capacity":10}' \
  | jq -r '.data.id')
echo "âœ“ Course created: $COURSE_ID"

# 2. ThÃªm 2 lessons
curl -s -X POST "$BASE/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson 1","order":1}' > /dev/null
curl -s -X POST "$BASE/admin/courses/$COURSE_ID/lessons" \
  -H "Content-Type: application/json" \
  -d '{"title":"Lesson 2","order":2}' > /dev/null
echo "âœ“ 2 lessons added"

# 3. Activate
STATUS=$(curl -s -X PATCH "$BASE/courses/$COURSE_ID/activate" | jq -r '.data.status')
echo "âœ“ Course activated: $STATUS"  # â†’ ACTIVE

# 4. Enroll student
ENROLLMENT_ID=$(curl -s -X POST "$BASE/courses/$COURSE_ID/enroll" \
  -H "x-user-id: $STUDENT" | jq -r '.data.id')
echo "âœ“ Enrolled: $ENROLLMENT_ID"

# 5. Láº¥y lesson IDs
L1=$(curl -s "$BASE/courses/$COURSE_ID" | jq -r '.data.lessons[0].id')
L2=$(curl -s "$BASE/courses/$COURSE_ID" | jq -r '.data.lessons[1].id')

# 6. Complete lesson 1
PROGRESS=$(curl -s -X POST "$BASE/enrollments/$ENROLLMENT_ID/lessons/$L1/complete" \
  | jq '.data.progress')
echo "âœ“ Lesson 1 completed. Progress: $PROGRESS%"  # â†’ 50

# 7. Complete lesson 2 â†’ enrollment COMPLETED
FINAL=$(curl -s -X POST "$BASE/enrollments/$ENROLLMENT_ID/lessons/$L2/complete" \
  | jq '{progress: .data.progress, status: .data.status}')
echo "âœ“ Lesson 2 completed: $FINAL"  # â†’ {progress:100, status:"COMPLETED"}

echo ""
echo "All checks passed!"
```

## ASR: Reset Progress And Archive Course

### Reset Learning Progress

```http
POST http://localhost:3004/enrollments/{enrollmentId}/reset-progress
Authorization: Bearer <student_token>
```

Expected:

- enrollment `progress = 0`
- enrollment `status = ACTIVE`
- `completedAt = null`
- exam history remains unchanged in `exam-service`
- `analytics-service` receives `course.enrollment.progress-reset`

### Archive Course

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

# Exam Service - HÆ°á»›ng Dáº«n Test API Chi Tiáº¿t

> TÃ i liá»‡u nÃ y hÆ°á»›ng dáº«n test `exam-service` v1 khi cháº¡y local hybrid mode, cáº£ khi gá»i trá»±c tiáº¿p port `3003` vÃ  khi gá»i qua Kong `8000`.

---

## Má»¥c Lá»¥c

1. [Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng](#1-khá»Ÿi-Ä‘á»™ng-mÃ´i-trÆ°á»ng)
2. [Kiáº¿n trÃºc request flow](#2-kiáº¿n-trÃºc-request-flow)
3. [Biáº¿n mÃ´i trÆ°á»ng test](#3-biáº¿n-mÃ´i-trÆ°á»ng-test)
4. [Láº¥y access token](#4-láº¥y-access-token)
5. [Seed dá»¯ liá»‡u phá»¥ thuá»™c](#5-seed-dá»¯-liá»‡u-phá»¥-thuá»™c)
6. [Test exam template endpoints](#6-test-exam-template-endpoints)
7. [Test student exam session flow](#7-test-student-exam-session-flow)
8. [Negative scenarios](#8-negative-scenarios)
9. [Kiá»ƒm tra DB vÃ  RabbitMQ](#9-kiá»ƒm-tra-db-vÃ -rabbitmq)
10. [Test Security Audit VÃ  Outbox](#10-test-security-audit-vÃ -outbox)
11. [Quality gates](#11-quality-gates)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Khá»Ÿi Äá»™ng MÃ´i TrÆ°á»ng

### 1.1 Start infrastructure

Tá»« root project:

```bash
pnpm run infra:up
```

Hybrid infra gá»“m:

- PostgreSQL databases: `5432..5440`
- RabbitMQ: `5672`, UI `15672`
- Redis: `6379`
- Consul: `8500`
- Keycloak: `8080`
- Kong dev gateway: proxy `8000`, admin `8001`

Kiá»ƒm tra nhanh:

```bash
curl -s http://localhost:8500/v1/status/leader
curl -s http://localhost:8001/services | jq '.data | map(.name)'
curl -s http://localhost:15672/api/overview -u guest:guest | jq '.rabbitmq_version'
```

### 1.2 Seed config vÃ o Consul

```bash
pnpm run consul:seed:local
```

Kiá»ƒm tra config exam-service:

```bash
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/?recurse" | jq '.[].Key'
```

Cáº§n cÃ³ cÃ¡c key quan trá»ng:

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

### 1.3 Generate vÃ  migrate database

Cháº¡y migrate cho cÃ¡c service liÃªn quan Ä‘áº¿n flow:

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

Náº¿u migration Ä‘Ã£ tá»“n táº¡i vÃ  chá»‰ cáº§n apply:

```bash
pnpm --filter=exam-service run db:deploy
```

### 1.4 Start required services

Exam flow cáº§n tá»‘i thiá»ƒu 4 services:

```bash
pnpm run dev --filter=identity-service
pnpm run dev --filter=user-service
pnpm run dev --filter=question-service
pnpm run dev --filter=exam-service
```

Kiá»ƒm tra Swagger:

```bash
curl -s http://localhost:3003/docs-json | jq '.info.title'
curl -s http://localhost:8000/exam-service/docs-json | jq '.info.title'
```

Swagger UI:

- Direct: http://localhost:3003/docs
- Qua Kong: http://localhost:8000/exam-service/docs

---

## 2. Kiáº¿n TrÃºc Request Flow

```text
Client/Postman
  |
  |-- DIRECT --> http://localhost:3003/exams/...
  |              Váº«n cáº§n Authorization header vÃ¬ exam-service tá»± validate JWT
  |
  |-- KONG ----> http://localhost:8000/exams/...
                 Kong forward path /exams vá»›i strip_path=false
                 exam-service váº«n validate JWT/RBAC báº±ng nest-keycloak-connect

exam-service
  |-- validates student profile --> user-service GET /users/me
  |                                dÃ¹ng incoming student bearer token
  |
  |-- fetches question pool -----> question-service POST /admin/questions/pool
                                   dÃ¹ng service-account token
```

Endpoint path:

| NhÃ³m     | Direct local                                  | Qua Kong                                      |
| --------- | --------------------------------------------- | --------------------------------------------- |
| Templates | `http://localhost:3003/admin/exams/templates` | `http://localhost:8000/admin/exams/templates` |
| Sessions  | `http://localhost:3003/exams/sessions`        | `http://localhost:8000/exams/sessions`        |
| Swagger   | `http://localhost:3003/docs`                  | `http://localhost:8000/exam-service/docs`     |

---

## 3. Biáº¿n MÃ´i TrÆ°á»ng Test

DÃ¹ng Git Bash/macOS/Linux style:

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

Náº¿u test trá»±c tiáº¿p service, Ä‘á»•i:

```bash
IDENTITY_BASE="http://localhost:3001"
USER_BASE="http://localhost:3002"
QUESTION_BASE="http://localhost:3005"
EXAM_BASE="http://localhost:3003"
```

LÆ°u Ã½ direct identity path khÃ¡c Kong:

| Action      | Direct local                 | Qua Kong                     |
| ----------- | ---------------------------- | ---------------------------- |
| Login       | `POST /login`                | `POST /auth/login`           |
| Refresh     | `POST /refresh`              | `POST /auth/refresh`         |
| Admin users | `POST /admin/identity-users` | `POST /admin/identity-users` |

Náº¿u dÃ¹ng PowerShell, Ä‘á»•i `\` thÃ nh backtick `` ` `` hoáº·c viáº¿t trÃªn má»™t dÃ²ng.

---

## 4. Láº¥y Access Token

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

Kiá»ƒm tra token cÃ³ role admin:

```bash
curl -s "$IDENTITY_BASE/admin/identity-users?page=1&size=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.success, .data.total'
```

Expect `true` vÃ  HTTP `200`.

### 4.2 Táº¡o student test qua identity-service

`user-service` khÃ´ng expose HTTP `POST /users`. Táº¡o user báº±ng identity-service, identity-service sáº½ publish RabbitMQ event `identity.user.created`, user-service sáº½ táº¡o profile.

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

Náº¿u user Ä‘Ã£ tá»“n táº¡i, láº¥y id tá»« list:

```bash
STUDENT_USER_ID=$(curl -s "$IDENTITY_BASE/admin/identity-users?search=$STUDENT_EMAIL" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.items[0].id')
```

Chá» user-service consume event, rá»“i verify profile:

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

### 4.3 Gáº¯n license tier cho student

Exam start sáº½ fail náº¿u `studentDetail.licenseTier` khÃ¡c template `licenseCategory`.

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

Kiá»ƒm tra current profile:

```bash
curl -s "$USER_BASE/users/me" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,email,role,studentDetail}'
```

---

## 5. Seed Dá»¯ Liá»‡u Phá»¥ Thuá»™c

Exam-service cáº§n active question pool tá»« question-service. Äá»ƒ test nhanh, táº¡o 3 cÃ¢u há»i `B2`, trong Ä‘Ã³ cÃ³ 1 cÃ¢u critical.

### 5.1 Táº¡o topic

```bash
TOPIC_ID=$(curl -s -X POST "$QUESTION_BASE/admin/questions/topics" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Exam B2 Seed Topic",
    "description": "Topic dÃ¹ng Ä‘á»ƒ test exam-service"
  }' | jq -r '.data.id')

echo "TOPIC_ID=$TOPIC_ID"
```

Náº¿u topic Ä‘Ã£ tá»“n táº¡i, cÃ³ thá»ƒ láº¥y topic Ä‘áº§u tiÃªn:

```bash
TOPIC_ID=$(curl -s "$QUESTION_BASE/admin/questions/topics?page=1&size=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.items[0].id')
```

### 5.2 Táº¡o question 1

```bash
Q1=$(curl -s -X POST "$QUESTION_BASE/admin/questions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Khi gáº·p Ä‘Ã¨n Ä‘á», ngÆ°á»i lÃ¡i xe pháº£i lÃ m gÃ¬?\",
    \"type\": \"SINGLE_CHOICE\",
    \"licenseCategories\": [\"$LICENSE_CATEGORY\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"ÄÃ¨n Ä‘á» báº¯t buá»™c dá»«ng láº¡i trÆ°á»›c váº¡ch dá»«ng.\",
    \"topicId\": \"$TOPIC_ID\",
    \"isCritical\": true,
    \"isActive\": true,
    \"options\": [
      {\"content\": \"Dá»«ng láº¡i trÆ°á»›c váº¡ch dá»«ng\", \"isCorrect\": true, \"displayOrder\": 1},
      {\"content\": \"TÄƒng tá»‘c Ä‘i qua\", \"isCorrect\": false, \"displayOrder\": 2},
      {\"content\": \"Báº¥m cÃ²i vÃ  tiáº¿p tá»¥c Ä‘i\", \"isCorrect\": false, \"displayOrder\": 3}
    ]
  }" | jq -r '.data.id')

echo "Q1=$Q1"
```

### 5.3 Táº¡o question 2

```bash
Q2=$(curl -s -X POST "$QUESTION_BASE/admin/questions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Biá»ƒn bÃ¡o hÃ¬nh trÃ²n ná»n xanh thÆ°á»ng thá»ƒ hiá»‡n Ä‘iá»u gÃ¬?\",
    \"type\": \"SINGLE_CHOICE\",
    \"licenseCategories\": [\"$LICENSE_CATEGORY\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"Biá»ƒn trÃ²n ná»n xanh thÆ°á»ng lÃ  biá»ƒn hiá»‡u lá»‡nh.\",
    \"topicId\": \"$TOPIC_ID\",
    \"isCritical\": false,
    \"isActive\": true,
    \"options\": [
      {\"content\": \"Biá»ƒn hiá»‡u lá»‡nh\", \"isCorrect\": true, \"displayOrder\": 1},
      {\"content\": \"Biá»ƒn cáº¥m\", \"isCorrect\": false, \"displayOrder\": 2},
      {\"content\": \"Biá»ƒn nguy hiá»ƒm\", \"isCorrect\": false, \"displayOrder\": 3}
    ]
  }" | jq -r '.data.id')

echo "Q2=$Q2"
```

### 5.4 Táº¡o question 3

```bash
Q3=$(curl -s -X POST "$QUESTION_BASE/admin/questions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"Khoáº£ng cÃ¡ch an toÃ n phá»¥ thuá»™c vÃ o yáº¿u tá»‘ nÃ o?\",
    \"type\": \"SINGLE_CHOICE\",
    \"licenseCategories\": [\"$LICENSE_CATEGORY\"],
    \"difficulty\": \"MEDIUM\",
    \"explanation\": \"Tá»‘c Ä‘á»™, máº·t Ä‘Æ°á»ng, thá»i tiáº¿t vÃ  tÃ¬nh huá»‘ng giao thÃ´ng Ä‘á»u áº£nh hÆ°á»Ÿng.\",
    \"topicId\": \"$TOPIC_ID\",
    \"isCritical\": false,
    \"isActive\": true,
    \"options\": [
      {\"content\": \"Tá»‘c Ä‘á»™ vÃ  Ä‘iá»u kiá»‡n giao thÃ´ng\", \"isCorrect\": true, \"displayOrder\": 1},
      {\"content\": \"MÃ u xe\", \"isCorrect\": false, \"displayOrder\": 2},
      {\"content\": \"Sá»‘ gháº¿ trÃªn xe\", \"isCorrect\": false, \"displayOrder\": 3}
    ]
  }" | jq -r '.data.id')

echo "Q3=$Q3"
```

### 5.5 Kiá»ƒm tra question pool

Endpoint pool lÃ  internal/admin endpoint, student khÃ´ng gá»i trá»±c tiáº¿p.

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

Táº¥t cáº£ template endpoints cáº§n role `ADMIN`.

### 6.1 POST /admin/exams/templates - táº¡o template

Scalar-ready B2 template using the seeded 600-question bank:

```json
{
  "name": "De thi B2 co ban",
  "description": "De thi mo phong theo cau truc GPLX hang B2",
  "licenseCategory": "B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0,
  "shuffleQuestions": true,
  "topicDistribution": [
    { "topicId": "9f49045f-156e-5252-8486-babb36dc74fd", "questionCount": 9 },
    { "topicId": "6d568ff3-458d-5764-bb15-ae3258b75a40", "questionCount": 1 },
    { "topicId": "a81d3294-cc8b-579e-9567-8bbc39f96b60", "questionCount": 1 },
    { "topicId": "6d38e12b-adec-5c2c-b029-e01ae1fdabd2", "questionCount": 1 },
    { "topicId": "d7a509c3-153f-5c03-9398-6a5626aa70d0", "questionCount": 9 },
    { "topicId": "0694bef4-6534-56d3-bc68-a3a0fb8f4f43", "questionCount": 9 }
  ]
}
```

The `questionCount` sum is `30`, matching `totalQuestions`. Because `criticalQuestions = 1`, this example includes topic 1/2/3, which contain the seeded critical-question pool.

```bash
TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Äá» thi $LICENSE_CATEGORY smoke test\",
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

Kiá»ƒm tra response Ä‘áº§y Ä‘á»§:

```bash
curl -s "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data'
```

Expect:

- HTTP `201 Created` khi táº¡o
- `data.id` lÃ  UUID
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
- `data.createdById` báº±ng admin user id trong token

### 6.2 GET /admin/exams/templates - list/filter

```bash
curl -s "$EXAM_BASE/admin/exams/templates?page=1&size=20&licenseCategory=$LICENSE_CATEGORY&isActive=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | {total,page,size,items: [.items[] | {id,name,version}]}'
```

Expect:

- HTTP `200`
- `data.items` cÃ³ template vá»«a táº¡o
- `page`, `size`, `total` há»£p lá»‡

### 6.3 PATCH /admin/exams/templates/:id - update vá»›i version

Láº¥y version hiá»‡n táº¡i:

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
    \"name\": \"Äá» thi $LICENSE_CATEGORY smoke test updated\",
    \"durationMinutes\": 25,
    \"isActive\": true
  }" | jq '.data | {id,name,durationMinutes,version}'
```

Expect:

- HTTP `200`
- `version` tÄƒng lÃªn 1
- `durationMinutes = 25`

### 6.4 PATCH stale version - expect conflict

Gá»i láº¡i version cÅ©:

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

Chá»‰ test vá»›i template chÆ°a cÃ³ session. Táº¡o template táº¡m:

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

Táº¥t cáº£ session endpoints cáº§n role `STUDENT` vÃ  owner-scope theo `JWT.sub`.

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
- má»—i question cÃ³ `questionId`, `content`, `options`, `displayOrder`, `isBookmarked`, `selectedOptionId`

### 7.3 Confidentiality check cho active questions

Active question payload khÃ´ng Ä‘Æ°á»£c leak Ä‘Ã¡p Ã¡n.

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data.items[] | keys'
```

KhÃ´ng Ä‘Æ°á»£c cÃ³:

- `correctOptionId`
- `isCritical`
- `isCorrect`
- `explanation`

Kiá»ƒm tra options:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data.items[0].options[0] | keys'
```

Expect chá»‰ cÃ³:

```json
["content", "displayOrder", "id"]
```

### 7.4 Láº¥y question/option ids Ä‘á»ƒ autosave

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
- question Ä‘Ã³ cÃ³ `selectedOptionId = OPTION_1_ID`
- `isBookmarked = true`
- response váº«n khÃ´ng cÃ³ `isCorrect`
- náº¿u session Ä‘Ã£ quÃ¡ `expiresAt`, API khÃ´ng lÆ°u answer má»›i; service tá»± grade timeout vÃ  tráº£ vá» `status = "TIMED_OUT"`

Autosave thÃªm cÃ¢u 2 vÃ  cÃ¢u 3:

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

Expect selected answer Ä‘Æ°á»£c giá»¯ nguyÃªn, bookmark Ä‘á»•i thÃ nh `true`.

### 7.7 GET /exams/sessions - history khi Ä‘ang lÃ m bÃ i

```bash
curl -s "$EXAM_BASE/exams/sessions?page=1&size=10&status=IN_PROGRESS" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {total,page,size,items: [.items[] | {id,status,score,isPassed}]}'
```

Expect cÃ³ session hiá»‡n táº¡i, `status = "IN_PROGRESS"`.

### 7.8 POST /exams/sessions/:id/submit - submit vÃ  grade

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,status,score,isPassed,failedByCritical,questions}'
```

Expect:

- HTTP `200`
- `status = "COMPLETED"` náº¿u chÆ°a háº¿t giá»
- `score` lÃ  sá»‘ cÃ¢u Ä‘Ãºng
- `criticalMistakes` lÃ  sá»‘ cÃ¢u critical sai hoáº·c bá» trá»‘ng
- `isPassed = true` náº¿u `score >= passingScore` vÃ  `criticalMistakes <= maxCriticalMistakes`
- `failedByCritical = true` náº¿u `criticalMistakes > maxCriticalMistakes`
- result payload Ä‘Æ°á»£c phÃ©p cÃ³ `questions[].isCorrect`
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

### 7.9 GET /exams/sessions/:id/result - xem káº¿t quáº£

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,status,score,isPassed,failedByCritical,questions}'
```

Expect:

- HTTP `200`
- data giá»‘ng submit result
- `questions[].isCorrect` cÃ³ giÃ¡ trá»‹ `true/false/null`
- result does not expose `correctOptionId`, `options[].isCorrect`, or `questions[].isCritical`
- náº¿u session Ä‘Ã£ quÃ¡ `expiresAt` nhÆ°ng DB váº«n Ä‘ang `IN_PROGRESS`, endpoint nÃ y tá»± finalize thÃ nh `TIMED_OUT` vÃ  tráº£ result thay vÃ¬ bÃ¡o `EXAM_SESSION_NOT_FINISHED`

### 7.10 GET /exams/sessions - history sau submit

```bash
curl -s "$EXAM_BASE/exams/sessions?page=1&size=10&status=COMPLETED" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data.items[] | {id,status,score,isPassed,failedByCritical}'
```

Expect cÃ³ session vá»«a submit.

---

## 8. Negative Scenarios

### 8.1 Student license tier mismatch

Táº¡o template license khÃ¡c:

```bash
MISMATCH_TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Äá» thi A1 mismatch",
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

Táº¡o template yÃªu cáº§u nhiá»u cÃ¢u hÆ¡n pool:

```bash
BIG_TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Äá» thi $LICENSE_CATEGORY insufficient pool\",
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

Start session má»›i:

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

### 8.4 Submit láº§n 2

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
- `code = "EXAM_SESSION_ALREADY_FINISHED"` hoáº·c domain conflict tá»« session state

### 8.6 Session timeout lazy finalization

Má»¥c tiÃªu: chá»©ng minh session háº¿t giá» Ä‘Æ°á»£c server finalize khi student gá»i `result` hoáº·c `answers`, khÃ´ng cáº§n background cron.

Start má»™t session riÃªng Ä‘á»ƒ test timeout:

```bash
TIMEOUT_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq -r '.data.id')

echo "$TIMEOUT_SESSION_ID"
```

Äá»ƒ demo nhanh, chá»‰nh `expiresAt` vá» quÃ¡ khá»© trong DB local:

```bash
docker exec -i luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db \
  -c "update exam_sessions set \"expiresAt\" = now() - interval '1 minute' where id = '$TIMEOUT_SESSION_ID';"
```

Gá»i result:

```bash
curl -s "$EXAM_BASE/exams/sessions/$TIMEOUT_SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,finishedAt,expiresAt}'
```

Expect:

- HTTP `200`
- `status = "TIMED_OUT"`
- `finishedAt` khÃ¡c `null`
- `score`, `isPassed`, `failedByCritical`, `criticalMistakes` Ä‘Ã£ Ä‘Æ°á»£c tÃ­nh
- RabbitMQ cÃ³ `exam.session.completed` vÃ  `exam.session.passed` hoáº·c `exam.session.failed`

Náº¿u gá»i autosave sau khi Ä‘Ã£ quÃ¡ háº¡n, API cÅ©ng finalize timeout vÃ  khÃ´ng apply answer má»›i:

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

Náº¿u session Ä‘Ã£ Ä‘Æ°á»£c finalize báº±ng `result` trÆ°á»›c Ä‘Ã³, autosave tiáº¿p theo cÃ³ thá»ƒ tráº£ `EXAM_SESSION_ALREADY_FINISHED`; Ä‘Ã³ lÃ  Ä‘Ãºng vÃ¬ session khÃ´ng cÃ²n `IN_PROGRESS`.

### 8.7 Student khÃ´ng Ä‘Æ°á»£c gá»i template admin endpoints

```bash
curl -s "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expect:

- HTTP `403`
- `code = "FORBIDDEN"`

### 8.8 Admin khÃ´ng Ä‘Æ°á»£c start student session

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

### 8.9 Student A khÃ´ng Ä‘Æ°á»£c Ä‘á»c session cá»§a Student B

Táº¡o student B tÆ°Æ¡ng tá»± má»¥c 4.2, login láº¥y `STUDENT_B_TOKEN`, sau Ä‘Ã³:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_B_TOKEN" | jq .
```

Expect:

- HTTP `403`
- `code = "EXAM_SESSION_UNAUTHORIZED"`

### 8.10 Delete template Ä‘Ã£ cÃ³ session

Láº¥y version template Ä‘Ã£ cÃ³ session:

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
- `code = "INVALID_EXAM_TEMPLATE"` hoáº·c `VALIDATION_ERROR`
- domain invariant: `passingScore <= totalQuestions`

---

## 9. Kiá»ƒm Tra DB VÃ  RabbitMQ

### 9.1 Kiá»ƒm tra DB exam-service

Náº¿u dÃ¹ng Docker Postgres local:

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

Kiá»ƒm tra snapshot security:

- DB cÃ³ `correctOptionId` Ä‘á»ƒ grade.
- Student active endpoints do not expose `correctOptionId` or `questions[].isCritical`.
- Result endpoint chá»‰ expose `isCorrect`, khÃ´ng expose correct answer id.

### 9.2 Kiá»ƒm tra RabbitMQ events

Sau khi submit, exam-service publish:

| Event                    | Queue target                  |
| ------------------------ | ----------------------------- |
| `exam.session.completed` | `analytics_service_events`    |
| `exam.session.passed`    | `notification_service_events` |
| `exam.session.failed`    | `notification_service_events` |

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

Failed event cÃ³ thÃªm:

```json
{
  "failedByCritical": true
}
```

---

## 10. Test Security Audit VÃ  Outbox

Má»¥c tiÃªu: chá»©ng minh admin exam-template mutations Ä‘Æ°á»£c audit báº±ng transactional outbox. Student exam session/answer flow khÃ´ng náº±m trong audit phase 1; chÃºng Ä‘Ã£ Ä‘Æ°á»£c lÆ°u nhÆ° business state trong `exam_db`.

### 10.1 Audited actions cáº§n cover

| API                                 | Expected audit action   |
| ----------------------------------- | ----------------------- |
| `POST /admin/exams/templates`       | `EXAM_TEMPLATE_CREATED` |
| `PATCH /admin/exams/templates/:id`  | `EXAM_TEMPLATE_UPDATED` |
| `DELETE /admin/exams/templates/:id` | `EXAM_TEMPLATE_DELETED` |

### 10.2 Create template vÃ  verify audit

```bash
curl -i -X POST http://localhost:8000/admin/exams/templates \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Äá» thi B1 Audit Demo",
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
- Response header cÃ³ `x-correlation-id`.
- Response body cÃ³ `data.id`; lÆ°u láº¡i thÃ nh `<template-id>`.

Verify `exam_db.outbox_messages`:

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

- `action = EXAM_TEMPLATE_CREATED`.
- `resource_type = EXAM_TEMPLATE`.
- `resource_id = <template-id>`.
- BÃ¬nh thÆ°á»ng sau vÃ i giÃ¢y `status = PUBLISHED`.

### 10.3 Update template vÃ  query centralized audit

```bash
curl -i -X PATCH http://localhost:8000/admin/exams/templates/<template-id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Äá» thi B1 Audit Demo Updated", "version": 1 }'
```

Query audit-service:

```bash
curl -s "http://localhost:8000/admin/audit-logs?serviceName=exam-service&resourceId=<template-id>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq '.data.items | map({action, resourceId, metadata, correlationId})'
```

Expected:

- CÃ³ `EXAM_TEMPLATE_CREATED`.
- CÃ³ `EXAM_TEMPLATE_UPDATED`.
- Metadata update cÃ³ `name` vÃ  `version`.

### 10.4 Delete template audit

Chá»‰ delete Ä‘Æ°á»£c template chÆ°a cÃ³ session:

```bash
curl -i -X DELETE "http://localhost:8000/admin/exams/templates/<template-id>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "version": 2 }'
```

Expected:

- HTTP `200`.
- Audit action `EXAM_TEMPLATE_DELETED`.
- Náº¿u template Ä‘Ã£ cÃ³ session, API tráº£ `EXAM_TEMPLATE_IN_USE` vÃ  khÃ´ng táº¡o success audit event phase nÃ y.

### 10.5 Outbox failure demo

```bash
docker compose stop rabbitmq

curl -i -X PATCH http://localhost:8000/admin/exams/templates/<template-id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "description": "Updated while RabbitMQ is down", "version": 2 }'
```

Expected:

- Business update váº«n commit náº¿u request path khÃ´ng cáº§n RabbitMQ trá»±c tiáº¿p.
- `exam_db.outbox_messages` cÃ³ row `PENDING` hoáº·c `FAILED`.
- Audit-service chÆ°a cÃ³ record má»›i ngay.

Start RabbitMQ:

```bash
docker compose start rabbitmq
```

Expected: pending outbox Ä‘Æ°á»£c relay vÃ  audit record xuáº¥t hiá»‡n.

---

## 11. Quality Gates

Cháº¡y háº¹p trÆ°á»›c:

```bash
pnpm --filter=exam-service run prisma:generate
pnpm --filter=exam-service run check-types
pnpm --filter=exam-service run build
```

Náº¿u cÃ³ sá»­a common/config/Kong:

```bash
pnpm run check-types
docker compose config --quiet
docker compose -f docker-compose.infra.yml config --quiet
```

Test focused náº¿u cÃ³:

```bash
pnpm --filter=exam-service run test
```

---

## 12. Troubleshooting

### 11.1 `401 UNAUTHORIZED`

NguyÃªn nhÃ¢n thÆ°á»ng gáº·p:

- Thiáº¿u `Authorization: Bearer <token>`.
- Token háº¿t háº¡n.
- Direct local váº«n cáº§n JWT vÃ¬ exam-service tá»± validate token.
- `keycloak.authServerUrl`, `realm`, `clientId` trong Consul sai.

Kiá»ƒm tra:

```bash
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/keycloak.authServerUrl?raw"
curl -s http://localhost:8080/realms/luyen-thi-lai-xe-realm/.well-known/openid-configuration | jq '.issuer'
```

### 11.2 `403 FORBIDDEN`

Kiá»ƒm tra role trong token:

- Template endpoints cáº§n `ADMIN`.
- Session endpoints cáº§n `STUDENT`.
- Question seed endpoints cáº§n `ADMIN` hoáº·c `CENTER_MANAGER`.

Náº¿u service account gá»i question-service pool fail, kiá»ƒm tra client `nestjs-backend` cÃ³ service account role phÃ¹ há»£p Ä‘á»ƒ gá»i `POST /admin/questions/pool`.

### 11.3 `STUDENT_PROFILE_INVALID`

Exam-service start session gá»i `user-service /users/me` báº±ng bearer token cá»§a student. Lá»—i nÃ y thÆ°á»ng do:

- user-service chÆ°a cháº¡y.
- profile chÆ°a Ä‘Æ°á»£c táº¡o tá»« event `identity.user.created`.
- student profile khÃ´ng active.
- role khÃ´ng pháº£i `STUDENT`.
- `studentDetail` bá»‹ thiáº¿u.

Kiá»ƒm tra:

```bash
curl -s "$USER_BASE/users/me" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

### 11.4 `STUDENT_LICENSE_MISMATCH`

License tier trong user profile khÃ¡c template:

```bash
curl -s "$USER_BASE/users/me" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data.studentDetail.licenseTier'

curl -s "$EXAM_BASE/admin/exams/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data.licenseCategory'
```

Sá»­a báº±ng:

```bash
curl -s -X PATCH "$USER_BASE/users/$STUDENT_USER_ID/license-tier" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseTier\": \"$LICENSE_CATEGORY\"
  }" -i
```

### 11.5 `INSUFFICIENT_QUESTION_POOL`

Question-service khÃ´ng cÃ³ Ä‘á»§ cÃ¢u active cho license category:

```bash
curl -s -X POST "$QUESTION_BASE/admin/questions/pool" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"size\": 3
  }" | jq '.data.items | length'
```

Cáº§n Ä‘áº£m báº£o:

- `licenseCategories` cá»§a question cÃ³ category template.
- `isActive = true`.
- Question chÆ°a bá»‹ soft delete.
- Má»—i question cÃ³ Ä‘Ãºng 1 option `isCorrect = true`.

### 11.6 Kong `502 Bad Gateway`

Kong dev route forward vá» local host port:

- exam-service: `3003`
- user-service: `3002`
- question-service: `3005`
- identity-service: `3001`

Kiá»ƒm tra service local:

```bash
curl -s http://localhost:3003/docs-json | jq '.info.title'
curl -s http://localhost:3002/docs-json | jq '.info.title'
curl -s http://localhost:3005/docs-json | jq '.info.title'
```

Kiá»ƒm tra Kong logs:

```bash
docker logs luyen-thi-lai-xe-microservices-kong-dev-1 --tail 100
```

### 11.7 Consul config stale

Náº¿u vá»«a sá»­a `.env` hoáº·c `docker/consul/init.sh`, reseed:

```bash
docker compose -f docker-compose.infra.yml up -d --force-recreate consul-init
pnpm run consul:seed:local
```

Kiá»ƒm tra key:

```bash
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/services.question.baseUrl?raw"
curl -s "http://localhost:8500/v1/kv/config/development-local/exam-service/services.user.baseUrl?raw"
```

### 11.8 Windows PowerShell note

CÃ¡c command trong guide dÃ¹ng Bash syntax. Náº¿u dÃ¹ng PowerShell:

- Thay `\` thÃ nh backtick `` ` ``.
- Thay `VAR=value` báº±ng `$env:VAR="value"` hoáº·c `$VAR="value"` tÃ¹y nhu cáº§u.
- Náº¿u `curl` bá»‹ alias sang `Invoke-WebRequest`, dÃ¹ng `curl.exe`.

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

# Identity Service â€” HÆ°á»›ng Dáº«n Test API Chi Tiáº¿t

> TÃ i liá»‡u nÃ y hÆ°á»›ng dáº«n test toÃ n bá»™ API cá»§a `identity-service`, bao gá»“m auth flow, admin user management, vÃ  xÃ¡c nháº­n event propagation sang user-service.

---

## Má»¥c lá»¥c

1. [Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng](#1-khá»Ÿi-Ä‘á»™ng-mÃ´i-trÆ°á»ng)
2. [Cáº¥u hÃ¬nh Keycloak Client](#2-cáº¥u-hÃ¬nh-keycloak-client)
3. [Test Auth Flow](#3-test-auth-flow)
4. [Test Admin User Management](#4-test-admin-user-management) â€” create, list, get, update, delete, role, lock
5. [XÃ¡c nháº­n Event Propagation](#5-xÃ¡c-nháº­n-event-propagation) â€” created, updated, role-changed, locked, deleted
6. [Test Token Blacklist (Redis)](#6-test-token-blacklist-redis)
7. [Kiá»ƒm tra Redis trá»±c tiáº¿p](#7-kiá»ƒm-tra-redis-trá»±c-tiáº¿p)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng

### BÆ°á»›c 1.1 â€” Start toÃ n bá»™ infra

```bash
# Tá»« root cá»§a project
pnpm run infra:up
```

Lá»‡nh nÃ y khá»Ÿi Ä‘á»™ng: PostgreSQL, RabbitMQ, Consul, Keycloak, Kong, **Redis**.

Chá» khoáº£ng 30-60 giÃ¢y.

**Kiá»ƒm tra cÃ¡c service healthy:**

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

### BÆ°á»›c 1.2 â€” Seed config vÃ o Consul

```bash
pnpm run consul:seed:local
```

Kiá»ƒm tra config Ä‘Ã£ Ä‘Æ°á»£c seed:

```bash
pnpm run consul:list
# Pháº£i tháº¥y: config/development-local/identity-service/redis.url
#             config/development-local/identity-service/keycloak.authServerUrl
```

### BÆ°á»›c 1.3 â€” CÃ i dependencies (láº§n Ä‘áº§u)

```bash
npm install
```

### BÆ°á»›c 1.4 â€” Cháº¡y identity-service vÃ  user-service

```bash
# Terminal 1 â€” identity-service
pnpm run dev --filter=identity-service

# Terminal 2 â€” user-service (Ä‘á»ƒ xÃ¡c nháº­n event propagation)
pnpm run dev --filter=user-service
```

Kiá»ƒm tra khá»Ÿi Ä‘á»™ng thÃ nh cÃ´ng:

```
âœ“ Identity Service listening on port 3001
âœ“ User Service listening on port 3002
```

---

## 2. Cáº¥u hÃ¬nh Keycloak Client

> **Báº¯t buá»™c** trÆ°á»›c khi test admin endpoints.

### BÆ°á»›c 2.1 â€” Má»Ÿ Keycloak Admin UI

```
http://localhost:8080
Username: admin
Password: admin
```

### BÆ°á»›c 2.2 â€” Enable Service Account cho client

1. Chá»n realm: **luyen-thi-lai-xe-realm**
2. Menu trÃ¡i: **Clients** â†’ chá»n **nestjs-backend**
3. Tab **Settings** â†’ báº­t **Service accounts roles** â†’ **Save**

### BÆ°á»›c 2.3 â€” GÃ¡n realm-management roles

1. Tab **Service accounts roles** (trÃªn cÃ¹ng client nestjs-backend)
2. Click **Assign role** â†’ Filter by client â†’ chá»n **realm-management**
3. TÃ­ch chá»n: `manage-users`, `view-realm` â†’ **Assign**

### BÆ°á»›c 2.4 â€” Táº¡o Realm Roles (náº¿u chÆ°a cÃ³)

1. Menu trÃ¡i: **Realm roles** â†’ **Create role**
2. Táº¡o láº§n lÆ°á»£t: `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

### BÆ°á»›c 2.5 â€” Táº¡o tÃ i khoáº£n admin Ä‘á»ƒ test

1. Menu trÃ¡i: **Users** â†’ **Add user**
2. Username: `admin_test`, Email: `admin@test.com`, **Save**
3. Tab **Credentials** â†’ Set Password: `Admin@123`, Temporary: OFF
4. Tab **Role mapping** â†’ Assign role: `ADMIN`

---

## 3. Test Auth Flow

### 3.1 â€” Login

```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@test.com",
    "password": "Admin@123"
  }'
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

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

> LÆ°u `accessToken` vÃ  `refreshToken` vÃ o biáº¿n mÃ´i trÆ°á»ng Ä‘á»ƒ dÃ¹ng cho cÃ¡c bÆ°á»›c tiáº¿p theo.

```bash
ACCESS_TOKEN="eyJhbGciOi..."
REFRESH_TOKEN="eyJhbGciOi..."
```

### 3.2 â€” Truy cáº­p private endpoint

```bash
curl http://localhost:3001/private \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/private",
  "data": { "message": "ChÃ o báº¡n, báº¡n Ä‘Ã£ Ä‘Äƒng nháº­p thÃ nh cÃ´ng!" }
}
```

### 3.3 â€” Refresh token

```bash
curl -X POST http://localhost:3001/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:** CÃ¹ng cáº¥u trÃºc vá»›i login, `accessToken` má»›i.

> Cáº­p nháº­t `ACCESS_TOKEN` vá»›i token má»›i.

### 3.4 â€” Forgot password

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

### 3.5 â€” Logout

Logout cáº§n cáº£ access token (header) vÃ  refresh token (body) Ä‘á»ƒ revoke toÃ n bá»™ session trÃªn Keycloak.

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

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

### 3.6 â€” XÃ¡c nháº­n access token bá»‹ blacklist

```bash
curl http://localhost:3001/private \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i `401`:**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Token has been revoked. Please log in again. (MSG131)",
  "timestamp": "...",
  "path": "/private"
}
```

### 3.7 â€” XÃ¡c nháº­n refresh token bá»‹ revoke (khÃ´ng thá»ƒ láº¥y token má»›i)

```bash
curl -X POST http://localhost:3001/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**Káº¿t quáº£ mong Ä‘á»£i `401`** â€” Keycloak tá»« chá»‘i vÃ¬ session Ä‘Ã£ bá»‹ revoke:

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Refresh token khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n",
  "timestamp": "...",
  "path": "/refresh"
}
```

---

## 4. Test Admin User Management

> Cáº§n `ACCESS_TOKEN` cá»§a tÃ i khoáº£n cÃ³ role `ADMIN`.

```bash
# Login láº¡i Ä‘á»ƒ láº¥y token má»›i (sau khi logout á»Ÿ bÆ°á»›c 3.5)
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com","password":"Admin@123"}' \
  | jq -r '.data.accessToken')
```

### 4.1 â€” Táº¡o user má»›i (STUDENT)

```bash
curl -X POST http://localhost:3001/admin/identity-users \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@gm.uit.edu.vn",
    "fullName": "Nguyá»…n VÄƒn A",
    "role": "STUDENT",
    "temporaryPassword": "Temp@1234"
  }'
```

**Káº¿t quáº£ mong Ä‘á»£i `201`:**

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
    "fullName": "Nguyá»…n VÄƒn A",
    "role": "STUDENT"
  }
}
```

> LÆ°u `userId` Ä‘á»ƒ dÃ¹ng á»Ÿ cÃ¡c bÆ°á»›c tiáº¿p theo.

```bash
USER_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

### 4.2 â€” Táº¡o user trÃ¹ng email (kiá»ƒm tra conflict)

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

**Káº¿t quáº£ mong Ä‘á»£i `400`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "User with this email already exists in Keycloak",
  "timestamp": "...",
  "path": "/admin/identity-users"
}
```

### 4.3 â€” Äá»•i role

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID/role" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "INSTRUCTOR"}'
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

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

### 4.4 â€” KhoÃ¡ tÃ i khoáº£n

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID/lock" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": true}'
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

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

### 4.5 â€” XÃ¡c nháº­n user bá»‹ khoÃ¡ khÃ´ng thá»ƒ login

```bash
# Thá»­ login báº±ng tÃ i khoáº£n vá»«a khoÃ¡
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1@gm.uit.edu.vn","password":"Temp@1234"}'
```

**Káº¿t quáº£ mong Ä‘á»£i `401`**

### 4.6 â€” Má»Ÿ khoÃ¡ tÃ i khoáº£n

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID/lock" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": false}'
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

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

### 4.7 â€” List users

```bash
curl "http://localhost:3001/admin/identity-users" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "userId": "...",
        "email": "...",
        "role": "...",
        "isActive": true,
        "isDeleted": false
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

Thá»­ filter: `?role=STUDENT`, `?isActive=true`, `?search=student1`, `?includeDeleted=true`.

### 4.8 â€” Get user by ID

```bash
curl "http://localhost:3001/admin/identity-users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:** object `IdentityUserResponseDto` vá»›i `userId`, `email`, `fullName`, `role`, `isActive`, `isDeleted`, `createdAt`, `updatedAt`.

### 4.9 â€” Cáº­p nháº­t user (email + fullName)

```bash
curl -X PATCH "http://localhost:3001/admin/identity-users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "student1-updated@gm.uit.edu.vn", "fullName": "Nguyá»…n VÄƒn A (updated)"}'
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:** object vá»›i `email` vÃ  `fullName` Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t.

> Sau bÆ°á»›c nÃ y, user-service sáº½ nháº­n event `identity.user.updated` vÃ  Ä‘á»“ng bá»™ email/fullName trong `UserProfile`.

### 4.10 â€” Soft delete user

```bash
curl -X DELETE "http://localhost:3001/admin/identity-users/$USER_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deletedById": "<admin_keycloak_id>"}'
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:** object vá»›i `isDeleted: true`, `isActive: false`, `deletedAt` cÃ³ giÃ¡ trá»‹.

> Sau bÆ°á»›c nÃ y, user-service nháº­n event `identity.user.deleted` vÃ  set `isActive = false` trong `UserProfile`.

### 4.11 â€” Test khÃ´ng Ä‘á»§ quyá»n (dÃ¹ng STUDENT token)

```bash
# Táº¡o student token (náº¿u student Ä‘Ã£ Ä‘á»•i password)
STUDENT_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1@gm.uit.edu.vn","password":"<new_password>"}' \
  | jq -r '.data.accessToken')

curl -X POST http://localhost:3001/admin/identity-users \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@test.com","fullName":"X","role":"STUDENT","temporaryPassword":"Pass@123"}'
```

**Káº¿t quáº£ mong Ä‘á»£i `403`**

---

## 5. XÃ¡c nháº­n Event Propagation

Sau khi táº¡o user á»Ÿ bÆ°á»›c 4.1, user-service pháº£i tá»± Ä‘á»™ng táº¡o `UserProfile`.

### 5.1 â€” Kiá»ƒm tra UserProfile Ä‘Æ°á»£c táº¡o

```bash
# Cáº§n ADMIN token; user-service Ä‘á»c actor tá»« JWT.sub.
# Gá»i trá»±c tiáº¿p user-service (port 3002)
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i `200`:**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/users/...",
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "fullName": "Nguyá»…n VÄƒn A",
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

> Náº¿u `404` sau 2-3 giÃ¢y, kiá»ƒm tra RabbitMQ vÃ  user-service logs.

### 5.2 â€” Kiá»ƒm tra event role-changed

Sau bÆ°á»›c 4.3 (Ä‘á»•i sang INSTRUCTOR):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i:** `"role": "INSTRUCTOR"`, `"studentDetail": null`

### 5.3 â€” Kiá»ƒm tra event identity.user.updated

Sau bÆ°á»›c 4.9 (cáº­p nháº­t email + fullName):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i:** `"email": "student1-updated@gm.uit.edu.vn"`, `"fullName": "Nguyá»…n VÄƒn A (updated)"`.

### 5.4 â€” Kiá»ƒm tra event identity.user.locked

Sau bÆ°á»›c 4.4 (lock user):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i:** `"isActive": false`.

Sau bÆ°á»›c 4.6 (unlock):

**Káº¿t quáº£ mong Ä‘á»£i:** `"isActive": true`.

### 5.5 â€” Kiá»ƒm tra event identity.user.deleted

Sau bÆ°á»›c 4.10 (soft delete):

```bash
curl "http://localhost:3002/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Káº¿t quáº£ mong Ä‘á»£i:** `"isActive": false` (profile bá»‹ deactivate nhÆ°ng váº«n tá»“n táº¡i trong user-service).

### 5.6 â€” Theo dÃµi RabbitMQ events

Má»Ÿ RabbitMQ Management: http://localhost:15672 (guest/guest)

- Tab **Queues** â†’ `user_service_events` â†’ **Get messages** â†’ xem payload events
- Tab **Queues** â†’ `notification_queue` â†’ tÆ°Æ¡ng tá»±

---

## 6. Test Token Blacklist (Redis)

### 6.1 â€” Logout vÃ  verify blacklist trong Redis

```bash
# Login
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com","password":"Admin@123"}' \
  | jq -r '.data.accessToken')

# Láº¥y jti tá»« JWT payload
JTI=$(echo $ACCESS_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.jti')
echo "JTI: $JTI"

# Logout (cáº§n cáº£ access token + refresh token)
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# Kiá»ƒm tra Redis
redis-cli GET "bl:$JTI"
# Káº¿t quáº£ mong Ä‘á»£i: "1"

redis-cli TTL "bl:$JTI"
# Káº¿t quáº£ mong Ä‘á»£i: sá»‘ giÃ¢y cÃ²n láº¡i cá»§a token
```

### 6.2 â€” Restart service, token váº«n bá»‹ blacklist

```bash
# Restart identity-service
# (Ctrl+C terminal 1, rá»“i pnpm run dev --filter=identity-service)

# Thá»­ dÃ¹ng token Ä‘Ã£ logout
curl http://localhost:3001/private \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Káº¿t quáº£ mong Ä‘á»£i: 401 (Redis váº«n giá»¯ key sau restart)
```

---

## 7. Kiá»ƒm tra Redis trá»±c tiáº¿p

```bash
# Káº¿t ná»‘i Redis CLI
redis-cli

# Xem táº¥t cáº£ blacklist keys
KEYS bl:*

# Xem TTL cá»§a má»™t key cá»¥ thá»ƒ
TTL bl:<jti>

# Sá»‘ keys trong blacklist
DBSIZE
```

---

## 8. Troubleshooting

### identity-service khÃ´ng start Ä‘Æ°á»£c

```bash
# Kiá»ƒm tra Consul cÃ³ Ä‘ang cháº¡y
curl http://localhost:8500/v1/status/leader

# Kiá»ƒm tra Redis cÃ³ Ä‘ang cháº¡y
redis-cli ping

# Kiá»ƒm tra logs
pnpm run dev --filter=identity-service 2>&1 | head -50
```

### Admin API tráº£ vá» 500 "Failed to obtain Keycloak admin token"

â†’ Client `nestjs-backend` chÆ°a enable Service Accounts. Xem [BÆ°á»›c 2.2](#bÆ°á»›c-22--enable-service-account-cho-client).

### Admin API tráº£ vá» 500 "Keycloak createUser failed"

â†’ Service account chÆ°a cÃ³ `manage-users` role. Xem [BÆ°á»›c 2.3](#bÆ°á»›c-23--gÃ¡n-realm-management-roles).

### user-service khÃ´ng nháº­n Ä‘Æ°á»£c event (UserProfile khÃ´ng Ä‘Æ°á»£c táº¡o)

```bash
# Kiá»ƒm tra queue user_service_events cÃ³ tá»“n táº¡i
curl http://localhost:15672/api/queues/%2F/user_service_events \
  -u guest:guest | jq '.messages'

# Kiá»ƒm tra user-service Ä‘ang consume queue
# Má»Ÿ http://localhost:15672 â†’ Queues â†’ user_service_events â†’ Consumers
```

â†’ Náº¿u queue chÆ°a tá»“n táº¡i: user-service chÆ°a start hoáº·c chÆ°a connect RabbitMQ.

### Token blacklist khÃ´ng hoáº¡t Ä‘á»™ng sau restart

â†’ Kiá»ƒm tra `redis.url` trong Consul:

```bash
curl http://localhost:8500/v1/kv/config/development-local/identity-service/redis.url?raw
# Káº¿t quáº£ mong Ä‘á»£i: redis://localhost:6379
```

### Lá»—i "Role 'STUDENT' not found in Keycloak realm"

â†’ Realm roles chÆ°a Ä‘Æ°á»£c táº¡o. Xem [BÆ°á»›c 2.4](#bÆ°á»›c-24--táº¡o-realm-roles-náº¿u-chÆ°a-cÃ³).

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

Root `.env` cáº§n cÃ³ `FCM_CREDENTIALS` lÃ  Firebase service-account JSON trÃªn má»™t dÃ²ng. KhÃ´ng commit file JSON credential rá»i vÃ o repo.

Sau khi cáº­p nháº­t `.env`, seed láº¡i Consul rá»“i restart notification-service:

```powershell
pnpm run consul:seed:local
pnpm --filter=notification-service run start:dev
```

Náº¿u `FCM_CREDENTIALS` trá»‘ng, service váº«n cháº¡y vÃ  PUSH sáº½ Ä‘Æ°á»£c skip cÃ³ kiá»ƒm soÃ¡t. In-app/email khÃ´ng bá»‹ áº£nh hÆ°á»Ÿng.

## Frontend Device Token Flow

TrÃªn thiáº¿t bá»‹ tháº­t hoáº·c emulator cÃ³ Firebase Messaging:

1. Cáº¥u hÃ¬nh Firebase app:
   - Android: thÃªm `google-services.json`.
   - iOS: thÃªm `GoogleService-Info.plist` vÃ  cáº¥u hÃ¬nh APNs key/certificate trong Firebase Console.
2. Xin quyá»n notification tá»« há»‡ Ä‘iá»u hÃ nh.
3. Láº¥y FCM registration token tá»« Firebase Messaging SDK.
4. ÄÄƒng kÃ½ token vá»›i backend:

```http
POST http://localhost:3006/notifications/devices
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "token": "<fcm_registration_token>",
  "platform": "android"
}
```

5. Khi Firebase refresh token, gá»i láº¡i endpoint trÃªn vá»›i token má»›i.
6. Khi logout hoáº·c táº¯t push, URL-encode token rá»“i há»§y Ä‘Äƒng kÃ½:

```http
DELETE http://localhost:3006/notifications/devices/<url_encoded_fcm_registration_token>
Authorization: Bearer <student_token>
```

Foreground test: app cáº§n tá»± hiá»ƒn thá»‹ local notification náº¿u muá»‘n tháº¥y banner khi Ä‘ang má»Ÿ app. Background/quit test: Ä‘Æ°a app xuá»‘ng background, trigger event cÃ³ kÃªnh PUSH, rá»“i kiá»ƒm tra system tray cá»§a thiáº¿t bá»‹.

## Send Academic Warning

```http
POST http://localhost:3006/admin/academic-warnings
Authorization: Bearer <admin_or_instructor_token>
Content-Type: application/json

{
  "studentId": "<studentId>",
  "reason": "LOW_EXAM_SCORE",
  "severity": "HIGH",
  "message": "Báº¡n cáº§n Ã´n láº¡i nhÃ³m cÃ¢u há»i thÆ°á»ng sai trÆ°á»›c khi thi tiáº¿p."
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
import { io } from "socket.io-client";

const socket = io("http://localhost:3006/notifications", {
  path: "/notifications/socket.io",
  auth: { token: process.env.STUDENT_TOKEN },
});

socket.on("notification.connected", console.log);
socket.on("notification.created", console.log);
socket.on("notification.unread_count.updated", console.log);
socket.on("notification.auth_failed", console.error);
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

# Question Service - HÆ°á»›ng Dáº«n Test API Chi Tiáº¿t

> TÃ i liá»‡u nÃ y hÆ°á»›ng dáº«n test API cá»§a `question-service` khi gá»i trá»±c tiáº¿p local port 3005 vÃ  khi gá»i qua Kong.

---

## 1. Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng

### 1.1 Start infra

```bash
pnpm run infra:up
pnpm run consul:seed:local
```

Kiá»ƒm tra Consul:

```bash
curl http://localhost:8500/v1/status/leader
```

`pnpm run infra:up` dÃ¹ng `docker-compose.infra.yml` cho hybrid mode, gá»“m:

- PostgreSQL databases: `5432..5440`
- RabbitMQ: `5672`, UI `15672`
- Redis: `6379`
- Consul: `8500`
- Keycloak: `8080`
- Kong dev gateway: proxy `8000`, admin `8001`
- ELK: Elasticsearch `9200`, Logstash `5044`, Kibana `5601`

Kiá»ƒm tra nhanh:

```bash
docker compose -f docker-compose.infra.yml ps
curl -s http://localhost:8001/services | jq '.data | map(.name)'
curl -s http://localhost:9200/_cluster/health | jq .
curl -I http://localhost:5601
```

Náº¿u chá»‰ muá»‘n báº­t riÃªng ELK:

```bash
docker compose -f docker-compose.infra.yml up -d elasticsearch logstash kibana
```

### 1.2 Generate vÃ  migrate database

```bash
cd apps/question-service
pnpm run db:generate
pnpm run db:migrate
```

Náº¿u migration Ä‘Ã£ tá»“n táº¡i:

```bash
cd apps/question-service
pnpm run db:deploy
```

### 1.3 Seed question topics and questions

Seed 6 topic gá»‘c vÃ  toÃ n bá»™ 600 cÃ¢u há»i tá»« `seed/600-cau-hoi.docx`:

```bash
cd apps/question-service
pnpm run db:seed
```

Hoáº·c cháº¡y tá»« root:

```bash
pnpm run db:seed:question
```

Khi nhiá»u service cÃ³ seed riÃªng, cháº¡y toÃ n bá»™ seed tá»« root:

```bash
pnpm run db:seed
```

Seed nÃ y idempotent, cÃ³ thá»ƒ cháº¡y láº¡i nhiá»u láº§n mÃ  khÃ´ng táº¡o trÃ¹ng topic/question/option.
CÃ¡c cÃ¢u cÃ³ hÃ¬nh váº«n Ä‘Æ°á»£c seed pháº§n text vÃ  Ä‘Ã¡p Ã¡n; cháº¡y seed áº£nh á»Ÿ bÆ°á»›c káº¿ tiáº¿p Ä‘á»ƒ upload Azure vÃ  link `imageUrl`/`mediaFileId`.

Seed áº£nh nhÃºng tá»« DOCX lÃªn Azure Blob Storage vÃ  link vÃ o question:

```bash
pnpm run db:seed:question-images
```

Seed áº£nh cáº§n config `media-service` trong Consul: `storage.accountName`, `storage.accountKey`, `storage.containerName`, cÃ¹ng database URL cá»§a `question-service` vÃ  `media-service`. Frontend nÃªn dÃ¹ng `mediaFileId` Ä‘á»ƒ gá»i `GET /media/files/:id/url` láº¥y presigned URL rá»“i render áº£nh.

Kiá»ƒm tra nhanh sau khi start service:

```bash
curl -s "http://localhost:3005/admin/questions/topics?page=1&size=20" | jq '.data | {total, topics: [.items[] | {name, description}]}'
curl -s "http://localhost:3005/admin/questions?page=1&size=1" | jq '.data.total'
curl -s "http://localhost:3005/admin/questions?type=TRAFFIC_SIGN&page=1&size=5" | jq '.data.items[] | {id, imageUrl, mediaFileId}'
```

Expect cÃ³ 6 topic gá»‘c:

- Quy Ä‘á»‹nh chung vÃ  quy táº¯c giao thÃ´ng Ä‘Æ°á»ng bá»™
- VÄƒn hÃ³a giao thÃ´ng, Ä‘áº¡o Ä‘á»©c ngÆ°á»i lÃ¡i xe, ká»¹ nÄƒng PCCC vÃ  cá»©u há»™ cá»©u náº¡n
- Ká»¹ thuáº­t lÃ¡i xe
- Cáº¥u táº¡o vÃ  sá»­a chá»¯a
- BÃ¡o hiá»‡u Ä‘Æ°á»ng bá»™
- Giáº£i tháº¿ sa hÃ¬nh vÃ  ká»¹ nÄƒng xá»­ lÃ½ tÃ¬nh huá»‘ng giao thÃ´ng

Expect question total lÃ  `600`.

Verify critical-question seed in `question_db`:

```sql
select count(*) as critical_total
from questions
where "isCritical" = true
  and "isDeleted" = false;

select qt.description, count(q.id) as critical_count
from questions q
join question_topics qt on qt.id = q."topicId"
where q."isCritical" = true
  and q."isDeleted" = false
group by qt.id, qt.description
order by min(qt.description);
```

Expected critical total is `60`. By seeded topic ranges, expected critical counts are `47 / 2 / 11 / 0 / 0 / 0`. If an exam template has `criticalQuestions > 0`, its `topicDistribution` must include topic 1, 2, or 3; topics 4-6 do not contain critical questions.

### 1.4 Start question-service

```bash
pnpm run dev --filter=question-service
```

Kiá»ƒm tra:

```bash
curl http://localhost:3005/docs-json
```

Swagger UI: http://localhost:3005/docs

---

## 2. Request Flow

```
Client
  |-- DIRECT --> http://localhost:3005
  |              Æ¯u tiÃªn JWT tháº­t; x-user-id chá»‰ lÃ  fallback legacy
  |
  |-- KONG ----> http://localhost:8000/admin/questions
                 Service Ä‘á»c actor tá»« JWT.sub
```

Trong local hybrid mode, Kong container `kong-dev` Ä‘á»c `kong/kong.dev.yaml` vÃ  forward `/admin/questions` vá» `host.docker.internal:3005`. VÃ¬ váº­y frontend/Postman nÃªn test qua `http://localhost:8000` Ä‘á»ƒ giá»‘ng production path hÆ¡n. CÃ¡c lá»‡nh `x-user-id` trong guide nÃ y chá»‰ cÃ²n dÃ¹ng cho debug legacy; frontend/demo chuáº©n gá»­i `Authorization: Bearer <access_token>`.

Kiá»ƒm tra Kong Ä‘Ã£ náº¡p route:

```bash
curl -s http://localhost:8001/routes | jq '.data[] | {name, paths}'
curl -s http://localhost:8001/services/question-service | jq .
```

Kiá»ƒm tra Swagger qua Kong:

```bash
curl -s http://localhost:8000/question-service/docs-json | jq '.info.title'
```

Kiá»ƒm tra API qua Kong:

```bash
curl -s "http://localhost:8000/admin/questions?page=1&size=5" | jq .
```

Náº¿u gá»i qua Kong bá»‹ `502`, thá»­:

```bash
curl -s http://localhost:3005/docs-json | jq '.info.title'
docker logs luyen-thi-lai-xe-microservices-kong-dev-1 --tail 100
```

`502` thÆ°á»ng cÃ³ nghÄ©a question-service local chÆ°a cháº¡y á»Ÿ port 3005 hoáº·c Kong container khÃ´ng reach Ä‘Æ°á»£c `host.docker.internal`.

---

## 3. Biáº¿n mÃ´i trÆ°á»ng test

```bash
BASE="http://localhost:3005"
KONG_BASE="http://localhost:8000"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"
```

---

## 4. Test Topic Endpoints

### 4.1 Táº¡o topic

```bash
TOPIC_ID=$(curl -s -X POST "$BASE/admin/questions/topics" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Biá»ƒn bÃ¡o giao thÃ´ng",
    "description": "CÃ¢u há»i vá» biá»ƒn bÃ¡o"
  }' | jq -r '.data.id')

echo "TOPIC_ID=$TOPIC_ID"
```

Expect `201 Created`, response cÃ³ `data.id`.

Qua Kong thÃ¬ Ä‘á»•i `$BASE` thÃ nh `$KONG_BASE`:

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
  -d '{"description":"MÃ´ táº£ má»›i"}' | jq '.data.description'
```

---

## 5. Test Question Endpoints

### 5.1 Táº¡o question

```bash
QUESTION_ID=$(curl -s -X POST "$BASE/admin/questions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $ADMIN_ID" \
  -d "{
    \"content\": \"Khi gáº·p Ä‘Ã¨n Ä‘á», ngÆ°á»i lÃ¡i xe pháº£i lÃ m gÃ¬?\",
    \"type\": \"THEORY\",
    \"licenseCategories\": [\"B2\"],
    \"difficulty\": \"EASY\",
    \"explanation\": \"ÄÃ¨n Ä‘á» yÃªu cáº§u dá»«ng láº¡i trÆ°á»›c váº¡ch dá»«ng.\",
    \"mediaFileId\": null,
    \"isCritical\": false,
    \"topicId\": \"$TOPIC_ID\",
    \"options\": [
      { \"content\": \"Dá»«ng láº¡i\", \"isCorrect\": true, \"displayOrder\": 1 },
      { \"content\": \"Äi tiáº¿p\", \"isCorrect\": false, \"displayOrder\": 2 }
    ]
  }" | jq -r '.data.id')

echo "QUESTION_ID=$QUESTION_ID"
```

Táº¡o question qua Kong:

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

### 5.2 Validation: khÃ´ng cÃ³ Ä‘Ãºng 1 Ä‘Ã¡p Ã¡n Ä‘Ãºng

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

### 5.5 Update question vá»›i version Ä‘Ãºng

```bash
VERSION=$(curl -s "$BASE/admin/questions/$QUESTION_ID" | jq -r '.data.version')

curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": $VERSION,
    \"difficulty\": \"MEDIUM\",
    \"explanation\": \"Giáº£i thÃ­ch Ä‘Ã£ cáº­p nháº­t\"
  }" | jq '.data | {difficulty, explanation, version}'
```

Expect `version` tÄƒng lÃªn 1.

### 5.6 Version conflict

```bash
curl -s -X PATCH "$BASE/admin/questions/$QUESTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "content": "Update báº±ng version cÅ©"
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

Kiá»ƒm tra RabbitMQ queue `question_service_publish` cÃ³ event `question.deactivated`.

### 5.8 Gáº¯n áº£nh tá»« media-service

Upload/initiate file qua media-service trÆ°á»›c Ä‘á»ƒ láº¥y `mediaFileId`, sau Ä‘Ã³ táº¡o hoáº·c update question vá»›i `mediaFileId`.

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

Expect question-service publish event `question.image.linked` vÃ o queue `media_service_events`; media-service consume event vÃ  mark FileObject `LINKED`. Question-service chá»‰ lÆ°u UUID reference, khÃ´ng gá»i trá»±c tiáº¿p Azure Blob.

### 5.9 Question pool

Táº¡o thÃªm question active náº¿u question trÃªn Ä‘Ã£ deactivate, sau Ä‘Ã³:

```bash
curl -s -X POST "$BASE/admin/questions/pool" \
  -H "Content-Type: application/json" \
  -d '{
    "licenseCategory": "B2",
    "size": 10,
    "type": "THEORY"
  }' | jq '.data.items | map({id, isActive, isDeleted, options})'
```

Expect chá»‰ tráº£ vá» question `isActive=true`, `isDeleted=false`. Pool response cÃ³ `options[].isCorrect` Ä‘á»ƒ exam-service snapshot/grade ná»™i bá»™.

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

Máº·c Ä‘á»‹nh list khÃ´ng tráº£ vá» question Ä‘Ã£ xÃ³a:

```bash
curl -s "$BASE/admin/questions" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

Náº¿u cáº§n debug:

```bash
curl -s "$BASE/admin/questions?includeDeleted=true" | jq ".data.items | map(select(.id == \"$QUESTION_ID\"))"
```

---

## 6. Test RabbitMQ Events

RabbitMQ UI: http://localhost:15672  
Username/password: `guest` / `guest`

Queues liÃªn quan:

- `question_service_events`: queue consume cá»§a question-service
- `question_service_publish`: queue publish domain events

Sau `POST /admin/questions`, kiá»ƒm tra `question.created`.

Sau deactivate hoáº·c delete, kiá»ƒm tra `question.deactivated`.

Sau create/update cÃ³ `mediaFileId`, kiá»ƒm tra event `question.image.linked` trong `media_service_events` vÃ  FileObject chuyá»ƒn sang `LINKED`.

---

## 7. Kiá»ƒm tra Database

### Prisma Studio

```bash
cd apps/question-service
pnpm run db:studio
```

Má»Ÿ http://localhost:5555 vÃ  xem:

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

### Prisma client chÆ°a generate

```bash
cd apps/question-service
pnpm run db:generate
```

### Database chÆ°a sáºµn sÃ ng

```bash
pnpm run infra:up
pnpm run consul:seed:local
```

### `QUESTION_TOPIC_NOT_FOUND`

Táº¡o topic trÆ°á»›c khi táº¡o question, hoáº·c kiá»ƒm tra `topicId`.

### `QUESTION_VERSION_CONFLICT`

Client Ä‘ang gá»­i version cÅ©. Gá»i `GET /admin/questions/:id` Ä‘á»ƒ láº¥y version má»›i nháº¥t rá»“i retry.

### Pool khÃ´ng cÃ³ items

Kiá»ƒm tra question pháº£i:

- `isActive=true`
- `isDeleted=false`
- cÃ³ `licenseCategories` chá»©a license Ä‘ang query
- khá»›p `type`, `difficulty`, `topicId` náº¿u cÃ³ filter

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

# User Service â€” HÆ°á»›ng Dáº«n Test API Chi Tiáº¿t

> TÃ i liá»‡u nÃ y hÆ°á»›ng dáº«n test toÃ n bá»™ API cá»§a `user-service`, cáº£ khi gá»i **trá»±c tiáº¿p** (bá» qua Kong, dÃ¹ng cho dev/debug) láº«n khi gá»i **qua Kong** (production path).

---

## Má»¥c lá»¥c

1. [Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng](#1-khá»Ÿi-Ä‘á»™ng-mÃ´i-trÆ°á»ng)
2. [Kiáº¿n trÃºc luá»“ng request](#2-kiáº¿n-trÃºc-luá»“ng-request)
3. [Chuáº©n bá»‹ â€” Táº¡o dá»¯ liá»‡u máº«u trá»±c tiáº¿p](#3-chuáº©n-bá»‹--táº¡o-dá»¯-liá»‡u-máº«u-trá»±c-tiáº¿p)
4. [Test tá»«ng endpoint](#4-test-tá»«ng-endpoint)
5. [Test luá»“ng RabbitMQ event](#5-test-luá»“ng-rabbitmq-event)
6. [Test qua Kong (production path)](#6-test-qua-kong-production-path)
7. [Kiá»ƒm tra Database trá»±c tiáº¿p](#7-kiá»ƒm-tra-database-trá»±c-tiáº¿p)
8. [Test Security Audit VÃ  Outbox](#8-test-security-audit-vÃ -outbox)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Khá»Ÿi Ä‘á»™ng mÃ´i trÆ°á»ng

### BÆ°á»›c 1.1 â€” Start infrastructure (DB + RabbitMQ + Consul)

```bash
# Tá»« root cá»§a project
docker-compose up -d db-user rabbitmq consul consul-init
```

Chá» khoáº£ng 10-15 giÃ¢y Ä‘á»ƒ Consul khá»Ÿi Ä‘á»™ng xong.

**Kiá»ƒm tra Consul healthy:**

```bash
curl http://localhost:8500/v1/status/leader
# Káº¿t quáº£ mong Ä‘á»£i: "..." (Ä‘á»‹a chá»‰ leader node)
```

**Consul UI:** http://localhost:8500/ui

### BÆ°á»›c 1.2 â€” Seed config vÃ o Consul

```bash
pnpm run consul:seed:local
```

Lá»‡nh nÃ y Ä‘á»c `consul-seed-development-local.json` vÃ  Ä‘áº©y config vÃ o Consul KV store.

**Kiá»ƒm tra:**

```bash
pnpm run consul:list
# Hoáº·c xem trá»±c tiáº¿p: http://localhost:8500/ui/dc1/kv
```

Sau khi seed thÃ nh cÃ´ng, báº¡n sáº½ tháº¥y cÃ¡c key nhÆ°:

- `config/development-local/shared/log.level`
- `config/development-local/user-service/port`
- `config/development-local/user-service/database.url`

### BÆ°á»›c 1.3 â€” Migrate database

```bash
cd apps/user-service
npx prisma migrate dev --name init
```

Hoáº·c náº¿u migration Ä‘Ã£ tá»“n táº¡i:

```bash
cd apps/user-service
npx prisma migrate deploy
```

**Kiá»ƒm tra schema Ä‘Ã£ táº¡o:**

```bash
npx prisma studio
# Má»Ÿ browser táº¡i http://localhost:5555 Ä‘á»ƒ xem DB
```

### BÆ°á»›c 1.4 â€” Start user-service

```bash
# Tá»« root
pnpm run dev --filter=user-service

# Hoáº·c vÃ o thÆ° má»¥c service
cd apps/user-service
pnpm run start:dev
```

**Kiá»ƒm tra service Ä‘ang cháº¡y:**

```bash
curl http://localhost:3002/docs-json
# Káº¿t quáº£: OpenAPI JSON spec
```

**Swagger UI:** http://localhost:3002/docs

---

## 2. Kiáº¿n trÃºc luá»“ng request

```
Client (curl/Postman)
    â”‚
    â”œâ”€â”€â”€ DIRECT (dev/debug) â”€â”€â†’ http://localhost:3002  â†â”€â”€ Port user-service local
    â”‚                            (Æ¯u tiÃªn JWT tháº­t; x-user-id chá»‰ lÃ  fallback legacy)
    â”‚
    â””â”€â”€â”€ VIA KONG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â†’ http://localhost:8000  â†â”€â”€ Kong gateway
                                 (Cáº§n JWT há»£p lá»‡ tá»« Keycloak)
                                 Service Ä‘á»c actor tá»« JWT.sub
```

> **LÆ°u Ã½:** user-service hiá»‡n validate JWT/RBAC táº¡i service vÃ  Ä‘á»c actor tá»« `@AuthenticatedUser()`. Middleware váº«n cÃ³ thá»ƒ map `JWT.sub` sang `x-user-id` Ä‘á»ƒ tÆ°Æ¡ng thÃ­ch code cÅ©, nhÆ°ng frontend/demo chuáº©n khÃ´ng tá»± gá»­i `x-user-id`.

---

## 3. Chuáº©n bá»‹ â€” Táº¡o dá»¯ liá»‡u máº«u trá»±c tiáº¿p

TrÆ°á»›c khi test, cáº§n cÃ³ Ã­t nháº¥t 1 user trong DB. Production flow nÃªn táº¡o account qua `identity-service` admin API Ä‘á»ƒ publish RabbitMQ event `identity.user.created`; user-service cÅ©ng expose `POST /admin/users` cho ADMIN/CENTER_MANAGER khi cáº§n backfill profile vá»›i Keycloak user id Ä‘Ã£ cÃ³.

CÃ¡c lá»‡nh `POST http://localhost:3001/admin/identity-users` bÃªn dÆ°á»›i cáº§n thÃªm header `Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>` khi cháº¡y vá»›i guard Keycloak.

### Táº¡o user ADMIN

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyá»…n Admin",
    "email": "admin@example.com",
    "role": "ADMIN",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
  "data": {
    "id": "admin-uuid-0001",
    "fullName": "Nguyá»…n Admin",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

### Táº¡o user CENTER_MANAGER

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Tráº§n Manager",
    "email": "manager@example.com",
    "role": "CENTER_MANAGER",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

### Táº¡o user STUDENT (vá»›i Ä‘áº§y Ä‘á»§ thÃ´ng tin)

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "LÃª Há»c ViÃªn",
    "email": "student@example.com",
    "role": "STUDENT",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (201):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
  "data": {
    "id": "student-uuid-0003",
    "fullName": "LÃª Há»c ViÃªn",
    "email": "student@example.com",
    "role": "STUDENT"
  }
}
```

### Táº¡o user INSTRUCTOR

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Pháº¡m GiÃ¡o ViÃªn",
    "email": "instructor@example.com",
    "role": "INSTRUCTOR",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

---

## 4. Test tá»«ng endpoint

> Táº¥t cáº£ cÃ¡c lá»‡nh curl sau Ä‘Ã¢y gá»i **trá»±c tiáº¿p** vÃ o user-service (port 3002), khÃ´ng qua Kong. Khi demo chuáº©n, dÃ¹ng `Authorization: Bearer <access_token>`. CÃ¡c vÃ­ dá»¥ cÃ²n dÃ¹ng `x-user-id` lÃ  debug legacy cho endpoint/case cÅ©, khÃ´ng pháº£i contract cho frontend.

---

### 4.1 POST /admin/users â€” táº¡o user profile

**Happy path â€” táº¡o profile trá»±c tiáº¿p báº±ng Keycloak user id Ä‘Ã£ cÃ³**

```bash
curl -s -X POST http://localhost:3002/users \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "keycloak-user-uuid",
    "fullName": "LÃª Há»c ViÃªn",
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

Best practice: khÃ´ng dÃ¹ng endpoint nÃ y Ä‘á»ƒ táº¡o account Ä‘Äƒng nháº­p; account váº«n pháº£i Ä‘Æ°á»£c táº¡o á»Ÿ identity-service/Keycloak trÆ°á»›c.

**Case: Email Ä‘Ã£ tá»“n táº¡i (expect 409)**

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "NgÆ°á»i KhÃ¡c",
    "email": "admin@example.com",
    "role": "ADMIN",
    "temporaryPassword": "Temp@1234"
  }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (409):**

```json
{
  "success": false,
  "code": "USER_ALREADY_EXISTS",
  "message": "User with email admin@example.com already exists",
  "timestamp": "...",
  "path": "/users"
}
```

**Case: Body thiáº¿u field báº¯t buá»™c (expect 400)**

```bash
curl -s -X POST http://localhost:3001/admin/identity-users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Thiáº¿u email"
  }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (400):**

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

### 4.2 GET /admin/users â€” Danh sÃ¡ch user profile (cÃ³ phÃ¢n trang + filter)

**Láº¥y táº¥t cáº£ users (page 1, size 20):**

```bash
curl -s "http://localhost:3002/users" | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (200):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users",
  "data": {
    "items": [
      /* máº£ng UserProfileResponse */
    ],
    "total": 4,
    "page": 1,
    "size": 20
  }
}
```

**Lá»c theo role STUDENT:**

```bash
curl -s "http://localhost:3002/admin/users?role=STUDENT" | jq .
```

**Lá»c theo isActive:**

```bash
curl -s "http://localhost:3002/admin/users?isActive=true" | jq .
```

**TÃ¬m kiáº¿m theo tÃªn/email/SÄT:**

```bash
curl -s "http://localhost:3002/admin/users?search=Há»c+ViÃªn" | jq .
curl -s "http://localhost:3002/admin/users?search=student@" | jq .
```

**PhÃ¢n trang:**

```bash
curl -s "http://localhost:3002/admin/users?page=1&size=2" | jq .
curl -s "http://localhost:3002/admin/users?page=2&size=2" | jq .
```

**Káº¿t há»£p filter:**

```bash
curl -s "http://localhost:3002/admin/users?role=STUDENT&isActive=true&page=1&size=10" | jq .
```

**Case: size vÆ°á»£t giá»›i háº¡n (expect 400):**

```bash
curl -s "http://localhost:3002/admin/users?size=200" | jq .
```

---

### 4.3 GET /users/me â€” Láº¥y profile cá»§a chÃ­nh mÃ¬nh

> Endpoint nÃ y láº¥y user hiá»‡n táº¡i tá»« `JWT.sub` qua `@AuthenticatedUser()`.

**Happy path:**

```bash
curl -s http://localhost:3002/users/me \
  -H "Authorization: Bearer <STUDENT_TOKEN>" | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (200):**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "path": "/users/me",
  "data": {
    "id": "student-uuid-0003",
    "fullName": "LÃª Há»c ViÃªn",
    "email": "student@example.com",
    "phoneNumber": "0912345678",
    "dateOfBirth": "2000-01-15T00:00:00.000Z",
    "avatarUrl": null,
    "gender": "MALE",
    "address": "123 ÄÆ°á»ng ABC, TP.HCM",
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

**Case: token há»£p lá»‡ nhÆ°ng profile tÆ°Æ¡ng á»©ng chÆ°a tá»“n táº¡i (expect 404):**

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

### 4.4 GET /admin/users/:id â€” Láº¥y profile theo ID

**Happy path:**

```bash
curl -s http://localhost:3002/admin/users/admin-uuid-0001 | jq .
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq .
```

**So sÃ¡nh studentDetail:**

- User ADMIN/INSTRUCTOR: `studentDetail: null`
- User STUDENT: `studentDetail: { licenseTier, enrolledAt, notes }`

**Case: ID khÃ´ng tá»“n táº¡i (expect 404):**

```bash
curl -s http://localhost:3002/admin/users/does-not-exist | jq .
```

---

### 4.5 PATCH /users/me â€” Cáº­p nháº­t profile báº£n thÃ¢n

> User Ä‘Æ°á»£c xÃ¡c Ä‘á»‹nh báº±ng `JWT.sub`.

**Cáº­p nháº­t má»™t sá»‘ field:**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -d '{
    "fullName": "LÃª Há»c ViÃªn (Updated)",
    "address": "456 ÄÆ°á»ng Má»›i, HÃ  Ná»™i",
    "gender": "FEMALE"
  }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (200)** â€” tráº£ vá» profile Ä‘Ã£ update:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "...",
  "path": "/users/me",
  "data": {
    "fullName": "LÃª Há»c ViÃªn (Updated)",
    "address": "456 ÄÆ°á»ng Má»›i, HÃ  Ná»™i",
    "gender": "FEMALE",
    ...
  }
}
```

**Cáº­p nháº­t SÄT há»£p lá»‡:**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{ "phoneNumber": "0987654321" }' | jq .
```

**Cáº­p nháº­t ghi chÃº (chá»‰ Ã¡p dá»¥ng cho STUDENT):**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{ "notes": "Há»c viÃªn cáº§n luyá»‡n thÃªm pháº§n biá»ƒn bÃ¡o" }' | jq .
```

> Náº¿u user khÃ´ng pháº£i STUDENT, `notes` bá»‹ bá» qua (khÃ´ng lá»—i, chá»‰ silent ignore).

**Case: SÄT khÃ´ng há»£p lá»‡ (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/users/me \
  -H "Content-Type: application/json" \
  -H "x-user-id: student-uuid-0003" \
  -d '{ "phoneNumber": "0123" }' | jq .
```

---

### 4.6 PATCH /admin/users/:id â€” Cáº­p nháº­t profile báº¥t ká»³ (admin)

```bash
curl -s -X PATCH http://localhost:3002/admin/users/instructor-uuid-0004 \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Pháº¡m GiÃ¡o ViÃªn (Admin Updated)",
    "address": "789 ÄÆ°á»ng Admin"
  }' | jq .
```

---

### 4.7 PATCH /admin/users/:id/lock â€” KhÃ³a / má»Ÿ khÃ³a user

**KhÃ³a user (isActive â†’ false):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": true }'
# Káº¿t quáº£ mong Ä‘á»£i: HTTP 204 (khÃ´ng cÃ³ body)
```

**XÃ¡c nháº­n user Ä‘Ã£ bá»‹ khÃ³a:**

```bash
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data.isActive'
# Káº¿t quáº£ mong Ä‘á»£i: false
```

**Kiá»ƒm tra user khÃ´ng xuáº¥t hiá»‡n khi lá»c isActive=true:**

```bash
curl -s "http://localhost:3002/admin/users?isActive=true" | jq '.data.items | map(.id)'
# student-uuid-0003 khÃ´ng cÃ³ trong danh sÃ¡ch
```

**Má»Ÿ khÃ³a user (isActive â†’ true):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": false }'
# Káº¿t quáº£ mong Ä‘á»£i: HTTP 204
```

**XÃ¡c nháº­n:**

```bash
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data.isActive'
# Káº¿t quáº£ mong Ä‘á»£i: true
```

**Case: ID khÃ´ng tá»“n táº¡i (expect 404):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/fake-uuid/lock \
  -H "Content-Type: application/json" \
  -d '{ "lock": true }' | jq .
```

**Case: Body khÃ´ng há»£p lá»‡ â€” thiáº¿u field `lock` (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/lock \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

### 4.8 PATCH /admin/users/:id/license-tier â€” GÃ¡n háº¡ng báº±ng lÃ¡i

> Endpoint nÃ y láº¥y `changedById` tá»« `JWT.sub` cá»§a ADMIN/CENTER_MANAGER Ä‘á»ƒ ghi audit.

**GÃ¡n háº¡ng B2 cho student:**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -d '{ "licenseTier": "B2" }' | jq '.data.studentDetail.licenseTier'
# Káº¿t quáº£ mong Ä‘á»£i: "B2"
```

**XÃ¡c nháº­n license tier Ä‘Ã£ Ä‘Æ°á»£c gÃ¡n:**

```bash
curl -s http://localhost:3002/admin/users/student-uuid-0003 | jq '.data.studentDetail'
```

**Káº¿t quáº£ mong Ä‘á»£i:**

```json
{
  "licenseTier": "B2",
  "enrolledAt": "2026-01-01T00:00:00.000Z",
  "notes": "Há»c viÃªn cáº§n luyá»‡n thÃªm pháº§n biá»ƒn bÃ¡o"
}
```

**Thay Ä‘á»•i háº¡ng (tá»« B2 â†’ C):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: manager-uuid-0002" \
  -d '{ "licenseTier": "C" }'
```

**Kiá»ƒm tra audit trail trong DB (xem pháº§n 7).**

**Case: GÃ¡n cho user KHÃ”NG pháº£i STUDENT (expect 422):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/admin-uuid-0001/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin-uuid-0001" \
  -d '{ "licenseTier": "B2" }' | jq .
```

**Káº¿t quáº£ mong Ä‘á»£i (422):**

```json
{
  "success": false,
  "code": "USER_NOT_STUDENT",
  "message": "User is not a student",
  "timestamp": "...",
  "path": "/users/admin-uuid-0001/license-tier"
}
```

**Case: licenseTier khÃ´ng há»£p lá»‡ (expect 400):**

```bash
curl -s -X PATCH http://localhost:3002/admin/users/student-uuid-0003/license-tier \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin-uuid-0001" \
  -d '{ "licenseTier": "Z9" }' | jq .
```

---

## 5. Test luá»“ng RabbitMQ event

### 5.1 Kiá»ƒm tra RabbitMQ Ä‘ang cháº¡y

**RabbitMQ Management UI:** http://localhost:15672  
Username: `guest` / Password: `guest`

VÃ o tab **Queues** Ä‘á»ƒ tháº¥y:

- `user_service_events` â€” queue user-service Ä‘ang CONSUME
- `user_service_publish` â€” queue user-service PUBLISH events vÃ o
- `course_service_events` â€” nháº­n event `user.student.license-assigned` tá»« user-service Ä‘á»ƒ course-service sync license tier read model

### 5.2 Simulate event `identity.user.created`

Thay vÃ¬ dÃ¹ng Keycloak, publish trá»±c tiáº¿p vÃ o RabbitMQ queue báº±ng Management UI hoáº·c CLI:

**CÃ¡ch 1: DÃ¹ng RabbitMQ Management UI**

1. VÃ o http://localhost:15672
2. Tab **Queues** â†’ chá»n queue `user_service_events`
3. Scroll xuá»‘ng **Publish message**
4. Äiá»n:
   - Routing key: `identity.user.created`
   - Payload:
   ```json
   {
     "userId": "rabbitmq-user-uuid-0005",
     "email": "rabbitmq-user@example.com",
     "fullName": "NgÆ°á»i DÃ¹ng RabbitMQ",
     "role": "STUDENT"
   }
   ```
5. Click **Publish message**

**XÃ¡c nháº­n user Ä‘Ã£ Ä‘Æ°á»£c táº¡o:**

```bash
curl -s http://localhost:3002/admin/users/rabbitmq-user-uuid-0005 | jq .
```

**CÃ¡ch 2: DÃ¹ng amqp script**

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
      fullName: "NgÆ°á»i DÃ¹ng RabbitMQ",
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

**Káº¿t quáº£ mong Ä‘á»£i:**

```json
{
  "role": "INSTRUCTOR",
  "studentDetail": null
}
```

> `studentDetail` bá»‹ xÃ³a vÃ¬ user khÃ´ng cÃ²n lÃ  STUDENT ná»¯a.

**Promote trá»Ÿ láº¡i STUDENT:**

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

**Káº¿t quáº£ mong Ä‘á»£i:**

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

> `studentDetail` Ä‘Æ°á»£c táº¡o má»›i (empty) vÃ¬ user vá»«a Ä‘Æ°á»£c promote.

---

## 6. Test qua Kong (production path)

> Cáº§n start thÃªm Kong. Chá»‰ Ã¡p dá»¥ng khi Ä‘Ã£ cáº¥u hÃ¬nh Keycloak vÃ  Kong Ä‘áº§y Ä‘á»§.

### 6.1 Start Kong

```bash
docker-compose up -d kong
```

Kong cháº¡y trÃªn port `8000` (HTTP proxy) vÃ  `8001` (Admin API).

### 6.2 Láº¥y JWT tá»« Keycloak

```bash
curl -s -X POST http://localhost:8080/realms/<realm>/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=<client_id>" \
  -d "username=<email>" \
  -d "password=<password>" | jq .access_token
```

### 6.3 Gá»i API qua Kong

```bash
TOKEN="eyJhbGci..."

curl -s http://localhost:8000/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

> Frontend chá»‰ gá»­i `Authorization`. Service tá»± validate token vÃ  láº¥y actor tá»« `JWT.sub`.

---

## 7. Kiá»ƒm tra Database trá»±c tiáº¿p

### DÃ¹ng Prisma Studio

```bash
cd apps/user-service
npx prisma studio
```

Má»Ÿ http://localhost:5555 Ä‘á»ƒ xem:

- Table `user_profiles`
- Table `student_details`
- Table `license_assignment_audits` â€” **quan trá»ng Ä‘á»ƒ verify audit trail**

### DÃ¹ng psql trá»±c tiáº¿p

```bash
psql postgresql://user:password@localhost:5433/user_db
```

```sql
-- Xem táº¥t cáº£ user profiles
SELECT id, "fullName", email, role, "isActive", "createdAt"
FROM user_profiles
ORDER BY "createdAt" DESC;

-- Xem student details
SELECT u."fullName", s."licenseTier", s."enrolledAt", s.notes
FROM user_profiles u
JOIN student_details s ON s."studentId" = u.id;

-- Xem audit trail cá»§a license assignment
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

## 8. Test Security Audit VÃ  Outbox

Má»¥c tiÃªu: chá»©ng minh `PATCH /admin/users/:id/license-tier` vá»«a update profile thÃ nh cÃ´ng, vá»«a táº¡o centralized audit trail qua transactional outbox.

### 8.1 Gá»i audited action

```bash
curl -i -X PATCH http://localhost:8000/admin/users/<student-id>/license-tier \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "licenseTier": "B1" }'
```

Expected:

- HTTP `200`.
- Response header cÃ³ `x-correlation-id`.
- Response body cÃ³ `data.studentDetail.licenseTier = "B1"`.

### 8.2 Verify local bounded-context audit

```sql
SELECT "studentId", "oldLicenseTier", "newLicenseTier", "changedById", "changedAt"
FROM license_assignment_audits
WHERE "studentId" = '<student-id>'
ORDER BY "changedAt" DESC
LIMIT 5;
```

Expected: cÃ³ row vá»›i `newLicenseTier = B1`.

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
- BÃ¬nh thÆ°á»ng sau vÃ i giÃ¢y `status = PUBLISHED`.
- Náº¿u RabbitMQ Ä‘ang down, row váº«n cÃ²n `PENDING` hoáº·c `FAILED`, khÃ´ng máº¥t.

### 8.4 Verify centralized audit-service

```bash
curl -s "http://localhost:8000/admin/audit-logs?action=USER_LICENSE_ASSIGNED&resourceId=<student-id>" \
  -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" | jq .
```

Expected:

- `data.total >= 1`.
- Item má»›i nháº¥t cÃ³:
  - `serviceName = user-service`
  - `resourceType = USER_PROFILE`
  - `resourceId = <student-id>`
  - `metadata.newLicenseTier = B1`
  - `correlationId` khá»›p response header náº¿u copy láº¡i lÃºc gá»i API.

---

## 9. Troubleshooting

### Service khÃ´ng start Ä‘Æ°á»£c

```
Error: Failed to connect to Consul
```

â†’ Cháº¡y `docker-compose up -d consul consul-init` vÃ  seed láº¡i: `pnpm run consul:seed:local`

---

### Database connection error

```
Error: Can't reach database server at localhost:5433
```

â†’ Cháº¡y `docker-compose up -d db-user`

---

### Prisma schema chÆ°a migrate

```
PrismaClientInitializationError: Unable to open a TLS connection
```

â†’ Cháº¡y:

```bash
cd apps/user-service
npx prisma migrate dev
```

---

### RabbitMQ event khÃ´ng Ä‘Æ°á»£c consume

1. Kiá»ƒm tra queue `user_service_events` tá»“n táº¡i trong RabbitMQ UI
2. Kiá»ƒm tra user-service log: event pattern pháº£i lÃ  `identity.user.created` hoáº·c `identity.user.role-changed`
3. Äáº£m báº£o `noAck: false` trong config â€” RabbitMQ chá» acknowledgment

---

### Response format sai (khÃ´ng cÃ³ `success` field)

â†’ `DomainExceptionFilter` hoáº·c `ApiExceptionFilter` chÆ°a Ä‘Æ°á»£c register. Kiá»ƒm tra `main.ts`:

```typescript
app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());
```

---

### `422 USER_NOT_STUDENT` khi gÃ¡n license tier

â†’ ÄÃºng behavior. User cáº§n cÃ³ `role = STUDENT` má»›i Ä‘Æ°á»£c gÃ¡n license tier.

---

## Checklist test nhanh

DÃ¹ng Ä‘á»ƒ verify toÃ n bá»™ happy path sau má»—i thay Ä‘á»•i:

```bash
BASE="http://localhost:3002"

# 1. Táº¡o user
curl -s -X POST $BASE/users -H "Content-Type: application/json" \
  -d '{"id":"test-001","fullName":"Test User","email":"test-001@test.com","role":"STUDENT"}' \
  | jq '.success'  # â†’ true

# 2. Láº¥y profile báº±ng ID
curl -s $BASE/users/test-001 | jq '.data.role'  # â†’ "STUDENT"

# 3. Láº¥y profile /me - cáº§n token cÃ³ sub = test-001 náº¿u guard Ä‘ang báº­t
curl -s $BASE/users/me -H "Authorization: Bearer <STUDENT_TOKEN>" | jq '.data.email'

# 4. Update profile
curl -s -X PATCH $BASE/users/me -H "Content-Type: application/json" -H "Authorization: Bearer <STUDENT_TOKEN>" \
  -d '{"address":"123 Test St"}' | jq '.data.address'  # â†’ "123 Test St"

# 5. GÃ¡n license tier
curl -s -X PATCH $BASE/admin/users/test-001/license-tier \
  -H "Content-Type: application/json" -H "Authorization: Bearer <ADMIN_OR_CENTER_MANAGER_TOKEN>" \
  -d '{"licenseTier":"B2"}' | jq '.data.studentDetail.licenseTier'  # â†’ "B2"

# 6. Verify license tier
curl -s $BASE/users/test-001 | jq '.data.studentDetail.licenseTier'  # â†’ "B2"

# 7. Lock user
curl -s -X PATCH $BASE/users/test-001/lock -H "Content-Type: application/json" \
  -d '{"lock":true}' -o /dev/null -w "%{http_code}"  # â†’ 204

# 8. Verify locked
curl -s $BASE/users/test-001 | jq '.data.isActive'  # â†’ false

echo "All checks passed!"
```

<!-- Merged legacy testing guide -->

# UC33: Logout - Implementation & Testing Guide

## Overview

UC33 Logout Ä‘Ã£ Ä‘Æ°á»£c triá»ƒn khai táº¡i `identity-service` vá»›i cÃ¡c thÃ nh pháº§n:

- Endpoint: `POST /logout`
- YÃªu cáº§u: JWT access token (Authorization header) + refresh token (request body)
- Response: ThÃ´ng bÃ¡o logout thÃ nh cÃ´ng vá»›i hÆ°á»›ng dáº«n xÃ³a token
- Backend: Revoke session trÃªn Keycloak + Redis blacklist theo `jti`/token TTL

## Architecture

```
Client â†’ POST /logout
           Authorization: Bearer <access_token>
           Body: { "refreshToken": "<refresh_token>" }
           â†“
         Kong Gateway (truyá»n token qua)
           â†“
         identity-service: AuthController.logout()
           â†“
         AppService.logout(token, refreshToken)
           â€¢ Decode JWT â†’ láº¥y exp claim
           â€¢ Revoke session trÃªn Keycloak (dÃ¹ng refreshToken)
           â€¢ ThÃªm access token vÃ o blacklist vá»›i TTL
           â†“
         TokenBlacklistService
           â€¢ LÆ°u key `bl:<jti>` vÃ o Redis
           â€¢ TTL theo `exp` cá»§a access token
           â†“
         LogoutResponseDto (MSG130)
           â†“
         Client: XÃ³a token tá»« LocalStorage/Cookie
```

## Files Changed

### Core Implementation

- `apps/identity-service/src/presentation/dtos/logout.response.dto.ts` â€” Response DTO
- `apps/identity-service/src/presentation/dtos/logout.request.dto.ts` â€” Request DTO
- `apps/identity-service/src/infrastructure/token-blacklist/token-blacklist.service.ts` â€” Blacklist service
- `apps/identity-service/src/app.service.ts` â€” Logout business logic + JWT decode
- `apps/identity-service/src/presentation/http/auth.controller.ts` â€” Logout endpoint
- `apps/identity-service/src/app.module.ts` â€” DI wiring

### Infrastructure

- `docker-compose.infra.yml` â€” ThÃªm Redis service
- `docker-compose.yaml` â€” ThÃªm Redis service
- `consul-seed-development-local.json` â€” ThÃªm redis.url config
- `consul-seed-development.json` â€” ThÃªm redis.url config

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

### 1. Khá»Ÿi Ä‘á»™ng Infrastructure

```bash
# Terminal 1: Khá»Ÿi Ä‘á»™ng infra (PostgreSQL, RabbitMQ, Consul, Keycloak, Redis)
pnpm run infra:up

# Chá» khoáº£ng 30 giÃ¢y Ä‘á»ƒ táº¥t cáº£ services healthy
```

### 2. Khá»Ÿi Ä‘á»™ng Services

```bash
# Terminal 2: Khá»Ÿi Ä‘á»™ng identity-service local
pnpm run dev --filter=identity-service
```

### 3. Test Login

```bash
# Láº¥y access token tá»« Keycloak
curl -X POST http://localhost:8080/realms/luyen-thi-lai-xe-realm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=nestjs-backend" \
  -d "client_secret=${KEYCLOAK_CLIENT_SECRET}" \
  -d "grant_type=password" \
  -d "username=demo" \
  -d "password=demo"

# Hoáº·c qua identity-service login endpoint
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo"}'

# LÆ°u láº¡i accessToken vÃ  refreshToken tá»« response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Test Logout â€” Success Case

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

### 5. Test Logout â€” Missing Token

```bash
curl -X POST http://localhost:3001/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "any-value"}'
# Expected: 401 Unauthorized
```

### 6. Test Logout â€” Invalid Token

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "any-value"}'
# Expected: 401 Unauthorized
```

### 7. Test Blacklist Enforcement (After Logout)

```bash
# Logout thÃ nh cÃ´ng â†’ Token vÃ o blacklist
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# LÃºc nÃ y, token váº«n há»£p lá»‡ vá» cáº¥u trÃºc, nhÆ°ng Ä‘Ã£ bá»‹ blacklist
# Khi gá»i protected API cá»§a identity-service, TokenBlacklistGuard check Redis
# Expected: 401 Token has been revoked
```

## Integration Points

### Current enforcement

Hiá»‡n táº¡i blacklist Ä‘Æ°á»£c enforce á»Ÿ service layer cá»§a `identity-service` báº±ng global `TokenBlacklistGuard` vÃ  Redis. Kong váº«n validate/route request nhÆ°ng khÃ´ng tá»± check Redis blacklist.

1. `POST /logout` decode access token, láº¥y `exp`, revoke refresh token/session trÃªn Keycloak.
2. `TokenBlacklistService` lÆ°u key `bl:<jti>` vÃ o Redis vá»›i TTL Ä‘áº¿n khi access token háº¿t háº¡n.
3. Protected API trong `identity-service` reject token Ä‘Ã£ logout báº±ng `401`.

### Gateway/backlog note

Náº¿u muá»‘n cháº·n token Ä‘Ã£ logout trÆ°á»›c khi request tá»›i má»i service, cáº§n thÃªm blacklist guard/plugin dÃ¹ng chung á»Ÿ API gateway hoáº·c shared guard trong tá»«ng service. ÄÃ¢y lÃ  hardening má»Ÿ rá»™ng, khÃ´ng giáº£ Ä‘á»‹nh frontend pháº£i gá»­i header nÃ o khÃ¡c ngoÃ i `Authorization`.

### Redis Integration

Hiá»‡n táº¡i: `TokenBlacklistService` dÃ¹ng `ioredis` client Ä‘Æ°á»£c inject tá»« `identity-service` app module.

**Cáº¥u hÃ¬nh**:

```typescript
// In AppModule
RedisModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    url: configService.get<string>("redis.url"),
  }),
});
```

## SRS Reference

**UC33: Logout**

| BR   | MÃ´ táº£                                       | Status                      |
| ---- | ---------------------------------------------- | --------------------------- |
| BR01 | JWT Validation: Extract tá»« header, validate  | âœ… Implemented             |
| BR02 | Token Blacklisting: Add to blacklist vá»›i TTL | âœ… Implemented (in-memory) |
| BR03 | Client-Side Cleanup: Return instruction        | âœ… Implemented             |
| BR04 | Post-Logout Verification: Check blacklist O(1) | ðŸŸ¡ In-memory only         |
| BR05 | Success Response: Return MSG130                | âœ… Implemented             |

| Message | Use Case              | Status          |
| ------- | --------------------- | --------------- |
| MSG129  | Token missing/invalid | âœ… Implemented |
| MSG130  | Logout success        | âœ… Implemented |

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
   - Full flow: Login â†’ Logout â†’ Try to use old token

5. **Add Monitoring**
   - Log logout events
   - Monitor blacklist size
   - Alert if blacklist grows unexpectedly

## Swagger Documentation

Endpoint tá»± Ä‘á»™ng Ä‘Æ°á»£c documented á»Ÿ:

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

# Instructor Dashboard Analytics Test Guide

This flow verifies the new instructor dashboard end-to-end. Use real JWT tokens; frontend/Scalar should send `Authorization: Bearer <access_token>` and should not send `x-user-id`.

## Setup

```powershell
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:deploy
pnpm run dev
```

Open Scalar through docs service:

```text
http://localhost:3009/docs
```

Useful direct Scalar/OpenAPI URLs:

- Course service: `http://localhost:3004/docs`
- Analytics service: `http://localhost:3007/docs`
- Kong docs: `http://localhost:8000/analytics-service/docs`

## Minimal Manual Flow

1. Login as admin/center manager and instructor. Keep `$TOKEN_ADMIN`, `$TOKEN_INSTRUCTOR`, `$TOKEN_STUDENT`.
2. In course-service Scalar, create a course with `instructorIds` containing the instructor id.
3. Activate the course with `PATCH /admin/courses/:id/activate`.
4. Create at least one schedule:

```http
POST /admin/courses/:id/schedules
Authorization: Bearer <admin_token>
Content-Type: application/json
```

```json
{
  "instructorId": "instructor-uuid",
  "dayOfWeek": 6,
  "startTime": "07:00",
  "endTime": "09:00",
  "room": "Phong 101",
  "effectiveFrom": "2026-06-01",
  "effectiveTo": null
}
```

5. Enroll one or more students with `POST /courses/:id/enroll`.
6. Complete lessons with `POST /enrollments/:id/lessons/:lessonId/complete`.
7. Complete exam sessions in exam-service so `exam.session.completed` includes question snapshots with `topicId`.
8. Wait a few seconds for RabbitMQ consumers, then call:

```http
GET /analytics/instructor/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
Authorization: Bearer <instructor_token>
```

9. As admin, verify the admin-view endpoint:

```http
GET /admin/analytics/instructors/<instructorId>/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
Authorization: Bearer <admin_token>
```

Expected dashboard checks:

- `summary.activeClassCount` counts active non-deleted courses assigned to the instructor.
- `summary.totalStudents` counts unique active students enrolled in those courses.
- `summary.passRate` changes after completed exams are projected.
- `summary.teachingHoursThisMonth` and `weeklyTeachingTrend[].teachingHours` come from course schedules.
- `topicAverages` appears after completed exam payloads include `topicId` and `isCorrect`.
- `classProgress[].progressPct` changes after enrollments complete.
- `todaySchedule` contains schedules whose `dayOfWeek` and effective dates match `date`.

## Projection And Cache Checks

Analytics read models are eventually consistent. If numbers look stale:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "analytics:instructor-dashboard:*"
```

Check analytics DB projection tables:

```sql
SELECT * FROM instructor_course_projections;
SELECT * FROM instructor_course_assignment_projections;
SELECT * FROM instructor_enrollment_projections;
SELECT * FROM instructor_schedule_projections;
SELECT * FROM instructor_exam_session_projections;
SELECT * FROM instructor_topic_attempt_projections;
```

If tables are empty, confirm producer events were published by course-service/exam-service and analytics-service logs show handlers for `course.created`, `course.schedule.created`, `course.enrollment.created`, `course.lesson.completed`, and `exam.session.completed`.

## Seeded Dashboard Data Check

After migrations, run the root seed once:

```powershell
pnpm run db:seed
```

Verify course schedules and analytics dashboard projections:

```powershell
docker compose exec -T db-course psql -U user -d course_db -c "SELECT count(*) AS course_schedules FROM course_schedules;"
docker compose exec -T db-analytics psql -U user -d analytics_db -c "SELECT 'dashboard_user_projections' AS table_name, count(*) FROM dashboard_user_projections UNION ALL SELECT 'dashboard_course_projections', count(*) FROM dashboard_course_projections UNION ALL SELECT 'dashboard_exam_session_projections', count(*) FROM dashboard_exam_session_projections UNION ALL SELECT 'instructor_course_projections', count(*) FROM instructor_course_projections UNION ALL SELECT 'instructor_schedule_projections', count(*) FROM instructor_schedule_projections UNION ALL SELECT 'instructor_topic_attempt_projections', count(*) FROM instructor_topic_attempt_projections;"
```

Expected: every count is greater than zero. Re-running `pnpm run db:seed` should keep the counts stable, except non-unique topic attempts are reset and recreated for the deterministic demo sessions.
