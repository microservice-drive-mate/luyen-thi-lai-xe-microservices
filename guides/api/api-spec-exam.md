# Exam Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service path:** `/exams`  
**Direct local:** `http://localhost:3003`  
**Swagger UI:** `http://localhost:3003/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/exam-service/docs`  
**OpenAPI JSON:** `http://localhost:3003/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/exam-service/docs-json`  
**Version:** 1.0.0

Business API path la `/exams/*`; Swagger/docs path la `/exam-service/docs`.

## Authentication

Exam-service validate JWT/RBAC tai service bang `nest-keycloak-connect`. Frontend goi qua Kong va gui `Authorization: Bearer <access_token>`.

| Endpoint | Role |
| --- | --- |
| `POST /exams/templates` | `ADMIN` |
| `GET /exams/templates` | `ADMIN` |
| `GET /exams/templates/:id` | `ADMIN` |
| `PATCH /exams/templates/:id` | `ADMIN` |
| `DELETE /exams/templates/:id` | `ADMIN` |
| `POST /exams/sessions` | `STUDENT` |
| `GET /exams/sessions` | `STUDENT` |
| `GET /exams/sessions/:id/questions` | `STUDENT`, owner only |
| `PATCH /exams/sessions/:id/answers` | `STUDENT`, owner only |
| `POST /exams/sessions/:id/submit` | `STUDENT`, owner only |
| `GET /exams/sessions/:id/result` | `STUDENT`, owner only |

Exam-service goi noi bo `question-service /questions/pool` bang Keycloak client-credentials token. Khong expose endpoint pool truc tiep cho student.

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
  "content": "Khi gap den do, nguoi lai xe phai lam gi?",
  "options": [
    { "id": "option-1", "content": "Dung lai", "displayOrder": 1 },
    { "id": "option-2", "content": "Di tiep", "displayOrder": 2 }
  ],
  "displayOrder": 1,
  "isCritical": false,
  "isBookmarked": false,
  "selectedOptionId": null
}
```

## Endpoints

### POST `/exams/templates`

```json
{
  "name": "De thi B2 co ban",
  "licenseCategory": "B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20
}
```

Response `201 Created`: exam template with `version=1`.

### GET `/exams/templates`

Query params: `page`, `size`, `licenseCategory`, `isActive`, `includeDeleted`.

### GET `/exams/templates/:id`

Response `200 OK`: exam template detail.

### PATCH `/exams/templates/:id`

Optimistic concurrency uses `version`.

```json
{
  "version": 1,
  "name": "De thi B2 cap nhat",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "isActive": true
}
```

### DELETE `/exams/templates/:id`

```json
{ "version": 1 }
```

Soft delete unused template. Template with sessions returns `EXAM_TEMPLATE_IN_USE`.

### POST `/exams/sessions`

Start exam session for current student. Exam-service validates current profile by calling `user-service /users/me` and checks `studentDetail.licenseTier` against the template.

```json
{
  "templateId": "template-uuid"
}
```

Response `201 Created`: session bootstrap with student-safe question snapshots.

### GET `/exams/sessions`

List current student exam history. Query params: `page`, `size`, `status`.

### GET `/exams/sessions/:id/questions`

Return current session questions without answer keys.

### PATCH `/exams/sessions/:id/answers`

```json
{
  "questionId": "question-uuid",
  "selectedOptionId": "option-uuid",
  "isBookmarked": true
}
```

Autosave is allowed only while session is active and not expired.

### POST `/exams/sessions/:id/submit`

Submit and synchronously grade. Each correct answer is 1 point; wrong/unanswered critical question fails the session even if score reaches threshold.

Response `200 OK`: result with `questions[].isCorrect`.

### GET `/exams/sessions/:id/result`

Return graded result. If session is still `IN_PROGRESS`, returns `EXAM_SESSION_NOT_FINISHED`.

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
