# Exam Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/exams`, `/admin/exams/templates`, `/admin/exams/sessions`  
**Direct local:** `http://localhost:3003`  
**Swagger UI:** `http://localhost:3003/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/exam-service/docs`  
**OpenAPI JSON:** `http://localhost:3003/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/exam-service/docs-json`  
**Version:** 1.0.0

Exam-service dùng `ApiResponseInterceptor` từ `@repo/common`, nên tất cả HTTP success response đều được bọc trong format chung:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/available",
  "data": {}
}
```

Lỗi domain và validation cũng dùng format chung:

```json
{
  "success": false,
  "code": "EXAM_SESSION_NOT_FOUND",
  "message": "Exam session not found: session-uuid",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions/session-uuid/result"
}
```

---

## Authentication

Exam-service validate JWT/RBAC tại service bằng `nest-keycloak-connect`. Frontend gọi qua Kong và gửi:

```http
Authorization: Bearer <access_token>
```

| Endpoint | Role |
| --- | --- |
| `POST /admin/exams/templates` | `ADMIN` |
| `GET /admin/exams/templates` | `ADMIN` |
| `GET /admin/exams/templates/:id` | `ADMIN` |
| `PATCH /admin/exams/templates/:id` | `ADMIN` |
| `DELETE /admin/exams/templates/:id` | `ADMIN` |
| `GET /admin/exams/sessions` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /exams/available` | `STUDENT` |
| `POST /exams/sessions` | `STUDENT` |
| `GET /exams/sessions` | `STUDENT` |
| `GET /exams/review/missed-questions` | `STUDENT` |
| `GET /exams/sessions/:id/questions` | `STUDENT`, owner only |
| `PATCH /exams/sessions/:id/answers` | `STUDENT`, owner only |
| `POST /exams/sessions/:id/submit` | `STUDENT`, owner only |
| `GET /exams/sessions/:id/result` | `STUDENT`, owner only |

Exam-service gọi nội bộ `question-service /admin/questions/pool` bằng Keycloak client-credentials token. Endpoint pool không expose trực tiếp cho student.

---

## Error Codes

| HTTP | Code |
| ---: | --- |
| 400 | `INVALID_EXAM_TEMPLATE`, `INVALID_EXAM_SESSION`, `VALIDATION_ERROR` |
| 403 | `EXAM_SESSION_UNAUTHORIZED`, `STUDENT_LICENSE_MISMATCH`, `FORBIDDEN` |
| 404 | `EXAM_TEMPLATE_NOT_FOUND`, `EXAM_SESSION_NOT_FOUND`, `EXAM_SESSION_QUESTION_NOT_FOUND` |
| 409 | `EXAM_TEMPLATE_VERSION_CONFLICT`, `EXAM_TEMPLATE_IN_USE`, `EXAM_SESSION_ALREADY_FINISHED`, `EXAM_SESSION_EXPIRED` |
| 422 | `EXAM_TEMPLATE_INACTIVE`, `STUDENT_PROFILE_INVALID`, `EXAM_SESSION_NOT_FINISHED`, `INSUFFICIENT_QUESTION_POOL` |

---

## Enums

`LicenseCategory`: `A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`  
`ExamSessionStatus`: `IN_PROGRESS` | `COMPLETED` | `TIMED_OUT` | `CANCELLED`

---

## Shared Shapes

### Exam Template

