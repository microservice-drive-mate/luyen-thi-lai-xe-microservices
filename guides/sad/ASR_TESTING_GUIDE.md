# ASR V1 Testing And Demo Guide

Guide này dùng để chuẩn bị môi trường, tạo dữ liệu, kiểm thử và demo các Architecturally Significant Requirements trong ASR V1 một cách mạch lạc. Mục tiêu là khi demo, mình có thể nói rõ:

1. ASR nào đang được chứng minh.
2. Vì sao bước test này chứng minh ASR đó.
3. Expected output là gì.
4. Nếu lỗi thì kiểm tra ở đâu.

## 0. Demo Storyline

Thứ tự demo khuyến nghị trong 15-20 phút:

| Thứ tự | Chủ đề | ASR | Bằng chứng nhanh |
| ---: | --- | --- | --- |
| 1 | Health, config, migration | Nền tảng demo | Docker/Consul/DB/service đều chạy |
| 2 | Quality gates | Maintainability/Reliability | `check-types`, unit test pass |
| 3 | Exam active payload không lộ đáp án | `ASR-SEC-05` | JSON không có `correctOptionId`, `isCorrect`, `isCritical`, `explanation` |
| 4 | Autosave idempotent | `ASR-REL-03` | Gửi cùng answer nhiều lần, state không duplicate/không mất câu khác |
| 5 | Submit retry-safe và server-side grading | `ASR-REL-04`, `ASR-REL-07`, `ASR-DI-01` | Submit lần 2 trả cùng result, không grade lại |
| 6 | Server-authoritative timer | `ASR-REL-02`, `ASR-REL-06` | Session hết hạn lazy finalize thành `TIMED_OUT` qua `submit`, `result`, hoặc `answers` |
| 7 | Kill-question logic | `ASR-DI-02` | Sai câu critical thì `failedByCritical=true` |
| 8 | Bounded pagination/index | `ASR-PERF-02`, `ASR-PERF-03`, `ASR-PERF-10`, `ASR-PERF-11` | `size=1000` bị reject, list có page/size |
| 9 | Redis cache-aside | `ASR-PERF-05` | Có Redis key, TTL, invalidate, fallback DB khi Redis down |
| 10 | Learning analytics dashboard | `ASR-PERF-04`, `ASR-PERF-07` | `analytics-service` projection trả progress từ cache/read model |
| 11 | Admin exam history and missed review | `ASR-PERF-09`, `ASR-PERF-10` | Filter history theo student/date/result; missed review không lộ đáp án |
| 12 | Progress reset and academic warning | `ASR-REL-05`, `ASR-PERF-08` | Reset giữ lịch sử; warning tạo notification async |
| 13 | Maneuver simulation backend rules | `ASR-SEC-07`, `ASR-UX-02` | Backend reject state transition sai và cache maneuver errors |

Nếu thời gian demo ngắn, ưu tiên các mục 1, 3, 4, 5, 8, 9.

## 1. ASR Mapping

| Quality Attribute | ASR | Cách chứng minh |
| --- | --- | --- |
| Security | `ASR-SEC-05` | Active exam response không expose đáp án, critical flag, explanation. |
| Reliability | `ASR-REL-02`, `ASR-REL-06` | Server dùng `startedAt/expiresAt`; session quá hạn được lazy finalize thành `TIMED_OUT` khi gọi `submit`, `result`, `questions`, hoặc `answers`. |
| Reliability | `ASR-REL-03` | Autosave cùng answer/bookmark nhiều lần không tạo duplicate và không mất state câu khác. |
| Reliability | `ASR-REL-04`, `ASR-REL-07` | Submit ghi result atomically; retry submit trả existing result. |
| Data Integrity | `ASR-DI-01`, `ASR-DI-02` | Grading và kill-question logic chạy server-side. |
| Data Integrity | `ASR-DI-08`, `ASR-DI-09` | Exam session lưu snapshot câu hỏi/options và tạo đúng số câu theo template. |
| Performance | `ASR-PERF-02`, `ASR-PERF-03`, `ASR-PERF-10`, `ASR-PERF-11` | List/search có pagination bounded `size <= 100` và DB index. |
| Performance | `ASR-PERF-05` | Course list/detail dùng Redis cache-aside TTL 600s, invalidate khi mutation, fallback DB khi Redis lỗi. |

