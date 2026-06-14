
<!-- Merged from docs/requirements/use-case-implementation-summary.md -->
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



<!-- Merged from docs/requirements/use-case-implementation-summary.md -->
# DriveMate - Summary 10 Use Case Chính Để Present

Tài liệu này tóm tắt theo chuỗi: **SRS flow/business rule -> codebase -> ASR -> ADD -> SAD -> design pattern**. Trọng tâm ưu tiên **Availability** nhưng vẫn giải thích Security, Reliability, Performance, Data Integrity và Modifiability khi liên quan.

## 0. Khung Kiến Trúc Nói Trước Khi Vào Use Case

DriveMate là monorepo microservices NestJS. Mỗi bounded context nằm trong một service riêng: `identity-service`, `user-service`, `course-service`, `exam-service`, `question-service`, `analytics-service`, `simulation-service`, `notification-service`, `media-service`, `audit-service`, `docs-service`. Kiến trúc trong ADD/SAD đi theo **4+1 View Model**:

- **Logical View:** các service tách theo domain; Kong làm API Gateway; Keycloak làm identity provider; RabbitMQ làm event bus; Redis dùng cho token blacklist và cache một số luồng đọc.
- **Implementation View:** Turborepo monorepo, NestJS, Prisma per-service, DDD/Clean Architecture. Code chia thành `presentation`, `application`, `domain`, `infrastructure`.
- **Deployment View:** Docker Compose cho dev, Kubernetes/HPA là target production. Service stateless nên scale ngang được.
- **Data View:** database-per-service trên PostgreSQL; không JOIN chéo database; trao đổi liên service qua REST hoặc RabbitMQ.
- **Process/Data Flow View trong SAD:** login qua Keycloak, start/submit exam, dashboard progress, notification async, course cache, simulation realtime.

Availability evidence toàn hệ thống:

- **ASR-AV-01:** mọi service dùng `HealthModule.register(...)`; endpoint `/health/live`, `/health/ready` nằm ở `packages/common/src/health/health.controller.ts`.
- **ASR-AV-03:** mọi service dùng `MetricsModule.register(...)`; `/metrics` và RED metrics nằm ở `packages/common/src/metrics`.
- **ASR-AV-04:** gọi HTTP liên service dùng `resilientFetch()` có timeout, retry, exponential backoff, circuit breaker tại `packages/common/src/http/resilient-http-client.ts`.
- **ASR-AV-06:** course dùng Redis cache với `safeExec()` fallback DB; analytics dùng projection/read model để giảm phụ thuộc truy vấn raw log.

> Ghi chú khi thầy hỏi gap: `SAD.docx` còn đoạn cũ nói course cache là NestJS in-memory, nhưng `ASR.xlsx`, `SRS-ASR-MAPPING-SUMMARY.md` và code hiện tại dùng Redis TTL 600s. Đây là gap tài liệu SAD cần update, không phải gap implementation.

---

## 1. UC01 - Login

**SRS flow và business rule.** Người dùng nhập email/password, hệ thống validate required fields và email format, load account theo email, kiểm tra account lock, verify password, reset failed counter nếu thành công, sinh JWT và redirect theo role. Nếu sai credential thì tăng failed counter; vượt threshold thì lock account. Business rules chính: BR01 input validation, BR02 account lock check, BR03 credential verification, BR04 brute-force protection, BR05 success response.

**Vị trí code.**

- `apps/identity-service/src/application/use-cases/login/login.use-case.ts`: `LoginUseCase` gọi `identityProvider.login(username, password)`.
- `apps/identity-service/src/infrastructure/keycloak-admin/keycloak-admin.service.ts`: adapter gọi Keycloak token endpoint/admin API.
- `apps/identity-service/src/infrastructure/guards/jwt-auth.guard.ts`: validate JWT cho protected route, cache public key và lấy Keycloak realm metadata bằng `resilientFetch`.

Code mẫu:

```ts
// login.use-case.ts
const tokenSet = await this.identityProvider.login(
  command.username,
  command.password,
);
```

```ts
// jwt-auth.guard.ts
const response = await resilientFetch(url, {}, {
  serviceName: 'identity-service',
  dependencyName: 'keycloak',
  timeoutMs: this.configService.get<number>('keycloak.timeoutMs') ?? 3_000,
});
```

**Mapping sang ASR.**

- **ASR-SEC-01:** stateless authentication, password hashing và brute-force lockout được delegate cho Keycloak. Code không tự hash password như SRS mô tả ở mức business, mà để Keycloak xử lý đúng ranh giới kiến trúc.
- **ASR-PERF-01:** login P95 <= 300ms trong điều kiện peak bình thường; `identity-service` stateless và có thể scale độc lập.
- **ASR-AV-04:** lấy public key Keycloak dùng `resilientFetch`, có timeout/retry/circuit breaker. Nếu Keycloak chậm, request fail có kiểm soát thay vì treo thread.
- **ASR-AV-01/03:** identity-service có health/metrics chung như các service khác.