```json
{
  "id": "template-uuid",
  "name": "Đề thi B2 cơ bản",
  "description": "De thi mo phong theo cau truc GPLX hang B2",
  "licenseCategory": "B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0,
  "shuffleQuestions": true,
  "topicDistribution": [
    {
      "topicId": "9f49045f-156e-5252-8486-babb36dc74fd",
      "questionCount": 9
    }
  ],
  "isActive": true,
  "isDeleted": false,
  "version": 1,
  "createdById": "admin-user-id",
  "createdAt": "2026-05-18T10:00:00.000Z",
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

`topicDistribution` uses strict counts: the sum of all `questionCount` values must equal `totalQuestions`. When a student starts a session, exam-service pulls exactly that many active questions per topic from question-service. If any topic lacks enough questions, the session start returns `INSUFFICIENT_QUESTION_POOL`.

Critical passing rule: `isPassed = score >= passingScore && criticalMistakes <= maxCriticalMistakes`.

Session timeout rule: exam-service uses server time and `expiresAt` as the source of truth. `submit`, `answers`, `questions`, and `result` touch points lazily finalize an expired `IN_PROGRESS` session as `TIMED_OUT`, persist the graded result, and publish the same completion/pass/fail events as submit. If the session is still `IN_PROGRESS` and not expired, `GET /result` returns `EXAM_SESSION_NOT_FINISHED`.

### Student-Safe Question

Student-facing question payload intentionally excludes `correctOptionId`, `options[].isCorrect`, `isCritical`, explanation, and scoring metadata.

```json
{
  "questionId": "question-uuid",
  "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
  "imageUrl": null,
  "mediaFileId": "media-file-uuid",
  "options": [
    {
      "id": "option-1",
      "content": "Dừng lại",
      "displayOrder": 1
    },
    {
      "id": "option-2",
      "content": "Đi tiếp",
      "displayOrder": 2
    }
  ],
  "displayOrder": 1,
  "isBookmarked": false,
  "selectedOptionId": null
}
```

If `mediaFileId` is present, frontend should call `GET /media/files/:mediaFileId/url` and use the returned presigned URL as the image `src`. `imageUrl` is a stable blob URL/fallback and may not be directly readable when the Azure container is private.

### Exam Session

For active sessions, `questions[].isCorrect` and `questions[].isCritical` are not returned.

```json
{
  "id": "session-uuid",
  "studentId": "student-user-id",
  "templateId": "template-uuid",
  "licenseCategory": "B2",
  "status": "IN_PROGRESS",
  "score": null,
  "isPassed": null,
  "failedByCritical": false,
  "criticalMistakes": 0,
  "maxCriticalMistakes": 0,
  "startedAt": "2026-05-18T10:00:00.000Z",
  "finishedAt": null,
  "expiresAt": "2026-05-18T10:20:00.000Z",
  "questions": [
    {
      "questionId": "question-uuid",
      "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
      "imageUrl": null,
      "mediaFileId": "media-file-uuid",
      "options": [
        {
          "id": "option-1",
          "content": "Dừng lại",
          "displayOrder": 1
        }
      ],
      "displayOrder": 1,
      "isBookmarked": false,
      "selectedOptionId": null
    }
  ]
}
```

### Exam Result

Submit/result responses include `questions[].isCorrect`, but still do not expose `correctOptionId`, `options[].isCorrect`, or `questions[].isCritical`. Fatal-question outcome is exposed only through aggregate result fields such as `failedByCritical` and `criticalMistakes`.

```json
{
  "id": "session-uuid",
  "studentId": "student-user-id",
  "templateId": "template-uuid",
  "licenseCategory": "B2",
  "status": "COMPLETED",
  "score": 26,
  "isPassed": true,
  "failedByCritical": false,
  "criticalMistakes": 0,
  "maxCriticalMistakes": 0,
  "startedAt": "2026-05-18T10:00:00.000Z",
  "finishedAt": "2026-05-18T10:15:00.000Z",
  "expiresAt": "2026-05-18T10:20:00.000Z",
  "questions": [
    {
      "questionId": "question-uuid",
      "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
      "imageUrl": null,
      "mediaFileId": "media-file-uuid",
      "options": [
        {
          "id": "option-1",
          "content": "Dừng lại",
          "displayOrder": 1
        }
      ],
      "displayOrder": 1,
      "isBookmarked": false,
      "selectedOptionId": "option-1",
      "isCorrect": true
    }
  ]
}
```

---

## Endpoints

### GET `/exams/available`

List active exam templates that the current student can start. Frontend should call this endpoint before `POST /exams/sessions`.

**Auth:** `STUDENT`. Service reads `JWT.sub`, calls `user-service /users/me` using the same bearer token, and matches templates by `studentDetail.licenseTier`.

**Query**

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/available",
  "data": {
    "items": [
      {
        "id": "template-uuid",
        "name": "Đề thi B2 cơ bản",
        "description": "De thi mo phong theo cau truc GPLX hang B2",
        "licenseCategory": "B2",
        "totalQuestions": 30,
        "passingScore": 26,
        "durationMinutes": 20,
        "criticalQuestions": 1,
        "maxCriticalMistakes": 0,
        "shuffleQuestions": true
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

Student-safe response intentionally excludes admin metadata: `createdById`, `isDeleted`, `version`, `createdAt`, `updatedAt`.

Behavior:

- Inactive, deleted, or different-license templates are not returned.
- Student with `studentDetail.licenseTier = null` receives an empty list.
- Inactive/non-student/missing student detail profile returns `STUDENT_PROFILE_INVALID`.

---

### POST `/admin/exams/templates`

Create an exam template. This is an admin-only blueprint; students do not call this endpoint directly.

**Auth:** `ADMIN`

**Body**

```json
{
  "name": "Đề thi B2 cơ bản",
  "description": "De thi mo phong theo cau truc GPLX hang B2",
  "licenseCategory": "B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0,
  "shuffleQuestions": true,
  "topicDistribution": [
    {
      "topicId": "9f49045f-156e-5252-8486-babb36dc74fd",
      "questionCount": 9
    },
    {
      "topicId": "d7a509c3-153f-5c03-9398-6a5626aa70d0",
      "questionCount": 21
    }
  ]
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `name` | string | Yes | non-empty | Display name shown to admins and students through `GET /exams/available`. |
| `description` | string/null | No | string | Description shown in admin/student UI. |
| `licenseCategory` | LicenseCategory | Yes | enum | License tier this template belongs to. |
| `totalQuestions` | number | Yes | integer, `>= 1` | Number of questions pulled from question-service when a session starts. |
| `passingScore` | number | Yes | integer, `>= 1` | Minimum score to pass; domain rejects invalid values. |
| `durationMinutes` | number | Yes | integer, `1..180` | Session time limit. |
| `criticalQuestions` | number | Yes | integer, `>= 0`, `<= totalQuestions` | Exact number of critical questions that must appear in the generated exam. |
| `maxCriticalMistakes` | number | Yes | integer, `>= 0`, `<= criticalQuestions` | Maximum wrong/unanswered critical questions allowed. |
| `shuffleQuestions` | boolean | Yes | boolean | Shuffle final session question order after strict topic selection. |
| `topicDistribution` | array | Yes | non-empty, sum `questionCount = totalQuestions` | Strict question counts per topic. |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/admin/exams/templates",
  "data": {
    "id": "template-uuid",
    "name": "Đề thi B2 cơ bản",
    "description": "De thi mo phong theo cau truc GPLX hang B2",
    "licenseCategory": "B2",
    "totalQuestions": 30,
    "passingScore": 26,
    "durationMinutes": 20,
    "criticalQuestions": 1,
    "maxCriticalMistakes": 0,
    "shuffleQuestions": true,
    "topicDistribution": [
      {
        "topicId": "9f49045f-156e-5252-8486-babb36dc74fd",
        "questionCount": 9
      },
      {
        "topicId": "d7a509c3-153f-5c03-9398-6a5626aa70d0",
        "questionCount": 21
      }
    ],
    "isActive": true,
    "isDeleted": false,
    "version": 1,
    "createdById": "admin-user-id",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  }
}
```

Frontend/admin UI note: store `version` from this response if the next action is update/delete.

---

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
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/admin/exams/templates",
  "data": {
    "items": [
      {
        "id": "template-uuid",
        "name": "Đề thi B2 cơ bản",
        "licenseCategory": "B2",
        "totalQuestions": 30,
        "passingScore": 26,
        "durationMinutes": 20,
        "isActive": true,
        "isDeleted": false,
        "version": 1,
        "createdById": "admin-user-id",
        "createdAt": "2026-05-18T10:00:00.000Z",
        "updatedAt": "2026-05-18T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

---

### GET `/admin/exams/templates/:id`

Get one template for admin edit/detail screen.

**Auth:** `ADMIN`

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam template id. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/admin/exams/templates/template-uuid",
  "data": {
    "id": "template-uuid",
    "name": "Đề thi B2 cơ bản",
    "licenseCategory": "B2",
    "totalQuestions": 30,
    "passingScore": 26,
    "durationMinutes": 20,
    "isActive": true,
    "isDeleted": false,
    "version": 1,
    "createdById": "admin-user-id",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  }
}
```

