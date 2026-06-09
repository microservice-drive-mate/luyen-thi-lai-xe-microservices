# ASR V1 Testing And Demo Guide

Guide nÃ y dÃ¹ng Ä‘á»ƒ chuáº©n bá»‹ mÃ´i trÆ°á»ng, táº¡o dá»¯ liá»‡u, kiá»ƒm thá»­ vÃ  demo cÃ¡c Architecturally Significant Requirements trong ASR V1 má»™t cÃ¡ch máº¡ch láº¡c. Má»¥c tiÃªu lÃ  khi demo, mÃ¬nh cÃ³ thá»ƒ nÃ³i rÃµ:

1. ASR nÃ o Ä‘ang Ä‘Æ°á»£c chá»©ng minh.
2. VÃ¬ sao bÆ°á»›c test nÃ y chá»©ng minh ASR Ä‘Ã³.
3. Expected output lÃ  gÃ¬.
4. Náº¿u lá»—i thÃ¬ kiá»ƒm tra á»Ÿ Ä‘Ã¢u.

## 0. Demo Storyline

Thá»© tá»± demo khuyáº¿n nghá»‹ trong 15-20 phÃºt:

| Thá»© tá»± | Chá»§ Ä‘á» | ASR | Báº±ng chá»©ng nhanh |
| ---: | --- | --- | --- |
| 1 | Health, config, migration | Ná»n táº£ng demo | Docker/Consul/DB/service Ä‘á»u cháº¡y |
| 2 | Quality gates | Maintainability/Reliability | `check-types`, unit test pass |
| 3 | Exam active payload khÃ´ng lá»™ Ä‘Ã¡p Ã¡n | `ASR-SEC-05` | JSON khÃ´ng cÃ³ `correctOptionId`, `isCorrect`, `isCritical`, `explanation` |
| 4 | Autosave idempotent | `ASR-REL-03` | Gá»­i cÃ¹ng answer nhiá»u láº§n, state khÃ´ng duplicate/khÃ´ng máº¥t cÃ¢u khÃ¡c |
| 5 | Submit retry-safe vÃ  server-side grading | `ASR-REL-04`, `ASR-REL-07`, `ASR-DI-01` | Submit láº§n 2 tráº£ cÃ¹ng result, khÃ´ng grade láº¡i |
| 6 | Server-authoritative timer | `ASR-REL-02`, `ASR-REL-06` | Session háº¿t háº¡n lazy finalize thÃ nh `TIMED_OUT` qua `submit`, `result`, hoáº·c `answers` |
| 7 | Kill-question logic | `ASR-DI-02` | Sai cÃ¢u critical thÃ¬ `failedByCritical=true` |
| 8 | Bounded pagination/index | `ASR-PERF-02`, `ASR-PERF-03`, `ASR-PERF-10`, `ASR-PERF-11` | `size=1000` bá»‹ reject, list cÃ³ page/size |
| 9 | Redis cache-aside | `ASR-PERF-05` | CÃ³ Redis key, TTL, invalidate, fallback DB khi Redis down |
| 10 | Learning analytics dashboard | `ASR-PERF-04`, `ASR-PERF-07` | `analytics-service` projection tráº£ progress tá»« cache/read model |
| 11 | Admin exam history and missed review | `ASR-PERF-09`, `ASR-PERF-10` | Filter history theo student/date/result; missed review khÃ´ng lá»™ Ä‘Ã¡p Ã¡n |
| 12 | Progress reset and academic warning | `ASR-REL-05`, `ASR-PERF-08` | Reset giá»¯ lá»‹ch sá»­; warning táº¡o notification async |
| 13 | Maneuver simulation backend rules | `ASR-SEC-07`, `ASR-UX-02` | Backend reject state transition sai vÃ  cache maneuver errors |

Náº¿u thá»i gian demo ngáº¯n, Æ°u tiÃªn cÃ¡c má»¥c 1, 3, 4, 5, 8, 9.

## 1. ASR Mapping

| Quality Attribute | ASR | CÃ¡ch chá»©ng minh |
| --- | --- | --- |
| Security | `ASR-SEC-05` | Active exam response khÃ´ng expose Ä‘Ã¡p Ã¡n, critical flag, explanation. |
| Reliability | `ASR-REL-02`, `ASR-REL-06` | Server dÃ¹ng `startedAt/expiresAt`; session quÃ¡ háº¡n Ä‘Æ°á»£c lazy finalize thÃ nh `TIMED_OUT` khi gá»i `submit`, `result`, `questions`, hoáº·c `answers`. |
| Reliability | `ASR-REL-03` | Autosave cÃ¹ng answer/bookmark nhiá»u láº§n khÃ´ng táº¡o duplicate vÃ  khÃ´ng máº¥t state cÃ¢u khÃ¡c. |
| Reliability | `ASR-REL-04`, `ASR-REL-07` | Submit ghi result atomically; retry submit tráº£ existing result. |
| Data Integrity | `ASR-DI-01`, `ASR-DI-02` | Grading vÃ  kill-question logic cháº¡y server-side. |
| Data Integrity | `ASR-DI-08`, `ASR-DI-09` | Exam session lÆ°u snapshot cÃ¢u há»i/options vÃ  táº¡o Ä‘Ãºng sá»‘ cÃ¢u theo template. |
| Performance | `ASR-PERF-02`, `ASR-PERF-03`, `ASR-PERF-10`, `ASR-PERF-11` | List/search cÃ³ pagination bounded `size <= 100` vÃ  DB index. |
| Performance | `ASR-PERF-05` | Course list/detail dÃ¹ng Redis cache-aside TTL 600s, invalidate khi mutation, fallback DB khi Redis lá»—i. |

