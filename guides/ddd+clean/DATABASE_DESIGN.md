# Database Design — Luyện Thi Lái Xe Microservices

## Nguyên tắc cốt lõi

- **Database per Service** — mỗi service có PostgreSQL database riêng, không share schema
- **Không foreign key cross-service** — chỉ reference bằng UUID
- **Mỗi Aggregate Root có 1 Repository** — transaction boundary là aggregate
- **Domain Events** cho eventual consistency giữa services
- **Denormalize khi cần** — lưu display data ở nhiều service là bình thường trong microservices

## Hạng bằng lái được hỗ trợ

```
A1 | A2 | B1 | B2 | C | D | E | F
```

Trường `licenseCategory` (enum) xuất hiện ở question-service, exam-service, course-service, simulation-service.

---

## Service 1: identity-service → Keycloak ✅ (dùng Keycloak, không tự implement)

**Bounded Context:** Authentication & Authorization

> Hệ thống sử dụng **Keycloak** làm Identity Provider. Không có `identity_db` riêng.
> Keycloak quản lý: credentials, login/logout, forgot password, JWT issuance, brute-force lock.
> Các service khác verify JWT do Keycloak cấp (via JWKS endpoint).

**Roles được cấu hình trong Keycloak:**

```
ADMIN | CENTER_MANAGER | INSTRUCTOR | STUDENT
```

### Domain Events phát ra (Keycloak Event Listener / Webhook)

| Event                        | Trigger                                | Payload                       |
| ---------------------------- | -------------------------------------- | ----------------------------- |
| `identity.user.created`      | Admin/Center Manager tạo tài khoản mới | userId, email, fullName, role |
| `identity.user.locked`       | Brute-force lock                       | userId                        |
| `identity.user.role-changed` | Admin đổi role                         | userId, oldRole, newRole      |

> Events được publish từ Keycloak Event Listener → RabbitMQ khi có thay đổi tài khoản.

---

## Service 2: user-service → `user_db`

**Bounded Context:** User Profile Management

> Hệ thống quản lý **1 trung tâm duy nhất** — không có khái niệm đa trung tâm.
> Keycloak (identity) biết "ai đang đăng nhập". user-service biết "người dùng là ai" (profile, hạng bằng được giao).
> 4 role: ADMIN, CENTER_MANAGER, INSTRUCTOR, STUDENT — tất cả đều có profile ở đây.

### Aggregate Root: `UserProfile`

> Profile cơ bản cho tất cả các role. `id` bằng với `userId` từ Keycloak — nhận qua event khi tạo tài khoản.

```
user_profiles
├── id              UUID PK          ← = Keycloak userId
├── fullName        TEXT NOT NULL
├── email           TEXT NOT NULL    ← denormalized để search/display, không dùng làm auth
├── phoneNumber     TEXT UNIQUE NULLABLE
├── dateOfBirth     DATE NULLABLE
├── avatarUrl       TEXT NULLABLE
├── gender          ENUM(MALE, FEMALE, OTHER) NULLABLE
├── address         TEXT NULLABLE
├── role            ENUM(ADMIN, CENTER_MANAGER, INSTRUCTOR, STUDENT) NOT NULL  ← sync từ Keycloak
├── isActive        BOOLEAN DEFAULT true   ← admin có thể deactivate độc lập với lock
├── createdAt       TIMESTAMPTZ
└── updatedAt       TIMESTAMPTZ
```

### Entity (thuộc UserProfile aggregate): `StudentDetail`

> Chỉ tồn tại khi `role = STUDENT`. Lưu hạng bằng được giao và các thông tin học viên.

```
student_details
├── id              UUID PK
├── studentId       UUID NOT NULL UNIQUE FK → user_profiles.id
├── licenseTier     ENUM(A1, A2, B1, B2, C, D, E, F) NULLABLE  ← hạng bằng đang học
├── enrolledAt      TIMESTAMPTZ NULLABLE   ← ngày bắt đầu học tại trung tâm
└── notes           TEXT NULLABLE          ← ghi chú của center manager / instructor
```

### Entity (thuộc UserProfile aggregate): `LicenseAssignmentAudit`

> Audit trail bắt buộc theo UC06 — mỗi lần đổi hạng bằng đều ghi lại.