**Errors:** `EXAM_TEMPLATE_NOT_FOUND` if the id does not exist.

---

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
  "description": "Cap nhat cau truc de thi B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0,
  "shuffleQuestions": true,
  "topicDistribution": [
    {
      "topicId": "9f49045f-156e-5252-8486-babb36dc74fd",
      "questionCount": 9
    },
    {
      "topicId": "d7a509c3-153f-5c03-9398-6a5626aa70d0",
      "questionCount": 21
    }
  ],
  "isActive": true
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `version` | number | Yes | integer, `>= 1` | Current version from latest template response. |
| `name` | string | No | non-empty when present | New display name. |
| `description` | string/null | No | string | New description. |
| `totalQuestions` | number | No | integer, `>= 1` | New question count. |
| `passingScore` | number | No | integer, `>= 1` | New passing score. |
| `durationMinutes` | number | No | integer, `1..180` | New duration. |
| `criticalQuestions` | number | No | integer, `>= 0`, `<= totalQuestions` | New exact critical question count. |
| `maxCriticalMistakes` | number | No | integer, `>= 0`, `<= criticalQuestions` | New critical mistake threshold. |
| `shuffleQuestions` | boolean | No | boolean | Enable/disable question order shuffle. |
| `topicDistribution` | array | No | non-empty, sum `questionCount = totalQuestions` | Replace strict topic distribution. |
| `isActive` | boolean | No | boolean | Enable or disable this template for student starts. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/admin/exams/templates/template-uuid",
  "data": {
    "id": "template-uuid",
    "name": "Đề thi B2 cập nhật",
    "description": "Cap nhat cau truc de thi B2",
    "licenseCategory": "B2",
    "totalQuestions": 30,
    "passingScore": 26,
    "durationMinutes": 20,
    "criticalQuestions": 1,
    "maxCriticalMistakes": 0,
    "shuffleQuestions": true,
    "topicDistribution": [
      {
        "topicId": "9f49045f-156e-5252-8486-babb36dc74fd",
        "questionCount": 9
      },
      {
        "topicId": "d7a509c3-153f-5c03-9398-6a5626aa70d0",
        "questionCount": 21
      }
    ],
    "isActive": true,
    "isDeleted": false,
    "version": 2,
    "createdById": "admin-user-id",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:05:00.000Z"
  }
}
```

**Errors:** `EXAM_TEMPLATE_VERSION_CONFLICT`, `INVALID_EXAM_TEMPLATE`, `EXAM_TEMPLATE_NOT_FOUND`.

---

### DELETE `/admin/exams/templates/:id`

Soft delete an unused template.

**Auth:** `ADMIN`

**Body**

```json
{
  "version": 1
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `version` | number | Yes | integer, `>= 1` | Current version from latest template response. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/admin/exams/templates/template-uuid",
  "data": {
    "id": "template-uuid",
    "name": "Đề thi B2 cơ bản",
    "licenseCategory": "B2",
    "totalQuestions": 30,
    "passingScore": 26,
    "durationMinutes": 20,
    "isActive": false,
    "isDeleted": true,
    "version": 2,
    "createdById": "admin-user-id",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:10:00.000Z"
  }
}
```

Template with sessions returns `EXAM_TEMPLATE_IN_USE`.

---

### POST `/exams/sessions`

Start exam session for current student. Exam-service validates current profile by calling `user-service /users/me` and checks `studentDetail.licenseTier` against the template.

**Auth:** `STUDENT`, owner is `JWT.sub`.

**Body**

```json
{
  "templateId": "template-uuid"
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `templateId` | UUID | Yes | `IsUUID` | Template id selected from `GET /exams/available`. |

**Response `201 Created`**

The response includes `questions[]` so frontend can render the exam immediately without a second request.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "Created",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions",
  "data": {
    "id": "session-uuid",
    "studentId": "student-user-id",
    "templateId": "template-uuid",
    "licenseCategory": "B2",
    "status": "IN_PROGRESS",
    "score": null,
    "isPassed": null,
    "failedByCritical": false,
    "criticalMistakes": 0,
    "maxCriticalMistakes": 0,
    "startedAt": "2026-05-18T10:00:00.000Z",
    "finishedAt": null,
    "expiresAt": "2026-05-18T10:20:00.000Z",
    "questions": [
      {
        "questionId": "question-uuid",
        "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
        "imageUrl": null,
        "mediaFileId": "media-file-uuid",
        "options": [
          {
            "id": "option-1",
            "content": "Dừng lại",
            "displayOrder": 1
          }
        ],
        "displayOrder": 1,
        "isBookmarked": false,
        "selectedOptionId": null
      }
    ]
  }
}
```

---

### GET `/exams/sessions`

List current student exam history.

**Auth:** `STUDENT`

**Query**

| Param | Type | Default | Validation |
| --- | --- | ---: | --- |
| `page` | number | 1 | integer, `>= 1` |
| `size` | number | 20 | integer, `1..100` |
| `status` | ExamSessionStatus | - | optional enum |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions",
  "data": {
    "items": [
      {
        "id": "session-uuid",
        "studentId": "student-user-id",
        "templateId": "template-uuid",
        "licenseCategory": "B2",
        "status": "IN_PROGRESS",
        "score": null,
        "isPassed": null,
        "failedByCritical": false,
        "criticalMistakes": 0,
        "maxCriticalMistakes": 0,
        "startedAt": "2026-05-18T10:00:00.000Z",
        "finishedAt": null,
        "expiresAt": "2026-05-18T10:20:00.000Z",
        "questions": [
          {
            "questionId": "question-uuid",
            "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
            "imageUrl": null,
            "mediaFileId": "media-file-uuid",
            "options": [
              {
                "id": "option-1",
                "content": "Dừng lại",
                "displayOrder": 1
              }
            ],
            "displayOrder": 1,
            "isBookmarked": false,
            "selectedOptionId": null
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

### GET `/exams/sessions/:id/questions`

Return current session questions without answer keys.

**Auth:** `STUDENT`, owner only. Other students receive `EXAM_SESSION_UNAUTHORIZED`.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam session id. |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions/session-uuid/questions",
  "data": {
    "items": [
      {
        "questionId": "question-uuid",
        "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
        "imageUrl": null,
        "mediaFileId": "media-file-uuid",
        "options": [
          {
            "id": "option-1",
            "content": "Dừng lại",
            "displayOrder": 1
          }
        ],
        "displayOrder": 1,
        "isBookmarked": false,
        "selectedOptionId": null
      }
    ]
  }
}
```

