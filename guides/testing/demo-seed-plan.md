# Demo Seed Plan And Guide

Mục tiêu: sau khi frontend pull code và chạy migration, chỉ cần chạy một lệnh root `npm run db:seed` là có đủ dữ liệu demo cho luồng identity -> user profile -> course enrollment -> learning progress -> exam session -> notification -> simulation.

---

## Usage

Chạy migration trước:

```powershell
npm.cmd run db:deploy
```

Seed toàn bộ dữ liệu demo:

```powershell
npm.cmd run db:seed
```

PowerShell có thể chặn `npm.ps1`, vì vậy trên Windows ưu tiên `npm.cmd`.

Seed riêng question bank nếu chỉ cần reset 600 câu hỏi:

```powershell
npm.cmd run db:seed:question
```

Seed/link ảnh câu hỏi từ `seed/600-cau-hoi.docx` lên Azure Blob:

```powershell
npm.cmd run db:seed:question-images
```

Lệnh này dùng key/path deterministic trên Azure Blob. Nếu blob đã tồn tại, nội dung có thể được upload lại vào cùng key và DB được upsert/re-link, nhưng xóa container/volume local không tự xóa dữ liệu đã nằm trên Azure.

Root seed hiện chạy theo thứ tự phụ thuộc:

1. `identity-service`
2. `user-service`
3. `question-service`
4. `exam-service`
5. `course-service`
6. `analytics-service`
7. `notification-service`
8. `simulation-service`

Seed scripts dùng deterministic ids và `upsert`, nên có thể chạy lại nhiều lần.

---

## Seeded Demo Users

| Role | Email | Notes |
| --- | --- | --- |
| `ADMIN` | `admin@test.com` | Seeded admin, id cố định `10000000-0000-0000-0000-000000000001` |
| `CENTER_MANAGER` | `manager@test.com` | Manager demo |
| `INSTRUCTOR` | `instructor.b1@test.com` | Instructor cho các khóa A1/B1 |
| `INSTRUCTOR` | `instructor.b2@test.com` | Instructor cho các khóa B2 |
| `STUDENT` | `student.a1@test.com` | License `A1`, progress active |
| `STUDENT` | `student.b1@test.com` | License `B1`, progress tốt |
| `STUDENT` | `student.b1.low@test.com` | License `B1`, có warning/weak topics |
| `STUDENT` | `student.b2@test.com` | License `B2`, có course completed |
| `STUDENT` | `student.b2.new@test.com` | License `B2`, trạng thái mới |

Tất cả demo users được seed vào cả `identity_db` và Keycloak. Password mặc định:

```text
123456
```

Identity seed dùng Keycloak Admin API để partial-import users với deterministic ids, nên `JWT.sub` khớp với ids trong các database service. Nếu chỉ muốn seed database mà không đụng Keycloak, có thể đặt:

```powershell
$env:SKIP_KEYCLOAK_SEED = "1"
npm.cmd --workspace=apps/identity-service run db:seed
```

---

## Seeded Dataset Summary

| Service | Data |
| --- | --- |
| `identity-service` | 9 demo identity users |
| `user-service` | 9 user profiles, 5 student details, license assignment audits |
| `question-service` | 6 topics, 600 questions từ `seed/600-cau-hoi.docx` |
| `exam-service` | 4 active templates: A1 basic, B1 basic, B2 basic, B2 advanced |
| `course-service` | 8 courses, lessons, materials, requirements, instructor assignments, enrollments, student license read model |
| `analytics-service` | Learning profiles, 7-day activity trend, weak-topic trackers |
| `notification-service` | Welcome/reminder notifications and one academic warning for low-score B1 student |
| `simulation-service` | 12 maneuvers, 36 checkpoints, 12 maneuver errors, one completed sample simulation session |

---

## Current Seed Audit

| Service | Seed status | Notes |
| --- | --- | --- |
| `identity-service` | Đã có script và seed demo users | Seed admin, manager, instructors, students. |
| `user-service` | Đã có script và seed profile/license | Đã fix thiếu `apps/user-service/prisma/seed.ts`. |
| `question-service` | Có script và có seed lớn | Seed 6 topic và 600 câu hỏi từ `seed/600-cau-hoi.docx`. Đây là nguồn dữ liệu chính cho exam template/session. |
| `course-service` | Đã có seed script | Seed course, lesson, material, enrollment, student license profile demo tự động. |
| `exam-service` | Đã có seed script | Seed exam templates demo tự động. |
| `analytics-service` | Đã có seed script | Seed read model trực tiếp cho demo speed. |
| `notification-service` | Đã có seed script | Seed warning/notification demo. |
| `simulation-service` | Đã có seed script | Seed `maneuvers`, `maneuver_checkpoints`, `maneuver_errors`. |
| `media-service` | Seed qua `db:seed:question-images` | Upload/link ảnh câu hỏi lên Azure Blob và upsert metadata khi cần demo media thật. |

Root seed runner `scripts/prisma-seed-all.ts` hiện discover service có `db:seed` và sort theo thứ tự phụ thuộc tường minh để tránh service sau cần dữ liệu từ service trước.

---

## Target Demo Dataset

### Identity/User

Seed deterministic ids để dễ dùng trong test guide và frontend fixtures.

| Role | Suggested count | Purpose |
| --- | ---: | --- |
| `ADMIN` | 1 | Quản trị toàn hệ thống |
| `CENTER_MANAGER` | 1 | Duyệt/cấu hình course, warning |
| `INSTRUCTOR` | 2 | Phụ trách course và xem progress student |
| `STUDENT` | 8-12 | Demo nhiều license tier, progress, notification, exam history |

User-service cần seed:

