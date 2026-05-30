# SRS Implementation Summary

This summary maps the SRS use cases from `context/SRS.docx` to the current microservices implementation after the SRS alignment pass.

## UC Coverage Matrix

| UC | Use case | Owner service | Main API/events | Status |
| --- | --- | --- | --- | --- |
| UC01 | Login | identity-service | `POST /login` | Matched with Keycloak delegation |
| UC02 | Forgot Password | identity-service | `POST /forgot-password` | Implemented with deviation: generic response prevents email enumeration |
| UC03 | Create User Account | identity-service, user-service | `POST /admin/identity-users`, `identity.user.created` | Matched |
| UC04 | Update User Account | identity-service, user-service | `PATCH /admin/identity-users/:id`, `PATCH /admin/users/:id` | Matched |
| UC05 | Lock User Account | identity-service, user-service | `PATCH /admin/identity-users/:id/lock` | Matched |
| UC06 | Assign License Categories To Students | user-service, course-service | `PATCH /admin/users/:id/license-tier`, `user.student.license-assigned` | Matched |
| UC07 | View Detailed Course List | course-service | `GET /courses`, `GET /courses/:id` | Matched |
| UC08 | Create Course | course-service | `POST /admin/courses` | Matched; includes optional unique `courseCode` |
| UC09 | Update Course | course-service | `PATCH /admin/courses/:id` | Matched; supports optimistic `version` |
| UC10 | Delete Course | course-service | `DELETE /admin/courses/:id` | Implemented with deviation: archive plus soft-delete metadata |
| UC11 | Take Theory Exam | exam-service | `POST /exams/sessions` | Matched |
| UC12 | Manage Exam Session | exam-service | `GET /exams/sessions/:id/questions`, `PATCH /exams/sessions/:id/answers` | Matched |
| UC13 | Submit Exam | exam-service | `POST /exams/sessions/:id/submit` | Implemented with deviation: grading is synchronous in aggregate |
| UC14 | Grade Exam | exam-service | domain grading and `exam.session.*` events | Matched |
| UC15 | View Exam Results | exam-service | `GET /exams/sessions/:id/result` | Matched |
| UC16 | Review Exams | exam-service | `GET /exams/sessions` | Matched |
| UC17 | Search Question Bank | question-service | `GET /admin/questions` | Matched |
| UC18 | Create Question | question-service | `POST /admin/questions` | Matched |
| UC19 | Update Question | question-service | `PATCH /admin/questions/:id` | Matched |
| UC20 | Delete Question | question-service | `DELETE /admin/questions/:id` | Matched via deactivation/versioning |
| UC21 | Create Exam Template | exam-service | `POST /admin/exams/templates` | Matched |
| UC22 | Update Exam Template | exam-service | `PATCH /admin/exams/templates/:id` | Matched |
| UC23 | Delete Exam Template | exam-service | `DELETE /admin/exams/templates/:id` | Matched via soft delete |
| UC24 | Auto-generate Exam Papers | exam-service, question-service | `POST /exams/sessions`, `POST /admin/questions/pool` | Matched |
| UC25 | View Student List | user-service | `GET /admin/users` | Matched |
| UC26 | Track Learning Progress | analytics-service | `GET /admin/analytics/students/:studentId/progress` | Matched |
| UC27 | View Exam History | exam-service | `GET /admin/exams/sessions` | Matched |
| UC28 | Reset Learning Progress | course-service, analytics-service | `POST /enrollments/:id/reset-progress`, `course.enrollment.progress-reset` | Partial: enrollment-scoped reset |
| UC29 | Send Academic Warnings | notification-service | `POST /admin/academic-warnings` | Matched with persisted retry state and batch recipients |
| UC30 | View Maneuver Checkpoint Details | simulation-service | `GET /simulation/maneuvers`, `GET /simulation/maneuvers/:id` | Matched with map metadata fields |
| UC31 | View General Maneuver Errors | simulation-service | `GET /simulation/maneuver-errors` | Matched with active/general filtering |
| UC32 | Review Frequently Missed Questions | exam-service | `GET /exams/review/missed-questions` | Matched; supports SRS `period`/`size` aliases and legacy query names |
| UC33 | Logout | identity-service | `POST /logout` | Matched |
| UC34 | View my learning progress | analytics-service | `GET /analytics/me/progress` | Matched; owner-only JWT scope and scoped cache |
| UC35 | 2D Driving Practice | simulation-service | `POST /simulation/practice2d/sessions` | Matched for HTTP feedback v1 |
| UC36 | Error Feedback Within Session | simulation-service | `POST /simulation/practice2d/sessions/:id/telemetry` | Matched for HTTP feedback v1 |

