# Analytics Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/analytics`, `/admin/analytics`  
**Direct local:** `http://localhost:3007`  
**Swagger UI:** `http://localhost:3007/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/analytics-service/docs`  
**OpenAPI JSON:** `http://localhost:3007/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/analytics-service/docs-json`  
**Version:** 1.0.0

Analytics-service builds a learning-progress read model from cross-service events. Frontend calls protected APIs with `Authorization: Bearer <access_token>`; the service reads the current actor from the JWT `sub` claim. Do not send `x-user-id` from frontend code.

Dashboard reads use Redis cache-aside with short TTL. Event consumers invalidate the affected student's cache after projection updates.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `GET /analytics/me/progress` | `STUDENT` |
| `GET /admin/analytics/students/:studentId/progress` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |

---

## Response Format

All successful responses are wrapped by the global `ApiResponseInterceptor`.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/analytics/me/progress",
  "data": {}
}
```

Error responses keep the same common envelope:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Forbidden resource",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/analytics/me/progress"
}
```

---

## Error Codes

| HTTP | Code | Cause |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid path/query parameter |
| 401 | `UNAUTHORIZED` | Missing or invalid access token |
| 403 | `FORBIDDEN` | Token is valid but role is not allowed |
| 500 | `INTERNAL_ERROR` | Projection/cache/database error |

---

## Shared Schemas

### `ProgressDashboard`

| Field | Type | Description |
| --- | --- | --- |
| `studentId` | `string` | Student id from identity/user profile |
| `completionPct` | `number` | Course completion percentage, rounded 0-100 |
| `studiedCount` | `number` | Backward-compatible alias for total study minutes |
| `attemptCount` | `number` | Total completed exam attempts |
| `passRate` | `number` | Passed exams over total attempts, rounded 0-100 |
| `totalStudyMinutes` | `number` | Accumulated study time from lesson completion events |
| `avgExamScore` | `number` | Average exam score from completed exam events |
| `trend` | `ProgressTrend[]` | Daily activity, oldest-to-newest, max 30 rows |
| `weakTopics` | `WeakTopic[]` | Top weak topics by incorrect count, max 5 rows |
| `lastActivityAt` | `string | null` | Last projected activity timestamp |

### `ProgressTrend`

```json
{
  "date": "2026-05-21",
  "attempts": 2,
  "correctAnswers": 48,
  "questionsAnswered": 60
}
```

### `WeakTopic`

```json
{
  "topicId": "10000000-0000-0000-0000-000000000101",
  "topicName": "Khái niệm và quy tắc giao thông",
  "incorrectCount": 4,
  "accuracyRate": 0.72
}
```

---

## Endpoints

### GET `/analytics/me/progress`

Returns the current student's progress dashboard. If a student profile does not exist yet, analytics-service creates an empty projection and returns zero-value metrics.

**Auth:** `STUDENT`

**Headers**

```http
Authorization: Bearer <student_access_token>
```

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/analytics/me/progress",
  "data": {
    "studentId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "completionPct": 50,
    "studiedCount": 135,
    "attemptCount": 3,
    "passRate": 67,
    "totalStudyMinutes": 135,
    "avgExamScore": 82,
    "trend": [
      {
        "date": "2026-05-20",
        "attempts": 1,
        "correctAnswers": 24,
        "questionsAnswered": 30
      },
      {
        "date": "2026-05-21",
        "attempts": 2,
        "correctAnswers": 48,
        "questionsAnswered": 60
      }
    ],
    "weakTopics": [
      {
        "topicId": "10000000-0000-0000-0000-000000000103",
        "topicName": "Biển báo hiệu đường bộ",
        "incorrectCount": 5,
        "accuracyRate": 0.64
      }
    ],
    "lastActivityAt": "2026-05-21T09:55:00.000Z"
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/admin/analytics/students/:studentId/progress`

Returns a student's dashboard for instructor/admin monitoring. The `studentId` path parameter is the target student, while the caller is still derived from the admin/instructor JWT.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `studentId` | `uuid` | yes | Target student id |

**Response `200`**

Same `ProgressDashboard` shape as `GET /analytics/me/progress`.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/admin/analytics/students/89ea9a17-1cce-4fff-855c-d32a081648cd/progress",
  "data": {
    "studentId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "completionPct": 50,
    "studiedCount": 135,
    "attemptCount": 3,
    "passRate": 67,
    "totalStudyMinutes": 135,
    "avgExamScore": 82,
    "trend": [],
    "weakTopics": [],
    "lastActivityAt": "2026-05-21T09:55:00.000Z"
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

## Event Projection

Analytics-service consumes these event types from RabbitMQ:

| Event | Projection effect |
| --- | --- |
| `identity.user.created` | Ensures an empty student learning profile exists |
| `exam.session.completed` | Updates exam attempts, pass rate, average score, daily trend, weak-topic tracker |
| `course.enrollment.created` | Increments enrolled course count |
| `course.enrollment.completed` | Increments completed course count |
| `course.lesson.completed` | Adds study minutes and daily study activity |
| `course.enrollment.progress-reset` | Clears daily activity/weak-topic tracker and resets course completion/study minutes baseline |

Event handlers are idempotent where the repository can upsert by natural key. After every successful projection update, the cache key for that student is invalidated.
## SRS Alignment Additions: Scoped Progress Cache

`GET /analytics/me/progress` remains owner-only: `studentId` is read only from JWT `sub`. The cache key is scoped as `analytics:progress:{studentId}:{licenseTier|default}` so progress can be separated by license tier when the claim is available.

Projection still comes from analytics read-model tables. Weak topics are computed from `QuestionAccuracyTracker`; no realtime raw-log aggregation is performed on request path.