> Availability tactic duoc tach rieng o section 2 de sau nay bo sung them Modifiability, Interoperability, Security, Reliability tactics theo cung format.

## 2. Quality Attribute Tactics

Section nay gom cac tactic kien truc da trien khai cho quality attributes. Khi bo sung tactic moi, them mot subsection moi theo format: scope, implementation, demo steps, expected evidence.

### 2.1 Availability: Health Check + Restart

Scope hien tai trien khai tactic **Detect Faults + Recover from Faults**:

- Ping/Echo: `GET /health/live` xac nhan process con song.
- Sanity Checking: `GET /health/ready` xac nhan dependency can thiet dang san sang.
- Monitor: `npm.cmd run smoke` goi health qua Kong cho cac service.
- Escalating Restart: Docker Compose cau hinh `restart: unless-stopped` de service tu chay lai khi container/process chet.

Expected health contract:

| Endpoint | Meaning | Expected |
| --- | --- | --- |
| `/health/live` | Process dang song | `200 OK` |
| `/health/ready` | Service san sang nhan traffic | `200 OK` neu dependency OK, `503` neu dependency loi |
| `/health` | Alias readiness | Giong `/health/ready` |

Demo nhanh qua Kong:

```powershell
docker compose up -d --build kong identity-service user-service exam-service course-service question-service notification-service analytics-service simulation-service media-service
npm.cmd run smoke
```

Smoke script co delay mac dinh 300ms/request de tranh bi Kong rate-limit `429` trong luc demo. Neu moi truong da nang/tat rate-limit, co the chay nhanh bang:

```powershell
$env:SMOKE_DELAY_MS=0
npm.cmd run smoke
```

Demo truc tiep service:

```powershell
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3002/health/ready
curl http://localhost:3010/health/ready
```

Demo dependency fault:

```powershell
docker compose stop db-user
curl http://localhost:3002/health/ready
docker compose start db-user
curl http://localhost:3002/health/ready
```

Expected:

- Khi `db-user` stop: `user-service` readiness tra `503 SERVICE_UNAVAILABLE`.
- Khi `db-user` start lai: readiness quay ve `200 OK`.

Demo restart:

```powershell
docker compose exec user-service sh -c "kill -9 1"
docker compose ps user-service
```

Expected: `user-service` duoc Docker Compose start lai do `restart: unless-stopped`. Luu y Docker Compose healthcheck chi danh dau `healthy/unhealthy`; no khong tu restart container chi vi healthcheck fail neu process van dang chay. Khong dung `docker compose stop` de demo restart policy vi day la thao tac dung thu cong co chu dich.

### 2.2 Security: Access Logging + Audit Trail + Transactional Outbox

Security tactic phase nay tach thanh 3 tang:

- Access log: moi HTTP request duoc log metadata vao Winston/Logstash/Elasticsearch voi `correlationId`.
- Transactional outbox: audited business mutation va audit event duoc ghi trong cung database transaction.
- Centralized audit log: cac hanh dong security/business quan trong duoc ghi immutable trong `audit-service`.

Design pattern ap dung:

- **Transactional Outbox Pattern** cho audit events o `user-service`, `course-service`, `exam-service`.
- **Idempotent Consumer** o `audit-service` bang unique `eventId`.
- **Correlation Id** de join access log trong ELK voi audit trail trong `audit_db`.

Scope phase hien tai:

| Service | Vai tro | Evidence |
| --- | --- | --- |
| `@repo/common` | Correlation id + access log | Response co `x-correlation-id`, log co `logType=access`. |
| `user-service` | Producer audit cho assign license | `user_db.outbox_messages`, action `USER_LICENSE_ASSIGNED`. |
| `course-service` | Producer audit cho course/enrollment mutations | `course_db.outbox_messages`, action `COURSE_*` hoac `ENROLLMENT_PROGRESS_RESET`. |
| `exam-service` | Producer audit cho exam-template mutations | `exam_db.outbox_messages`, action `EXAM_TEMPLATE_*`. |
| `audit-service` | Consumer/source of truth audit trail | `audit_db.audit_logs`, API `/admin/audit-logs`. |

Audited actions:

| Service | Actions |
| --- | --- |
| `user-service` | `USER_LICENSE_ASSIGNED` |
| `course-service` | `COURSE_CREATED`, `COURSE_UPDATED`, `COURSE_ARCHIVED`, `COURSE_ACTIVATED`, `COURSE_LESSON_ADDED`, `COURSE_LESSON_REMOVED`, `COURSE_MATERIAL_ADDED`, `ENROLLMENT_PROGRESS_RESET` |
| `exam-service` | `EXAM_TEMPLATE_CREATED`, `EXAM_TEMPLATE_UPDATED`, `EXAM_TEMPLATE_DELETED` |

Demo nhanh:

```powershell
# Goi mot audited action, vi du assign license tier
curl -X PATCH http://localhost:8000/admin/users/<student-id>/license-tier `
  -H "Authorization: Bearer <admin_access_token>" `
  -H "Content-Type: application/json" `
  -d "{ \"licenseTier\": \"B1\" }"

# Query centralized audit trail
curl "http://localhost:8000/admin/audit-logs?action=USER_LICENSE_ASSIGNED" `
  -H "Authorization: Bearer <admin_access_token>"
```

Expected:

- Response audited action co header `x-correlation-id`.
- `outbox_messages` trong `user_db` co row `security.audit.recorded`, `status = PUBLISHED`.
- `audit_db.audit_logs` co record `USER_LICENSE_ASSIGNED`.
- Access log trong ELK co cung `correlationId`.

