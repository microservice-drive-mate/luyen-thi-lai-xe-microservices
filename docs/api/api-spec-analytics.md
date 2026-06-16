# Analytics Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/analytics`, `/admin/analytics`  
**Direct local:** `http://localhost:3007`  
**Swagger UI:** `http://localhost:3007/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/analytics-service/docs`  
**OpenAPI JSON:** `http://localhost:3007/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/analytics-service/docs-json`  
**Version:** 1.0.0

Analytics-service builds learning-progress and admin-dashboard read models from cross-service events. Frontend calls protected APIs with `Authorization: Bearer <access_token>`; the service reads the current actor from the JWT `sub` claim. Do not send `x-user-id` from frontend code.

Progress dashboard reads use Redis cache-aside by student. Admin dashboard reads use Redis cache-aside by month. Event consumers invalidate the relevant cache after projection updates.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `GET /analytics/me/progress` | `STUDENT` |
| `GET /analytics/instructor/dashboard` | `INSTRUCTOR` |
| `GET /admin/analytics/students/:studentId/progress` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /admin/analytics/dashboard` | `ADMIN`, `CENTER_MANAGER` |
| `GET /admin/analytics/instructors/:instructorId/dashboard` | `ADMIN`, `CENTER_MANAGER` |

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

### `AdminDashboard`

| Field | Type | Description |
| --- | --- | --- |
| `period` | `DashboardPeriod` | Current and previous calendar windows used for card deltas |
| `cards` | `DashboardCard[]` | Top summary cards: students, courses, instructors, completed exams |
| `monthlyTrend` | `MonthlyTrendPoint[]` | Last 6 months of student creation and completed/passed exams |
| `licenseDistribution` | `LicenseDistributionItem[]` | Active students grouped by license tier/category |
| `passRateByLicense` | `PassRateByLicenseItem[]` | Completed/passed exams and pass rate by license category |
| `recentActivities` | `RecentActivity[]` | Last 10 dashboard activities from projected events |

`DashboardCard.key` values:

```text
students | courses | instructors | completedExams
```

`RecentActivity.type` values:

```text
student | course | exam | audit
```

### `InstructorDashboard`

Instructor dashboard is an eventually-consistent read model for the instructor home screen.

| Field | Type | Description |
| --- | --- | --- |
| `period` | `InstructorDashboardPeriod` | Requested month/week/date and timezone |
| `summary.activeClassCount` | `number` | Active, non-deleted courses assigned to the instructor |
| `summary.totalStudents` | `number` | Unique active students in the instructor active courses |
| `summary.passRate` | `number` | Passed completed exam attempts / completed attempts in the selected month |
| `summary.teachingHoursThisMonth` | `number` | Sum of weekly schedule occurrences in the selected month |
| `weeklyTeachingTrend` | `InstructorWeeklyTeachingTrendPoint[]` | Seven points from `weekStart` |
| `topicAverages` | `InstructorTopicAverage[]` | Correct answers / answered questions by topic |
| `classProgress` | `InstructorClassProgress[]` | Completed enrollments / total enrollments by course |
| `todaySchedule` | `InstructorTodayScheduleItem[]` | Schedule occurrences matching `date` |

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

### GET `/analytics/instructor/dashboard`

Returns the current instructor dashboard. The instructor id is read from JWT `sub`.

**Auth:** `INSTRUCTOR`

**Query Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `month` | `YYYY-MM` | no | Calendar month for summary, pass rate, teaching hours, and topic averages |
| `weekStart` | `YYYY-MM-DD` | no | Monday date for the 7-day line chart |
| `date` | `YYYY-MM-DD` | no | Date used for today's schedule |

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-06-13T10:00:00.000Z",
  "path": "/analytics/instructor/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13",
  "data": {
    "period": {
      "month": "2026-06",
      "weekStart": "2026-06-08",
      "date": "2026-06-13",
      "timezone": "Asia/Ho_Chi_Minh"
    },
    "summary": {
      "activeClassCount": 8,
      "totalStudents": 156,
      "passRate": 89,
      "teachingHoursThisMonth": 124
    },
    "weeklyTeachingTrend": [
      {
        "date": "2026-06-08",
        "label": "T2",
        "teachingHours": 8,
        "studentCount": 42
      }
    ],
    "topicAverages": [
      {
        "topicId": "topic-id",
        "topicName": "Bien bao",
        "averageScore": 82,
        "answeredQuestions": 120
      }
    ],
    "classProgress": [
      {
        "courseId": "course-id",
        "title": "B1 - Sang T2,T4,T6",
        "licenseCategory": "B1",
        "totalStudents": 24,
        "completedStudents": 18,
        "progressPct": 75
      }
    ],
    "todaySchedule": [
      {
        "scheduleId": "schedule-id",
        "courseId": "course-id",
        "title": "B1 - Sang T2,T4,T6",
        "room": "Phong 101",
        "startTime": "07:00",
        "endTime": "09:00",
        "studentCount": 24
      }
    ]
  }
}
```