## 2. Prerequisites

Cần chuẩn bị:

- Docker Desktop đang chạy.
- Node/npm đúng version của repo.
- `jq` để đọc JSON curl output.
- PowerShell hoặc Git Bash.
- Root `.env` đã có các biến local cần thiết theo README.

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

```powershell
npm.cmd --version
docker --version
docker compose version
```

## 3. Demo Mode

Có 2 cách demo:

| Mode | Khi dùng | Base URL |
| --- | --- | --- |
| Qua Kong | Demo giống production hơn, có JWT thật | `http://localhost:8000` |
| Direct service | Debug nhanh từng service bằng JWT thật trên port local | `http://localhost:3001` đến `3008` |

Khuyến nghị demo với thầy: **qua Kong** cho các API cần auth. Frontend và demo chuẩn chỉ gửi `Authorization: Bearer <access_token>`; không tự gửi `x-user-id`. Một số guide cũ có thể nhắc fallback header cho debug legacy, nhưng không dùng nó làm flow chính.

## 4. Start Infrastructure

Từ root repo:

```powershell
npm.cmd run infra:up
npm.cmd run consul:seed:local
```

Kiểm tra container quan trọng:

```powershell
docker compose -f docker-compose.infra.yml ps
```

Các container nên thấy `running` hoặc `healthy`:

- `consul`
- `rabbitmq`
- `redis`
- `db-exam`
- `db-question`
- `db-course`
- `db-user`
- `keycloak` nếu demo auth/JWT

Kiểm tra Consul:

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

Kiểm tra Docker Compose config:

```powershell
docker compose config --quiet
```

Expected: command exit code `0`. Nếu Docker in warning về `%USERPROFILE%\.docker\config.json` nhưng exit code vẫn `0`, compose config vẫn hợp lệ.

## 5. Generate Prisma Client And Apply Migrations

Chạy generate/deploy cho các service thuộc ASR:

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

Migrations ASR V1 cần có:

- `apps/exam-service/prisma/migrations/20260519170000_add_asr_query_indexes`
- `apps/question-service/prisma/migrations/20260519170000_add_asr_query_indexes`
- `apps/course-service/prisma/migrations/20260519170000_add_asr_query_indexes`

Nếu course-service có thêm read model license tier, cũng apply migration:

- `apps/course-service/prisma/migrations/20260521090000_add_student_license_profile_read_model`

## 6. Seed Data

Khuyến nghị hiện tại cho demo đầy đủ là chạy root seed một lần sau migration:

```powershell
npm.cmd run db:seed
```

Lệnh này seed theo thứ tự phụ thuộc: identity, user, question, exam, course, analytics, notification, simulation. Dataset gồm demo users/license, 600 câu hỏi, exam templates, courses/enrollments, analytics read model, notifications và simulation maneuvers/checkpoints/errors. Chi tiết nằm ở `guides/testing/demo-seed-plan.md`.

### 6.1 Seed Question Topics/Question Bank

Nếu question-service có seed script:

```powershell
npm.cmd --workspace=apps/question-service run db:seed
```

Kiểm tra nhanh:

```bash
curl -s "http://localhost:3005/admin/questions?page=1&size=5" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  | jq '.data | {total,page,size}'
```

Expected: `total > 0`.

Seed hiện tại dùng topic IDs deterministic UUID v5. Khi tạo exam template, dùng các IDs này thay vì các UUID placeholder cũ:

| Topic | ID |
| --- | --- |
| Khái niệm và quy tắc giao thông đường bộ | `9f49045f-156e-5252-8486-babb36dc74fd` |
| Nghiệp vụ vận tải | `6d568ff3-458d-5764-bb15-ae3258b75a40` |
| Văn hóa giao thông và đạo đức người lái xe | `a81d3294-cc8b-579e-9567-8bbc39f96b60` |
| Kỹ thuật lái xe | `6d38e12b-adec-5c2c-b029-e01ae1fdabd2` |
| Cấu tạo và sửa chữa xe | `d7a509c3-153f-5c03-9398-6a5626aa70d0` |
| Hệ thống biển báo hiệu đường bộ | `0694bef4-6534-56d3-bc68-a3a0fb8f4f43` |

