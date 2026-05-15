# Question Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service path:** `/questions`  
**Direct local:** `http://localhost:3005`  
**Swagger UI:** `http://localhost:3005/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/question-service/docs`  
**OpenAPI JSON:** `http://localhost:3005/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/question-service/docs-json`  
**Version:** 1.0.0

## Auth Update

Question-service hiện validate JWT/RBAC tại service bằng Keycloak guard. Frontend gọi qua Kong và gửi `Authorization: Bearer <access_token>`; Kong forward header này vào service. Service lấy actor id từ `JWT.sub`, còn `x-user-id` chỉ là fallback cho debug/local script cũ.

| Endpoint                                                                                                      | Role                                    |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `POST /questions`, `GET /questions`, `GET /questions/:id`, `PATCH /questions/:id`, `DELETE /questions/:id`    | `ADMIN`, `CENTER_MANAGER`               |
| `POST /questions/topics`, `GET /questions/topics`, `GET /questions/topics/:id`, `PATCH /questions/topics/:id` | `ADMIN`, `CENTER_MANAGER`               |
| `POST /questions/pool`                                                                                        | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |

Kong OSS trong repo đang dùng routing, CORS và rate-limiting. OIDC plugin không có sẵn trong image OSS; service-level Keycloak guard là điểm enforce auth hiện tại.

Business API path là `/questions/*`; Swagger/docs path là `/question-service/docs`.

---

## Gateway / Kong

Question-service đã có route trong `kong/kong.dev.yaml`:

| Public path qua Kong                               | Upstream local service                       |
| -------------------------------------------------- | -------------------------------------------- |
| `http://localhost:8000/questions`                  | `http://host.docker.internal:3005/questions` |
| `http://localhost:8000/question-service/docs`      | `http://host.docker.internal:3005/docs`      |
| `http://localhost:8000/question-service/docs-json` | `http://host.docker.internal:3005/docs-json` |

Khi test direct local, gọi `http://localhost:3005`. Khi test dùng kiến trúc gateway, gọi `http://localhost:8000/questions`.

```bash
curl -s http://localhost:8000/questions | jq .
curl -s http://localhost:8000/question-service/docs-json | jq '.info.title'
```

Kong OSS trong repo đang dùng routing, CORS và rate-limiting. JWT/RBAC được enforce tại question-service bằng Keycloak guard.

---

