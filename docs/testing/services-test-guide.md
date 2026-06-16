# Services API Test Guide

This is the master manual test guide for local/demo backend testing. Use it as the checklist, then open the per-service specs in `docs/api/api-spec-*.md` or Scalar when you need the full schema.

## 1. Setup

Start infra, migrate, seed, then run services:

```powershell
pnpm.cmd run infra:up
pnpm.cmd run consul:seed:local
pnpm.cmd run db:generate
pnpm.cmd run db:deploy
pnpm.cmd run db:seed
pnpm.cmd run dev
```

If migrations drift in local demo DBs and you accept losing local data, reset the affected service DB, then seed again. Do not use reset on shared or production data.

Open Scalar:

```text
http://localhost:3009/docs
```

Direct service docs:

| Service | Base URL | Scalar/Swagger |
| --- | --- | --- |
| identity-service | `http://localhost:3001` | `http://localhost:3001/docs` |
| user-service | `http://localhost:3002` | `http://localhost:3002/docs` |
| exam-service | `http://localhost:3003` | `http://localhost:3003/docs` |
| course-service | `http://localhost:3004` | `http://localhost:3004/docs` |
| question-service | `http://localhost:3005` | `http://localhost:3005/docs` |
| notification-service | `http://localhost:3006` | `http://localhost:3006/docs` |
| analytics-service | `http://localhost:3007` | `http://localhost:3007/docs` |
| simulation-service | `http://localhost:3008` | `http://localhost:3008/docs` |
| media-service | `http://localhost:3010` | `http://localhost:3010/docs` |
| audit-service | `http://localhost:3011` | `http://localhost:3011/docs` |

Kong public base is `http://localhost:8000`. In Scalar direct service mode use direct paths, for example `POST http://localhost:3001/login`. Through Kong use public paths such as `POST http://localhost:8000/auth/login`.

## 2. Tokens

Use seed accounts from `docs/testing/demo-seed-plan.md`, or create accounts through identity-service.

Login in Scalar or curl:

```http
POST http://localhost:3001/login
Content-Type: application/json

{
  "username": "student.b2@test.com",
  "password": "Password@123"
}
```

Save `data.accessToken` as the bearer token. Repeat for admin, center manager, and instructor when testing role guards.

Quick health check:

```powershell
curl http://localhost:3001/health/ready
curl http://localhost:3002/health/ready
curl http://localhost:3003/health/ready
curl http://localhost:3004/health/ready
curl http://localhost:3005/health/ready
curl http://localhost:3006/health/ready
curl http://localhost:3007/health/ready
curl http://localhost:3008/health/ready
curl http://localhost:3010/health/ready
curl http://localhost:3011/health/ready
```

## 3. Identity And Session Revocation

Test normal auth:

1. `POST /login` with username/password.
2. `GET /private` with `Authorization: Bearer <accessToken>`.
3. `POST /refresh` with `refreshToken`.
4. `POST /logout` with both `Authorization` and `refreshToken`.
5. Retry `GET /private` with the logged-out access token. Expected: `401`, token revoked.

Password/session rules:

| Action | Expected session behavior |
| --- | --- |
| `POST /logout` | Revokes the current refresh token and blacklists the current access token until expiry. Other devices stay logged in. |
| `POST /forgot-password` | Sends/reset email flow only. It does not immediately revoke existing sessions. |
| `POST /reset-password` | Admin/CENTER_MANAGER sets a new password and revokes all existing sessions for that user. |
| `POST /change-password` | Current user changes password and all existing sessions for that user are revoked. Frontend should clear local tokens and redirect to login. |
| `PATCH /admin/identity-users/:id/lock` | Lock revokes all sessions for that user. Unlock does not restore old tokens. |

Two-device revocation test:

1. Login the same user twice and keep `TOKEN_A` and `TOKEN_B`.
2. Call `POST /change-password` using `TOKEN_A`.
3. Call any protected endpoint using `TOKEN_A` and `TOKEN_B`.
4. Expected: both old tokens fail with `401`.
5. Login with the new password. Expected: new token works.