**Common errors:** `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

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

### GET `/admin/analytics/instructors/:instructorId/dashboard`

Admin/center-manager view of a specific instructor dashboard. Response shape is the same as `GET /analytics/instructor/dashboard`.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `instructorId` | `uuid` | yes | Target instructor id |

**Query Parameters:** same as `GET /analytics/instructor/dashboard`.

**Common errors:** `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/admin/analytics/dashboard`

Returns the admin reporting dashboard used by the admin/center manager dashboard screen.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Query Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `month` | `YYYY-MM` | no | Calendar month for the current reporting window. Defaults to the current month in service time. |

If `month` is present but does not match `YYYY-MM`, the service returns `400 BAD_REQUEST` with message `month must match YYYY-MM`.

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-06-13T10:00:00.000Z",
  "path": "/admin/analytics/dashboard?month=2026-06",
  "data": {
    "period": {
      "month": "2026-06",
      "currentFrom": "2026-06-01T00:00:00.000Z",
      "currentTo": "2026-07-01T00:00:00.000Z",
      "previousFrom": "2026-05-01T00:00:00.000Z",
      "previousTo": "2026-06-01T00:00:00.000Z"
    },
    "cards": [
      {
        "key": "students",
        "label": "Tong Hoc Vien",
        "value": 120,
        "previousValue": 100,
        "delta": {
          "value": 20,
          "percentage": 20,
          "direction": "up"
        }
      },
      {
        "key": "completedExams",
        "label": "Bai Thi Hoan Thanh",
        "value": 45,
        "previousValue": 30,
        "delta": {
          "value": 15,
          "percentage": 50,
          "direction": "up"
        }
      }
    ],
    "monthlyTrend": [
      {
        "month": "2026-06",
        "students": 20,
        "completedExams": 45,
        "passedExams": 31
      }
    ],
    "licenseDistribution": [
      {
        "licenseCategory": "B2",
        "students": 80,
        "percentage": 66.67
      }
    ],
    "passRateByLicense": [
      {
        "licenseCategory": "B2",
        "completedExams": 30,
        "passedExams": 21,
        "passRate": 70
      }
    ],
    "recentActivities": [
      {
        "id": "activity-id",
        "type": "course",
        "title": "Course B2 was updated",
        "description": "course.updated",
        "resourceType": "COURSE",
        "resourceId": "course-id",
        "licenseCategory": "B2",
        "occurredAt": "2026-06-13T09:30:00.000Z"
      }
    ]
  }
}
```

Notes for frontend:

- The dashboard is projection-based. Existing historical users/courses/exams will not appear until events are emitted or a backfill is implemented.
- Empty dashboard data is valid when projection tables are empty.
- `cards` may contain all four card keys; frontend should render by `key`, not by array index.
- `delta.percentage` can be `null` when previous value is `0`.

**Common errors:** `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

## Event Projection

Analytics-service consumes these event types from RabbitMQ:

| Event | Projection effect |
| --- | --- |
| `identity.user.created` | Ensures an empty student learning profile exists |
| `identity.user.updated` | Updates admin dashboard user projection and recent activity |
| `identity.user.deleted` | Marks admin dashboard user projection inactive/deleted and records activity |
| `identity.user.role-changed` | Updates admin dashboard user role projection and records activity |
| `identity.user.locked` | Updates admin dashboard user active/locked projection and records activity |
| `user.student.license-assigned` | Updates student license distribution and records student activity |
| `exam.session.completed` | Updates exam attempts, pass rate, average score, daily trend, weak-topic tracker |
| `course.created` | Upserts course projection and records course activity |
| `course.updated` | Upserts course projection and records course activity |
| `course.archived` | Marks course projection archived/deleted and records course activity |
| `course.schedule.created` | Upserts instructor schedule projection |
| `course.schedule.updated` | Updates instructor schedule projection |
| `course.schedule.deleted` | Deactivates instructor schedule projection |
| `course.enrollment.created` | Increments enrolled course count |
| `course.enrollment.completed` | Increments completed course count |
| `course.lesson.completed` | Adds study minutes and daily study activity |
| `course.enrollment.progress-reset` | Clears daily activity/weak-topic tracker and resets course completion/study minutes baseline |
| `security.audit.recorded` | Records audit activity for admin dashboard recent activities |

Event handlers are idempotent where the repository can upsert by natural key. After every successful projection update, the cache key for that student is invalidated.

Admin dashboard events are de-duplicated by `eventId` in `dashboard_processed_events`. After a successful admin projection update, cached keys matching `analytics:admin-dashboard:*` are invalidated.

## SRS Alignment Additions: Scoped Progress Cache

`GET /analytics/me/progress` remains owner-only: `studentId` is read only from JWT `sub`. The cache key is scoped as `analytics:progress:{studentId}:{licenseTier|default}` so progress can be separated by license tier when the claim is available.

Projection still comes from analytics read-model tables. Weak topics are computed from `QuestionAccuracyTracker`; no realtime raw-log aggregation is performed on request path.
## Student Convenience Endpoints

### GET `/analytics/me/weak-topics`

Returns the current student's weak topics from the existing progress dashboard projection.

**Auth:** `STUDENT`

### GET `/analytics/me/study-streak`

Returns a lightweight study streak summary computed from the current 30-day progress trend.

**Auth:** `STUDENT`

The endpoint normalizes cached date strings and database `Date` values before returning `lastActivityDate`, so it should behave the same on Redis cache hit and miss.
