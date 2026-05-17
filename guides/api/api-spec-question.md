# Question Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service path:** `/admin/questions`  
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
| `POST /admin/questions`, `GET /admin/questions`, `GET /admin/questions/:id`, `PATCH /admin/questions/:id`, `DELETE /admin/questions/:id`    | `ADMIN`, `CENTER_MANAGER`               |
| `POST /admin/questions/topics`, `GET /admin/questions/topics`, `GET /admin/questions/topics/:id`, `PATCH /admin/questions/topics/:id` | `ADMIN`, `CENTER_MANAGER`               |
| `POST /admin/questions/pool`                                                                                        | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |

Kong OSS trong repo đang dùng routing, CORS và rate-limiting. OIDC plugin không có sẵn trong image OSS; service-level Keycloak guard là điểm enforce auth hiện tại.

Admin dashboard business API path là `/admin/questions/*`; Swagger/docs path là `/question-service/docs`. Không còn public route `/questions/*` cho frontend hoặc Kong.

---

## Gateway / Kong

Question-service đã có route trong `kong/kong.dev.yaml`:

| Public path qua Kong                               | Upstream local service                       |
| -------------------------------------------------- | -------------------------------------------- |
| `http://localhost:8000/admin/questions`                  | `http://host.docker.internal:3005/admin/questions` |
| `http://localhost:8000/question-service/docs`      | `http://host.docker.internal:3005/docs`      |
| `http://localhost:8000/question-service/docs-json` | `http://host.docker.internal:3005/docs-json` |

Khi test direct local, gọi `http://localhost:3005`. Khi test dùng kiến trúc gateway, gọi `http://localhost:8000/admin/questions`.

```bash
curl -s http://localhost:8000/admin/questions | jq .
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
  "path": "/admin/questions",
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
  "path": "/admin/questions/abc"
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

### POST `/admin/questions/topics`

Tạo topic mới.

```json
{
  "name": "Biển báo giao thông",
  "description": "Nhóm câu hỏi về biển báo",
  "parentId": null
}
```

**Response `201 Created`:** `data` là `TopicResponse`.

### GET `/admin/questions/topics`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Query details**

| Param | Type | Default | Validation | Description |
| --- | --- | ---: | --- | --- |
| `page` | number | 1 | integer, `>= 1` | Page index. |
| `size` | number | 20 | integer, `1..100` | Items per page. |
| `parentId` | UUID | - | optional UUID | Filter child topics by parent topic. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "topic-uuid",
        "name": "Bien bao giao thong",
        "description": "Nhom cau hoi ve bien bao",
        "parentId": null,
        "createdAt": "2026-05-14T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

List topic có phân trang.

| Param      | Type   | Default |
| ---------- | ------ | ------: |
| `page`     | number |       1 |
| `size`     | number |      20 |
| `parentId` | UUID   |       - |

### GET `/admin/questions/topics/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Topic id. |

**Response `200 OK`:** `data` is `TopicResponse`.

**Errors:** `QUESTION_TOPIC_NOT_FOUND`.

Lấy chi tiết topic.

### PATCH `/admin/questions/topics/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Body**

```json
{
  "name": "Bien bao cam",
  "description": "Nhom cau hoi ve bien bao cam",
  "parentId": "parent-topic-uuid"
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `name` | string | No | non-empty when present | Topic display name. |
| `description` | string | No | optional | Topic description. |
| `parentId` | UUID/null | No | optional UUID/null | Parent topic id; use null for root topic. |

**Response `200 OK`:** `data` is updated `TopicResponse`.

Cập nhật `name`, `description`, hoặc `parentId`.

---

## Endpoints - Questions

### POST `/admin/questions`

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

### GET `/admin/questions`

**Auth:** `ADMIN`, `CENTER_MANAGER`

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

### GET `/admin/questions/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Question id. |

**Response `200 OK`:** `data` is `QuestionResponse`.

Frontend/admin note: this endpoint is safe for question management screens only. It includes `options[].isCorrect`; do not expose this response to students.

**Errors:** `QUESTION_NOT_FOUND`.

Lấy chi tiết question. Response có `options[].isCorrect`.

### PATCH `/admin/questions/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Question id. |

Cập nhật question. Bắt buộc gửi `version`.

```json
{
  "version": 1,
  "content": "Nội dung mới",
  "isActive": false
}
```

Nếu `version` không khớp, response `409 QUESTION_VERSION_CONFLICT`. Nếu `isActive` chuyển từ `true` sang `false`, publish `question.deactivated`.

Common update fields:

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `version` | number | Yes | integer | Current version from latest question response. |
| `content` | string | No | max 2000 chars | Question text. |
| `type` | QuestionType | No | enum | Question category/type. |
| `licenseCategories` | LicenseCategory[] | No | non-empty enum array | License tiers this question applies to. |
| `difficulty` | QuestionDifficulty | No | enum | Difficulty filter/display value. |
| `explanation` | string | No | optional | Explanation for admins/internal use. |
| `imageUrl` | string/null | No | optional URL/null | Display URL if already available. |
| `mediaFileId` | UUID/null | No | optional UUID/null | Reference to media-service file metadata. |
| `isCritical` | boolean | No | boolean | Critical question flag. |
| `isActive` | boolean | No | boolean | Active question can be used in pools. |
| `topicId` | UUID | No | UUID | Topic id. |
| `options` | array | No | 2..6 items | Replacement option set; exactly one option must be correct. |

**Response `200 OK`:** `data` is updated `QuestionResponse`.

### DELETE `/admin/questions/:id`

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Question id. |

Soft delete question. `deletedById` lấy từ `sub` trong JWT của caller.

```json
{ "version": 2 }
```

Response `200 OK`: `QuestionResponse` với `isDeleted=true`, `isActive=false`.

**Event published:** `question.deactivated`.

### POST `/admin/questions/pool`

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` or service-account token used by exam-service.

Frontend note: student clients must not call this endpoint. Use `GET /exams/available` and `POST /exams/sessions` instead.

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

Request fields:

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `licenseCategory` | LicenseCategory | Yes | enum | Required license tier. |
| `size` | number | Yes | integer, `>= 1` | Number of questions requested. |
| `type` | QuestionType | No | enum | Optional type filter. |
| `difficulty` | QuestionDifficulty | No | enum | Optional difficulty filter. |
| `topicId` | UUID | No | UUID | Optional topic filter. |
| `isCritical` | boolean | No | boolean | Optional critical filter. |
| `excludeQuestionIds` | UUID[] | No | optional array | Questions to exclude from pool. |

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
