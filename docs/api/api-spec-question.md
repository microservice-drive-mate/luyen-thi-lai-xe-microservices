# Question Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service path:** `/admin/questions`  
**Direct local:** `http://localhost:3005`  
**Swagger UI:** `http://localhost:3005/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/question-service/docs`  
**OpenAPI JSON:** `http://localhost:3005/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/question-service/docs-json`  
**Version:** 1.0.0

Question-service validate JWT/RBAC tại service bằng Keycloak guard. Frontend gọi qua Kong và gửi `Authorization: Bearer <access_token>`.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `POST /admin/questions/topics` | `ADMIN`, `CENTER_MANAGER` |
| `GET /admin/questions/topics` | `ADMIN`, `CENTER_MANAGER` |
| `GET /admin/questions/topics/:id` | `ADMIN`, `CENTER_MANAGER` |
| `PATCH /admin/questions/topics/:id` | `ADMIN`, `CENTER_MANAGER` |
| `POST /admin/questions` | `ADMIN`, `CENTER_MANAGER` |
| `GET /admin/questions` | `ADMIN`, `CENTER_MANAGER` |
| `GET /admin/questions/:id` | `ADMIN`, `CENTER_MANAGER` |
| `PATCH /admin/questions/:id` | `ADMIN`, `CENTER_MANAGER` |
| `DELETE /admin/questions/:id` | `ADMIN`, `CENTER_MANAGER` |
| `POST /admin/questions/pool` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` or exam-service service account |

---

## Response Format

Tất cả HTTP success response được bọc bởi `ApiResponseInterceptor`.

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
  "message": "Question not found: question-uuid",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/question-uuid"
}
```

---

## Error Codes

| HTTP | Code | Nguyên nhân |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_QUESTION` | Body/query hoặc invariant không hợp lệ |
| 404 | `QUESTION_NOT_FOUND` | Không tìm thấy question |
| 404 | `QUESTION_TOPIC_NOT_FOUND` | Không tìm thấy topic |
| 409 | `QUESTION_DUPLICATE` | Question trùng normalized content + topic |
| 409 | `QUESTION_VERSION_CONFLICT` | Optimistic concurrency conflict |
| 422 | `QUESTION_ALREADY_DELETED` | Thao tác trên question đã soft-delete |

---

## Enums

`LicenseCategory`: `A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`  
`QuestionType`: `THEORY` | `TRAFFIC_SIGN` | `SCENARIO_RELATED`  
`QuestionDifficulty`: `EASY` | `MEDIUM` | `HARD`

---

## Seeded 600-Question Bank

The local/demo seed imports the 600-question bank from `seed/600-cau-hoi.docx` and marks 60 official critical questions with `isCritical = true`.

Critical question numbers:

```text
19,20,21,22,23,24,25,26,27,28,
30,32,34,35,47,48,52,53,55,58,
63,64,65,66,67,68,70,71,72,73,
74,85,86,87,88,89,90,91,92,93,
97,98,102,117,163,165,167,197,198,206,
215,226,234,245,246,252,253,254,255,260
```

Critical counts by seeded topic:

| Topic range | Critical count |
| --- | ---: |
| `1-180` | 47 |
| `181-205` | 2 |
| `206-263` | 11 |
| `264-300` | 0 |
| `301-485` | 0 |
| `486-600` | 0 |

Exam templates with `criticalQuestions > 0` must include at least one topic from the first three ranges in `topicDistribution`.

---

## Image Contract

Ảnh câu hỏi nên dùng `mediaFileId` để reference `media-service` FileObject. Frontend gọi `GET /media/files/:mediaFileId/url` để lấy presigned URL rồi render ảnh. `imageUrl` là URL blob ổn định/fallback, nhưng có thể không đọc trực tiếp được nếu Azure container private.

Nếu body create/update có `mediaFileId`, question-service publish event `question.image.linked`; media-service consume event này để mark file thành `LINKED`.

---

## Topic Endpoints

### POST `/admin/questions/topics`

Tạo topic mới.

**Body**

```json
{
  "name": "Biển báo giao thông",
  "description": "Nhóm câu hỏi về biển báo",
  "parentId": null
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/topics",
  "data": {
    "id": "topic-uuid",
    "name": "Biển báo giao thông",
    "description": "Nhóm câu hỏi về biển báo",
    "parentId": null,
    "createdAt": "2026-05-14T10:00:00.000Z"
  }
}
```

---

### GET `/admin/questions/topics`

List topic có phân trang.

**Query**

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |
| `parentId` | UUID | - | optional UUID |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/topics",
  "data": {
    "items": [
      {
        "id": "topic-uuid",
        "name": "Biển báo giao thông",
        "description": "Nhóm câu hỏi về biển báo",
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

---

### GET `/admin/questions/topics/:id`

Lấy chi tiết topic.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/topics/topic-uuid",
  "data": {
    "id": "topic-uuid",
    "name": "Biển báo giao thông",
    "description": "Nhóm câu hỏi về biển báo",
    "parentId": null,
    "createdAt": "2026-05-14T10:00:00.000Z"
  }
}
```

---

### PATCH `/admin/questions/topics/:id`

Cập nhật `name`, `description`, hoặc `parentId`.

**Body**

