# Exam Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service path:** `/exams`  
**Direct local:** `http://localhost:3003`  
**Swagger UI:** `http://localhost:3003/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/exam-service/docs`  
**OpenAPI JSON:** `http://localhost:3003/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/exam-service/docs-json`  
**Version:** 1.0.0

Business API path là `/exams/*`; Swagger/docs path là `/exam-service/docs`.

## Authentication

Exam-service validate JWT/RBAC tại service bằng `nest-keycloak-connect`. Frontend gọi qua Kong và gửi `Authorization: Bearer <access_token>`.

| Endpoint | Role |
| --- | --- |
| `POST /admin/exams/templates` | `ADMIN` |
| `GET /admin/exams/templates` | `ADMIN` |
| `GET /admin/exams/templates/:id` | `ADMIN` |
| `PATCH /admin/exams/templates/:id` | `ADMIN` |
| `DELETE /admin/exams/templates/:id` | `ADMIN` |
| `GET /exams/available` | `STUDENT` |
| `POST /exams/sessions` | `STUDENT` |
| `GET /exams/sessions` | `STUDENT` |
| `GET /exams/sessions/:id/questions` | `STUDENT`, owner only |
| `PATCH /exams/sessions/:id/answers` | `STUDENT`, owner only |
| `POST /exams/sessions/:id/submit` | `STUDENT`, owner only |
| `GET /exams/sessions/:id/result` | `STUDENT`, owner only |

Exam-service gọi nội bộ `question-service /admin/questions/pool` bằng Keycloak client-credentials token. Không expose endpoint pool trực tiếp cho student.

## Error Codes

| HTTP | Code |
| ---: | --- |
| 400 | `INVALID_EXAM_TEMPLATE`, `INVALID_EXAM_SESSION`, `VALIDATION_ERROR` |
| 403 | `EXAM_SESSION_UNAUTHORIZED`, `STUDENT_LICENSE_MISMATCH`, `FORBIDDEN` |
| 404 | `EXAM_TEMPLATE_NOT_FOUND`, `EXAM_SESSION_NOT_FOUND`, `EXAM_SESSION_QUESTION_NOT_FOUND` |
| 409 | `EXAM_TEMPLATE_VERSION_CONFLICT`, `EXAM_TEMPLATE_IN_USE`, `EXAM_SESSION_ALREADY_FINISHED`, `EXAM_SESSION_EXPIRED` |
| 422 | `EXAM_TEMPLATE_INACTIVE`, `STUDENT_PROFILE_INVALID`, `EXAM_SESSION_NOT_FINISHED`, `INSUFFICIENT_QUESTION_POOL` |

## Enums

`LicenseCategory`: `A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`  
`ExamSessionStatus`: `IN_PROGRESS` | `COMPLETED` | `TIMED_OUT` | `CANCELLED`

## Student-Facing Question Confidentiality

Student-facing question payload intentionally excludes `correctOptionId`, `options[].isCorrect`, explanation, and scoring metadata.

```json
{
  "questionId": "question-uuid",
  "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
  "options": [
    { "id": "option-1", "content": "Dừng lại", "displayOrder": 1 },
    { "id": "option-2", "content": "Đi tiếp", "displayOrder": 2 }
  ],
  "displayOrder": 1,
  "isCritical": false,
  "isBookmarked": false,
  "selectedOptionId": null
}
```

## Endpoints

### GET `/exams/available`

List active exam templates that the current student can start. Frontend should call this endpoint before `POST /exams/sessions`.

Auth: `STUDENT`. The service reads `JWT.sub`, calls `user-service /users/me` using the same bearer token, and matches templates by `studentDetail.licenseTier`.

Query params:

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |

Response `200 OK`:

```json
{
  "items": [
    {
      "id": "template-uuid",
      "name": "Đề thi B2 cơ bản",
      "licenseCategory": "B2",
      "totalQuestions": 30,
      "passingScore": 26,
      "durationMinutes": 20
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

Student-safe response intentionally excludes admin metadata: `createdById`, `isDeleted`, `version`, `createdAt`, `updatedAt`.

Behavior:

- inactive, deleted, or different-license templates are not returned.
- student with `studentDetail.licenseTier = null` receives an empty list.
- inactive/non-student/missing student detail profile returns `STUDENT_PROFILE_INVALID`.

### POST `/admin/exams/templates`

Create an exam template. This is an admin-only blueprint; students do not call this endpoint directly.

**Auth:** `ADMIN`

**Body**

```json
{
  "name": "Đề thi B2 cơ bản",
  "licenseCategory": "B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `name` | string | Yes | non-empty | Display name shown to admins and students through `GET /exams/available`. |
| `licenseCategory` | LicenseCategory | Yes | enum | License tier this template belongs to. |
| `totalQuestions` | number | Yes | integer, `>= 1` | Number of questions pulled from question-service when a session starts. |
| `passingScore` | number | Yes | integer, `1..totalQuestions` | Minimum score to pass, unless failed by critical question. |
| `durationMinutes` | number | Yes | integer, `1..180` | Session time limit. |

**Response `201 Created`**

`data` is `ExamTemplateResponse` with `version=1`, `isActive=true`, `isDeleted=false`.

Frontend/admin UI note: store `version` from this response if the next action is update/delete.

### GET `/admin/exams/templates`

List templates for admin management.

**Auth:** `ADMIN`

**Query**

| Param | Type | Default | Validation | Description |
| --- | --- | ---: | --- | --- |
| `page` | number | 1 | integer, `>= 1` | Page index. |
| `size` | number | 20 | integer, `1..100` | Items per page. |
| `licenseCategory` | LicenseCategory | - | optional enum | Filter by license tier. |
| `isActive` | boolean | - | optional boolean | Filter active/inactive templates. |
| `includeDeleted` | boolean | false | optional boolean | Include soft-deleted templates when true. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "id": "template-uuid",
        "name": "De thi B2 co ban",
        "licenseCategory": "B2",
        "totalQuestions": 30,
        "passingScore": 26,
        "durationMinutes": 20,
        "isActive": true,
        "isDeleted": false,
        "version": 1,
        "createdById": "admin-user-id",
        "createdAt": "2026-05-14T10:00:00.000Z",
        "updatedAt": "2026-05-14T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

### GET `/admin/exams/templates/:id`

Get one template for admin edit/detail screen.

**Auth:** `ADMIN`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam template id. |

**Response `200 OK`:** `data` is `ExamTemplateResponse`.

**Errors:** `EXAM_TEMPLATE_NOT_FOUND` if the id does not exist.

### PATCH `/admin/exams/templates/:id`

Optimistic concurrency uses `version`.

**Auth:** `ADMIN`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam template id. |

**Body**

```json
{
  "version": 1,
  "name": "Đề thi B2 cập nhật",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "isActive": true
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `version` | number | Yes | integer | Current version from latest template response. |
| `name` | string | No | non-empty when present | New display name. |
| `totalQuestions` | number | No | integer, `>= 1` | New question count. |
| `passingScore` | number | No | integer, `1..totalQuestions` | New passing score. |
| `durationMinutes` | number | No | integer, `1..180` | New duration. |
| `isActive` | boolean | No | boolean | Enable or disable this template for student starts. |

**Response `200 OK`:** `data` is updated `ExamTemplateResponse`; `version` increments.

**Errors:** `EXAM_TEMPLATE_VERSION_CONFLICT`, `INVALID_EXAM_TEMPLATE`, `EXAM_TEMPLATE_NOT_FOUND`.

### DELETE `/admin/exams/templates/:id`

Soft delete an unused template.

**Auth:** `ADMIN`

```json
{ "version": 1 }
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | number | Yes | Current version from latest template response. |

**Response `200 OK`:** `data` is template with `isDeleted=true`, `isActive=false`.

Template with sessions returns `EXAM_TEMPLATE_IN_USE`.

### POST `/exams/sessions`

Start exam session for current student. Exam-service validates current profile by calling `user-service /users/me` and checks `studentDetail.licenseTier` against the template.

Auth: `STUDENT`, owner is `JWT.sub`.

```json
{
  "templateId": "template-uuid"
}
```

Request DTO:

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `templateId` | UUID | Yes | `IsUUID` | Template id selected from `GET /exams/available`. |

Response `201 Created`: session bootstrap with student-safe question snapshots. The response includes `questions[]` so frontend can render the exam immediately without a second request.

### GET `/exams/sessions`

List current student exam history. Query params: `page`, `size`, `status`.

Query params:

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |
| `status` | ExamSessionStatus | - | optional enum |

Response item shape is `ExamSessionResponse`. For `IN_PROGRESS` sessions, `questions[].isCorrect` is not returned.

### GET `/exams/sessions/:id/questions`

Return current session questions without answer keys.

Auth: `STUDENT`, owner only. Other students receive `EXAM_SESSION_UNAUTHORIZED`.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam session id. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "items": [
      {
        "questionId": "question-uuid",
        "content": "Question content",
        "options": [
          { "id": "option-1", "content": "Answer A", "displayOrder": 1 }
        ],
        "displayOrder": 1,
        "isCritical": false,
        "isBookmarked": false,
        "selectedOptionId": null
      }
    ]
  }
}
```

Frontend note: render questions by `displayOrder`; use `questionId` and `options[].id` for autosave.

### PATCH `/exams/sessions/:id/answers`

```json
{
  "questionId": "question-uuid",
  "selectedOptionId": "option-uuid",
  "isBookmarked": true
}
```

Autosave is allowed only while session is active and not expired.

Request DTO:

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `questionId` | UUID/string | Yes | non-empty | Question id from session snapshot. |
| `selectedOptionId` | UUID/string | No | optional | Selected option id. Omit for bookmark-only update. |
| `isBookmarked` | boolean | No | optional | Bookmark flag. |

### POST `/exams/sessions/:id/submit`

Submit and synchronously grade. Each correct answer is 1 point; wrong/unanswered critical question fails the session even if score reaches threshold.

**Auth:** `STUDENT`, owner only.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam session id. |

**Body:** no body.

Response `200 OK`: result with `questions[].isCorrect`. Result still does not expose `correctOptionId` or `options[].isCorrect`.

**Errors:** `EXAM_SESSION_ALREADY_FINISHED`, `EXAM_SESSION_UNAUTHORIZED`, `EXAM_SESSION_NOT_FOUND`.

### GET `/exams/sessions/:id/result`

Return graded result. If session is still `IN_PROGRESS`, returns `EXAM_SESSION_NOT_FINISHED`.

**Auth:** `STUDENT`, owner only.

**Response `200 OK`:** same result DTO as submit.

Frontend note: use this endpoint for result screen refresh/deep link; use submit response for immediate result after finishing.

## Events Published

### `exam.session.completed`

```json
{
  "eventName": "exam.session.completed",
  "sessionId": "session-uuid",
  "studentId": "student-user-id",
  "score": 26,
  "isPassed": true,
  "licenseCategory": "B2"
}
```

### `exam.session.passed`

```json
{
  "eventName": "exam.session.passed",
  "sessionId": "session-uuid",
  "studentId": "student-user-id",
  "licenseCategory": "B2"
}
```

### `exam.session.failed`

```json
{
  "eventName": "exam.session.failed",
  "sessionId": "session-uuid",
  "studentId": "student-user-id",
  "failedByCritical": true,
  "licenseCategory": "B2"
}
```