Redis verification:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "auth:revoked-after:*"
```

Expected: a key exists for the user after change password, reset password, or lock.

## 4. Media Direct Upload

Production flow is hybrid: direct upload to Azure Blob for normal frontend usage, multipart server upload as fallback.

Direct upload as frontend:

1. Call backend init with JWT:

```http
POST http://localhost:3010/media/files/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "originalName": "avatar.png",
  "mimeType": "image/png",
  "fileSize": 12345
}
```

2. Copy `data.uploadUrl`.
3. PUT the file directly to Azure. Do not send `Authorization`.

```javascript
await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "Content-Type": file.type,
    "x-ms-blob-type": "BlockBlob"
  },
  body: file
});
```

4. Confirm upload with backend:

```http
POST http://localhost:3010/media/files/{fileId}/complete
Authorization: Bearer <token>
```

5. Attach `mediaFileId` to a business API, for example user document or course material.
6. Render/download by calling:

```http
GET http://localhost:3010/media/files/{fileId}/url
Authorization: Bearer <token>
```

Expected statuses:

| Step | File status |
| --- | --- |
| init | `UNLINKED` |
| complete | `UPLOADED` |
| link event from user/course/question | `LINKED` |

Fallback:

```http
POST http://localhost:3010/media/files
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Expected: still works for small/manual uploads.

Azure CORS note: browser preflight for the PUT goes to Azure, not to media-service. If the frontend sees no `Access-Control-Allow-Origin` on the Azure URL, fix CORS on the Storage Account for the frontend origin.

## 5. User Documents

User-service stores document metadata only. Binary files stay in media-service/Azure.

1. Upload through media flow and get `mediaFileId`.
2. Attach document:

```http
POST http://localhost:3002/admin/users/{userId}/documents
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "type": "IDENTITY_CARD",
  "title": "CCCD mat truoc",
  "mediaFileId": "{mediaFileId}",
  "status": "PENDING"
}
```

3. List documents:

```http
GET http://localhost:3002/admin/users/{userId}/documents
Authorization: Bearer <admin_token>
```

Expected: document row returns `type`, `title`, `mediaFileId`, `status`, timestamps.

## 6. Course, Lessons, Schedules, Enrollment

Admin/instructor course management:

```http
POST /admin/courses
GET /admin/courses
GET /admin/courses/{id}
PATCH /admin/courses/{id}
PATCH /admin/courses/{id}/activate
POST /admin/courses/{id}/lessons
PATCH /admin/courses/{id}/lessons/{lessonId}
DELETE /admin/courses/{id}/lessons/{lessonId}
POST /admin/courses/{id}/materials
POST /admin/courses/{id}/instructors
DELETE /admin/courses/{id}/instructors/{userId}
```

Schedule APIs for instructor dashboard:

```http
GET /admin/courses/{id}/schedules
POST /admin/courses/{id}/schedules
PATCH /admin/courses/{id}/schedules/{scheduleId}
DELETE /admin/courses/{id}/schedules/{scheduleId}
```

Create schedule body:

```json
{
  "instructorId": "instructor-user-id",
  "dayOfWeek": 1,
  "startTime": "07:00",
  "endTime": "09:00",
  "room": "Phong 101",
  "effectiveFrom": "2026-06-01",
  "effectiveTo": null
}
```

Student flow:

```http
GET /courses
GET /courses/{courseId}
GET /courses/{courseId}/lessons/{lessonId}
POST /courses/{courseId}/enroll
GET /enrollments
GET /enrollments/{enrollmentId}
POST /enrollments/{enrollmentId}/lessons/{lessonId}/complete
POST /courses/{courseId}/unenroll
```

Re-enroll regression:

1. Student enrolls in an active course.
2. Student calls `POST /courses/{courseId}/unenroll`.
3. Student calls `POST /courses/{courseId}/enroll` again.
4. Expected: existing `DROPPED` enrollment is reactivated to `ACTIVE`, progress reset to `0`, no duplicate active enrollment.

## 7. Question Seed, Practice, Reports

Seed expectations:

```sql
SELECT count(*) FROM questions WHERE "isCritical" = true;
```

Expected: `60`.

Critical distribution by seeded topic ranges:

| Topic | Expected critical count |
| --- | ---: |
| Topic 1 | 47 |
| Topic 2 | 2 |
| Topic 3 | 11 |
| Topic 4 | 0 |
| Topic 5 | 0 |
| Topic 6 | 0 |

Student-safe practice APIs:

```http
GET http://localhost:3005/questions/topics
Authorization: Bearer <token>

GET http://localhost:3005/questions/practice?licenseCategory=B2&page=1&size=10
Authorization: Bearer <student_token>

POST http://localhost:3005/questions/{questionId}/report
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "reason": "WRONG_ANSWER",
  "message": "Dap an/loi giai can kiem tra lai"
}
```

Expected for `GET /questions/practice`: response must not expose `correctOptionId`, `options[].isCorrect`, or `isCritical`.

## 8. Exam Template And Session Generation

Template rules:

- `sum(topicDistribution[].questionCount)` must equal `totalQuestions`.
- If `criticalQuestions > 0`, distribution must include at least one topic with critical pool: topic 1, 2, or 3 in the current seed.
- `maxCriticalMistakes` should stay `0` for official kill-question behavior.

B2 30-question example:

```json
{
  "name": "De thi B2 co ban",
  "description": "De thi mo phong theo cau truc GPLX hang B2",
  "licenseCategory": "B2",
  "totalQuestions": 30,
  "passingScore": 26,
  "durationMinutes": 20,
  "criticalQuestions": 1,
  "maxCriticalMistakes": 0,
  "shuffleQuestions": true,
  "topicDistribution": [
    { "topicId": "<topic-1-id>", "questionCount": 9 },
    { "topicId": "<topic-2-id>", "questionCount": 1 },
    { "topicId": "<topic-3-id>", "questionCount": 3 },
    { "topicId": "<topic-4-id>", "questionCount": 8 },
    { "topicId": "<topic-5-id>", "questionCount": 5 },
    { "topicId": "<topic-6-id>", "questionCount": 4 }
  ]
}
```

Session test:

```http
POST http://localhost:3003/exams/sessions
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "templateId": "{templateId}"
}
```

Expected: no `INSUFFICIENT_QUESTION_POOL` when question seed is present and the template distribution is valid.

## 9. Analytics

Student analytics:

```http
GET http://localhost:3007/analytics/me/progress
GET http://localhost:3007/analytics/me/weak-topics
GET http://localhost:3007/analytics/me/study-streak
Authorization: Bearer <student_token>
```

Study-streak regression:

1. Call `GET /analytics/me/study-streak` twice.
2. Expected: both calls return `currentStreakDays`, `longestWindowDays`, and `lastActivityDate`.
3. Expected: no `result.lastActivityAt.toISOString is not a function` error, including cache hit.

Cache check:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "analytics:progress:*"
```

After `POST /enrollments/{id}/reset-progress`, the student's analytics keys should be invalidated and rebuilt on next read.

Admin dashboard:

```http
GET http://localhost:3007/admin/analytics/dashboard?month=2026-06
Authorization: Bearer <admin_token>
```

Instructor dashboard:

```http
GET http://localhost:3007/analytics/instructor/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
Authorization: Bearer <instructor_token>

GET http://localhost:3007/admin/analytics/instructors/{instructorId}/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
Authorization: Bearer <admin_token>
```

Expected instructor response sections:

```text
period
summary.activeClassCount
summary.totalStudents
summary.passRate
summary.teachingHoursThisMonth
weeklyTeachingTrend
topicAverages
classProgress
todaySchedule
```

Seed/projection checks:

```sql
SELECT count(*) FROM dashboard_user_projections;
SELECT count(*) FROM dashboard_course_projections;
SELECT count(*) FROM dashboard_exam_session_projections;
SELECT count(*) FROM instructor_course_projections;
SELECT count(*) FROM instructor_schedule_projections;
SELECT count(*) FROM instructor_topic_attempt_projections;
```

Expected: all counts are greater than `0` after `pnpm.cmd run db:seed`.

## 10. Notification

Current user APIs:

```http
GET /notifications/me?page=1&size=20
PATCH /notifications/{notificationId}/read
PATCH /notifications/mark-all-read
GET /notifications/preferences/me
PATCH /notifications/preferences/me
```

Preference update body:

```json
{
  "inAppEnabled": true,
  "emailEnabled": true,
  "pushEnabled": false,
  "smsEnabled": false,
  "studyReminderEnabled": true,
  "examReminderEnabled": true,
  "courseUpdateEnabled": true,
  "academicWarningEnabled": true
}
```

Academic warning:

```http
POST /admin/academic-warnings
Authorization: Bearer <admin_or_instructor_token>
Content-Type: application/json