Verify bang DB:

```powershell
docker compose exec db-user psql -U user -d user_db -c "SELECT payload->>'action' AS action, status, attempts, \"publishedAt\" FROM outbox_messages ORDER BY \"createdAt\" DESC LIMIT 5;"
docker compose exec db-audit psql -U user -d audit_db -c "SELECT \"serviceName\", action, \"resourceType\", \"resourceId\", \"correlationId\" FROM audit_logs ORDER BY \"occurredAt\" DESC LIMIT 5;"
```

Demo outbox khi RabbitMQ loi:

```powershell
docker compose stop rabbitmq
# Goi audited action
# Kiem tra outbox_messages van giu event PENDING/FAILED de retry
docker compose start rabbitmq
# Kiem tra event duoc publish lai va audit log xuat hien
```

Expected khi RabbitMQ down:

- Business mutation van commit neu request path khong phu thuoc RabbitMQ truc tiep.
- Producer DB co outbox row `PENDING` hoac `FAILED`.
- Audit-service chua co record moi cho den khi broker hoat dong lai va relay publish thanh cong.

Chi tiet API va test:

- `docs/api/api-spec-audit.md`
- `docs/testing/services-test-guide.md`
- `docs/api/api-spec-user.md` phan Security Audit
- `docs/api/api-spec-course.md` phan Security Audit
- `docs/api/api-spec-exam.md` phan Security Audit

## 3. Prerequisites

Cáº§n chuáº©n bá»‹:

- Docker Desktop Ä‘ang cháº¡y.
- Node/npm Ä‘Ãºng version cá»§a repo.
- `jq` Ä‘á»ƒ Ä‘á»c JSON curl output.
- PowerShell hoáº·c Git Bash.
- Root `.env` Ä‘Ã£ cÃ³ cÃ¡c biáº¿n local cáº§n thiáº¿t theo README.

Náº¿u PowerShell cháº·n `npm.ps1`, dÃ¹ng `npm.cmd` thay cho `npm`.

```powershell
npm.cmd --version
docker --version
docker compose version
```

## 4. Demo Mode

CÃ³ 2 cÃ¡ch demo:

| Mode | Khi dÃ¹ng | Base URL |
| --- | --- | --- |
| Qua Kong | Demo giá»‘ng production hÆ¡n, cÃ³ JWT tháº­t | `http://localhost:8000` |
| Direct service | Debug nhanh tá»«ng service báº±ng JWT tháº­t trÃªn port local | `http://localhost:3001` Ä‘áº¿n `3008` |

Khuyáº¿n nghá»‹ demo vá»›i tháº§y: **qua Kong** cho cÃ¡c API cáº§n auth. Frontend vÃ  demo chuáº©n chá»‰ gá»­i `Authorization: Bearer <access_token>`; khÃ´ng tá»± gá»­i `x-user-id`. Má»™t sá»‘ guide cÅ© cÃ³ thá»ƒ nháº¯c fallback header cho debug legacy, nhÆ°ng khÃ´ng dÃ¹ng nÃ³ lÃ m flow chÃ­nh.

## 5. Start Infrastructure

Tá»« root repo:

```powershell
npm.cmd run infra:up
npm.cmd run consul:seed:local
```

Kiá»ƒm tra container quan trá»ng:

```powershell
docker compose -f docker-compose.infra.yml ps
```

CÃ¡c container nÃªn tháº¥y `running` hoáº·c `healthy`:

- `consul`
- `rabbitmq`
- `redis`
- `db-exam`
- `db-question`
- `db-course`
- `db-user`
- `keycloak` náº¿u demo auth/JWT

Kiá»ƒm tra Consul:

```powershell
curl http://localhost:8500/v1/status/leader
npm.cmd run consul:get -- config/development-local/exam-service/database.url
npm.cmd run consul:get -- config/development-local/question-service/database.url
npm.cmd run consul:get -- config/development-local/course-service/database.url
npm.cmd run consul:get -- config/development-local/course-service/redis.url
```

Expected Redis config:

```text
redis://localhost:6379
```

Kiá»ƒm tra Docker Compose config:

```powershell
docker compose config --quiet
```

Expected: command exit code `0`. Náº¿u Docker in warning vá» `%USERPROFILE%\.docker\config.json` nhÆ°ng exit code váº«n `0`, compose config váº«n há»£p lá»‡.

## 6. Generate Prisma Client And Apply Migrations

Cháº¡y generate/deploy cho cÃ¡c service thuá»™c ASR:

```powershell
npm.cmd --workspace=apps/exam-service run db:generate
npm.cmd --workspace=apps/exam-service run db:deploy

npm.cmd --workspace=apps/question-service run db:generate
npm.cmd --workspace=apps/question-service run db:deploy

npm.cmd --workspace=apps/user-service run db:generate
npm.cmd --workspace=apps/user-service run db:deploy

npm.cmd --workspace=apps/course-service run db:generate
npm.cmd --workspace=apps/course-service run db:deploy
```

Migrations ASR V1 cáº§n cÃ³:

- `apps/exam-service/prisma/migrations/20260519170000_add_asr_query_indexes`
- `apps/question-service/prisma/migrations/20260519170000_add_asr_query_indexes`
- `apps/course-service/prisma/migrations/20260519170000_add_asr_query_indexes`

Náº¿u course-service cÃ³ thÃªm read model license tier, cÅ©ng apply migration:

- `apps/course-service/prisma/migrations/20260521090000_add_student_license_profile_read_model`

## 7. Seed Data

