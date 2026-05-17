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
10. [Quality gates](#10-quality-gates)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Khởi Động Môi Trường

### 1.1 Start infrastructure

Từ root project:

```bash
npm run infra:up
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
npm run consul:seed:local
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
npm --workspace=apps/identity-service run db:generate
npm --workspace=apps/identity-service run db:migrate

npm --workspace=apps/user-service run db:generate
npm --workspace=apps/user-service run db:migrate

npm --workspace=apps/question-service run db:generate
npm --workspace=apps/question-service run db:migrate

npm --workspace=apps/exam-service run prisma:generate
npm --workspace=apps/exam-service run db:migrate
```

Nếu migration đã tồn tại và chỉ cần apply:

```bash
npm --workspace=apps/exam-service run db:deploy
```

### 1.4 Start required services

Exam flow cần tối thiểu 4 services:

```bash
npm run dev --filter=identity-service
npm run dev --filter=user-service
npm run dev --filter=question-service
npm run dev --filter=exam-service
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
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"totalQuestions\": 3,
    \"passingScore\": 2,
    \"durationMinutes\": 20
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
    \"durationMinutes\": 10
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
- item fields are student-safe: `id`, `name`, `licenseCategory`, `totalQuestions`, `passingScore`, `durationMinutes`
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
- mỗi question có `questionId`, `content`, `options`, `displayOrder`, `isCritical`, `isBookmarked`, `selectedOptionId`

### 7.3 Confidentiality check cho active questions

Active question payload không được leak đáp án.

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  | jq '.data.items[] | keys'
```

Không được có:

- `correctOptionId`
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
- `isPassed = true` nếu `score >= passingScore` và không sai/unanswered critical
- `failedByCritical = true` nếu sai hoặc bỏ trống câu critical
- result payload được phép có `questions[].isCorrect`

### 7.9 GET /exams/sessions/:id/result - xem kết quả

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/result" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.data | {id,status,score,isPassed,failedByCritical,questions}'
```

Expect:

- HTTP `200`
- data giống submit result
- `questions[].isCorrect` có giá trị `true/false/null`
- vẫn không expose `correctOptionId` hoặc `options[].isCorrect`

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
    "durationMinutes": 10
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
    \"durationMinutes\": 20
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

### 8.6 Student không được gọi template admin endpoints

```bash
curl -s "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expect:

- HTTP `403`
- `code = "FORBIDDEN"`

### 8.7 Admin không được start student session

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

### 8.8 Student A không được đọc session của Student B

Tạo student B tương tự mục 4.2, login lấy `STUDENT_B_TOKEN`, sau đó:

```bash
curl -s "$EXAM_BASE/exams/sessions/$SESSION_ID/questions" \
  -H "Authorization: Bearer $STUDENT_B_TOKEN" | jq .
```

Expect:

- HTTP `403`
- `code = "EXAM_SESSION_UNAUTHORIZED"`

### 8.9 Delete template đã có session

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

### 8.10 Invalid template body

```bash
curl -s -X POST "$EXAM_BASE/admin/exams/templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Invalid passing score\",
    \"licenseCategory\": \"$LICENSE_CATEGORY\",
    \"totalQuestions\": 3,
    \"passingScore\": 4,
    \"durationMinutes\": 20
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
select id, name, "licenseCategory", "totalQuestions", "passingScore", "durationMinutes", "isActive", "isDeleted", version
from exam_templates
order by "createdAt" desc
limit 5;

select id, "studentId", "templateId", status, score, "isPassed", "failedByCritical", "startedAt", "finishedAt", "expiresAt"
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
- Student active endpoints không expose `correctOptionId`.
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

## 10. Quality Gates

Chạy hẹp trước:

```bash
npm --workspace=apps/exam-service run prisma:generate
npm --workspace=apps/exam-service run check-types
npm --workspace=apps/exam-service run build
```

Nếu có sửa common/config/Kong:

```bash
npm run check-types
docker compose config --quiet
docker compose -f docker-compose.infra.yml config --quiet
```

Test focused nếu có:

```bash
npm --workspace=apps/exam-service run test
```

---

## 11. Troubleshooting

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
npm run consul:seed:local
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