```
license_assignment_audits
├── id              UUID PK
├── studentId       UUID NOT NULL FK → user_profiles.id
├── oldLicenseTier  ENUM(A1, A2, B1, B2, C, D, E, F) NULLABLE  ← null nếu là lần gán đầu tiên
├── newLicenseTier  ENUM(A1, A2, B1, B2, C, D, E, F) NOT NULL
├── changedById     UUID NOT NULL  ← ref → Keycloak userId (ADMIN hoặc CENTER_MANAGER)
└── changedAt       TIMESTAMPTZ NOT NULL
```

### Value Objects (domain layer)

- `PhoneNumber` — validate định dạng 10-11 số VN
- `DateOfBirth` — validate tuổi ≥ 18
- `LicenseTier` — validate thuộc tập hợp hợp lệ (A1..F)

### Domain Events

| Direction | Event                           | Trigger                  | Payload                                            |
| --------- | ------------------------------- | ------------------------ | -------------------------------------------------- |
| Subscribe | `identity.user.created`         | Keycloak tạo tài khoản   | Tạo UserProfile + StudentDetail (nếu role=STUDENT) |
| Subscribe | `identity.user.role-changed`    | Admin đổi role           | Sync lại `role` trên UserProfile                   |
| Publish   | `user.student.license-assigned` | Gán/đổi hạng bằng (UC06) | studentId, oldTier, newTier, changedById           |

---

## Service 3: question-service → `question_db`

**Bounded Context:** Question Bank Management

### Aggregate Root: `QuestionTopic`

> Phân loại câu hỏi theo chủ đề (Luật giao thông, Biển báo, Kỹ thuật lái, Đạo đức người lái...)

```
question_topics
├── id          UUID PK
├── name        TEXT NOT NULL
├── description TEXT
├── parentId    UUID NULLABLE FK → question_topics.id  ← phân cấp
└── createdAt   TIMESTAMPTZ
```

### Aggregate Root: `Question`

```
questions
├── id               UUID PK
├── content          TEXT NOT NULL          ← max 2000 ký tự
├── type             ENUM(THEORY, TRAFFIC_SIGN, SCENARIO_RELATED)
├── licenseCategory  TEXT[]                 ← array enum A1..F, 1 câu dùng được nhiều hạng
├── difficulty       ENUM(EASY, MEDIUM, HARD)
├── explanation      TEXT                   ← giải thích đáp án đúng
├── imageUrl         TEXT NULLABLE          ← biển báo hoặc tình huống
├── isCritical       BOOLEAN DEFAULT false  ← câu điểm liệt: sai = tự động trượt
├── isActive         BOOLEAN DEFAULT true
├── topicId          UUID NOT NULL FK → question_topics.id
├── createdById      UUID NOT NULL  ← ref → identity_users.id
├── createdAt        TIMESTAMPTZ
└── updatedAt        TIMESTAMPTZ
```

> **`isCritical`**: Câu hỏi về nồng độ cồn, tốc độ tối đa — sai 1 câu là trượt dù tổng điểm đủ.

### Entity (thuộc Question): `QuestionOption`

```
question_options
├── id            UUID PK
├── questionId    UUID NOT NULL FK → questions.id
├── content       TEXT NOT NULL  ← max 500 ký tự
├── isCorrect     BOOLEAN NOT NULL
└── displayOrder  INT NOT NULL
```

### Domain Events phát ra

| Event                  | Trigger          | Payload                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `question.created`     | Thêm câu hỏi mới | questionId, licenseCategory[], isCritical |
| `question.deactivated` | Tắt câu hỏi      | questionId                                |

---

## Service 4: exam-service → `exam_db`

**Bounded Context:** Exam Scheduling & Session Management

### Aggregate Root: `ExamTemplate`

> Blueprint của một đề thi — cấu hình số câu, thời gian, điểm đậu theo hạng bằng.

```
exam_templates
├── id                UUID PK
├── name              TEXT NOT NULL
├── licenseCategory   ENUM(A1, A2, B1, B2, C, D, E, F)
├── totalQuestions    INT NOT NULL
├── passingScore      INT NOT NULL     ← điểm tối thiểu để đậu
├── durationMinutes   INT NOT NULL
├── isActive          BOOLEAN DEFAULT true
├── createdById       UUID NOT NULL
└── createdAt         TIMESTAMPTZ
```

### Aggregate Root: `ExamSession`

> Một lần thi của student. Quản lý toàn bộ trạng thái phiên thi.