Khuyáº¿n nghá»‹ hiá»‡n táº¡i cho demo Ä‘áº§y Ä‘á»§ lÃ  cháº¡y root seed má»™t láº§n sau migration:

```powershell
npm.cmd run db:seed
```

Lá»‡nh nÃ y seed theo thá»© tá»± phá»¥ thuá»™c: identity, user, question, exam, course, analytics, notification, simulation. Dataset gá»“m demo users/license, 600 cÃ¢u há»i, exam templates, courses/enrollments, analytics read model, notifications vÃ  simulation maneuvers/checkpoints/errors. Chi tiáº¿t náº±m á»Ÿ `docs/testing/demo-seed-plan.md`.

### 7.1 Seed Question Topics/Question Bank

Náº¿u question-service cÃ³ seed script:

```powershell
npm.cmd --workspace=apps/question-service run db:seed
```

Kiá»ƒm tra nhanh:

```bash
curl -s "http://localhost:3005/admin/questions?page=1&size=5" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  | jq '.data | {total,page,size}'
```

Expected: `total > 0`.

Seed hiá»‡n táº¡i dÃ¹ng topic IDs deterministic UUID v5. Khi táº¡o exam template, dÃ¹ng cÃ¡c IDs nÃ y thay vÃ¬ cÃ¡c UUID placeholder cÅ©:

| Topic | ID |
| --- | --- |
| KhÃ¡i niá»‡m vÃ  quy táº¯c giao thÃ´ng Ä‘Æ°á»ng bá»™ | `9f49045f-156e-5252-8486-babb36dc74fd` |
| Nghiá»‡p vá»¥ váº­n táº£i | `6d568ff3-458d-5764-bb15-ae3258b75a40` |
| VÄƒn hÃ³a giao thÃ´ng vÃ  Ä‘áº¡o Ä‘á»©c ngÆ°á»i lÃ¡i xe | `a81d3294-cc8b-579e-9567-8bbc39f96b60` |
| Ká»¹ thuáº­t lÃ¡i xe | `6d38e12b-adec-5c2c-b029-e01ae1fdabd2` |
| Cáº¥u táº¡o vÃ  sá»­a chá»¯a xe | `d7a509c3-153f-5c03-9398-6a5626aa70d0` |
| Há»‡ thá»‘ng biá»ƒn bÃ¡o hiá»‡u Ä‘Æ°á»ng bá»™ | `0694bef4-6534-56d3-bc68-a3a0fb8f4f43` |

### 7.2 Chuáº©n Bá»‹ User VÃ  License

Flow chuáº©n:

1. Táº¡o account á»Ÿ identity-service.
2. User-service nháº­n event `identity.user.created` vÃ  táº¡o profile.
3. Assign license tier á»Ÿ user-service.
4. Course-service nháº­n event `user.student.license-assigned` vÃ  sync `student_license_profiles`.

Kiá»ƒm tra user profile:

```bash
curl -s "http://localhost:3002/admin/users/<student-id>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  | jq '.data | {id,role,studentDetail}'
```

Assign license:

```bash
curl -s -X PATCH "http://localhost:3002/admin/users/<student-id>/license-tier" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "licenseTier": "B2" }' \
  | jq '.data.studentDetail.licenseTier'
```

Expected:

```json
"B2"
```

Kiá»ƒm tra course-service read model:

```sql
SELECT "studentId", "licenseTier", "syncedAt", "updatedAt"
FROM student_license_profiles
WHERE "studentId" = '<student-id>';
```

Náº¿u chÆ°a cÃ³ row, restart user-service/course-service rá»“i assign láº¡i license Ä‘á»ƒ re-emit event.

### 7.3 Chuáº©n Bá»‹ Exam Template

Cáº§n cÃ³:

- Template active.
- `durationMinutes` phÃ¹ há»£p demo.
- `licenseCategory` khá»›p license cá»§a student.
- Question bank Ä‘á»§ cÃ¢u theo `topicDistribution`.

Khi demo timer, nÃªn táº¡o template riÃªng vá»›i `durationMinutes = 1`.

VÃ­ dá»¥ template demo nhá», dá»… Ä‘á»§ pool sau khi seed:

```bash
TIMER_TEMPLATE_ID=$(curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ASR timer B2",
    "description": "Template demo timeout",
    "licenseCategory": "B2",
    "totalQuestions": 1,
    "passingScore": 1,
    "durationMinutes": 1,
    "criticalQuestions": 0,
    "maxCriticalMistakes": 0,
    "shuffleQuestions": false,
    "topicDistribution": [
      {
        "topicId": "9f49045f-156e-5252-8486-babb36dc74fd",
        "questionCount": 1
      }
    ]
  }' | jq -r '.data.id')
```

## 8. Start Services

CÃ¡ch nhanh:

```powershell
npm.cmd run dev
```

Hoáº·c má»Ÿ má»—i service má»™t terminal Ä‘á»ƒ log rÃµ hÆ¡n:

```powershell
npm.cmd --workspace=apps/identity-service run start:dev
npm.cmd --workspace=apps/user-service run start:dev
npm.cmd --workspace=apps/question-service run start:dev
npm.cmd --workspace=apps/exam-service run start:dev
npm.cmd --workspace=apps/course-service run start:dev
```

Ports local:

| Service | URL |
| --- | --- |
| Kong | `http://localhost:8000` |
| identity-service | `http://localhost:3001` |
| user-service | `http://localhost:3002` |
| exam-service | `http://localhost:3003` |
| course-service | `http://localhost:3004` |
| question-service | `http://localhost:3005` |
| RabbitMQ UI | `http://localhost:15672` |
| Consul UI | `http://localhost:8500/ui` |
| Redis | `localhost:6379` |