Frontend note: render questions by `displayOrder`; use `questionId` and `options[].id` for autosave.

---

### PATCH `/exams/sessions/:id/answers`

Autosave answer and/or bookmark. Autosave is applied only while session is active and not expired. If the session has passed `expiresAt`, exam-service lazily finalizes it as `TIMED_OUT`; the submitted answer payload is not applied, and the response returns the finalized session state.

**Auth:** `STUDENT`, owner only.

**Body**

```json
{
  "questionId": "question-uuid",
  "selectedOptionId": "option-uuid",
  "isBookmarked": true
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `questionId` | UUID | Yes | `IsUUID` | Question id from session snapshot. |
| `selectedOptionId` | UUID/null | No | optional `IsUUID` | Selected option id. Omit for bookmark-only update. |
| `isBookmarked` | boolean | No | optional boolean | Bookmark flag. |

**Response `200 OK`**

Controller returns the updated session. `questions[].isCorrect` is not returned. Normal autosave returns `status = "IN_PROGRESS"`; an expired session returns `status = "TIMED_OUT"` with `score`, `isPassed`, `finishedAt`, and critical-mistake fields populated.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions/session-uuid/answers",
  "data": {
    "id": "session-uuid",
    "studentId": "student-user-id",
    "templateId": "template-uuid",
    "licenseCategory": "B2",
    "status": "IN_PROGRESS",
    "score": null,
    "isPassed": null,
    "failedByCritical": false,
    "criticalMistakes": 0,
    "maxCriticalMistakes": 0,
    "startedAt": "2026-05-18T10:00:00.000Z",
    "finishedAt": null,
    "expiresAt": "2026-05-18T10:20:00.000Z",
    "questions": [
      {
        "questionId": "question-uuid",
        "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
        "imageUrl": null,
        "mediaFileId": "media-file-uuid",
        "options": [
          {
            "id": "option-1",
            "content": "Dừng lại",
            "displayOrder": 1
          }
        ],
        "displayOrder": 1,
        "isBookmarked": true,
        "selectedOptionId": "option-uuid"
      }
    ]
  }
}
```

