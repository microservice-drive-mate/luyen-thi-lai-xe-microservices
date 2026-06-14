# Services API Test Guide

This is the master manual test guide for the backend services. Use it together with the per-service API specs in `docs/api/api-spec-*.md`.

For the interactive UI, open Scalar:

```text
http://localhost:3009/docs
```

Direct service docs:

```text
Identity:      http://localhost:3001/docs
User:          http://localhost:3002/docs
Exam:          http://localhost:3003/docs
Course:        http://localhost:3004/docs
Question:      http://localhost:3005/docs
Notification:  http://localhost:3006/docs
Analytics:     http://localhost:3007/docs
Simulation:    http://localhost:3008/docs
Media:         http://localhost:3010/docs
Audit:         http://localhost:3011/docs
```

## Setup

```powershell
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:deploy
pnpm run db:seed
pnpm run dev
```

Use real Keycloak tokens in Scalar:

```http
Authorization: Bearer <access_token>
```

Do not send `x-user-id` from frontend or Scalar unless you are debugging an old local script. Services should resolve actor id from JWT `sub`.

## Test Order

Recommended order for full API verification:

1. Identity and auth
2. User profile and admin user management
3. Media upload flow
4. Question bank and practice APIs
5. Exam template/session flow
6. Course enrollment/progress flow
7. Simulation flow
8. Notification flow
9. Analytics dashboards/progress
10. Audit and observability checks

## 1. Identity

Scalar: `http://localhost:3001/docs`

Smoke flow:

1. `POST /auth/login`
2. `POST /auth/refresh`
3. `POST /auth/change-password`
4. `POST /auth/forgot-password`
5. Admin/center manager only: `POST /auth/reset-password`
6. `POST /auth/logout`

Notes:

- `change-password` requires a logged-in user and verifies `currentPassword`.
- `reset-password` is an admin/center-manager credential reset wrapper over Keycloak. It is not a public reset-token callback.
- After `change-password`, all old tokens for that user should be rejected across protected services.
- After admin `reset-password` or account lock, all old tokens for the target user should be rejected. Verify with a protected API in user-service, course-service, and media-service.
- `forgot-password` only sends a reset email and should not revoke sessions immediately.

## 2. User

Scalar: `http://localhost:3002/docs`

Core checks:

1. `GET /users/me`
2. `PATCH /users/me`
3. `GET /admin/users`
4. `GET /admin/users/:id`
5. `PATCH /admin/users/:id`
6. `PATCH /admin/users/:id/license-tier`
7. `PATCH /admin/users/:id/lock`

Document metadata flow:

1. Upload or initialize/complete a file in media-service.
2. Copy `mediaFileId`.
3. Call:

```http
POST /admin/users/:id/documents
```

```json
{
  "type": "ID_CARD_FRONT",
  "mediaFileId": "media-file-id",
  "title": "CCCD mat truoc",
  "status": "PENDING"
}
```

4. Verify:

```http
GET /admin/users/:id/documents
```

Expected: user-service stores metadata only; binary file stays in media-service/Azure.

## 3. Media

Scalar: `http://localhost:3010/docs`

Small file fallback:

1. `POST /media/files` with multipart form data.
2. `GET /media/files/:id`
3. `GET /media/files/:id/url`

Direct Azure upload flow:

1. `POST /media/files/init`
2. `PUT uploadUrl` directly to Azure Blob Storage.
3. `POST /media/files/:id/complete`
4. Attach `mediaFileId` to a business API.
5. Render via `GET /media/files/:id/url`.

Important:

- Do not send JWT or `Authorization` when doing the direct `PUT uploadUrl` to Azure.
- The Azure `PUT uploadUrl` step is not a backend API, so Scalar is mainly used for steps 1, 3, and 5.

## 4. Question

Scalar: `http://localhost:3005/docs`

Admin flow:

1. `GET /admin/questions/topics`
2. `POST /admin/questions/topics`
3. `POST /admin/questions`
4. `GET /admin/questions`
5. `PATCH /admin/questions/:id`
6. `DELETE /admin/questions/:id`
7. Internal/admin pool: `POST /admin/questions/pool`

Student practice flow:

1. `GET /questions/topics`
2. `GET /questions/practice`
3. `POST /questions/:id/report`

Safety check:

`GET /questions/practice` must not return:

- `options[].isCorrect`
- `isCritical`
- `explanation`

Critical question seed verification:

```sql
SELECT count(*) FROM questions WHERE "isCritical" = true;
```

Expected: `60`.

## 5. Exam

Scalar: `http://localhost:3003/docs`

Template flow:

1. `POST /admin/exams/templates`
2. `GET /admin/exams/templates`
3. `GET /admin/exams/templates/:id`
4. `PATCH /admin/exams/templates/:id`

Session flow:

1. Login as student.
2. `POST /exams/sessions`
3. `GET /exams/sessions/:id`
4. `PATCH /exams/sessions/:id/answers`
5. `POST /exams/sessions/:id/submit`
6. `GET /exams/sessions/:id/result`

Template note:

If `criticalQuestions > 0`, `topicDistribution` must include at least one topic that has critical questions. In the seeded 600-question bank, critical questions only exist in seeded topic ranges 1, 2, and 3.

## 6. Course