```
exam_sessions
├── id                UUID PK
├── studentId         UUID NOT NULL  ← ref → identity_users.id
├── templateId        UUID NOT NULL FK → exam_templates.id
├── status            ENUM(PENDING, IN_PROGRESS, COMPLETED, TIMED_OUT, CANCELLED)
├── score             INT NULLABLE          ← null khi chưa hoàn thành
├── isPassed          BOOLEAN NULLABLE
├── failedByCritical  BOOLEAN DEFAULT false ← trượt do câu điểm liệt
├── startedAt         TIMESTAMPTZ NULLABLE
├── finishedAt        TIMESTAMPTZ NULLABLE
├── expiresAt         TIMESTAMPTZ NOT NULL  ← startedAt + durationMinutes
└── createdAt         TIMESTAMPTZ
```

### Entity (thuộc ExamSession): `ExamSessionQuestion`

> Snapshot câu hỏi tại thời điểm thi — tránh bị ảnh hưởng khi question-service cập nhật sau.

```
exam_session_questions
├── id               UUID PK
├── sessionId        UUID NOT NULL FK → exam_sessions.id
├── questionId       UUID NOT NULL        ← ref → question_db (UUID only, NO FK)
├── questionContent  TEXT NOT NULL        ← snapshot nội dung câu hỏi
├── optionsSnapshot  JSONB NOT NULL       ← snapshot toàn bộ options
├── isCritical       BOOLEAN NOT NULL
├── displayOrder     INT NOT NULL
├── selectedOptionId UUID NULLABLE        ← null = chưa trả lời
├── isCorrect        BOOLEAN NULLABLE
└── answeredAt       TIMESTAMPTZ NULLABLE
```

### Aggregate Root: `ExamSchedule`

> Lịch thi được tạo bởi CENTER_MANAGER hoặc ADMIN.

```
exam_schedules
├── id               UUID PK
├── templateId       UUID NOT NULL FK → exam_templates.id
├── centerId         UUID NULLABLE  ← ref → user-service (UUID only)
├── scheduledAt      TIMESTAMPTZ NOT NULL
├── location         TEXT
├── maxParticipants  INT
├── createdById      UUID NOT NULL
└── createdAt        TIMESTAMPTZ
```

### Value Objects

- `Score` — 0 ≤ value ≤ totalQuestions
- `ExamDuration` — > 0, ≤ 180 phút

### Domain Events phát ra

| Event                    | Trigger                  | Payload                                                |
| ------------------------ | ------------------------ | ------------------------------------------------------ |
| `exam.session.completed` | Thi xong (kể cả timeout) | sessionId, studentId, score, isPassed, licenseCategory |
| `exam.session.passed`    | Thi đậu                  | sessionId, studentId, licenseCategory                  |
| `exam.session.failed`    | Thi rớt                  | sessionId, studentId, failedByCritical                 |

---

## Service 5: course-service → `course_db`

**Bounded Context:** Learning Content & Enrollment

### Aggregate Root: `Course`

```
courses
├── id               UUID PK
├── title            TEXT NOT NULL
├── description      TEXT
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── thumbnailUrl     TEXT
├── totalLessons     INT DEFAULT 0
├── estimatedHours   INT
├── isPublished      BOOLEAN DEFAULT false
├── createdById      UUID NOT NULL  ← ref → identity_users.id (INSTRUCTOR/ADMIN)
├── createdAt        TIMESTAMPTZ
└── updatedAt        TIMESTAMPTZ
```

### Entity (thuộc Course): `CourseModule`

```
course_modules
├── id          UUID PK
├── courseId    UUID NOT NULL FK → courses.id
├── title       TEXT NOT NULL
├── description TEXT
└── order       INT NOT NULL
```

### Entity (thuộc CourseModule): `Lesson`

```
lessons
├── id              UUID PK
├── moduleId        UUID NOT NULL FK → course_modules.id
├── title           TEXT NOT NULL
├── content         TEXT         ← markdown
├── videoUrl        TEXT NULLABLE
├── durationMinutes INT DEFAULT 0
├── order           INT NOT NULL
└── createdAt       TIMESTAMPTZ
```

### Aggregate Root: `CourseEnrollment`

> Quản lý tiến trình học của 1 student trong 1 khóa học.