---

### POST `/exams/sessions/:id/submit`

Submit and synchronously grade. Each correct answer is 1 point; wrong/unanswered critical question fails the session even if score reaches threshold.

**Auth:** `STUDENT`, owner only.

**Path params**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID | Yes | Exam session id. |

**Body:** no body.

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions/session-uuid/submit",
  "data": {
    "id": "session-uuid",
    "studentId": "student-user-id",
    "templateId": "template-uuid",
    "licenseCategory": "B2",
    "status": "COMPLETED",
    "score": 26,
    "isPassed": true,
    "failedByCritical": false,
    "criticalMistakes": 0,
    "maxCriticalMistakes": 0,
    "startedAt": "2026-05-18T10:00:00.000Z",
    "finishedAt": "2026-05-18T10:15:00.000Z",
    "expiresAt": "2026-05-18T10:20:00.000Z",
    "questions": [
      {
        "questionId": "question-uuid",
        "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
        "imageUrl": null,
        "mediaFileId": "media-file-uuid",
        "options": [
          {
            "id": "option-1",
            "content": "Dừng lại",
            "displayOrder": 1
          }
        ],
        "displayOrder": 1,
        "isBookmarked": false,
        "selectedOptionId": "option-1",
        "isCorrect": true
      }
    ]
  }
}
```

**Errors:** `EXAM_SESSION_ALREADY_FINISHED`, `EXAM_SESSION_UNAUTHORIZED`, `EXAM_SESSION_NOT_FOUND`.

---

### GET `/exams/sessions/:id/result`

Return graded result. If the session is expired but still stored as `IN_PROGRESS`, this endpoint lazily finalizes it as `TIMED_OUT` and returns the graded result. If the session is still `IN_PROGRESS` and not expired, it returns `EXAM_SESSION_NOT_FINISHED`.

**Auth:** `STUDENT`, owner only.

**Response `200 OK`**

Same shape as `POST /exams/sessions/:id/submit`.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/exams/sessions/session-uuid/result",
  "data": {
    "id": "session-uuid",
    "studentId": "student-user-id",
    "templateId": "template-uuid",
    "licenseCategory": "B2",
    "status": "COMPLETED",
    "score": 26,
    "isPassed": true,
    "failedByCritical": false,
    "criticalMistakes": 0,
    "maxCriticalMistakes": 0,
    "startedAt": "2026-05-18T10:00:00.000Z",
    "finishedAt": "2026-05-18T10:15:00.000Z",
    "expiresAt": "2026-05-18T10:20:00.000Z",
    "questions": [
      {
        "questionId": "question-uuid",
        "content": "Khi gặp đèn đỏ, người lái xe phải làm gì?",
        "imageUrl": null,
        "mediaFileId": "media-file-uuid",
        "options": [
          {
            "id": "option-1",
            "content": "Dừng lại",
            "displayOrder": 1
          }
        ],
        "displayOrder": 1,
        "isBookmarked": false,
        "selectedOptionId": "option-1",
        "isCorrect": true
      }
    ]
  }
}
```

