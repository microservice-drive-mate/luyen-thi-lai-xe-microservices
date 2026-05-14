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

Question-service hien validate JWT/RBAC tai service bang Keycloak guard. Frontend goi qua Kong va gui `Authorization: Bearer <access_token>`; Kong forward header nay vao service. Service lay actor id tu `JWT.sub`, con `x-user-id` chi la fallback cho debug/local script cu.

| Endpoint                                                                                                      | Role                                    |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `POST /questions`, `GET /questions`, `GET /questions/:id`, `PATCH /questions/:id`, `DELETE /questions/:id`    | `ADMIN`, `CENTER_MANAGER`               |
| `POST /questions/topics`, `GET /questions/topics`, `GET /questions/topics/:id`, `PATCH /questions/topics/:id` | `ADMIN`, `CENTER_MANAGER`               |
| `POST /questions/pool`                                                                                        | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |

Kong OSS trong repo dang dung routing, CORS va rate-limiting. OIDC plugin khong co san trong image OSS; service-level Keycloak guard la diem enforce auth hien tai.

Business API path la `/questions/*`; Swagger/docs path la `/question-service/docs`.

---

## Gateway / Kong

Question-service da co route trong `kong/kong.dev.yaml`:

| Public path qua Kong                               | Upstream local service                       |
| -------------------------------------------------- | -------------------------------------------- |
| `http://localhost:8000/questions`                  | `http://host.docker.internal:3005/questions` |
| `http://localhost:8000/question-service/docs`      | `http://host.docker.internal:3005/docs`      |
| `http://localhost:8000/question-service/docs-json` | `http://host.docker.internal:3005/docs-json` |

Khi test direct local, goi `http://localhost:3005`. Khi test dung kien truc gateway, goi `http://localhost:8000/questions`.

```bash
curl -s http://localhost:8000/questions | jq .
curl -s http://localhost:8000/question-service/docs-json | jq '.info.title'
```

Kong OSS trong repo dang dung routing, CORS va rate-limiting. JWT/RBAC duoc enforce tai question-service bang Keycloak guard.

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

Loi domain:

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

| HTTP | Code                        | Nguyen nhan                                         |
| ---: | --------------------------- | --------------------------------------------------- |
|  400 | `VALIDATION_ERROR`          | Body/query khong hop le                             |
|  400 | `INVALID_QUESTION`          | Vi pham invariant cua question/topic                |
|  404 | `QUESTION_NOT_FOUND`        | Khong tim thay question                             |
|  404 | `QUESTION_TOPIC_NOT_FOUND`  | Khong tim thay topic                                |
|  409 | `QUESTION_DUPLICATE`        | Question cung normalized content + topic da ton tai |
|  409 | `QUESTION_VERSION_CONFLICT` | Optimistic concurrency conflict                     |
|  422 | `QUESTION_ALREADY_DELETED`  | Thao tac tren question da soft-delete               |

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

Admin/detail response co `options[].isCorrect`. Field nay phuc vu quan tri va endpoint noi bo; cac API client-facing cua exam-service sau nay phai loai bo dap an dung.

Anh cau hoi nen dung `mediaFileId` de reference `media-service` FileObject. `imageUrl` chi la URL hien thi/denormalized neu client da co URL truc tiep; question-service khong upload file va khong quan ly Azure Blob.

```json
{
  "id": "question-uuid",
  "content": "Khi gap den do, nguoi lai xe phai lam gi?",
  "type": "THEORY",
  "licenseCategories": ["B2"],
  "difficulty": "EASY",
  "explanation": "Den do yeu cau dung lai truoc vach dung.",
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
      "content": "Dung lai",
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
  "name": "Bien bao giao thong",
  "description": "Nhom cau hoi ve bien bao",
  "parentId": null,
  "createdAt": "2026-05-14T10:00:00.000Z"
}
```

---

## Endpoints - Topics

### POST `/questions/topics`

Tao topic moi.

```json
{
  "name": "Bien bao giao thong",
  "description": "Nhom cau hoi ve bien bao",
  "parentId": null
}
```

**Response `201 Created`:** `data` la `TopicResponse`.

### GET `/questions/topics`

List topic co phan trang.

| Param      | Type   | Default |
| ---------- | ------ | ------: |
| `page`     | number |       1 |
| `size`     | number |      20 |
| `parentId` | UUID   |       - |

### GET `/questions/topics/:id`

Lay chi tiet topic.

### PATCH `/questions/topics/:id`

Cap nhat `name`, `description`, hoac `parentId`.

---

## Endpoints - Questions

### POST `/questions`

Tao question moi. `createdById` lay tu `sub` trong JWT cua caller.

**Headers**

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**

```json
{
  "content": "Khi gap den do, nguoi lai xe phai lam gi?",
  "type": "THEORY",
  "licenseCategories": ["B2"],
  "difficulty": "EASY",
  "explanation": "Den do yeu cau dung lai truoc vach dung.",
  "imageUrl": null,
  "mediaFileId": "media-file-uuid",
  "isCritical": false,
  "isActive": true,
  "topicId": "topic-uuid",
  "options": [
    { "content": "Dung lai", "isCorrect": true, "displayOrder": 1 },
    { "content": "Di tiep", "isCorrect": false, "displayOrder": 2 }
  ]
}
```

Validation chinh:

| Field                    | Rule                                  |
| ------------------------ | ------------------------------------- |
| `content`                | required, max 2000 chars              |
| `licenseCategories`      | 1..n enum values                      |
| `options`                | 2..6 items                            |
| `options[].content`      | required, max 500 chars               |
| `options[].isCorrect`    | exactly one correct option            |
| `options[].displayOrder` | positive integer, unique per question |

Neu body co `mediaFileId`, question-service publish event `question.image.linked` sang `media-service` de mark file `LINKED`.

**Response `201 Created`:** `data` la `QuestionResponse`.

**Event published:** `question.created`.

**Event published when `mediaFileId` is present:** `question.image.linked`.

Media integration dung event-driven pattern: question-service chi luu UUID reference va publish `question.image.linked`; media-service consume event de mark FileObject thanh `LINKED`. Question-service khong goi truc tiep Azure Blob va khong truy cap DB cua media-service.

### GET `/questions`

Search question bank co filter va pagination.

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

Lay chi tiet question. Response co `options[].isCorrect`.

### PATCH `/questions/:id`

Cap nhat question. Bat buoc gui `version`.

```json
{
  "version": 1,
  "content": "Noi dung moi",
  "isActive": false
}
```

Neu `version` khong khop, response `409 QUESTION_VERSION_CONFLICT`. Neu `isActive` chuyen tu `true` sang `false`, publish `question.deactivated`.

### DELETE `/questions/:id`

Soft delete question. `deletedById` lay tu `sub` trong JWT cua caller.

```json
{ "version": 2 }
```

Response `200 OK`: `QuestionResponse` voi `isDeleted=true`, `isActive=false`.

**Event published:** `question.deactivated`.

### POST `/questions/pool`

Endpoint noi bo cho exam-service lay question pool active va chua soft-delete.

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

Note: pool response co dap an dung de exam-service snapshot/grade noi bo. Khong expose response nay truc tiep cho student client.

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