```
course_enrollments
├── id          UUID PK
├── courseId    UUID NOT NULL FK → courses.id
├── studentId   UUID NOT NULL  ← ref → identity_users.id
├── status      ENUM(ACTIVE, COMPLETED, DROPPED)
├── progress    INT DEFAULT 0  ← 0-100%
├── enrolledAt  TIMESTAMPTZ
└── completedAt TIMESTAMPTZ NULLABLE
```

### Entity (thuộc CourseEnrollment): `LessonProgress`

```
lesson_progress
├── id             UUID PK
├── enrollmentId   UUID NOT NULL FK → course_enrollments.id
├── lessonId       UUID NOT NULL FK → lessons.id
├── completedAt    TIMESTAMPTZ NULLABLE
└── watchedSeconds INT DEFAULT 0
```

### Domain Events phát ra

| Event                         | Trigger                  | Payload                              |
| ----------------------------- | ------------------------ | ------------------------------------ |
| `course.enrollment.created`   | Student đăng ký khóa học | enrollmentId, studentId, courseId    |
| `course.enrollment.completed` | Hoàn thành khóa học      | enrollmentId, studentId, courseId    |
| `course.lesson.completed`     | Hoàn thành 1 bài học     | lessonId, studentId, durationMinutes |

---

## Service 6: simulation-service → `simulation_db`

**Bounded Context:** Driving Scenario Simulation (Sa hình)

> Sa hình: student xem video/ảnh tình huống thực tế và chọn hành động đúng. Có 120 tình huống theo quy định.

### Aggregate Root: `Scenario`

> Content tĩnh, do ADMIN/INSTRUCTOR tạo.

```
scenarios
├── id               UUID PK
├── title            TEXT NOT NULL
├── description      TEXT
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── type             ENUM(INTERSECTION, HIGHWAY, URBAN, PARKING, ROUNDABOUT, WEATHER, NIGHT)
├── difficulty       ENUM(EASY, MEDIUM, HARD)
├── videoUrl         TEXT NULLABLE
├── imageUrl         TEXT NULLABLE
├── thumbnailUrl     TEXT
├── order            INT NOT NULL   ← thứ tự trong bộ 120 tình huống
├── isActive         BOOLEAN DEFAULT true
├── createdById      UUID NOT NULL
├── createdAt        TIMESTAMPTZ
└── updatedAt        TIMESTAMPTZ
```

### Entity (thuộc Scenario): `ScenarioOption`

```
scenario_options
├── id            UUID PK
├── scenarioId    UUID NOT NULL FK → scenarios.id
├── content       TEXT NOT NULL
├── isCorrect     BOOLEAN NOT NULL
├── explanation   TEXT           ← giải thích tại sao đúng/sai
└── displayOrder  INT NOT NULL
```

### Aggregate Root: `SimulationSession`

> Một lần luyện tập sa hình của student.

```
simulation_sessions
├── id               UUID PK
├── studentId        UUID NOT NULL  ← ref → identity_users.id
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── status           ENUM(IN_PROGRESS, COMPLETED, ABANDONED)
├── totalScenarios   INT NOT NULL
├── correctCount     INT DEFAULT 0
├── score            INT NULLABLE   ← 0-100
├── isPassed         BOOLEAN NULLABLE
├── startedAt        TIMESTAMPTZ NOT NULL
└── completedAt      TIMESTAMPTZ NULLABLE
```

### Entity (thuộc SimulationSession): `SimulationAnswer`

```
simulation_answers
├── id                UUID PK
├── sessionId         UUID NOT NULL FK → simulation_sessions.id
├── scenarioId        UUID NOT NULL FK → scenarios.id
├── selectedOptionId  UUID NULLABLE   ← null = bỏ qua
├── isCorrect         BOOLEAN NULLABLE
├── timeSpentSeconds  INT DEFAULT 0
└── answeredAt        TIMESTAMPTZ NULLABLE
```

### Domain Events phát ra

| Event                          | Trigger            | Payload                                                |
| ------------------------------ | ------------------ | ------------------------------------------------------ |
| `simulation.session.completed` | Hoàn thành sa hình | sessionId, studentId, score, isPassed, licenseCategory |

---

## Service 7: notification-service → `notification_db`

**Bounded Context:** Notification Delivery

### Aggregate Root: `NotificationTemplate`