Scalar: `http://localhost:3004/docs`

Admin flow:

1. `POST /admin/courses`
2. `POST /admin/courses/:id/lessons`
3. `PATCH /admin/courses/:id/lessons/:lessonId`
4. `POST /admin/courses/:id/materials`
5. `POST /admin/courses/:id/instructors`
6. `DELETE /admin/courses/:id/instructors/:userId`
7. `POST /admin/courses/:id/schedules`
8. `PATCH /admin/courses/:id/activate`

Student flow:

1. `GET /courses`
2. `GET /courses/:id`
3. `GET /courses/:id/lessons/:lessonId`
4. `POST /courses/:id/enroll`
5. `GET /enrollments`
6. `GET /enrollments/:id`
7. `POST /enrollments/:id/lessons/:lessonId/complete`
8. `POST /enrollments/:id/reset-progress`
9. `POST /courses/:id/unenroll`

Notes:

- Separate lesson/material list endpoints are intentionally not required because `GET /courses/:id` and `GET /admin/courses/:id` already return `lessons` and `materials`.
- Course schedules feed instructor dashboard analytics.
- After `POST /courses/:id/unenroll`, calling `POST /courses/:id/enroll` again should work. The service reactivates the existing dropped enrollment because the database keeps one unique enrollment row per `courseId + studentId`.

## 7. Simulation

Scalar: `http://localhost:3008/docs`

Simulation session flow:

1. `GET /simulation/maneuvers`
2. `GET /simulation/maneuver-errors`
3. `POST /simulation/sessions`
4. `PATCH /simulation/sessions/:id/answers`
5. `POST /simulation/sessions/:id/submit`
6. `GET /simulation/sessions`
7. `GET /simulation/sessions/:id/result`

Practice 2D flow:

1. `POST /simulation/practice2d/sessions`
2. `POST /simulation/practice2d/sessions/:id/telemetry`
3. `POST /simulation/practice2d/sessions/:id/end`
4. `GET /simulation/practice2d/sessions/:id`

## 8. Notification

Scalar: `http://localhost:3006/docs`

User notification flow:

1. `GET /notifications/me`
2. `PATCH /notifications/:id/read`
3. `PATCH /notifications/mark-all-read`
4. `GET /notifications/preferences/me`
5. `PATCH /notifications/preferences/me`

Preference body example:

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

Admin warning flow:

```http
POST /admin/academic-warnings
```

Expected: request is accepted and delivery runs asynchronously.

## 9. Analytics

Scalar: `http://localhost:3007/docs`

Student endpoints:

1. `GET /analytics/me/progress`
2. `GET /analytics/me/weak-topics`
3. `GET /analytics/me/study-streak`

`GET /analytics/me/study-streak` should work on both cache miss and cache hit. Redis stores cached dates as JSON strings, so the endpoint normalizes `lastActivityAt` before returning `lastActivityDate`.

Admin dashboard:

```http
GET /admin/analytics/dashboard?month=2026-06
```

Instructor dashboard:

```http
GET /analytics/instructor/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
```

Admin view of instructor dashboard:

```http
GET /admin/analytics/instructors/:instructorId/dashboard?month=2026-06&weekStart=2026-06-08&date=2026-06-13
```

If dashboard data looks empty, verify projections:

```sql
SELECT count(*) FROM dashboard_user_projections;
SELECT count(*) FROM dashboard_course_projections;
SELECT count(*) FROM instructor_course_projections;
SELECT count(*) FROM instructor_schedule_projections;
SELECT count(*) FROM instructor_topic_attempt_projections;
```

Expected after `pnpm run db:seed`: counts are greater than zero.

## 10. Audit

Scalar: `http://localhost:3011/docs`

Checks:

1. Perform an audited mutation, for example:
   - `PATCH /admin/users/:id/license-tier`
   - `POST /admin/courses`
   - `PATCH /admin/courses/:id/activate`
   - `POST /admin/exams/templates`
2. Query:

```http
GET /admin/audit-logs
```

3. Filter by `serviceName`, `action`, or `resourceId`.

Producer outbox checks:

```sql
SELECT payload->>'action' AS action, status, attempts, "publishedAt", "lastError"
FROM outbox_messages
ORDER BY "createdAt" DESC
LIMIT 10;
```

## Scalar Tips

- Use the direct service Scalar URL when testing a single service.
- Use docs-service Scalar (`http://localhost:3009/docs`) when you want one place to browse all services.
- Use Kong paths when testing frontend-equivalent routing. Example:

```text
Direct: /questions/practice
Kong:   /question-service/questions/practice
```

- Always set `Authorization: Bearer <token>` for protected endpoints.
- For direct Azure Blob `PUT uploadUrl`, do not send `Authorization`.

## Regression Checklist

Run this after migrations and seed:

```powershell
pnpm run db:generate
pnpm run db:deploy
pnpm run db:seed
pnpm run smoke
```

Then manually verify:

- Login/refresh/logout still works.
- Media direct upload completes and signed URL renders.
- Question practice does not leak answers.
- Exam generation works with seeded critical questions.
- Course enrollment/progress flow works.
- Notification preferences persist.
- Analytics student/admin/instructor dashboards return non-empty seeded demo data.
- Audit logs appear for audited mutations.