**Design pattern.**

- **Adapter:** `IdentityProviderPort` che giấu chi tiết Keycloak. Use case chỉ biết interface, không biết HTTP endpoint cụ thể.
- **Chain of Responsibility:** request đi qua Kong/JWT guard/token blacklist/role guard. Mỗi guard chịu một trách nhiệm.
- **Circuit Breaker + Retry:** nằm trong shared `resilientFetch`, áp dụng cho dependency Keycloak.

**Mapping sang ADD.**

- ADD §2.1.1 / Table ASR-SEC-01: xác thực stateless, credential policy qua Keycloak.
- ADD §2.2.1 / ASR-PERF-01: identity service scale độc lập.
- ADD §2.7.2 / ASR-AV-04: HTTP resilience cho downstream dependency.
- ADD §3.1 Logical View: Kong validate JWT, identity-service tích hợp Keycloak.

**Mapping sang SAD.**

- SAD §5.2.1 mô tả data flow login: Client -> Kong -> identity-service -> Keycloak -> trả JWT.
- SAD §6.3.1 mô tả Authentication & Session Management, access token ngắn hạn 15-30 phút, Keycloak quản lý brute force.
- SAD §3.3.1 và §3.3.2 giải thích scale độc lập và fault isolation.

---

## 2. UC02 - Forgot Password

**SRS flow và business rule.** Người dùng nhập email ở màn hình login; hệ thống validate email, tìm account, tạo reset token, set expiration, gửi link email; người dùng mở link, token được validate, nhập password mới, password policy pass thì update password và mark token used. BR chính: BR01 email validation, BR02 account lookup, BR03 token generation, BR04 token validation/password policy, BR05 success response.

**Vị trí code.**

- `apps/identity-service/src/application/use-cases/forgot-password/forgot-password.use-case.ts`
- `apps/identity-service/src/infrastructure/keycloak-admin/keycloak-admin.service.ts`
- DTO: `apps/identity-service/src/presentation/dtos/forgot-password.request.dto.ts`

Code mẫu:

```ts
const normalizedEmail = command.email.trim().toLowerCase();
const response = new ForgotPasswordResult(
  true,
  'Neu email nay ton tai, huong dan dat lai mat khau da duoc gui.',
);

const user = await this.identityProvider.findUserByEmail(normalizedEmail);
if (!user?.id || user.enabled === false) return response;

await this.identityProvider.sendPasswordResetEmail(user.id);
return response;
```

**Mapping sang ASR.**

- **ASR-SEC-02:** reset token single-use, expires within 15 minutes, password policy do Keycloak quản lý.
- **Availability/Security note:** code trả response generic kể cả email không tồn tại hoặc disabled. Điểm này khác SRS activity cũ ghi HTTP 404, nhưng tốt hơn về security vì chống user enumeration. Khi present nên nói: “SRS mô tả lookup failure; implementation intentionally masks account existence while still satisfying ASR-SEC-02.”
- **ASR-AV-04:** nếu Keycloak admin API chậm/lỗi, adapter/provider có thể áp dụng timeout/retry theo hạ tầng chung.

**Design pattern.**

- **Delegation / Adapter:** use case delegate toàn bộ token lifecycle và email reset cho Keycloak qua `IdentityProviderPort`.
- **Facade:** `ForgotPasswordUseCase` cung cấp API đơn giản cho presentation layer, che giấu nhiều bước của Keycloak.

**Mapping sang ADD.**

- ADD §2.1.1.2 ASR-SEC-02: password reset security.
- ADD §3.1 Logical View: identity-service là wrapper cho Keycloak admin API.
- ADD §3.2 Implementation View: application layer gọi port, infrastructure layer implement bằng Keycloak.

**Mapping sang SAD.**

- SAD §3.2.2 Keycloak: built-in Forgot Password flow, SMTP/email dispatch.
- SAD §6.3.1: Password Reset via Keycloak, identity-service không tự lưu reset token.
- SAD §5.1.2: Keycloak nhận password-reset request và admin API calls.

---

## 3. UC03 - Create User Account

**SRS flow và business rule.** Admin/Manager fill form, validate JWT, check RBAC, validate `fullName`, `email`, `role`, `temporaryPassword`, check duplicate email, tạo account active, gửi credential email, trả HTTP 201. Business rules: BR01 validation, BR02 RBAC, BR03 uniqueness, BR04 account creation transaction, BR05 success response.

**Vị trí code.**