```json
{
  "name": "Biển báo cấm",
  "description": "Nhóm câu hỏi về biển báo cấm",
  "parentId": "parent-topic-uuid"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/topics/topic-uuid",
  "data": {
    "id": "topic-uuid",
    "name": "Biển báo cấm",
    "description": "Nhóm câu hỏi về biển báo cấm",
    "parentId": "parent-topic-uuid",
    "createdAt": "2026-05-14T10:00:00.000Z"
  }
}
```

---

## Question Endpoints

### POST `/admin/questions`

Tạo question mới. `createdById` lấy từ `sub` trong JWT của caller.

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

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions",
  "data": {
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
}
```

**Event published:** `question.created`; nếu có `mediaFileId` thì publish thêm `question.image.linked`.

---

### GET `/admin/questions`

Search question bank có filter và pagination.

**Query**

| Param | Type | Default |
| --- | --- | ---: |
| `page` | number | 1 |
| `size` | number | 20 |
| `keyword` | string | - |
| `licenseCategory` | LicenseCategory | - |
| `type` | QuestionType | - |
| `difficulty` | QuestionDifficulty | - |
| `topicId` | UUID | - |
| `isCritical` | boolean | - |
| `isActive` | boolean | - |
| `includeDeleted` | boolean | false |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions",
  "data": {
    "items": [
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
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/admin/questions/:id`

Lấy chi tiết question. Response có `options[].isCorrect`; chỉ dùng cho admin/internal, không expose trực tiếp cho student.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/question-uuid",
  "data": {
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
}
```

---

### PATCH `/admin/questions/:id`

Cập nhật question. Bắt buộc gửi `version`.

**Body**

```json
{
  "version": 1,
  "content": "Nội dung mới",
  "isActive": false
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/question-uuid",
  "data": {
    "id": "question-uuid",
    "content": "Nội dung mới",
    "type": "THEORY",
    "licenseCategories": ["B2"],
    "difficulty": "EASY",
    "explanation": "Đèn đỏ yêu cầu dừng lại trước vạch dừng.",
    "imageUrl": null,
    "mediaFileId": "media-file-uuid",
    "isCritical": false,
    "isActive": false,
    "isDeleted": false,
    "topicId": "topic-uuid",
    "createdById": "admin-uuid",
    "version": 2,
    "deletedById": null,
    "deletedAt": null,
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:05:00.000Z",
    "options": [
      {
        "id": "option-uuid",
        "content": "Dừng lại",
        "isCorrect": true,
        "displayOrder": 1
      }
    ]
  }
}
```

Nếu `version` không khớp, response `409 QUESTION_VERSION_CONFLICT`. Nếu `isActive` chuyển từ `true` sang `false`, publish `question.deactivated`.

---

### DELETE `/admin/questions/:id`

Soft delete question. `deletedById` lấy từ `sub` trong JWT của caller.

**Body**

```json
{
  "version": 2
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/question-uuid",
  "data": {
    "id": "question-uuid",
    "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
    "type": "THEORY",
    "licenseCategories": ["B2"],
    "difficulty": "EASY",
    "explanation": "Đèn đỏ yêu cầu dừng lại trước vạch dừng.",
    "imageUrl": null,
    "mediaFileId": "media-file-uuid",
    "isCritical": false,
    "isActive": false,
    "isDeleted": true,
    "topicId": "topic-uuid",
    "createdById": "admin-uuid",
    "version": 3,
    "deletedById": "admin-uuid",
    "deletedAt": "2026-05-14T10:10:00.000Z",
    "createdAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:10:00.000Z",
    "options": [
      {
        "id": "option-uuid",
        "content": "Dừng lại",
        "isCorrect": true,
        "displayOrder": 1
      }
    ]
  }
}
```

**Event published:** `question.deactivated`.

---

### POST `/admin/questions/pool`

Endpoint nội bộ cho exam-service lấy question pool active và chưa soft-delete. Student clients không gọi endpoint này. Với exam template có `topicDistribution`, exam-service có thể gọi endpoint này nhiều lần, mỗi lần truyền một `topicId` và `size` tương ứng để lấy đúng số câu theo từng topic.

**Body**

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

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions/pool",
  "data": {
    "items": [
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
    ]
  }
}
```

Pool response có đáp án đúng để exam-service snapshot/grade nội bộ. Không expose response này trực tiếp cho student client.

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

## Public Practice Endpoints

### GET `/questions/topics`

Student-safe topic list for practice screens. Same query shape as `GET /admin/questions/topics`.

**Auth:** `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER`

### GET `/questions/practice`

Returns active, non-deleted questions for practice. Query shape matches `GET /admin/questions`, but the response intentionally strips answer data:

- no `options[].isCorrect`
- no `isCritical`
- no `explanation`
- no `createdById` or versioning fields

**Auth:** `STUDENT`

```json
{
  "items": [
    {
      "id": "question-uuid",
      "content": "Question text",
      "type": "THEORY",
      "licenseCategories": ["B2"],
      "difficulty": "EASY",
      "imageUrl": null,
      "mediaFileId": null,
      "topicId": "topic-uuid",
      "options": [
        {
          "id": "option-uuid",
          "content": "Option text",
          "displayOrder": 1
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### POST `/questions/:id/report`

Creates a pending report for a question.

**Auth:** `STUDENT`

```json
{
  "reason": "WRONG_ANSWER",
  "message": "I think this question has an incorrect answer."
}
```