Frontend note: use this endpoint for result screen refresh/deep link; use submit response for immediate result after finishing.

---

## Events Published

## Security Audit

Access logging is emitted for every HTTP request. Successful exam-template mutations write `security.audit.recorded` into `exam_db.outbox_messages` in the same transaction as the template change. The outbox relay publishes it to RabbitMQ, and `audit-service` persists it into `audit_db.audit_logs`.

Student exam answers/session operations are not in audit phase 1; they are already persisted as business records in `exam_db`. Phase 1 focuses on admin template mutations because these affect exam structure and grading rules.

| Endpoint | Audit action | Resource | Metadata |
| --- | --- | --- | --- |
| `POST /admin/exams/templates` | `EXAM_TEMPLATE_CREATED` | `EXAM_TEMPLATE/:id` | `{ "name": "...", "licenseCategory": "B1" }` |
| `PATCH /admin/exams/templates/:id` | `EXAM_TEMPLATE_UPDATED` | `EXAM_TEMPLATE/:id` | `{ "name": "...", "version": 2 }` |
| `DELETE /admin/exams/templates/:id` | `EXAM_TEMPLATE_DELETED` | `EXAM_TEMPLATE/:id` | `{ "name": "...", "version": 3 }` |

Example audit event:

```json
{
  "eventId": "audit-event-uuid",
  "eventName": "security.audit.recorded",
  "schemaVersion": 1,
  "serviceName": "exam-service",
  "actorId": "admin-keycloak-sub",
  "actorRole": "ADMIN",
  "action": "EXAM_TEMPLATE_UPDATED",
  "resourceType": "EXAM_TEMPLATE",
  "resourceId": "template-id",
  "outcome": "SUCCESS",
  "occurredAt": "2026-05-24T10:00:00.000Z",
  "correlationId": "request-correlation-id",
  "requestPath": "/admin/exams/templates/template-id",
  "httpMethod": "PATCH",
  "metadata": {
    "name": "Đề thi B1 cập nhật",
    "version": 2
  }
}
```