- DTO validation: `apps/identity-service/src/presentation/dtos/create-user.request.dto.ts`
- Use case: `apps/identity-service/src/application/use-cases/create-identity-user/create-identity-user.use-case.ts`
- Aggregate: `apps/identity-service/src/domain/aggregates/identity-user/identity-user.aggregate.ts`
- Repository: `apps/identity-service/src/infrastructure/persistence/prisma/prisma-identity-user.repository.ts`

Code mẫu:

```ts
// create-user.request.dto.ts
@IsEmail()
email!: string;

@IsString()
@IsNotEmpty()
fullName!: string;

@IsEnum(UserRole)
role!: UserRole;

@IsString()
@MinLength(8)
temporaryPassword!: string;
```

```ts
// create-identity-user.use-case.ts
const userId = await this.identityProvider.createUser(
  command.email,
  command.temporaryPassword,
  command.fullName,
);
await this.identityProvider.assignRealmRole(userId, command.role);

const user = IdentityUser.create({ id: userId, email: command.email, fullName: command.fullName, role: command.role });
await this.identityUserRepository.save(user);
await this.publishEvents(user);
```

**Mapping sang ASR.**

- **ASR-SEC-04:** email unique và role assignment qua RBAC tập trung. Keycloak giữ role; service không hardcode policy phân quyền rải rác.
- **ASR-AV-05 liên quan một phần:** tạo user có domain events/audit publish; tuy nhiên cần phân biệt event publish trong identity hiện không nhất thiết là transactional outbox cho mọi event. Nếu thầy hỏi “atomic giữa Keycloak và DB không?”, câu trả lời đúng là đây là distributed workflow, không phải single DB transaction; hệ thống giảm rủi ro bằng sync/eventual consistency.
- **ASR-AV-01/03:** có health/metrics để detect lỗi identity-service.

**Design pattern.**

- **Decorator:** `class-validator` decorators trên DTO enforce input validation.
- **Factory Method:** `IdentityUser.create(...)` tạo aggregate và enforce invariant domain.
- **Observer/Event-driven:** aggregate phát domain event, use case publish để user-service/analytics đồng bộ ngữ cảnh.

**Mapping sang ADD.**

- ADD §2.1.2.1 ASR-SEC-04: RBAC tập trung.
- ADD §3.2 Implementation View: NestJS DTO validation, DDD aggregate, repository.
- ADD §3.4 Data View/Event Bus: identity event lan truyền sang service khác qua RabbitMQ.

**Mapping sang SAD.**

- SAD §3.2.3 identity-service: wrapper Keycloak, identity_db lưu cache IdentityUser.
- SAD §3.2.4 user-service: consume identity event để tạo/sync profile.
- SAD §6.3.2 Authorization & Access Control: role do Keycloak realm quản lý.

---

## 4. UC06 - Assign License Categories To Students

**SRS flow và business rule.** Admin/Manager chọn student, chọn license tier, validate JWT/RBAC, query student, validate tier active, update `student.licenseTierId`, ghi audit `{changedBy, oldValue, newValue, changedAt}`, persist và trả HTTP 200. BR chính: JWT/RBAC, student existence, license tier validation, assignment update and audit.

**Vị trí code.**

- Use case: `apps/user-service/src/application/use-cases/assign-license-tier/assign-license-tier.use-case.ts`
- Aggregate: `apps/user-service/src/domain/aggregates/user-profile/user-profile.aggregate.ts`
- Repository transaction: `apps/user-service/src/infrastructure/persistence/prisma/prisma-user-profile.repository.ts`

Code mẫu:

```ts
const profile = await this.userProfileRepository.findById(command.studentId);
if (!profile) throw new UserProfileNotFoundException(command.studentId);

profile.assignLicenseTier(command.newLicenseTier, command.changedById);

await this.userProfileRepository.save(profile, auditEvent);
await this.eventPublisher.publishAll(events);
```