Health smoke check:

```powershell
curl http://localhost:3003/docs-json
curl http://localhost:3004/docs-json
curl http://localhost:3005/docs-json
```

## 9. Prepare Demo Variables

Trong Git Bash:

```bash
KONG_BASE="http://localhost:8000"
EXAM_BASE="http://localhost:3003"
COURSE_BASE="http://localhost:3004"
QUESTION_BASE="http://localhost:3005"

ADMIN_TOKEN="<admin_access_token>"
STUDENT_TOKEN="<student_access_token>"
STUDENT_ID="<student-id>"
TEMPLATE_ID="<exam-template-id>"
COURSE_ID="<course-id>"
```

Náº¿u gá»i qua Kong, cÃ³ thá»ƒ Ä‘á»•i:

```bash
EXAM_BASE="$KONG_BASE"
COURSE_BASE="$KONG_BASE"
QUESTION_BASE="$KONG_BASE"
```

## 10. Automated Quality Gates

Cháº¡y trÆ°á»›c khi demo:

```powershell
npm.cmd --workspace=apps/exam-service run check-types
npm.cmd --workspace=apps/exam-service run test

npm.cmd --workspace=apps/user-service run check-types

npm.cmd --workspace=apps/course-service run check-types
npm.cmd --workspace=apps/course-service run test

npm.cmd --workspace=apps/question-service run check-types
docker compose config --quiet
```

Expected:

- `check-types` pass.
- Test pass cho exam-service vÃ  course-service.
- User-service compile pass Ä‘á»ƒ Ä‘áº£m báº£o API assign license tier vÃ  event publish váº«n há»£p lá»‡.
- Compose config exit code `0`.

Demo phrase:

> "TrÆ°á»›c khi test thá»§ cÃ´ng, em cháº¡y quality gate Ä‘á»ƒ Ä‘áº£m báº£o cÃ¡c service compile vÃ  unit tests cá»§a cÃ¡c behavior quan trá»ng váº«n pass."

## 11. Security: Active Exam Does Not Leak Answer Data

Má»¥c tiÃªu: chá»©ng minh `ASR-SEC-05`.

### 11.1 Start Exam Session

```bash
SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\"
  }" | jq -r '.data.id')

echo "$SESSION_ID"
```

Expected: in ra UUID session.

### 11.2 Inspect Active Questions

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data.items[0]'
```

Allowed fields:

- `questionId`
- `content`
- `imageUrl`
- `mediaFileId`
- `options`
- `displayOrder`
- `isBookmarked`
- `selectedOptionId`

Forbidden fields:

- `correctOptionId`
- `options[].isCorrect`
- `questions[].isCritical`
- `explanation`
- `isCorrect` while session is active

Quick assertion:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.. | objects | keys | select(index("correctOptionId") or index("isCorrect") or index("isCritical") or index("explanation"))'
```

Expected: no output.

Demo phrase:

> "Frontend chá»‰ nháº­n dá»¯ liá»‡u Ä‘á»§ Ä‘á»ƒ hiá»ƒn thá»‹ Ä‘á» vÃ  lÆ°u Ä‘Ã¡p Ã¡n. ÄÃ¡p Ã¡n Ä‘Ãºng, giáº£i thÃ­ch vÃ  cá» cÃ¢u Ä‘iá»ƒm liá»‡t khÃ´ng xuáº¥t hiá»‡n á»Ÿ active payload."

## 12. Reliability: Autosave Is Idempotent

Má»¥c tiÃªu: chá»©ng minh `ASR-REL-03`.

Láº¥y question/option ids:

```bash
QUESTIONS_JSON=$(curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

QUESTION_1_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[0].questionId')
OPTION_1_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[0].options[0].id')
QUESTION_2_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[1].questionId')
OPTION_2_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[1].options[0].id')
```

Autosave cÃ¹ng cÃ¢u nhiá»u láº§n:

```bash
for i in 1 2 3; do
  curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
    -H "Authorization: Bearer $STUDENT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"questionId\": \"$QUESTION_1_ID\",
      \"selectedOptionId\": \"$OPTION_1_ID\",
      \"isBookmarked\": true
    }" | jq '.data.questions[] | select(.questionId == "'$QUESTION_1_ID'") | {selectedOptionId,isBookmarked}'
done
```

Autosave cÃ¢u khÃ¡c:

```bash
curl -s -X PATCH "$EXAM_BASE/exams/sessions/$SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_2_ID\",
    \"selectedOptionId\": \"$OPTION_2_ID\"
  }" | jq '.data.questions[] | {questionId,selectedOptionId,isBookmarked}'
```

Expected:

- Repeating same autosave returns stable state.
- Question 1 keeps selected option and bookmark.
- Question 2 can be saved without losing Question 1.
- Active response still does not expose answer keys.

Optional DB proof:

```powershell
npm.cmd --workspace=apps/exam-service run db:studio
```

Check `exam_session_questions`: one row per session-question, no duplicate.

## 13. Reliability/Data Integrity: Submit Is Retry-Safe

Má»¥c tiÃªu: chá»©ng minh `ASR-REL-04`, `ASR-REL-07`, `ASR-DI-01`.

Submit láº§n Ä‘áº§u:

```bash
FIRST_SUBMIT=$(curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo "$FIRST_SUBMIT" | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,finishedAt}'
```

Submit láº¡i:

```bash
SECOND_SUBMIT=$(curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo "$SECOND_SUBMIT" | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,finishedAt}'
```