- `user_profiles` cho tất cả demo users.
- `student_details` cho students, gồm license tier `A1`, `B1`, `B2`.
- `license_assignment_audits` cho các student đã được assign license.

Course-service cũng cần seed `student_license_profiles` mirror từ user-service để enroll check license consistency không bị fail trong demo local.

### Question/Exam

Question-service hiện đã seed 600 câu hỏi. Exam-service nên seed template dựa trên topic ids thật từ question seed.

Suggested templates:

| License | Template | Questions | Passing | Duration |
| --- | --- | ---: | ---: | ---: |
| `A1` | `Đề thi A1 cơ bản` | 25 | 21 | 19 |
| `B1` | `Đề thi B1 cơ bản` | 30 | 26 | 20 |
| `B2` | `Đề thi B2 cơ bản` | 35 | 32 | 22 |
| `B2` | `Đề thi B2 nâng cao` | 35 | 32 | 22 |

Each template should have `topicDistribution` across the 6 seeded question topics. Keep ids deterministic or look up by `chapter` so the seed remains stable if deterministic topic ids change later.

### Course

Suggested course data:

- 2 active courses for `A1`.
- 2 active courses for `B1`.
- 2 active courses for `B2`.
- 1 draft course and 1 archived course for admin UI states.
- 5-8 lessons per active course.
- 2-3 materials per course with placeholder `fileUrl` or `mediaFileId`.
- Instructor assignments for seeded instructor ids.
- Requirements with realistic attendance/pass-score settings.
- Enrollments for seeded students:
  - some `ACTIVE` with 20-80% progress,
  - some `COMPLETED`,
  - some untouched to demo empty state.

### Analytics

Analytics can be derived from events during real usage, but seed should directly upsert read models for demo speed.

Seed:

- `student_learning_profiles` for every demo student.
- `daily_activities` for the last 7-14 days.
- `question_accuracy_trackers` for 3-5 weak topics/questions per active student.

This makes `GET /analytics/me/progress` useful immediately, without requiring the frontend demo to replay lessons/exams first.

### Notification

Seed:

- 2-4 notifications per demo student.
- At least one academic warning with `LOW_EXAM_SCORE` and `HIGH` severity.
- Mixed `isRead` true/false for badge demo.

### Simulation

Seed maneuver content because simulation APIs depend on it.

Suggested B1/B2 dataset:

- 10-12 maneuvers:
  - xuất phát,
  - dừng xe nhường đường người đi bộ,
  - dừng và khởi hành ngang dốc,
  - qua vệt bánh xe và đường hẹp vuông góc,
  - qua ngã tư có tín hiệu,
  - đường vòng quanh co,
  - ghép xe dọc,
  - tạm dừng nơi có đường sắt,
  - tăng tốc/chuyển số,
  - ghép xe ngang,
  - kết thúc.
- 3-5 checkpoints per maneuver.
- 20-30 maneuver errors with `MINOR`, `MAJOR`, `CRITICAL` severities.
- Optional sample completed sessions for seeded students if frontend needs history/state examples.

---

## Implementation Plan Status

### Phase 1 - Fix seed runner foundation

1. Done - Add a deterministic service seed order in `scripts/prisma-seed-all.ts`:
   `identity-service`, `user-service`, `question-service`, `exam-service`, `course-service`, `analytics-service`, `notification-service`, `simulation-service`.
2. Done - Keep the ability to run a single service:
   `npm run db:seed:question`, `tsx scripts/prisma-seed-all.ts simulation-service`.
3. Done - Make seed scripts idempotent with `upsert`, scoped deterministic ids, or natural unique keys.
4. Done - Fix missing `apps/user-service/prisma/seed.ts`.

### Phase 2 - Seed base identities and profiles

1. Done - Extend identity seed with deterministic demo users.
2. Done - Seed user profiles and student details with matching ids.
3. Done - Seed license assignment audit rows for students.
4. Done - Seed course-service `student_license_profiles` mirror rows to support license consistency during enroll.

### Phase 3 - Seed learning content

1. Done - Reuse existing question-service seed for 600 questions.
2. Done - Add exam-service seed for active templates per license category.
3. Done - Add course-service seed for courses, lessons, materials, requirements, instructors, enrollments.
4. Done - Add simulation-service seed for maneuvers/checkpoints/errors.

### Phase 4 - Seed demo state

1. Done - Seed analytics read models for dashboard pages.
2. Done - Seed notification rows and academic warnings.
3. Deferred - Exam sessions should still be created through exam APIs because snapshots are domain-sensitive.

### Phase 5 - Documentation and verification

1. Done here - Document `npm run db:seed` as the standard demo setup.
2. Done here - Add a seed verification section:
   - course list has active courses,
   - exam templates exist,
   - simulation maneuvers return non-empty arrays,
   - analytics progress returns non-zero demo data,
   - notifications list returns seeded unread items.
3. Manual checklist:
   - login demo student,
   - view courses,
   - enroll matching license course,
   - start exam,
   - view progress,
   - view notifications,
   - open simulation maneuver list.

---

## Acceptance Criteria

- `npm run db:deploy` then `npm run db:seed` completes from repo root without manual per-service commands. Verified with `npm.cmd run db:seed`.
- The seed is safe to rerun. Verified by running `npm.cmd run db:seed` twice.
- External dependencies are documented: identity seed calls Keycloak Admin API unless `SKIP_KEYCLOAK_SEED=1`; question image seed calls Azure Blob/media storage.
- Frontend can load useful data immediately for course, exam, analytics, notification, and simulation screens.
- Simulation maneuver APIs return non-empty data for at least `B1` and `B2`.
- Course enrollment demo does not fail with `STUDENT_LICENSE_NOT_ASSIGNED` after seed.
- API/test docs reference deterministic demo ids and accounts.