Trong repository:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.userProfile.upsert(...);
  await tx.studentDetail.upsert(...);
  await tx.licenseAssignmentAudit.create(...);
  await tx.outboxMessage.create({ data: { eventName: auditEvent.eventName, payload: auditEvent } });
});
```

**Mapping sang ASR.**

- **ASR-DI-05:** một học viên chỉ có một license tier active; switch tier và audit được ghi atomically trong `user_db`.
- **ASR-MOD-02:** license tier là data/config, tránh hardcode logic theo string ở business flow.
- **ASR-AV-05:** `user-service` ghi business mutation + audit outbox trong cùng PostgreSQL transaction. Nếu audit-service/RabbitMQ tạm lỗi, message vẫn pending để relay sau.

**Design pattern.**

- **Aggregate Root:** `UserProfile` giữ invariant `studentDetail/licenseTier`.
- **Transactional Outbox:** audit event ghi vào `outboxMessage` trong cùng transaction với profile/studentDetail.
- **Repository:** application layer không biết Prisma details.

**Mapping sang ADD.**

- ADD §2.4.1.4 ASR-DI-05: one active license per student.
- ADD §2.7.3 ASR-AV-05: transactional recovery/outbox.
- ADD §3.4 Data View: database-per-service, audit event không JOIN chéo service.

**Mapping sang SAD.**

- SAD §3.2.4 user-service: license tier config, audit write.
- SAD §3.3.4 Data Sovereignty: user-service giữ consistency contract riêng cho profile/license.
- SAD §4.2 Technical Constraints: data integrity rules và audit logging.

---

## 5. UC07 - View Detailed Course List

**SRS flow và business rule.** User mở Course List, hệ thống validate JWT, lấy licenseCategory từ token/profile, resolve cache key `[licenseCategory,page,size]`, nếu cache hit trả paginated result; nếu miss query DB với filter license + pagination, populate cache, trả list/detail. BR chính: authentication, license-based filtering, cache-aside query, search/pagination, detail response.

**Vị trí code.**

- Use case: `apps/course-service/src/application/use-cases/list-courses/list-courses.use-case.ts`
- Cache port: `apps/course-service/src/application/ports/course-cache.port.ts`
- Redis implementation: `apps/course-service/src/infrastructure/cache/redis-course-cache.service.ts`

Code mẫu:

```ts
const cached = await this.courseCache.getCourseList(cacheKey);
if (cached) return cached;

const { items, total } = await this.courseRepository.findAll({ ...query });
const result = new ListCoursesResult(items.map(CourseResult.fromAggregate), total, query.page, query.size);
await this.courseCache.setCourseList(cacheKey, result);
return result;
```

```ts
private readonly ttlSeconds = 600;

private async safeExec<T>(operation: () => Promise<T>, fallback?: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    this.logger.warn(`Course cache skipped: ${...}`);
    return fallback as T;
  }
}
```

**Mapping sang ASR.**

- **ASR-PERF-05:** cache hit < 50ms, cache miss fallback DB < 300ms, TTL 600s, invalidation khi course update/delete.
- **ASR-AV-06:** partial degradation. Redis down không làm request chết; `safeExec(..., null)` biến thành cache miss và DB fallback.
- **ASR-AV-01/03:** course-service có `/health/ready` và `/metrics` để phát hiện Redis/DB degradation.

**Design pattern.**

- **Strategy:** `CourseCachePort` là abstraction; Redis là concrete strategy, có thể thay bằng in-memory/no-cache mà use case không đổi.
- **Cache-Aside:** app tự check cache, miss thì query DB, set cache.
- **Guard Clause/Repository:** query luôn có pagination, tránh unbounded read.

**Mapping sang ADD.**

- ADD §2.2.2.2 ASR-PERF-05: course cache TTL 5-10 min.
- ADD §2.7.4 ASR-AV-06: cache-backed read model/partial degradation.
- ADD §3.1 Logical View và §3.2 Implementation View: `course-service` là service riêng, có repository/cache adapter.

**Mapping sang SAD.**

- SAD §5.2.5 mô tả Course Detail Read with Cache.
- SAD §7.1.1 mô tả course detail cache performance.
- **Doc gap:** SAD hiện ghi in-memory CacheManager/no Redis, trong khi code và ASR hiện dùng Redis. Khi present nên nói: “SAD bản hiện tại cần cập nhật theo quyết định mới: Redis tốt hơn in-memory vì cross-instance consistency, pattern invalidation, restart-safe.”

---

## 6. UC11 - Take Theory Exam / Start Exam

**SRS flow và business rule.** Student click start exam, hệ thống validate JWT, check permission, validate `templateId/licenseTierId`, load student profile + exam template + config, generate randomized question set, create attempt record, init server timer, persist attempt, serialize questions không có đáp án, trả HTTP 201. BR chính: auth/permission, payload validation, resource existence, question generation, attempt persistence, answer confidentiality.

**Vị trí code.**

- Use case: `apps/exam-service/src/application/use-cases/start-session/start-session.use-case.ts`
- Aggregate: `apps/exam-service/src/domain/aggregates/exam-session/exam-session.aggregate.ts`
- Adapter: `apps/exam-service/src/infrastructure/http/http-question-pool.client.ts`
- Mapper/result DTO: `apps/exam-service/src/application/use-cases/shared/exam-session.result.ts`

Code mẫu:

```ts
const profile = await this.userProfileClient.getCurrentStudentProfile(command.accessToken);
if (profile.studentDetail.licenseTier !== template.licenseCategory) {
  throw new StudentLicenseMismatchException('Invalid exam start request. (MSG36)');
}

const questions = await this.selectQuestions(
  template.licenseCategory,
  template.topicDistribution,
  template.criticalQuestions,
  template.shuffleQuestions,
);