### 6.2 Chuẩn Bị User Và License

Flow chuẩn:

1. Tạo account ở identity-service.
2. User-service nhận event `identity.user.created` và tạo profile.
3. Assign license tier ở user-service.
4. Course-service nhận event `user.student.license-assigned` và sync `student_license_profiles`.

Kiểm tra user profile:

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

Kiểm tra course-service read model:

```sql
SELECT "studentId", "licenseTier", "syncedAt", "updatedAt"
FROM student_license_profiles
WHERE "studentId" = '<student-id>';
```

Nếu chưa có row, restart user-service/course-service rồi assign lại license để re-emit event.

### 6.3 Chuẩn Bị Exam Template

Cần có:

- Template active.
- `durationMinutes` phù hợp demo.
- `licenseCategory` khớp license của student.
- Question bank đủ câu theo `topicDistribution`.

Khi demo timer, nên tạo template riêng với `durationMinutes = 1`.

Ví dụ template demo nhỏ, dễ đủ pool sau khi seed:

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

## 7. Start Services

Cách nhanh:

```powershell
npm.cmd run dev
```

Hoặc mở mỗi service một terminal để log rõ hơn:

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

## 8. Prepare Demo Variables

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

Nếu gọi qua Kong, có thể đổi:

```bash
EXAM_BASE="$KONG_BASE"
COURSE_BASE="$KONG_BASE"
QUESTION_BASE="$KONG_BASE"
```

## 9. Automated Quality Gates

Chạy trước khi demo:

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
- Test pass cho exam-service và course-service.
- User-service compile pass để đảm bảo API assign license tier và event publish vẫn hợp lệ.
- Compose config exit code `0`.

Demo phrase:

> "Trước khi test thủ công, em chạy quality gate để đảm bảo các service compile và unit tests của các behavior quan trọng vẫn pass."

## 10. Security: Active Exam Does Not Leak Answer Data

Mục tiêu: chứng minh `ASR-SEC-05`.

### 10.1 Start Exam Session

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

### 10.2 Inspect Active Questions

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

> "Frontend chỉ nhận dữ liệu đủ để hiển thị đề và lưu đáp án. Đáp án đúng, giải thích và cờ câu điểm liệt không xuất hiện ở active payload."

## 11. Reliability: Autosave Is Idempotent

Mục tiêu: chứng minh `ASR-REL-03`.

Lấy question/option ids:

```bash
QUESTIONS_JSON=$(curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

QUESTION_1_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[0].questionId')
OPTION_1_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[0].options[0].id')
QUESTION_2_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[1].questionId')
OPTION_2_ID=$(echo "$QUESTIONS_JSON" | jq -r '.data.items[1].options[0].id')
```

Autosave cùng câu nhiều lần:

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

Autosave câu khác:

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

## 12. Reliability/Data Integrity: Submit Is Retry-Safe

Mục tiêu: chứng minh `ASR-REL-04`, `ASR-REL-07`, `ASR-DI-01`.

Submit lần đầu:

```bash
FIRST_SUBMIT=$(curl -s -X POST "$EXAM_BASE/exams/sessions/$SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo "$FIRST_SUBMIT" | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,finishedAt}'
```

Submit lại:

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

- Cả hai request HTTP `200`.
- Result giống nhau.
- Không lỗi `EXAM_SESSION_ALREADY_FINISHED`.
- Không grade lại.

Result endpoint:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {id,status,score,isPassed,failedByCritical,criticalMistakes,questions}'
```

Expected:

- Result có `questions[].isCorrect`.
- Result không expose `correctOptionId`, `options[].isCorrect`, hoặc `questions[].isCritical`.

Demo phrase:

> "Submit là retry-safe. Nếu client mất mạng rồi bấm gửi lại, server trả lại result đã ghi, không chấm lại và không tạo trạng thái lệch."

## 13. Timer: Server-Authoritative Timeout And Lazy Finalization

Mục tiêu: chứng minh `ASR-REL-02`, `ASR-REL-06`.

Chuẩn bị template `durationMinutes = 1` ở mục 6.3, start session mới:

```bash
TIMEOUT_SESSION_ID=$(curl -s -X POST "$EXAM_BASE/exams/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"templateId\": \"$TIMER_TEMPLATE_ID\" }" \
  | jq -r '.data.id')