## Updated Activity Flows And Business Rules

### UC29: Send Academic Warnings

Activity flow:
1. Instructor/Admin submits warning request with one student or selected `studentIds`, reason, severity, message, and optional delivery channel list.
2. Notification-service validates JWT/RBAC at controller guard level.
3. Controller normalizes single and batch recipients and rejects unsupported delivery channels.
4. Use case persists one `AcademicWarning` per recipient first with `PENDING`.
5. Service attempts to create/enqueue the notification.
6. On success, warning is marked `QUEUED`; on failure, it is marked `PENDING_RETRY`.
7. Retry worker picks due `PENDING_RETRY` warnings and retries up to 3 attempts.

Business rules:
- BR01: protected by `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`.
- BR02: DTO validates recipient list, reason, severity, message, and `IN_APP` delivery channel.
- BR04: warning persistence is not blocked by queue/notification failure.
- BR05: response returns persisted, queued, and pendingRetry counts.

Known deviation:
- BR03 target-existence validation is not performed inside notification-service because user ownership lives in user-service and this monorepo avoids cross-service foreign keys. Caller-facing validation remains UUID/RBAC; recipient existence can be added later through a user-service query port or identity event projection.

### UC32: Review Frequently Missed Questions

Activity flow:
1. Student calls `GET /exams/review/missed-questions`.
2. Controller derives student id from JWT only.
3. Query validates SRS `size`/`period` aliases plus legacy `limit`/`periodDays`, and `mode`.
4. Repository loads wrong-answer history from completed/timed-out sessions.
5. Use case ranks by frequency or recency and returns student-safe question snapshots.

Business rules:
- BR01: protected by `STUDENT` role.
- BR02: `limit` is capped at 50; `periodDays` is capped at 365.
- BR03: empty history returns an empty review set.
- BR04: `mode=frequent` prioritizes repeated misses; `mode=recent` prioritizes latest mistakes.

### UC34: View My Learning Progress

Activity flow:
1. Student calls `GET /analytics/me/progress`.
2. Controller extracts `studentId` from JWT `sub`; request URL/body never supplies student scope.
3. Use case checks Redis cache by `studentId` and license tier scope.
4. Cache miss falls back to analytics read model tables.
5. Response projects completion, attempts, pass rate, trend, and weak topics.

Business rules:
- BR01/BR02: student-only endpoint and strict owner scope.
- BR03: cache key is `analytics:progress:{studentId}:{licenseTier|default}`.
- BR04: weak topics are computed from question accuracy projection.
- BR05: no activity returns a valid empty dashboard.

### UC35: 2D Driving Practice

Activity flow:
1. Student starts a practice session with license category, client capabilities, and telemetry persistence preference.
2. Domain validates student id, license category, and canvas/WebGL plus keyboard/touch capability.
3. Repository persists `Practice2dSession`.
4. Student sends telemetry events while session is active.
5. Student ends or abandons the session.
6. Completed sessions emit `simulation.practice2d.completed`.

Business rules:
- BR174: protected by `STUDENT`; all session actions enforce owner id.
- BR175: invalid session creation payload returns domain validation error.
- BR176: license category is required and persisted on the session.
- BR177: unsupported clients are rejected.
- BR179: if `persistTelemetry=true`, latest telemetry snapshot and feedback events are persisted.
- BR180: end response includes score, penalties, error count, and summary.

### UC36: Error Feedback Within Session

Activity flow:
1. Student sends telemetry to an active practice session.
2. Use case loads the session and checks ownership.
3. Domain validates active state and telemetry type.
4. Domain applies detection rules.
5. Feedback event is persisted and returned immediately.
6. Session counters and score inputs are updated.

Business rules:
- BR181: protected by `STUDENT`; owner-only access.
- BR182: missing or finished sessions return not found/conflict.
- BR183: telemetry type is required.
- BR184: v1 rules detect collision, overspeed, and lane departure.
- BR185: response includes severity, penalty, message, and hint.
- BR186: feedback events are stored transactionally with session state.

## Known Intentional Deviations

- Forgot-password uses a generic success response to avoid leaking whether an email exists.
- Course deletion remains API-compatible with existing archive semantics, but now also stores soft-delete metadata.
- UC35/UC36 feedback is HTTP request/response in this phase; WebSocket/SSE can be added later without changing stored history.
- UC28 is currently enrollment-scoped reset plus analytics projection reset, not a global all-learning reset endpoint.