## Response Format

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/questions",
  "data": {}
}
```

Lỗi domain:

```json
{
  "success": false,
  "code": "QUESTION_NOT_FOUND",
  "message": "Question not found: abc",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/questions/abc"
}
```

---

## Error Codes

| HTTP | Code                        | Nguyên nhân                                         |
| ---: | --------------------------- | --------------------------------------------------- |
|  400 | `VALIDATION_ERROR`          | Body/query không hợp lệ                             |
|  400 | `INVALID_QUESTION`          | Vi phạm invariant của question/topic                |
|  404 | `QUESTION_NOT_FOUND`        | Không tìm thấy question                             |
|  404 | `QUESTION_TOPIC_NOT_FOUND`  | Không tìm thấy topic                                |
|  409 | `QUESTION_DUPLICATE`        | Question cùng normalized content + topic đã tồn tại |
|  409 | `QUESTION_VERSION_CONFLICT` | Optimistic concurrency conflict                     |
|  422 | `QUESTION_ALREADY_DELETED`  | Thao tác trên question đã soft-delete               |

---

## Enums

### LicenseCategory

`A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`

### QuestionType

`THEORY` | `TRAFFIC_SIGN` | `SCENARIO_RELATED`

### QuestionDifficulty

`EASY` | `MEDIUM` | `HARD`

---

## Shared Types

### QuestionResponse

Admin/detail response có `options[].isCorrect`. Field này phục vụ quản trị và endpoint nội bộ; các API client-facing của exam-service sau này phải loại bỏ đáp án đúng.

Ảnh câu hỏi nên dùng `mediaFileId` để reference `media-service` FileObject. `imageUrl` chỉ là URL hiển thị/denormalized nếu client đã có URL trực tiếp; question-service không upload file và không quản lý Azure Blob.

```json
{
  "id": "question-uuid",
  "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
  "type": "THEORY",
  "licenseCategories": ["B2"],
  "difficulty": "EASY",
  "explanation": "Đèn đỏ yêu cầu dừng lại trước vạch dừng.",
  "imageUrl": null,
  "mediaFileId": "media-file-uuid",
  "isCritical": false,
  "isActive": true,
  "isDeleted": false,
  "topicId": "topic-uuid",
  "createdById": "admin-uuid",
  "version": 1,
  "deletedById": null,
  "deletedAt": null,
  "createdAt": "2026-05-14T10:00:00.000Z",
  "updatedAt": "2026-05-14T10:00:00.000Z",
  "options": [
    {
      "id": "option-uuid",
      "content": "Dừng lại",
      "isCorrect": true,
      "displayOrder": 1
    }
  ]
}
```

### TopicResponse

```json
{
  "id": "topic-uuid",
  "name": "Biển báo giao thông",
  "description": "Nhóm câu hỏi về biển báo",
  "parentId": null,
  "createdAt": "2026-05-14T10:00:00.000Z"
}
```

---

## Endpoints - Topics

### POST `/questions/topics`

Tạo topic mới.

```json
{
  "name": "Biển báo giao thông",
  "description": "Nhóm câu hỏi về biển báo",
  "parentId": null
}
```

**Response `201 Created`:** `data` là `TopicResponse`.

### GET `/questions/topics`

List topic có phân trang.

| Param      | Type   | Default |
| ---------- | ------ | ------: |
| `page`     | number |       1 |
| `size`     | number |      20 |
| `parentId` | UUID   |       - |

### GET `/questions/topics/:id`

Lấy chi tiết topic.

### PATCH `/questions/topics/:id`

Cập nhật `name`, `description`, hoặc `parentId`.

---

## Endpoints - Questions

### POST `/questions`

Tạo question mới. `createdById` lấy từ `sub` trong JWT của caller.

**Headers**

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**

```json
{
  "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
  "type": "THEORY",
  "licenseCategories": ["B2"],
  "difficulty": "EASY",
  "explanation": "Đèn đỏ yêu cầu dừng lại trước vạch dừng.",
  "imageUrl": null,
  "mediaFileId": "media-file-uuid",
  "isCritical": false,
  "isActive": true,
  "topicId": "topic-uuid",
  "options": [
    { "content": "Dừng lại", "isCorrect": true, "displayOrder": 1 },
    { "content": "Đi tiếp", "isCorrect": false, "displayOrder": 2 }
  ]
}
```

Validation chính:

| Field                    | Rule                                  |
| ------------------------ | ------------------------------------- |
| `content`                | required, max 2000 chars              |
| `licenseCategories`      | 1..n enum values                      |
| `options`                | 2..6 items                            |
| `options[].content`      | required, max 500 chars               |
| `options[].isCorrect`    | exactly one correct option            |
| `options[].displayOrder` | positive integer, unique per question |

Nếu body có `mediaFileId`, question-service publish event `question.image.linked` sang `media-service` để mark file `LINKED`.

**Response `201 Created`:** `data` là `QuestionResponse`.

**Event published:** `question.created`.

**Event published when `mediaFileId` is present:** `question.image.linked`.

Media integration dùng event-driven pattern: question-service chỉ lưu UUID reference và publish `question.image.linked`; media-service consume event để mark FileObject thành `LINKED`. Question-service không gọi trực tiếp Azure Blob và không truy cập DB của media-service.

### GET `/questions`

Search question bank có filter và pagination.

| Param             | Type               | Default |
| ----------------- | ------------------ | ------: |
| `page`            | number             |       1 |
| `size`            | number             |      20 |
| `keyword`         | string             |       - |
| `licenseCategory` | LicenseCategory    |       - |
| `type`            | QuestionType       |       - |
| `difficulty`      | QuestionDifficulty |       - |
| `topicId`         | UUID               |       - |
| `isCritical`      | boolean            |       - |
| `isActive`        | boolean            |       - |
| `includeDeleted`  | boolean            |   false |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "size": 20
  }
}
```

### GET `/questions/:id`

Lấy chi tiết question. Response có `options[].isCorrect`.

### PATCH `/questions/:id`

Cập nhật question. Bắt buộc gửi `version`.

```json
{
  "version": 1,
  "content": "Nội dung mới",
  "isActive": false
}
```

Nếu `version` không khớp, response `409 QUESTION_VERSION_CONFLICT`. Nếu `isActive` chuyển từ `true` sang `false`, publish `question.deactivated`.

### DELETE `/questions/:id`

Soft delete question. `deletedById` lấy từ `sub` trong JWT của caller.

```json
{ "version": 2 }
```

Response `200 OK`: `QuestionResponse` với `isDeleted=true`, `isActive=false`.

**Event published:** `question.deactivated`.

### POST `/questions/pool`

Endpoint nội bộ cho exam-service lấy question pool active và chưa soft-delete.

```json
{
  "licenseCategory": "B2",
  "size": 25,
  "type": "THEORY",
  "difficulty": "EASY",
  "topicId": "topic-uuid",
  "isCritical": false,
  "excludeQuestionIds": ["question-uuid"]
}
```

Response:

```json
{
  "items": [
    {
      "id": "question-uuid",
      "content": "...",
      "options": [
        {
          "id": "option-uuid",
          "content": "...",
          "isCorrect": true,
          "displayOrder": 1
        }
      ]
    }
  ]
}
```

Note: pool response có đáp án đúng để exam-service snapshot/grade nội bộ. Không expose response này trực tiếp cho student client.

---

## Events Published

### `question.created`

```json
{
  "eventName": "question.created",
  "questionId": "question-uuid",
  "licenseCategories": ["B2"],
  "isCritical": false
}
```

### `question.deactivated`

```json
{
  "eventName": "question.deactivated",
  "questionId": "question-uuid"
}
```

### `question.image.linked`

```json
{
  "eventName": "question.image.linked",
  "questionId": "question-uuid",
  "mediaFileId": "media-file-uuid"
}
```