const session = ExamSession.create({
  studentId: command.studentId,
  templateId: template.id,
  templateNameSnapshot: template.name,
  templateVersionSnapshot: template.version,
  topicDistributionSnapshot: template.topicDistribution,
  questions: ...
});
```

Trong aggregate:

```ts
const now = new Date();
const expiresAt = new Date(now.getTime() + props.durationMinutes * 60_000);
status: ExamSessionStatus.IN_PROGRESS,
startedAt: now,
expiresAt,
```

**Mapping sang ASR.**

- **ASR-PERF-12:** question selection phải dùng indexed queries, không full-table scan; call sang question-service qua adapter.
- **ASR-DI-08:** exam config snapshot (`templateNameSnapshot`, `version`, `topicDistributionSnapshot`, `durationMinutesSnapshot`) đóng băng cấu hình lúc generate.
- **ASR-DI-09:** exact question count per topic; thiếu pool thì throw `InsufficientQuestionPoolException`.
- **ASR-REL-02:** server authoritative timer; `startedAt/expiresAt` do server set.
- **ASR-AV-04:** `HttpQuestionPoolClient` dùng `resilientFetch` với timeout khi gọi question-service. Nếu question-service fail, exam-service fail nhanh có kiểm soát.

**Design pattern.**

- **Factory Method:** `ExamSession.create()` tạo session hợp lệ, set timer và initial state.
- **Adapter:** `HttpQuestionPoolClient extends QuestionPoolClient`, chuyển HTTP envelope thành domain pool items.
- **Snapshot/Immutability Pattern:** session lưu config snapshot, lịch sử thi không bị thay đổi khi admin chỉnh template sau này.
- **Circuit Breaker:** shared `resilientFetch` bảo vệ call `exam-service -> question-service`.

**Mapping sang ADD.**

- ADD §2.2.4.2 ASR-PERF-12: exam generation latency.
- ADD §2.4.1.7 ASR-DI-09 và §2.4.2.2 ASR-DI-08: structural correctness + config snapshot.
- ADD §2.7.2 ASR-AV-04: service-level timeout/retry/circuit breaker.
- ADD §3.5/Process View: start exam là flow đồng bộ, nhưng dependency được resilient.

**Mapping sang SAD.**

- SAD §5.2.2 Start & Submit Exam: start exam load active config, snapshot vào `ExamSession`, gọi question-service, trả question text + options only.
- SAD §3.2.5 exam-service: exam templates, sessions, atomic scoring, config snapshots.
- SAD §6.3.3 Exam Content Integrity: correct answer không được gửi ra client.

---

## 7. UC12 - Manage Exam Session / Auto-Save Answer

**SRS flow và business rule.** Student trả lời/bookmark/autosave; hệ thống validate JWT, check permission, validate attemptId/questionId/eventType/status, load attempt/question/timer metadata, upsert answer/bookmark, update remaining time, persist session state, trả HTTP 200. BR chính: auth, request validation, context existence, idempotent save, timer state.

**Vị trí code.**

- Use case: `apps/exam-service/src/application/use-cases/save-answer/save-answer.use-case.ts`
- Aggregate method: `ExamSession.saveAnswer(...)`
- Repository upsert: `apps/exam-service/src/infrastructure/persistence/prisma/prisma-exam-session.repository.ts`

Code mẫu:

```ts
const session = await this.sessionRepository.findById(command.sessionId);
if (!session) throw new ExamSessionNotFoundException();
session.assertOwner(command.studentId);

const finalized = await finalizeExpiredSessionIfNeeded(session, ...);
if (finalized) return ExamSessionResult.fromAggregate(session, true);