Compare:

```bash
echo "$FIRST_SUBMIT" | jq -r '.data.id, .data.status, .data.score, .data.finishedAt'
echo "$SECOND_SUBMIT" | jq -r '.data.id, .data.status, .data.score, .data.finishedAt'
```

Expected:

- Cáº£ hai request HTTP `200`.
- Result giá»‘ng nhau.
- KhÃ´ng lá»—i `EXAM_SESSION_ALREADY_FINISHED`.
- KhÃ´ng grade láº¡i.

Result endpoint:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,questions}'
```

Expected:

- Result cÃ³ `questions[].isCorrect`.
- Result khÃ´ng expose `correctOptionId`, `options[].isCorrect`, hoáº·c `questions[].isCritical`.

Demo phrase:

> "Submit lÃ  retry-safe. Náº¿u client máº¥t máº¡ng rá»“i báº¥m gá»­i láº¡i, server tráº£ láº¡i result Ä‘Ã£ ghi, khÃ´ng cháº¥m láº¡i vÃ  khÃ´ng táº¡o tráº¡ng thÃ¡i lá»‡ch."

## 14. Timer: Server-Authoritative Timeout And Lazy Finalization

Má»¥c tiÃªu: chá»©ng minh `ASR-REL-02`, `ASR-REL-06`.

Chuáº©n bá»‹ template `durationMinutes = 1` á»Ÿ má»¥c 6.3, start session má»›i:

```bash
TIMEOUT_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"templateId\": \"$TIMER_TEMPLATE_ID\" }" \
  | jq -r '.data.id')
```

CÃ³ 2 cÃ¡ch Ä‘Æ°a session vÃ o tráº¡ng thÃ¡i quÃ¡ háº¡n.

CÃ¡ch demo tháº­t:

```powershell
Start-Sleep -Seconds 70
```

CÃ¡ch demo nhanh báº±ng DB local:

```bash
docker exec -i luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db \
  -c "update exam_sessions set \"expiresAt\" = now() - interval '1 minute' where id = '$TIMEOUT_SESSION_ID';"
```

Gá»i result trÆ°á»›c khi submit:

```bash
curl -s "$EXAM_BASE/exams/sessions/$TIMEOUT_SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {status,score,isPassed,startedAt,finishedAt,expiresAt}'
```

Expected:

- HTTP `200`.
- `status = "TIMED_OUT"`.
- `finishedAt` khÃ¡c `null` vÃ  sau `expiresAt`.
- Result váº«n available dÃ¹ client chÆ°a báº¥m submit.

Äá»ƒ chá»©ng minh autosave cÅ©ng lazy-finalize, táº¡o má»™t session timeout khÃ¡c chÆ°a gá»i `result`:

```bash
TIMEOUT_AUTOSAVE_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"templateId\": \"$TIMER_TEMPLATE_ID\" }" \
  | jq -r '.data.id')

TIMEOUT_AUTOSAVE_QUESTIONS=$(curl -s "$EXAM_BASE/exams/sessions/$TIMEOUT_AUTOSAVE_SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

TIMEOUT_QUESTION_ID=$(echo "$TIMEOUT_AUTOSAVE_QUESTIONS" | jq -r '.data.items[0].questionId')
TIMEOUT_OPTION_ID=$(echo "$TIMEOUT_AUTOSAVE_QUESTIONS" | jq -r '.data.items[0].options[0].id')

docker exec -i luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db \
  -c "update exam_sessions set \"expiresAt\" = now() - interval '1 minute' where id = '$TIMEOUT_AUTOSAVE_SESSION_ID';"
```

Gá»i autosave sau khi háº¿t háº¡n:

```bash
curl -s -X PATCH "$EXAM_BASE/exams/sessions/$TIMEOUT_AUTOSAVE_SESSION_ID/answers" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$TIMEOUT_QUESTION_ID\",
    \"selectedOptionId\": \"$TIMEOUT_OPTION_ID\"
  }" | jq '.data | {status,score,finishedAt}'
```

Expected:

- `status = "TIMED_OUT"`.
- Answer má»›i khÃ´ng Ä‘Æ°á»£c apply sau khi session Ä‘Ã£ háº¿t háº¡n.
- KhÃ´ng cÃ²n lá»—i `EXAM_SESSION_EXPIRED` lÃ m session bá»‹ káº¹t `IN_PROGRESS`.

Náº¿u Ä‘Ã£ gá»i `result` trÆ°á»›c Ä‘Ã³ vÃ  session Ä‘Ã£ finalized, autosave tiáº¿p theo cÃ³ thá»ƒ tráº£ `EXAM_SESSION_ALREADY_FINISHED`; Ä‘Ã³ lÃ  Ä‘Ãºng vÃ¬ session lÃºc nÃ y khÃ´ng cÃ²n `IN_PROGRESS`.

Submit sau khi session Ä‘Ã£ finalize:

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions/$TIMEOUT_SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {status,score,isPassed,startedAt,finishedAt,expiresAt}'
```

Expected:

- Váº«n HTTP `200`.
- Tráº£ láº¡i existing result `TIMED_OUT`.
- KhÃ´ng grade láº¡i, khÃ´ng publish duplicate event.

Demo phrase:

> "Timer khÃ´ng phá»¥ thuá»™c Ä‘á»“ng há»“ frontend. Server quyáº¿t Ä‘á»‹nh dá»±a trÃªn `startedAt` vÃ  `expiresAt`; náº¿u client khÃ´ng submit Ä‘Ãºng lÃºc, request káº¿ tiáº¿p nhÆ° result hoáº·c autosave sáº½ Ä‘Ã³ng phiÃªn thÃ nh TIMED_OUT má»™t cÃ¡ch nháº¥t quÃ¡n."