```
notification_templates
├── id            UUID PK
├── code          TEXT UNIQUE NOT NULL  ← e.g. EXAM_PASSED, WELCOME, EXAM_FAILED
├── type          ENUM(IN_APP, EMAIL, PUSH, SMS)
├── titleTemplate TEXT NOT NULL         ← Handlebars: "Xin chào {{fullName}}!"
├── bodyTemplate  TEXT NOT NULL
├── isActive      BOOLEAN DEFAULT true
└── createdAt     TIMESTAMPTZ
```

### Aggregate Root: `Notification`

```
notifications
├── id        UUID PK
├── userId    UUID NOT NULL  ← ref → identity_users.id
├── type      ENUM(IN_APP, EMAIL, PUSH, SMS)
├── title     TEXT NOT NULL
├── body      TEXT NOT NULL
├── data      JSONB DEFAULT '{}'  ← metadata tùy loại thông báo
├── isRead    BOOLEAN DEFAULT false
├── readAt    TIMESTAMPTZ NULLABLE
├── sentAt    TIMESTAMPTZ NULLABLE
└── createdAt TIMESTAMPTZ
```

### Aggregate Root: `NotificationPreference`

```
notification_preferences
├── id           UUID PK
├── userId       UUID NOT NULL UNIQUE  ← ref → identity_users.id
├── emailEnabled BOOLEAN DEFAULT true
├── pushEnabled  BOOLEAN DEFAULT true
├── smsEnabled   BOOLEAN DEFAULT false
├── inAppEnabled BOOLEAN DEFAULT true
└── updatedAt    TIMESTAMPTZ
```

### Domain Events subscribe

| Event                          | Hành động                                             |
| ------------------------------ | ----------------------------------------------------- |
| `identity.user.created`        | Gửi welcome notification + tạo NotificationPreference |
| `identity.user.locked`         | Cảnh báo tài khoản bị khóa                            |
| `exam.session.passed`          | Thông báo đậu thi                                     |
| `exam.session.failed`          | Thông báo rớt thi, gợi ý ôn thêm                      |
| `course.enrollment.completed`  | Chúc mừng hoàn thành khóa học                         |
| `simulation.session.completed` | Thông báo kết quả sa hình                             |

---

## Service 8: analytics-service → `analytics_db`

**Bounded Context:** Learning Analytics & Progress Tracking

> Analytics service là **CQRS read model** — nghe events từ các service khác, tổng hợp view để query nhanh.

### Aggregate Root: `StudentLearningProfile`

> Thống kê tổng hợp học tập của student — cập nhật dần theo events.

```
student_learning_profiles
├── id                UUID PK  ← bằng studentId
├── studentId         UUID NOT NULL UNIQUE
├── totalStudyMinutes INT DEFAULT 0
├── totalExamAttempts INT DEFAULT 0
├── passedExams       INT DEFAULT 0
├── avgExamScore      FLOAT DEFAULT 0
├── totalSimSessions  INT DEFAULT 0
├── passedSimSessions INT DEFAULT 0
├── avgSimScore       FLOAT DEFAULT 0
├── coursesEnrolled   INT DEFAULT 0
├── coursesCompleted  INT DEFAULT 0
├── lastActivityAt    TIMESTAMPTZ
└── updatedAt         TIMESTAMPTZ
```

### Entity (thuộc StudentLearningProfile): `DailyActivity`

```
daily_activities
├── id                UUID PK
├── studentId         UUID NOT NULL
├── date              DATE NOT NULL
├── studyMinutes      INT DEFAULT 0
├── questionsAnswered INT DEFAULT 0
├── correctAnswers    INT DEFAULT 0
├── examsAttempted    INT DEFAULT 0
├── simSessions       INT DEFAULT 0
└── UNIQUE(studentId, date)
```

### Aggregate Root: `QuestionAccuracyTracker`

> Track tỷ lệ đúng/sai theo từng câu hỏi — dùng để gợi ý ôn câu yếu.

```
question_accuracy_trackers
├── id              UUID PK
├── studentId       UUID NOT NULL
├── questionId      UUID NOT NULL  ← ref → question_db (UUID only)
├── totalAttempts   INT DEFAULT 0
├── correctAttempts INT DEFAULT 0
├── lastAttemptAt   TIMESTAMPTZ
└── UNIQUE(studentId, questionId)
```

### Aggregate Root: `WeakAreaReport`