Verification:

```sql
SELECT payload->>'action' AS action, status, attempts, "publishedAt", "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

Centralized query:

```http
GET /admin/audit-logs?serviceName=exam-service&resourceId=<template-id>
Authorization: Bearer <admin_access_token>
```

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
## ASR Additions: History Filters And Missed Review

### GET `/exams/sessions`

Student exam history now supports filters:

- `page`, `size`
- `status`
- `isPassed`
- `from`, `to` ISO timestamps

Response shape is the same paginated `ExamSession` list documented in `GET /exams/sessions`.

### GET `/admin/exams/sessions`

Role: `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`.

Lists exam history across students for dashboard/review workflows.

Query filters:

- `studentId`
- `page`, `size`
- `status`
- `isPassed`
- `from`, `to`

**Response `200`**

Same paginated `ExamSession` list shape as student history, but records may belong to multiple students.

### GET `/exams/review/missed-questions`

Role: `STUDENT`.

Query: `limit` from 1 to 50, default 20.

Returns recently missed question snapshots for review. Response does not include `correctOptionId`, `isCorrect`, or explanations.

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/exams/review/missed-questions?limit=20",
  "data": [
    {
      "questionId": "9fd83d2d-64e6-5e87-b7a0-0edb40bd8fa6",
      "content": "Người điều khiển phương tiện phải làm gì khi gặp biển báo này?",
      "topicId": "10000000-0000-0000-0000-000000000103",
      "topicName": "Biển báo hiệu đường bộ",
      "options": [
        {
          "id": "1265a10e-52ab-5234-8b83-38203cd811f2",
          "content": "Giảm tốc độ và quan sát"
        }
      ],
      "lastAnsweredAt": "2026-05-21T09:55:00.000Z"
    }
  ]
}
```

Exam sessions store immutable template snapshot fields at start time: template name/version, license category, total questions, passing score, duration, critical config, and topic distribution.