## 15. Data Integrity: Kill-Question Logic

Má»¥c tiÃªu: chá»©ng minh `ASR-DI-02`.

Template cáº§n cÃ³:

```json
{
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0
}
```

Trong active session, bá» trá»‘ng hoáº·c chá»n sai má»™t cÃ¢u critical rá»“i submit.

Expected result:

```json
{
  "failedByCritical": true,
  "isPassed": false,
  "criticalMistakes": 1
}
```

Important:

- Active payload khÃ´ng cho frontend biáº¿t cÃ¢u nÃ o critical.
- Server tá»± grade báº±ng snapshot DB vÃ  `correctOptionId`.
- Client chá»‰ hiá»ƒn thá»‹ result server tráº£ vá».

Demo phrase:

> "Quy táº¯c cÃ¢u Ä‘iá»ƒm liá»‡t lÃ  rule phÃ­a server. Frontend khÃ´ng thá»ƒ nÃ© rule báº±ng cÃ¡ch sá»­a payload."

## 16. Performance: Bounded Pagination

Má»¥c tiÃªu: chá»©ng minh `ASR-PERF-02`, `ASR-PERF-03`, `ASR-PERF-10`, `ASR-PERF-11`.

### 16.1 Valid Pagination

```bash
curl -s "$EXAM_BASE/exams/sessions?page=1&size=20" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {total,page,size}'

curl -s "$QUESTION_BASE/admin/questions?page=1&size=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.data | {total,page,size}'

curl -s "$COURSE_BASE/courses?page=1&size=20" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {total,page,size}'
```

Expected:

- HTTP `200`.
- Response cÃ³ `total`, `page`, `size`.
- KhÃ´ng tráº£ unbounded full table.

### 16.2 Invalid Pagination

```bash
curl -s "$EXAM_BASE/exams/sessions?page=1&size=1000" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .

curl -s "$QUESTION_BASE/admin/questions?page=1&size=1000" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

curl -s "$COURSE_BASE/courses?page=1&size=1000" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expected:

- Validation error.
- `size` max lÃ  `100`.

### 16.3 DB Index Evidence

Má»Ÿ migration:

- `apps/exam-service/prisma/migrations/20260519170000_add_asr_query_indexes/migration.sql`
- `apps/question-service/prisma/migrations/20260519170000_add_asr_query_indexes/migration.sql`
- `apps/course-service/prisma/migrations/20260519170000_add_asr_query_indexes/migration.sql`

Demo phrase:

> "Pagination giá»›i háº¡n táº£i tráº£ vá», cÃ²n index há»— trá»£ query filter/search Ä‘á»ƒ khÃ´ng scan báº£ng lá»›n khi dá»¯ liá»‡u tÄƒng."

## 17. Course Cache-Aside With Redis

Má»¥c tiÃªu: chá»©ng minh `ASR-PERF-05`.

### 17.1 Confirm Redis

```powershell
docker compose -f docker-compose.infra.yml ps redis
docker ps --format "table {{.Names}}\t{{.Image}}" | Select-String redis
```

Ping Redis:

```powershell
docker exec -it <redis-container-name> redis-cli PING
```

Expected:

```text
PONG
```

### 17.2 Clear Old Keys

Xem key cÅ©:

```powershell
docker exec -it <redis-container-name> redis-cli KEYS "course:*"
```

Náº¿u muá»‘n lÃ m sáº¡ch cache trÆ°á»›c demo, xÃ³a tá»«ng key course hiá»ƒn thá»‹ á»Ÿ lá»‡nh trÃªn:

```powershell
docker exec -it <redis-container-name> redis-cli DEL "<course-cache-key>"
```

CÃ³ thá»ƒ bá» qua bÆ°á»›c xÃ³a cache náº¿u chá»‰ cáº§n chá»©ng minh sau khi gá»i API cÃ³ key vÃ  TTL.

### 17.3 Cache Miss Then Populate

Call course list:

```bash
curl -s "$COURSE_BASE/courses?page=1&size=20" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {total,page,size}'
```

Check keys:

```powershell
docker exec -it <redis-container-name> redis-cli KEYS "course:*"
```

Expected:

- CÃ³ key dáº¡ng `course:list:*`.

Call course detail:

```bash
curl -s "$COURSE_BASE/courses/$COURSE_ID" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {id,title,licenseCategory,status}'
```

Check keys again:

```powershell
docker exec -it <redis-container-name> redis-cli KEYS "course:*"
```

Expected:

- CÃ³ thÃªm key dáº¡ng `course:detail:<course-id>`.

### 17.4 Cache Hit And TTL

Call same URL again:

```bash
curl -s "$COURSE_BASE/courses?page=1&size=20" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.success'
```

Expected:

```json
true
```

TTL:

```powershell
docker exec -it <redis-container-name> redis-cli TTL "<course-cache-key>"
```

Expected:

- TTL `> 0`.
- TTL `<= 600`.

### 17.5 Invalidation

Thá»±c hiá»‡n má»™t mutation lÃ m Ä‘á»•i course public data:

```bash
curl -s -X PATCH "$COURSE_BASE/admin/courses/$COURSE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "description": "ASR cache invalidation demo" }' \
  | jq '.success'