> Chủ đề yếu của student — computed từ QuestionAccuracy, grouped by topic.

```
weak_area_reports
├── id            UUID PK
├── studentId     UUID NOT NULL
├── topicId       UUID NOT NULL  ← ref → question_db.question_topics (UUID only)
├── topicName     TEXT NOT NULL  ← denormalized để tránh cross-service call
├── accuracyRate  FLOAT NOT NULL ← 0.0 - 1.0
├── questionCount INT NOT NULL
├── needsReview   BOOLEAN DEFAULT false
├── updatedAt     TIMESTAMPTZ
└── UNIQUE(studentId, topicId)
```

### Domain Events subscribe

| Event                          | Hành động                                                 |
| ------------------------------ | --------------------------------------------------------- |
| `identity.user.created`        | Tạo StudentLearningProfile                                |
| `exam.session.completed`       | Update LearningProfile + DailyActivity + QuestionAccuracy |
| `simulation.session.completed` | Update LearningProfile + DailyActivity                    |
| `course.lesson.completed`      | Update studyMinutes trong DailyActivity                   |
| `course.enrollment.completed`  | Increment coursesCompleted                                |

---

## Cross-Service Event Flow

```
[Keycloak → RabbitMQ via Event Listener]
    ├── identity.user.created ──► user-service        (tạo UserProfile + StudentDetail)
    │                         ──► analytics-service   (tạo StudentLearningProfile)
    │                         ──► notification-service (gửi welcome notification)
    └── identity.user.locked  ──► notification-service (cảnh báo tài khoản bị khóa)

[user-service]
    └── user.student.license-assigned ──► analytics-service   (reset scope theo hạng bằng mới)
                                      ──► notification-service (thông báo đổi hạng bằng)

[exam-service]
    ├── exam.session.completed ──► analytics-service   (cập nhật stats + question accuracy)
    ├── exam.session.passed    ──► notification-service (thông báo đậu)
    └── exam.session.failed    ──► notification-service (thông báo rớt)

[simulation-service]
    └── simulation.session.completed ──► analytics-service   (cập nhật sim stats)
                                     ──► notification-service (thông báo kết quả)

[course-service]
    ├── course.lesson.completed     ──► analytics-service   (cập nhật study time)
    └── course.enrollment.completed ──► notification-service (chúc mừng hoàn thành)
                                    ──► analytics-service   (increment coursesCompleted)
```

---

## Tóm tắt

| Service              | Database        | Aggregate Roots                                                 | Ghi chú                                   |
| -------------------- | --------------- | --------------------------------------------------------------- | ----------------------------------------- |
| identity-service     | **Keycloak**    | —                                                               | Không có DB riêng                         |
| user-service         | user_db         | UserProfile                                                     | Có StudentDetail + LicenseAssignmentAudit |
| question-service     | question_db     | Question, QuestionTopic                                         |                                           |
| exam-service         | exam_db         | ExamTemplate, ExamSession, ExamSchedule                         | Snapshot câu hỏi                          |
| course-service       | course_db       | Course, CourseEnrollment                                        |                                           |
| simulation-service   | simulation_db   | Scenario, SimulationSession                                     | 120 tình huống                            |
| notification-service | notification_db | Notification, NotificationTemplate, NotificationPreference      | Pure consumer                             |
| analytics-service    | analytics_db    | StudentLearningProfile, QuestionAccuracyTracker, WeakAreaReport | Pure read model                           |

---

## Event Contracts (packages/common)

Nên tạo shared event types để tất cả services dùng chung, tránh drift:

```
packages/common/src/events/
├── identity/
│   ├── user-created.event.ts
│   └── user-locked.event.ts
├── exam/
│   ├── session-completed.event.ts
│   └── session-passed.event.ts
├── course/
│   ├── enrollment-completed.event.ts
│   └── lesson-completed.event.ts
└── simulation/
    └── session-completed.event.ts
```

---

## Thứ tự implement đề xuất

1. **question-service** — foundation, các service khác tham chiếu questionId
2. **exam-service** — call question-service (sync HTTP) để lấy câu hỏi khi tạo session
3. **course-service** — độc lập, có thể implement song song với exam
4. **simulation-service** — độc lập
5. **user-service** — subscribe `identity.user.created`
6. **analytics-service** — subscribe nhiều events nhất, nên implement sau
7. **notification-service** — implement sau khi có đủ events để test