session.saveAnswer(command.questionId, command.selectedOptionId, command.isBookmarked);
await this.sessionRepository.save(session);
```

Aggregate:

```ts
saveAnswer(questionId: string, selectedOptionId?: string | null, isBookmarked?: boolean): void {
  this.assertInProgress();
  this.assertNotExpired();
  const question = this.findQuestion(questionId);
  if (selectedOptionId !== undefined) question.answer(selectedOptionId);
  if (isBookmarked !== undefined) question.setBookmarked(isBookmarked);
  this.touch();
}
```

Repository:

```ts
await tx.examSessionQuestion.upsert({
  where: { id: question.id },
  create: { id: question.id, ...questionData },
  update: questionData,
});
```

**Mapping sang ASR.**

- **ASR-REL-03:** save operation idempotent; gửi lại cùng answer không tạo duplicate vì repository dùng `upsert`.
- **ASR-REL-02:** auto-save vẫn check expiry server-side; expired thì finalize trước.
- **ASR-UX-05:** phần offline buffering là client-side; backend hỗ trợ bằng idempotent sync.
- **ASR-AV-06:** session state ở DB, không phụ thuộc instance memory; request có thể route tới replica service khác.

**Design pattern.**

- **Aggregate Root:** invariant `IN_PROGRESS`, `not expired`, owner check nằm trong domain.
- **Idempotent Write:** `upsert` đảm bảo retry/duplicate submit cùng state không tạo row mới.
- **Repository:** transaction persistence nằm trong infrastructure.

**Mapping sang ADD.**

- ADD §2.3.2.2 ASR-REL-03: idempotent auto-save + offline sync.
- ADD §2.3.1.1 ASR-REL-02: server authoritative timer.
- ADD §3.4 Data View: in-progress session state persisted to `exam_db`, không giữ trong memory.

**Mapping sang SAD.**

- SAD §5.2.2 step auto-save: PATCH answers every 5-10s, idempotent, offline buffer sync on reconnect.
- SAD §4.3 Design Principles: idempotent write, stateless services.
- SAD §3.3.2 Availability Boundaries: exam-service không phụ thuộc analytics/notification để autosave.

---

## 8. UC13/UC14 - Submit & Grade Exam

**SRS flow và business rule.** UC13 student confirm submit; hệ thống validate JWT/permission, validate attempt status/anti-double-submit, load active attempt and answer snapshot, lock answers/finalize attempt, trigger grading, trả confirmation/result. UC14 grading workflow load answers + answer key + fatal questions, compute score/pass threshold, apply fatal question override, persist final grade, trả HTTP 200.

**Vị trí code.**

- Use case: `apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.ts`
- Domain grading: `apps/exam-service/src/domain/aggregates/exam-session/exam-session.aggregate.ts`
- Repository transaction: `apps/exam-service/src/infrastructure/persistence/prisma/prisma-exam-session.repository.ts`
- Event publisher: `apps/exam-service/src/infrastructure/messaging/rabbitmq-event-publisher.service.ts`

Code mẫu:

```ts
if (session.status !== ExamSessionStatus.IN_PROGRESS) {
  return ExamSessionResult.fromAggregate(session, true);
}