```

Check Redis:

```powershell
docker exec -it <redis-container-name> redis-cli KEYS "course:*"
```

Expected:

- List cache bá»‹ xÃ³a.
- Detail cache cá»§a course bá»‹ xÃ³a hoáº·c sáº½ Ä‘Æ°á»£c refresh á»Ÿ request káº¿ tiáº¿p.

### 17.6 Redis Failure Fallback

Stop Redis:

```powershell
docker compose -f docker-compose.infra.yml stop redis
```

Call course list:

```bash
curl -s "$COURSE_BASE/courses?page=1&size=20" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.success'
```

Expected:

```json
true
```

Start Redis again:

```powershell
docker compose -f docker-compose.infra.yml start redis
```

Demo phrase:

> "Redis lÃ  cache-aside, khÃ´ng pháº£i nguá»“n dá»¯ liá»‡u chÃ­nh. Khi Redis lá»—i, service fallback vá» PostgreSQL vÃ  giá»¯ nguyÃªn response shape."

## 18. Evidence Checklist

TrÆ°á»›c demo, nÃªn chuáº©n bá»‹ screenshot hoáº·c terminal output cho:

- `docker compose -f docker-compose.infra.yml ps`.
- Consul key `course-service/redis.url`.
- `check-types` vÃ  test pass.
- Active exam payload khÃ´ng cÃ³ Ä‘Ã¡p Ã¡n.
- Autosave láº·p láº¡i khÃ´ng Ä‘á»•i state sai.
- Submit láº§n 1 vÃ  retry submit cÃ³ cÃ¹ng result.
- Timeout session cÃ³ `TIMED_OUT` khi gá»i result/autosave/submit.
- Kill-question result cÃ³ `failedByCritical=true`.
- Pagination `size=1000` bá»‹ validation error.
- Redis keys sau cache populate.
- Redis TTL key course.
- Redis keys sau mutation bá»‹ clear.
- Course list váº«n `success=true` khi Redis stop.

## 19. Demo Script Ngáº¯n

CÃ³ thá»ƒ nÃ³i theo flow nÃ y:

1. "Em demo ASR V1 gá»“m security, reliability, data integrity vÃ  performance."
2. "Äáº§u tiÃªn lÃ  health/config: Docker, Consul, DB vÃ  service Ä‘á»u cháº¡y."
3. "Tiáº¿p theo lÃ  quality gate: typecheck vÃ  test pass."
4. "Vá»›i security, active exam payload khÃ´ng tráº£ Ä‘Ã¡p Ã¡n Ä‘Ãºng, khÃ´ng tráº£ isCritical, khÃ´ng tráº£ explanation."
5. "Vá»›i reliability, autosave lÃ  idempotent: gá»­i láº·p khÃ´ng duplicate vÃ  khÃ´ng máº¥t answer cÃ¢u khÃ¡c."
6. "Submit lÃ  retry-safe: client gá»­i láº¡i request váº«n nháº­n cÃ¹ng result."
7. "Timer lÃ  server-authoritative: quÃ¡ expiresAt thÃ¬ request káº¿ tiáº¿p lazy finalize session thÃ nh TIMED_OUT."
8. "Data integrity: cháº¥m Ä‘iá»ƒm vÃ  cÃ¢u Ä‘iá»ƒm liá»‡t cháº¡y server-side."
9. "Performance: cÃ¡c list endpoint cÃ³ bounded pagination vÃ  index."
10. "Course-service dÃ¹ng Redis cache-aside: cÃ³ cache key/TTL, mutation invalidate, Redis down váº«n fallback DB."

## 20. Troubleshooting

### Consul KhÃ´ng CÃ³ Config

```powershell
npm.cmd run consul:seed:local
npm.cmd run consul:get -- config/development-local/course-service/redis.url
```

### Prisma Client KhÃ´ng Tháº¥y Schema Má»›i

```powershell
npm.cmd --workspace=apps/<service> run db:generate
npm.cmd --workspace=apps/<service> run db:deploy
```

### Service KhÃ´ng Connect DB

Kiá»ƒm tra DB container:

```powershell
docker compose -f docker-compose.infra.yml ps db-exam db-question db-course
```

Kiá»ƒm tra Consul DB URL:

```powershell
npm.cmd run consul:get -- config/development-local/exam-service/database.url
```

### KhÃ´ng CÃ³ Token

Xem:

- `docs/testing/services-test-guide.md`
- `docs/api/identity-user-flow.md`

Náº¿u debug direct service, váº«n Æ°u tiÃªn dÃ¹ng JWT tháº­t vÃ¬ cÃ¡c service má»›i Ä‘á»c actor tá»« `JWT.sub`. Chá»‰ dÃ¹ng fallback header khi má»™t endpoint cÅ© ghi rÃµ há»— trá»£ debug legacy.

### Course Enroll BÃ¡o `STUDENT_LICENSE_NOT_ASSIGNED`

Course-service chÆ°a cÃ³ read model license tier cá»§a student.

1. Restart user-service vÃ  course-service.
2. Assign láº¡i license tier trong user-service.
3. Check course DB:

```sql
SELECT "studentId", "licenseTier"
FROM student_license_profiles
WHERE "studentId" = '<student-id>';
```

### Redis Container Name KhÃ¡c

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}" | Select-String redis
```

Sau Ä‘Ã³ thay `<redis-container-name>` trong cÃ¡c lá»‡nh Redis.

### PowerShell Cháº·n `npm.ps1`

DÃ¹ng `npm.cmd`:

```powershell
npm.cmd --workspace=apps/exam-service run check-types
```

### Git BÃ¡o Dubious Ownership Trong Sandbox

Khi chá»‰ cáº§n xem status/diff:

```powershell
git -c safe.directory="C:/Users/Ngo Minh Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices" status --short
```