{
  "studentIds": ["student-id"],
  "deliveryChannels": ["IN_APP"],
  "reason": "LOW_PROGRESS",
  "severity": "MEDIUM",
  "message": "Can cai thien tien do hoc tap"
}
```

Expected: request returns `202 ACCEPTED`; notification delivery is asynchronous.

## 11. Simulation

Classic simulation:

```http
GET /simulation/maneuvers?licenseCategory=B2
GET /simulation/maneuver-errors?licenseCategory=B2
POST /simulation/sessions
PATCH /simulation/sessions/{id}/answers
POST /simulation/sessions/{id}/submit
GET /simulation/sessions
GET /simulation/sessions/{id}/result
```

Expected:

- `GET /simulation/sessions` lists only the current student's sessions.
- `GET /simulation/sessions/{id}/result` is owner-scoped.

2D practice:

```http
POST /simulation/practice2d/sessions
POST /simulation/practice2d/sessions/{id}/telemetry
POST /simulation/practice2d/sessions/{id}/end
GET /simulation/practice2d/sessions/{id}
```

Expected: unsupported client capabilities return `PRACTICE2D_UNSUPPORTED_CLIENT`; valid telemetry returns feedback/penalty summary.

## 12. Audit And Observability

Audit API:

```http
GET http://localhost:3011/admin/audit-logs
Authorization: Bearer <admin_token>
```

Expected:

- Student token gets `403`.
- Admin or center manager can list audit records.
- Mutation endpoints such as course create/update, enrollment reset, exam template create/update/delete, password reset/change, and user lock produce audit events where implemented.

Access logging:

1. Call any service endpoint.
2. Verify response has `x-correlation-id`.
3. Search service logs or Kibana by correlation id.
4. Expected: no raw password, token, storage key, or Authorization header in logs.

## 13. DB Verify Commands

Use host ports from the local Docker setup:

```powershell
psql "postgresql://user:password@localhost:5433/user_db"
psql "postgresql://user:password@localhost:5434/exam_db"
psql "postgresql://user:password@localhost:5435/course_db"
psql "postgresql://user:password@localhost:5436/question_db"
psql "postgresql://user:password@localhost:5438/analytics_db"
psql "postgresql://user:password@localhost:5441/audit_db"
```

Common checks:

```sql
-- question_db
SELECT count(*) FROM questions;
SELECT count(*) FROM questions WHERE "isCritical" = true;

-- course_db
SELECT count(*) FROM course_schedules;
SELECT "studentId", "courseId", status, progress FROM course_enrollments LIMIT 10;

-- analytics_db
SELECT count(*) FROM instructor_schedule_projections;
SELECT count(*) FROM instructor_topic_attempt_projections;

-- user_db
SELECT count(*) FROM user_documents;
```

## 14. Regression Checklist

Before considering a branch ready:

```powershell
pnpm.cmd --filter @repo/common run build
pnpm.cmd exec turbo run check-types
pnpm.cmd exec turbo run test
```

Manual smoke checklist:

- Login, refresh, logout work.
- Change password/reset password/lock revoke old tokens across services.
- Media direct upload completes and `GET /media/files/{id}/url` renders.
- User document can attach a `mediaFileId`.
- Student can unenroll then enroll the same course again.
- `GET /analytics/me/study-streak` works on cache miss and cache hit.
- Question practice payload does not leak answers or `isCritical`.
- Exam template distribution sum equals `totalQuestions`.
- B2 session generation no longer fails with `INSUFFICIENT_QUESTION_POOL` after question seed.
- Admin dashboard and instructor dashboard return non-empty seeded demo data.
- Notification preferences can be read/updated and mark-all-read works.
- Simulation session history/result are owner-scoped.