session.submit();
await this.sessionRepository.save(session);
const events = session.getDomainEvents();
session.clearDomainEvents();
await this.eventPublisher.publishAll(events);
```

Domain grading:

```ts
for (const question of this._questions) {
  const correct = question.grade();
  if (correct) score += 1;
  if (question.isCritical && !correct) criticalMistakes += 1;
}
const failedByCritical = criticalMistakes > this.maxCriticalMistakes;
this._isPassed = !failedByCritical && score >= this.passingScore;
this._status = status;
this.addDomainEvent(new ExamSessionCompletedEvent(...));
```

**Mapping sang ASR.**

- **ASR-DI-01:** client chỉ gửi selected answer; scoring server-side.
- **ASR-DI-02:** fatal/critical question được xử lý trong domain, không expose cho client trong lúc làm bài.
- **ASR-REL-04:** submit, grade, result write cần atomic. Code hiện lưu `examSession` và `examSessionQuestion` trong một Prisma transaction trong repository, nên phần DB persistence của result là atomic.
- **ASR-DI-07 và ASR-AV-05:** tài liệu ASR/ADD/SAD yêu cầu `ExamCompleted` được ghi outbox cùng transaction. **Code hiện tại chưa làm đúng điểm này cho business event exam completion**: `sessionRepository.save(session)` commit xong, rồi `eventPublisher.publishAll(events)` publish RabbitMQ sau đó. Nếu broker lỗi ở đúng thời điểm này, DB result đã commit nhưng event analytics có thể không được outbox retry. Đây là gap implementation so với ASR-DI-07/AV-05. Audit outbox có tồn tại trong exam-service nhưng không áp dụng cho `ExamSessionCompletedEvent`.

**Design pattern.**

- **Aggregate Root + Domain Event/Observer:** grading nằm trong `ExamSession.grade()`, sau đó add `ExamSessionCompleted/Passed/FailedEvent`.
- **Rule Engine đơn giản:** pass/fail dựa trên score + critical mistakes.
- **Transactional Repository:** Prisma `$transaction` bọc save session/questions.
- **Transactional Outbox intended pattern:** tài liệu yêu cầu, nhưng code business event cần bổ sung để đạt đủ.

**Mapping sang ADD.**

- ADD §2.3.3.1 ASR-REL-04: reliable atomic submit.
- ADD §2.4.2.1 ASR-DI-01: immutable result.
- ADD §2.4.1.6 ASR-DI-07 và §2.7.3 ASR-AV-05: transactional outbox cho ExamCompleted.
- Khi present, nếu không muốn bị bắt lỗi, nói rõ: “Design decision trong ADD là outbox; code hiện đã atomic DB result, nhưng business event outbox cần hoàn thiện để full compliance.”

**Mapping sang SAD.**

- SAD §5.2.2 mô tả Start & Submit Exam: single PostgreSQL transaction và outbox publisher.
- SAD §6.3.3 Exam Content Integrity: correct answers không leak.
- SAD §7.1.3 note on exam grading: synchronous grading trong transaction để trả result ngay.

---

## 9. UC26/UC34 - View Learning Progress Dashboard

**SRS flow và business rule.** Student mở My Progress; hệ thống validate JWT, check Student role, extract studentId từ claims, cache-first query progress, nếu miss query DB/projection, cache metrics, project payload gồm completion%, pass-rate, weak topics, enforce strict scope studentId match, trả HTTP 200.

**Vị trí code.**

- Consumer event: `apps/analytics-service/src/presentation/messaging/messaging.controller.ts`
- Projection update: `apps/analytics-service/src/application/use-cases/record-events/record-events.use-case.ts`
- Read use case: `apps/analytics-service/src/application/use-cases/get-progress/get-progress.use-case.ts`
- Repository: `apps/analytics-service/src/infrastructure/persistence/prisma/prisma-learning-progress.repository.ts`

Code mẫu:

```ts
// messaging.controller.ts
@EventPattern('exam.session.completed')
async handleExamCompleted(@Payload() payload: ExamCompletedPayload): Promise<void> {
  await this.recordLearningEventUseCase.execute({
    type: 'exam-completed',
    payload,
  });
}
```

```ts
// get-progress.use-case.ts
const cached = await this.cache.get(query.studentId, query.licenseTier);
if (cached) return cached;
const dashboard = await this.repository.getDashboard(query.studentId);
await this.cache.set(query.studentId, dashboard, query.licenseTier);
return dashboard;
```

**Mapping sang ASR.**

- **ASR-PERF-04:** dashboard lấy từ pre-computed/projection table, không real-time aggregate raw log.
- **ASR-PERF-07:** chart data từ aggregated data, response mục tiêu < 200ms.
- **ASR-AV-06:** projected read model giảm áp lực lên exam_db; nếu analytics lag, exam flow vẫn chạy, dashboard eventual consistent.
- **ASR-AV-05/DI-07:** lý tưởng là exam-service outbox -> RabbitMQ -> analytics idempotent. Code analytics consumer có handler và cache invalidation, nhưng full guarantee phụ thuộc việc exam-service bổ sung outbox như gap ở UC13/14.

**Design pattern.**

- **CQRS:** write model ở `exam-service/course-service`, read projection ở `analytics-service`.
- **Pub-Sub:** analytics consume events như `exam.session.completed`, `course.enrollment.progress-reset`.
- **Cache-Aside / Projection Cache:** `GetProgressUseCase` đọc cache trước, miss thì query projection.

**Mapping sang ADD.**

- ADD §2.2.2.1 ASR-PERF-04: progress statistics from pre-aggregated table.
- ADD §2.2.2.3 ASR-PERF-07: chart from aggregated data.
- ADD §2.7.4 ASR-AV-06: cache-backed/projected read models.
- ADD §3.1 Logical View: analytics-service chịu trách nhiệm progress stats/SRS.

**Mapping sang SAD.**

- SAD §5.2.3 Progress Dashboard Load: Client -> Kong -> analytics-service -> indexed lookup on progress_stat -> return metrics.
- SAD §3.2.9 analytics-service: progress queries hit pre-aggregated table, no raw log aggregation.
- SAD §7.1.2: progress dashboard P95 < 200ms bằng indexed lookup.

---

## 10. UC35/UC36 - 2D Driving Practice & Realtime Error Feedback

**SRS/mapping flow và business rule.** Student bắt đầu practice 2D, hệ thống validate JWT/student role/license tier/capability, tạo session. Trong session, client gửi telemetry như speed, lane offset, collision. Server kiểm tra trạng thái session, owner, ingest telemetry, detect lỗi, trả feedback `{errorCode, severity, penalty, message, hint}` để client render cảnh báo. BR chính: authorization, capability validation, server-side feedback, fatal/warning mapping, session end summary.

**Vị trí code.**

- Use cases: `apps/simulation-service/src/application/use-cases/practice2d/practice2d.use-cases.ts`
- Aggregate/FSM: `apps/simulation-service/src/domain/aggregates/practice2d/practice2d-session.aggregate.ts`

Code mẫu:

```ts
// use case
const session = await this.repository.findById(command.sessionId);
if (!session) throw new Practice2dSessionNotFoundException(command.sessionId);
session.assertOwner(command.studentId);
const feedback = session.ingestTelemetry({
  type: command.type,
  speedKmh: command.speedKmh,
  laneOffset: command.laneOffset,
  collision: command.collision,
  signal: command.signal,
  payload: command.payload,
});
await this.repository.save(session);
```

```ts
// aggregate
if (input.collision) {
  return this.feedback(input, 'COLLISION', FeedbackSeverity.FATAL, 100);
}
if (typeof input.speedKmh === 'number' && input.speedKmh > 60) {
  return this.feedback(input, 'OVERSPEED', FeedbackSeverity.WARNING, 10);
}
if (typeof input.laneOffset === 'number' && Math.abs(input.laneOffset) > 1) {
  return this.feedback(input, 'LANE_DEPARTURE', FeedbackSeverity.WARNING, 5);
}
```

**Mapping sang ASR.**

- **ASR-UX-02:** server xác định lỗi và trả action response; client chỉ render alert, không tự tính luật. Target hiển thị <= 300ms sau khi nhận response.
- **ASR-MOD-03:** map/scenario config đọc runtime; thêm map mới bằng config, không release app mới.
- **ASR-AV-06:** simulation session persist vào DB; service stateless scale được. Static error definitions/scenario có thể cache; lỗi analytics/notification không ảnh hưởng practice.
- **ASR-AV-01/03:** simulation-service có health/metrics, giúp detect realtime service degradation.

**Design pattern.**

- **Finite State Machine (FSM):** session chỉ nhận telemetry khi `IN_PROGRESS`; `end()` chuyển sang `COMPLETED/ABANDONED`.
- **Factory Method:** `Practice2dSession.create()` validate capability trước khi tạo session.
- **Observer/Domain Event:** khi end session không abandoned, aggregate add `Practice2dSessionCompletedEvent`.

**Mapping sang ADD.**

- ADD §2.5.2.1 ASR-MOD-03: runtime map configurability.
- ADD §2.6.1.2 ASR-UX-02: instant road-map error alert.
- ADD §3.1 Logical View: simulation-service quản lý driving scenarios/server FSM.

**Mapping sang SAD.**

- SAD §3.2.8 simulation-service: map types loaded from JSON configs, realtime via WebSocket/Socket.IO, server computes feedback.
- SAD §5.1.8: simulation-service inputs/outputs/storage.
- SAD §6.3.4 API & Service Protection: WSS/TLS, JWT/RBAC ở WebSocket handshake.

---

## 11. Các Câu Trả Lời Nhanh Khi Thầy Hỏi Availability

1. **Nếu một service chết thì sao?**`/health/live` và `/health/ready` cho Docker/Kubernetes biết service process/dependency status. Docker Compose dùng healthcheck/restart, Kubernetes dùng liveness/readiness probe để remove pod khỏi traffic và restart.
2. **Nếu question-service chậm lúc start exam thì sao?**`exam-service` gọi `question-service` qua `HttpQuestionPoolClient`, bên trong dùng `resilientFetch`: timeout, retry transient lỗi, circuit breaker open để fail-fast. Không giữ thread treo vô hạn.
3. **Nếu Redis cache course chết thì sao?**`RedisCourseCacheService.safeExec()` catch lỗi và fallback `null`, use case query DB như cache miss. Hệ thống degrade về latency DB nhưng không crash.
4. **Nếu analytics-service backlog thì có ảnh hưởng submit exam không?**Theo kiến trúc, không. Exam result commit trong `exam_db`; analytics là consumer eventual consistency. Tuy nhiên code cần outbox cho `ExamCompleted` để đảm bảo event không mất khi RabbitMQ lỗi.
5. **Nếu notification-service lỗi thì học viên có nộp bài được không?**Có. Notification là async qua RabbitMQ/DLQ, không nằm trên critical path của exam submission.
6. **Hệ thống có quan sát lỗi production không?**
   Có `/metrics` Prometheus, correlation-id, access log/ELK, smoke script kiểm tra `/health/live` và `/health/ready` qua Kong.

---

## 12. Điểm Cần Nhớ Khi Trình Bày Gap

- **Gap 1 - SAD course cache stale:** SAD nói in-memory cache, nhưng code/ASR dùng Redis TTL 600s. Câu trả lời: Redis là quyết định mới tốt hơn cho multi-replica; SAD cần update để đồng bộ.
- **Gap 2 - ExamCompleted transactional outbox:** ASR/SAD yêu cầu ExamCompleted event ghi outbox cùng transaction với completed session. Code hiện publish RabbitMQ sau transaction. Câu trả lời: phần grading/result DB đã atomic; để full compliance với ASR-DI-07/AV-05 cần đưa domain event vào outbox trong `PrismaExamSessionRepository.save()` rồi relay background.
- **Gap 3 - Forgot password SRS 404 vs implementation generic response:** code cố tình không trả 404 để chống user enumeration. Đây là security improvement so với flow cũ, vẫn phù hợp ASR-SEC-02.