```

Có 2 cách đưa session vào trạng thái quá hạn.

Cách demo thật:

```powershell
Start-Sleep -Seconds 70
```

Cách demo nhanh bằng DB local:

```bash
docker exec -i luyen-thi-lai-xe-microservices-db-exam-1 psql -U user -d exam_db \
  -c "update exam_sessions set \"expiresAt\" = now() - interval '1 minute' where id = '$TIMEOUT_SESSION_ID';"
```

Gọi result trước khi submit:

```bash
curl -s "$EXAM_BASE/exams/sessions/$TIMEOUT_SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {status,score,isPassed,startedAt,finishedAt,expiresAt}'
```

Expected:

- HTTP `200`.
- `status = "TIMED_OUT"`.
- `finishedAt` khác `null` và sau `expiresAt`.
- Result vẫn available dù client chưa bấm submit.

Để chứng minh autosave cũng lazy-finalize, tạo một session timeout khác chưa gọi `result`:

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

Gọi autosave sau khi hết hạn:

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
- Answer mới không được apply sau khi session đã hết hạn.
- Không còn lỗi `EXAM_SESSION_EXPIRED` làm session bị kẹt `IN_PROGRESS`.

Nếu đã gọi `result` trước đó và session đã finalized, autosave tiếp theo có thể trả `EXAM_SESSION_ALREADY_FINISHED`; đó là đúng vì session lúc này không còn `IN_PROGRESS`.

Submit sau khi session đã finalize:

```bash
curl -s -X POST "$EXAM_BASE/exams/sessions/$TIMEOUT_SESSION_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data | {status,score,isPassed,startedAt,finishedAt,expiresAt}'
```

Expected:

- Vẫn HTTP `200`.
- Trả lại existing result `TIMED_OUT`.
- Không grade lại, không publish duplicate event.

Demo phrase:

> "Timer không phụ thuộc đồng hồ frontend. Server quyết định dựa trên `startedAt` và `expiresAt`; nếu client không submit đúng lúc, request kế tiếp như result hoặc autosave sẽ đóng phiên thành TIMED_OUT một cách nhất quán."

## 14. Data Integrity: Kill-Question Logic

Mục tiêu: chứng minh `ASR-DI-02`.

Template cần có:

```json
{
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0
}
```

Trong active session, bỏ trống hoặc chọn sai một câu critical rồi submit.

Expected result:

```json
{
  "failedByCritical": true,
  "isPassed": false,
  "criticalMistakes": 1
}
```

Important:

- Active payload không cho frontend biết câu nào critical.
- Server tự grade bằng snapshot DB và `correctOptionId`.
- Client chỉ hiển thị result server trả về.

Demo phrase:

> "Quy tắc câu điểm liệt là rule phía server. Frontend không thể né rule bằng cách sửa payload."

## 15. Performance: Bounded Pagination

Mục tiêu: chứng minh `ASR-PERF-02`, `ASR-PERF-03`, `ASR-PERF-10`, `ASR-PERF-11`.

### 15.1 Valid Pagination

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
- Response có `total`, `page`, `size`.
- Không trả unbounded full table.

### 15.2 Invalid Pagination

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
- `size` max là `100`.

### 15.3 DB Index Evidence

Mở migration:

- `apps/exam-service/prisma/migrations/20260519170000_add_asr_query_indexes/migration.sql`
- `apps/question-service/prisma/migrations/20260519170000_add_asr_query_indexes/migration.sql`
- `apps/course-service/prisma/migrations/20260519170000_add_asr_query_indexes/migration.sql`

Demo phrase:

> "Pagination giới hạn tải trả về, còn index hỗ trợ query filter/search để không scan bảng lớn khi dữ liệu tăng."

## 16. Course Cache-Aside With Redis

Mục tiêu: chứng minh `ASR-PERF-05`.

### 16.1 Confirm Redis

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

### 16.2 Clear Old Keys

Xem key cũ:

```powershell
docker exec -it <redis-container-name> redis-cli KEYS "course:*"
```

Nếu muốn làm sạch cache trước demo, xóa từng key course hiển thị ở lệnh trên:

```powershell
docker exec -it <redis-container-name> redis-cli DEL "<course-cache-key>"
```

Có thể bỏ qua bước xóa cache nếu chỉ cần chứng minh sau khi gọi API có key và TTL.

### 16.3 Cache Miss Then Populate

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

- Có key dạng `course:list:*`.

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

- Có thêm key dạng `course:detail:<course-id>`.

### 16.4 Cache Hit And TTL

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

### 16.5 Invalidation

Thực hiện một mutation làm đổi course public data:

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

- List cache bị xóa.
- Detail cache của course bị xóa hoặc sẽ được refresh ở request kế tiếp.

### 16.6 Redis Failure Fallback

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

> "Redis là cache-aside, không phải nguồn dữ liệu chính. Khi Redis lỗi, service fallback về PostgreSQL và giữ nguyên response shape."

## 17. Evidence Checklist

Trước demo, nên chuẩn bị screenshot hoặc terminal output cho:

- `docker compose -f docker-compose.infra.yml ps`.
- Consul key `course-service/redis.url`.
- `check-types` và test pass.
- Active exam payload không có đáp án.
- Autosave lặp lại không đổi state sai.
- Submit lần 1 và retry submit có cùng result.
- Timeout session có `TIMED_OUT` khi gọi result/autosave/submit.
- Kill-question result có `failedByCritical=true`.
- Pagination `size=1000` bị validation error.
- Redis keys sau cache populate.
- Redis TTL key course.
- Redis keys sau mutation bị clear.
- Course list vẫn `success=true` khi Redis stop.

## 18. Demo Script Ngắn

Có thể nói theo flow này:

1. "Em demo ASR V1 gồm security, reliability, data integrity và performance."
2. "Đầu tiên là health/config: Docker, Consul, DB và service đều chạy."
3. "Tiếp theo là quality gate: typecheck và test pass."
4. "Với security, active exam payload không trả đáp án đúng, không trả isCritical, không trả explanation."
5. "Với reliability, autosave là idempotent: gửi lặp không duplicate và không mất answer câu khác."
6. "Submit là retry-safe: client gửi lại request vẫn nhận cùng result."
7. "Timer là server-authoritative: quá expiresAt thì request kế tiếp lazy finalize session thành TIMED_OUT."
8. "Data integrity: chấm điểm và câu điểm liệt chạy server-side."
9. "Performance: các list endpoint có bounded pagination và index."
10. "Course-service dùng Redis cache-aside: có cache key/TTL, mutation invalidate, Redis down vẫn fallback DB."

## 19. Troubleshooting

### Consul Không Có Config

```powershell
npm.cmd run consul:seed:local
npm.cmd run consul:get -- config/development-local/course-service/redis.url
```

### Prisma Client Không Thấy Schema Mới

```powershell
npm.cmd --workspace=apps/<service> run db:generate
npm.cmd --workspace=apps/<service> run db:deploy
```

### Service Không Connect DB

Kiểm tra DB container:

```powershell
docker compose -f docker-compose.infra.yml ps db-exam db-question db-course
```

Kiểm tra Consul DB URL:

```powershell
npm.cmd run consul:get -- config/development-local/exam-service/database.url
```

### Không Có Token

Xem:

- `guides/testing/identity-service-test-guide.md`
- `guides/api/identity-user-flow.md`

Nếu debug direct service, vẫn ưu tiên dùng JWT thật vì các service mới đọc actor từ `JWT.sub`. Chỉ dùng fallback header khi một endpoint cũ ghi rõ hỗ trợ debug legacy.

### Course Enroll Báo `STUDENT_LICENSE_NOT_ASSIGNED`

Course-service chưa có read model license tier của student.

1. Restart user-service và course-service.
2. Assign lại license tier trong user-service.
3. Check course DB:

```sql
SELECT "studentId", "licenseTier"
FROM student_license_profiles
WHERE "studentId" = '<student-id>';
```

### Redis Container Name Khác

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}" | Select-String redis
```

Sau đó thay `<redis-container-name>` trong các lệnh Redis.

### PowerShell Chặn `npm.ps1`

Dùng `npm.cmd`:

```powershell
npm.cmd --workspace=apps/exam-service run check-types
```

### Git Báo Dubious Ownership Trong Sandbox

Khi chỉ cần xem status/diff:

```powershell
git -c safe.directory="C:/Users/Ngo Minh Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices" status --short
```
