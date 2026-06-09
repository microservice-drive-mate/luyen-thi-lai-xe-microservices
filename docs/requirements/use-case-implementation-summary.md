
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
# DriveMate - Summary 10 Use Case ChÃ­nh Äá»ƒ Present

TÃ i liá»‡u nÃ y tÃ³m táº¯t theo chuá»—i: **SRS flow/business rule -> codebase -> ASR -> ADD -> SAD -> design pattern**. Trá»ng tÃ¢m Æ°u tiÃªn **Availability** nhÆ°ng váº«n giáº£i thÃ­ch Security, Reliability, Performance, Data Integrity vÃ  Modifiability khi liÃªn quan.

## 0. Khung Kiáº¿n TrÃºc NÃ³i TrÆ°á»›c Khi VÃ o Use Case

DriveMate lÃ  monorepo microservices NestJS. Má»—i bounded context náº±m trong má»™t service riÃªng: `identity-service`, `user-service`, `course-service`, `exam-service`, `question-service`, `analytics-service`, `simulation-service`, `notification-service`, `media-service`, `audit-service`, `docs-service`. Kiáº¿n trÃºc trong ADD/SAD Ä‘i theo **4+1 View Model**:

- **Logical View:** cÃ¡c service tÃ¡ch theo domain; Kong lÃ m API Gateway; Keycloak lÃ m identity provider; RabbitMQ lÃ m event bus; Redis dÃ¹ng cho token blacklist vÃ  cache má»™t sá»‘ luá»“ng Ä‘á»c.
- **Implementation View:** Turborepo monorepo, NestJS, Prisma per-service, DDD/Clean Architecture. Code chia thÃ nh `presentation`, `application`, `domain`, `infrastructure`.
- **Deployment View:** Docker Compose cho dev, Kubernetes/HPA lÃ  target production. Service stateless nÃªn scale ngang Ä‘Æ°á»£c.
- **Data View:** database-per-service trÃªn PostgreSQL; khÃ´ng JOIN chÃ©o database; trao Ä‘á»•i liÃªn service qua REST hoáº·c RabbitMQ.
- **Process/Data Flow View trong SAD:** login qua Keycloak, start/submit exam, dashboard progress, notification async, course cache, simulation realtime.

Availability evidence toÃ n há»‡ thá»‘ng:

- **ASR-AV-01:** má»i service dÃ¹ng `HealthModule.register(...)`; endpoint `/health/live`, `/health/ready` náº±m á»Ÿ `packages/common/src/health/health.controller.ts`.
- **ASR-AV-03:** má»i service dÃ¹ng `MetricsModule.register(...)`; `/metrics` vÃ  RED metrics náº±m á»Ÿ `packages/common/src/metrics`.
- **ASR-AV-04:** gá»i HTTP liÃªn service dÃ¹ng `resilientFetch()` cÃ³ timeout, retry, exponential backoff, circuit breaker táº¡i `packages/common/src/http/resilient-http-client.ts`.
- **ASR-AV-06:** course dÃ¹ng Redis cache vá»›i `safeExec()` fallback DB; analytics dÃ¹ng projection/read model Ä‘á»ƒ giáº£m phá»¥ thuá»™c truy váº¥n raw log.

> Ghi chÃº khi tháº§y há»i gap: `SAD.docx` cÃ²n Ä‘oáº¡n cÅ© nÃ³i course cache lÃ  NestJS in-memory, nhÆ°ng `ASR.xlsx`, `SRS-ASR-MAPPING-SUMMARY.md` vÃ  code hiá»‡n táº¡i dÃ¹ng Redis TTL 600s. ÄÃ¢y lÃ  gap tÃ i liá»‡u SAD cáº§n update, khÃ´ng pháº£i gap implementation.

---

## 1. UC01 - Login

**SRS flow vÃ  business rule.** NgÆ°á»i dÃ¹ng nháº­p email/password, há»‡ thá»‘ng validate required fields vÃ  email format, load account theo email, kiá»ƒm tra account lock, verify password, reset failed counter náº¿u thÃ nh cÃ´ng, sinh JWT vÃ  redirect theo role. Náº¿u sai credential thÃ¬ tÄƒng failed counter; vÆ°á»£t threshold thÃ¬ lock account. Business rules chÃ­nh: BR01 input validation, BR02 account lock check, BR03 credential verification, BR04 brute-force protection, BR05 success response.

**Vá»‹ trÃ­ code.**

- `apps/identity-service/src/application/use-cases/login/login.use-case.ts`: `LoginUseCase` gá»i `identityProvider.login(username, password)`.
- `apps/identity-service/src/infrastructure/keycloak-admin/keycloak-admin.service.ts`: adapter gá»i Keycloak token endpoint/admin API.
- `apps/identity-service/src/infrastructure/guards/jwt-auth.guard.ts`: validate JWT cho protected route, cache public key vÃ  láº¥y Keycloak realm metadata báº±ng `resilientFetch`.

Code máº«u:

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

- **ASR-SEC-01:** stateless authentication, password hashing vÃ  brute-force lockout Ä‘Æ°á»£c delegate cho Keycloak. Code khÃ´ng tá»± hash password nhÆ° SRS mÃ´ táº£ á»Ÿ má»©c business, mÃ  Ä‘á»ƒ Keycloak xá»­ lÃ½ Ä‘Ãºng ranh giá»›i kiáº¿n trÃºc.
- **ASR-PERF-01:** login P95 <= 300ms trong Ä‘iá»u kiá»‡n peak bÃ¬nh thÆ°á»ng; `identity-service` stateless vÃ  cÃ³ thá»ƒ scale Ä‘á»™c láº­p.
- **ASR-AV-04:** láº¥y public key Keycloak dÃ¹ng `resilientFetch`, cÃ³ timeout/retry/circuit breaker. Náº¿u Keycloak cháº­m, request fail cÃ³ kiá»ƒm soÃ¡t thay vÃ¬ treo thread.
- **ASR-AV-01/03:** identity-service cÃ³ health/metrics chung nhÆ° cÃ¡c service khÃ¡c.

**Design pattern.**

- **Adapter:** `IdentityProviderPort` che giáº¥u chi tiáº¿t Keycloak. Use case chá»‰ biáº¿t interface, khÃ´ng biáº¿t HTTP endpoint cá»¥ thá»ƒ.
- **Chain of Responsibility:** request Ä‘i qua Kong/JWT guard/token blacklist/role guard. Má»—i guard chá»‹u má»™t trÃ¡ch nhiá»‡m.
- **Circuit Breaker + Retry:** náº±m trong shared `resilientFetch`, Ã¡p dá»¥ng cho dependency Keycloak.

**Mapping sang ADD.**

- ADD Â§2.1.1 / Table ASR-SEC-01: xÃ¡c thá»±c stateless, credential policy qua Keycloak.
- ADD Â§2.2.1 / ASR-PERF-01: identity service scale Ä‘á»™c láº­p.
- ADD Â§2.7.2 / ASR-AV-04: HTTP resilience cho downstream dependency.
- ADD Â§3.1 Logical View: Kong validate JWT, identity-service tÃ­ch há»£p Keycloak.

**Mapping sang SAD.**

- SAD Â§5.2.1 mÃ´ táº£ data flow login: Client -> Kong -> identity-service -> Keycloak -> tráº£ JWT.
- SAD Â§6.3.1 mÃ´ táº£ Authentication & Session Management, access token ngáº¯n háº¡n 15-30 phÃºt, Keycloak quáº£n lÃ½ brute force.
- SAD Â§3.3.1 vÃ  Â§3.3.2 giáº£i thÃ­ch scale Ä‘á»™c láº­p vÃ  fault isolation.

---

## 2. UC02 - Forgot Password

**SRS flow vÃ  business rule.** NgÆ°á»i dÃ¹ng nháº­p email á»Ÿ mÃ n hÃ¬nh login; há»‡ thá»‘ng validate email, tÃ¬m account, táº¡o reset token, set expiration, gá»­i link email; ngÆ°á»i dÃ¹ng má»Ÿ link, token Ä‘Æ°á»£c validate, nháº­p password má»›i, password policy pass thÃ¬ update password vÃ  mark token used. BR chÃ­nh: BR01 email validation, BR02 account lookup, BR03 token generation, BR04 token validation/password policy, BR05 success response.

**Vá»‹ trÃ­ code.**

- `apps/identity-service/src/application/use-cases/forgot-password/forgot-password.use-case.ts`
- `apps/identity-service/src/infrastructure/keycloak-admin/keycloak-admin.service.ts`
- DTO: `apps/identity-service/src/presentation/dtos/forgot-password.request.dto.ts`

Code máº«u:

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

- **ASR-SEC-02:** reset token single-use, expires within 15 minutes, password policy do Keycloak quáº£n lÃ½.
- **Availability/Security note:** code tráº£ response generic ká»ƒ cáº£ email khÃ´ng tá»“n táº¡i hoáº·c disabled. Äiá»ƒm nÃ y khÃ¡c SRS activity cÅ© ghi HTTP 404, nhÆ°ng tá»‘t hÆ¡n vá» security vÃ¬ chá»‘ng user enumeration. Khi present nÃªn nÃ³i: â€œSRS mÃ´ táº£ lookup failure; implementation intentionally masks account existence while still satisfying ASR-SEC-02.â€
- **ASR-AV-04:** náº¿u Keycloak admin API cháº­m/lá»—i, adapter/provider cÃ³ thá»ƒ Ã¡p dá»¥ng timeout/retry theo háº¡ táº§ng chung.

**Design pattern.**

- **Delegation / Adapter:** use case delegate toÃ n bá»™ token lifecycle vÃ  email reset cho Keycloak qua `IdentityProviderPort`.
- **Facade:** `ForgotPasswordUseCase` cung cáº¥p API Ä‘Æ¡n giáº£n cho presentation layer, che giáº¥u nhiá»u bÆ°á»›c cá»§a Keycloak.

**Mapping sang ADD.**

- ADD Â§2.1.1.2 ASR-SEC-02: password reset security.
- ADD Â§3.1 Logical View: identity-service lÃ  wrapper cho Keycloak admin API.
- ADD Â§3.2 Implementation View: application layer gá»i port, infrastructure layer implement báº±ng Keycloak.

**Mapping sang SAD.**

- SAD Â§3.2.2 Keycloak: built-in Forgot Password flow, SMTP/email dispatch.
- SAD Â§6.3.1: Password Reset via Keycloak, identity-service khÃ´ng tá»± lÆ°u reset token.
- SAD Â§5.1.2: Keycloak nháº­n password-reset request vÃ  admin API calls.

---

## 3. UC03 - Create User Account

**SRS flow vÃ  business rule.** Admin/Manager fill form, validate JWT, check RBAC, validate `fullName`, `email`, `role`, `temporaryPassword`, check duplicate email, táº¡o account active, gá»­i credential email, tráº£ HTTP 201. Business rules: BR01 validation, BR02 RBAC, BR03 uniqueness, BR04 account creation transaction, BR05 success response.

**Vá»‹ trÃ­ code.**

- DTO validation: `apps/identity-service/src/presentation/dtos/create-user.request.dto.ts`
- Use case: `apps/identity-service/src/application/use-cases/create-identity-user/create-identity-user.use-case.ts`
- Aggregate: `apps/identity-service/src/domain/aggregates/identity-user/identity-user.aggregate.ts`
- Repository: `apps/identity-service/src/infrastructure/persistence/prisma/prisma-identity-user.repository.ts`

Code máº«u:

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

- **ASR-SEC-04:** email unique vÃ  role assignment qua RBAC táº­p trung. Keycloak giá»¯ role; service khÃ´ng hardcode policy phÃ¢n quyá»n ráº£i rÃ¡c.
- **ASR-AV-05 liÃªn quan má»™t pháº§n:** táº¡o user cÃ³ domain events/audit publish; tuy nhiÃªn cáº§n phÃ¢n biá»‡t event publish trong identity hiá»‡n khÃ´ng nháº¥t thiáº¿t lÃ  transactional outbox cho má»i event. Náº¿u tháº§y há»i â€œatomic giá»¯a Keycloak vÃ  DB khÃ´ng?â€, cÃ¢u tráº£ lá»i Ä‘Ãºng lÃ  Ä‘Ã¢y lÃ  distributed workflow, khÃ´ng pháº£i single DB transaction; há»‡ thá»‘ng giáº£m rá»§i ro báº±ng sync/eventual consistency.
- **ASR-AV-01/03:** cÃ³ health/metrics Ä‘á»ƒ detect lá»—i identity-service.

**Design pattern.**

- **Decorator:** `class-validator` decorators trÃªn DTO enforce input validation.
- **Factory Method:** `IdentityUser.create(...)` táº¡o aggregate vÃ  enforce invariant domain.
- **Observer/Event-driven:** aggregate phÃ¡t domain event, use case publish Ä‘á»ƒ user-service/analytics Ä‘á»“ng bá»™ ngá»¯ cáº£nh.

**Mapping sang ADD.**

- ADD Â§2.1.2.1 ASR-SEC-04: RBAC táº­p trung.
- ADD Â§3.2 Implementation View: NestJS DTO validation, DDD aggregate, repository.
- ADD Â§3.4 Data View/Event Bus: identity event lan truyá»n sang service khÃ¡c qua RabbitMQ.

**Mapping sang SAD.**

- SAD Â§3.2.3 identity-service: wrapper Keycloak, identity_db lÆ°u cache IdentityUser.
- SAD Â§3.2.4 user-service: consume identity event Ä‘á»ƒ táº¡o/sync profile.
- SAD Â§6.3.2 Authorization & Access Control: role do Keycloak realm quáº£n lÃ½.

---

## 4. UC06 - Assign License Categories To Students

**SRS flow vÃ  business rule.** Admin/Manager chá»n student, chá»n license tier, validate JWT/RBAC, query student, validate tier active, update `student.licenseTierId`, ghi audit `{changedBy, oldValue, newValue, changedAt}`, persist vÃ  tráº£ HTTP 200. BR chÃ­nh: JWT/RBAC, student existence, license tier validation, assignment update and audit.

**Vá»‹ trÃ­ code.**

- Use case: `apps/user-service/src/application/use-cases/assign-license-tier/assign-license-tier.use-case.ts`
- Aggregate: `apps/user-service/src/domain/aggregates/user-profile/user-profile.aggregate.ts`
- Repository transaction: `apps/user-service/src/infrastructure/persistence/prisma/prisma-user-profile.repository.ts`

Code máº«u:

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

- **ASR-DI-05:** má»™t há»c viÃªn chá»‰ cÃ³ má»™t license tier active; switch tier vÃ  audit Ä‘Æ°á»£c ghi atomically trong `user_db`.
- **ASR-MOD-02:** license tier lÃ  data/config, trÃ¡nh hardcode logic theo string á»Ÿ business flow.
- **ASR-AV-05:** `user-service` ghi business mutation + audit outbox trong cÃ¹ng PostgreSQL transaction. Náº¿u audit-service/RabbitMQ táº¡m lá»—i, message váº«n pending Ä‘á»ƒ relay sau.

**Design pattern.**

- **Aggregate Root:** `UserProfile` giá»¯ invariant `studentDetail/licenseTier`.
- **Transactional Outbox:** audit event ghi vÃ o `outboxMessage` trong cÃ¹ng transaction vá»›i profile/studentDetail.
- **Repository:** application layer khÃ´ng biáº¿t Prisma details.

**Mapping sang ADD.**

- ADD Â§2.4.1.4 ASR-DI-05: one active license per student.
- ADD Â§2.7.3 ASR-AV-05: transactional recovery/outbox.
- ADD Â§3.4 Data View: database-per-service, audit event khÃ´ng JOIN chÃ©o service.

**Mapping sang SAD.**

- SAD Â§3.2.4 user-service: license tier config, audit write.
- SAD Â§3.3.4 Data Sovereignty: user-service giá»¯ consistency contract riÃªng cho profile/license.
- SAD Â§4.2 Technical Constraints: data integrity rules vÃ  audit logging.

---

## 5. UC07 - View Detailed Course List

**SRS flow vÃ  business rule.** User má»Ÿ Course List, há»‡ thá»‘ng validate JWT, láº¥y licenseCategory tá»« token/profile, resolve cache key `[licenseCategory,page,size]`, náº¿u cache hit tráº£ paginated result; náº¿u miss query DB vá»›i filter license + pagination, populate cache, tráº£ list/detail. BR chÃ­nh: authentication, license-based filtering, cache-aside query, search/pagination, detail response.

**Vá»‹ trÃ­ code.**

- Use case: `apps/course-service/src/application/use-cases/list-courses/list-courses.use-case.ts`
- Cache port: `apps/course-service/src/application/ports/course-cache.port.ts`
- Redis implementation: `apps/course-service/src/infrastructure/cache/redis-course-cache.service.ts`

Code máº«u:

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
- **ASR-AV-06:** partial degradation. Redis down khÃ´ng lÃ m request cháº¿t; `safeExec(..., null)` biáº¿n thÃ nh cache miss vÃ  DB fallback.
- **ASR-AV-01/03:** course-service cÃ³ `/health/ready` vÃ  `/metrics` Ä‘á»ƒ phÃ¡t hiá»‡n Redis/DB degradation.

**Design pattern.**

- **Strategy:** `CourseCachePort` lÃ  abstraction; Redis lÃ  concrete strategy, cÃ³ thá»ƒ thay báº±ng in-memory/no-cache mÃ  use case khÃ´ng Ä‘á»•i.
- **Cache-Aside:** app tá»± check cache, miss thÃ¬ query DB, set cache.
- **Guard Clause/Repository:** query luÃ´n cÃ³ pagination, trÃ¡nh unbounded read.

**Mapping sang ADD.**

- ADD Â§2.2.2.2 ASR-PERF-05: course cache TTL 5-10 min.
- ADD Â§2.7.4 ASR-AV-06: cache-backed read model/partial degradation.
- ADD Â§3.1 Logical View vÃ  Â§3.2 Implementation View: `course-service` lÃ  service riÃªng, cÃ³ repository/cache adapter.

**Mapping sang SAD.**

- SAD Â§5.2.5 mÃ´ táº£ Course Detail Read with Cache.
- SAD Â§7.1.1 mÃ´ táº£ course detail cache performance.
- **Doc gap:** SAD hiá»‡n ghi in-memory CacheManager/no Redis, trong khi code vÃ  ASR hiá»‡n dÃ¹ng Redis. Khi present nÃªn nÃ³i: â€œSAD báº£n hiá»‡n táº¡i cáº§n cáº­p nháº­t theo quyáº¿t Ä‘á»‹nh má»›i: Redis tá»‘t hÆ¡n in-memory vÃ¬ cross-instance consistency, pattern invalidation, restart-safe.â€

---

## 6. UC11 - Take Theory Exam / Start Exam

**SRS flow vÃ  business rule.** Student click start exam, há»‡ thá»‘ng validate JWT, check permission, validate `templateId/licenseTierId`, load student profile + exam template + config, generate randomized question set, create attempt record, init server timer, persist attempt, serialize questions khÃ´ng cÃ³ Ä‘Ã¡p Ã¡n, tráº£ HTTP 201. BR chÃ­nh: auth/permission, payload validation, resource existence, question generation, attempt persistence, answer confidentiality.

**Vá»‹ trÃ­ code.**

- Use case: `apps/exam-service/src/application/use-cases/start-session/start-session.use-case.ts`
- Aggregate: `apps/exam-service/src/domain/aggregates/exam-session/exam-session.aggregate.ts`
- Adapter: `apps/exam-service/src/infrastructure/http/http-question-pool.client.ts`
- Mapper/result DTO: `apps/exam-service/src/application/use-cases/shared/exam-session.result.ts`

Code máº«u:

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

- **ASR-PERF-12:** question selection pháº£i dÃ¹ng indexed queries, khÃ´ng full-table scan; call sang question-service qua adapter.
- **ASR-DI-08:** exam config snapshot (`templateNameSnapshot`, `version`, `topicDistributionSnapshot`, `durationMinutesSnapshot`) Ä‘Ã³ng bÄƒng cáº¥u hÃ¬nh lÃºc generate.
- **ASR-DI-09:** exact question count per topic; thiáº¿u pool thÃ¬ throw `InsufficientQuestionPoolException`.
- **ASR-REL-02:** server authoritative timer; `startedAt/expiresAt` do server set.
- **ASR-AV-04:** `HttpQuestionPoolClient` dÃ¹ng `resilientFetch` vá»›i timeout khi gá»i question-service. Náº¿u question-service fail, exam-service fail nhanh cÃ³ kiá»ƒm soÃ¡t.

**Design pattern.**

- **Factory Method:** `ExamSession.create()` táº¡o session há»£p lá»‡, set timer vÃ  initial state.
- **Adapter:** `HttpQuestionPoolClient extends QuestionPoolClient`, chuyá»ƒn HTTP envelope thÃ nh domain pool items.
- **Snapshot/Immutability Pattern:** session lÆ°u config snapshot, lá»‹ch sá»­ thi khÃ´ng bá»‹ thay Ä‘á»•i khi admin chá»‰nh template sau nÃ y.
- **Circuit Breaker:** shared `resilientFetch` báº£o vá»‡ call `exam-service -> question-service`.

**Mapping sang ADD.**

- ADD Â§2.2.4.2 ASR-PERF-12: exam generation latency.
- ADD Â§2.4.1.7 ASR-DI-09 vÃ  Â§2.4.2.2 ASR-DI-08: structural correctness + config snapshot.
- ADD Â§2.7.2 ASR-AV-04: service-level timeout/retry/circuit breaker.
- ADD Â§3.5/Process View: start exam lÃ  flow Ä‘á»“ng bá»™, nhÆ°ng dependency Ä‘Æ°á»£c resilient.

**Mapping sang SAD.**

- SAD Â§5.2.2 Start & Submit Exam: start exam load active config, snapshot vÃ o `ExamSession`, gá»i question-service, tráº£ question text + options only.
- SAD Â§3.2.5 exam-service: exam templates, sessions, atomic scoring, config snapshots.
- SAD Â§6.3.3 Exam Content Integrity: correct answer khÃ´ng Ä‘Æ°á»£c gá»­i ra client.

---

## 7. UC12 - Manage Exam Session / Auto-Save Answer

**SRS flow vÃ  business rule.** Student tráº£ lá»i/bookmark/autosave; há»‡ thá»‘ng validate JWT, check permission, validate attemptId/questionId/eventType/status, load attempt/question/timer metadata, upsert answer/bookmark, update remaining time, persist session state, tráº£ HTTP 200. BR chÃ­nh: auth, request validation, context existence, idempotent save, timer state.

**Vá»‹ trÃ­ code.**

- Use case: `apps/exam-service/src/application/use-cases/save-answer/save-answer.use-case.ts`
- Aggregate method: `ExamSession.saveAnswer(...)`
- Repository upsert: `apps/exam-service/src/infrastructure/persistence/prisma/prisma-exam-session.repository.ts`

Code máº«u:

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

- **ASR-REL-03:** save operation idempotent; gá»­i láº¡i cÃ¹ng answer khÃ´ng táº¡o duplicate vÃ¬ repository dÃ¹ng `upsert`.
- **ASR-REL-02:** auto-save váº«n check expiry server-side; expired thÃ¬ finalize trÆ°á»›c.
- **ASR-UX-05:** pháº§n offline buffering lÃ  client-side; backend há»— trá»£ báº±ng idempotent sync.
- **ASR-AV-06:** session state á»Ÿ DB, khÃ´ng phá»¥ thuá»™c instance memory; request cÃ³ thá»ƒ route tá»›i replica service khÃ¡c.

**Design pattern.**

- **Aggregate Root:** invariant `IN_PROGRESS`, `not expired`, owner check náº±m trong domain.
- **Idempotent Write:** `upsert` Ä‘áº£m báº£o retry/duplicate submit cÃ¹ng state khÃ´ng táº¡o row má»›i.
- **Repository:** transaction persistence náº±m trong infrastructure.

**Mapping sang ADD.**

- ADD Â§2.3.2.2 ASR-REL-03: idempotent auto-save + offline sync.
- ADD Â§2.3.1.1 ASR-REL-02: server authoritative timer.
- ADD Â§3.4 Data View: in-progress session state persisted to `exam_db`, khÃ´ng giá»¯ trong memory.

**Mapping sang SAD.**

- SAD Â§5.2.2 step auto-save: PATCH answers every 5-10s, idempotent, offline buffer sync on reconnect.
- SAD Â§4.3 Design Principles: idempotent write, stateless services.
- SAD Â§3.3.2 Availability Boundaries: exam-service khÃ´ng phá»¥ thuá»™c analytics/notification Ä‘á»ƒ autosave.

---

## 8. UC13/UC14 - Submit & Grade Exam

**SRS flow vÃ  business rule.** UC13 student confirm submit; há»‡ thá»‘ng validate JWT/permission, validate attempt status/anti-double-submit, load active attempt and answer snapshot, lock answers/finalize attempt, trigger grading, tráº£ confirmation/result. UC14 grading workflow load answers + answer key + fatal questions, compute score/pass threshold, apply fatal question override, persist final grade, tráº£ HTTP 200.

**Vá»‹ trÃ­ code.**

- Use case: `apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.ts`
- Domain grading: `apps/exam-service/src/domain/aggregates/exam-session/exam-session.aggregate.ts`
- Repository transaction: `apps/exam-service/src/infrastructure/persistence/prisma/prisma-exam-session.repository.ts`
- Event publisher: `apps/exam-service/src/infrastructure/messaging/rabbitmq-event-publisher.service.ts`

Code máº«u:

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

- **ASR-DI-01:** client chá»‰ gá»­i selected answer; scoring server-side.
- **ASR-DI-02:** fatal/critical question Ä‘Æ°á»£c xá»­ lÃ½ trong domain, khÃ´ng expose cho client trong lÃºc lÃ m bÃ i.
- **ASR-REL-04:** submit, grade, result write cáº§n atomic. Code hiá»‡n lÆ°u `examSession` vÃ  `examSessionQuestion` trong má»™t Prisma transaction trong repository, nÃªn pháº§n DB persistence cá»§a result lÃ  atomic.
- **ASR-DI-07 vÃ  ASR-AV-05:** tÃ i liá»‡u ASR/ADD/SAD yÃªu cáº§u `ExamCompleted` Ä‘Æ°á»£c ghi outbox cÃ¹ng transaction. **Code hiá»‡n táº¡i chÆ°a lÃ m Ä‘Ãºng Ä‘iá»ƒm nÃ y cho business event exam completion**: `sessionRepository.save(session)` commit xong, rá»“i `eventPublisher.publishAll(events)` publish RabbitMQ sau Ä‘Ã³. Náº¿u broker lá»—i á»Ÿ Ä‘Ãºng thá»i Ä‘iá»ƒm nÃ y, DB result Ä‘Ã£ commit nhÆ°ng event analytics cÃ³ thá»ƒ khÃ´ng Ä‘Æ°á»£c outbox retry. ÄÃ¢y lÃ  gap implementation so vá»›i ASR-DI-07/AV-05. Audit outbox cÃ³ tá»“n táº¡i trong exam-service nhÆ°ng khÃ´ng Ã¡p dá»¥ng cho `ExamSessionCompletedEvent`.

**Design pattern.**

- **Aggregate Root + Domain Event/Observer:** grading náº±m trong `ExamSession.grade()`, sau Ä‘Ã³ add `ExamSessionCompleted/Passed/FailedEvent`.
- **Rule Engine Ä‘Æ¡n giáº£n:** pass/fail dá»±a trÃªn score + critical mistakes.
- **Transactional Repository:** Prisma `$transaction` bá»c save session/questions.
- **Transactional Outbox intended pattern:** tÃ i liá»‡u yÃªu cáº§u, nhÆ°ng code business event cáº§n bá»• sung Ä‘á»ƒ Ä‘áº¡t Ä‘á»§.

**Mapping sang ADD.**

- ADD Â§2.3.3.1 ASR-REL-04: reliable atomic submit.
- ADD Â§2.4.2.1 ASR-DI-01: immutable result.
- ADD Â§2.4.1.6 ASR-DI-07 vÃ  Â§2.7.3 ASR-AV-05: transactional outbox cho ExamCompleted.
- Khi present, náº¿u khÃ´ng muá»‘n bá»‹ báº¯t lá»—i, nÃ³i rÃµ: â€œDesign decision trong ADD lÃ  outbox; code hiá»‡n Ä‘Ã£ atomic DB result, nhÆ°ng business event outbox cáº§n hoÃ n thiá»‡n Ä‘á»ƒ full compliance.â€

**Mapping sang SAD.**

- SAD Â§5.2.2 mÃ´ táº£ Start & Submit Exam: single PostgreSQL transaction vÃ  outbox publisher.
- SAD Â§6.3.3 Exam Content Integrity: correct answers khÃ´ng leak.
- SAD Â§7.1.3 note on exam grading: synchronous grading trong transaction Ä‘á»ƒ tráº£ result ngay.

---

## 9. UC26/UC34 - View Learning Progress Dashboard

**SRS flow vÃ  business rule.** Student má»Ÿ My Progress; há»‡ thá»‘ng validate JWT, check Student role, extract studentId tá»« claims, cache-first query progress, náº¿u miss query DB/projection, cache metrics, project payload gá»“m completion%, pass-rate, weak topics, enforce strict scope studentId match, tráº£ HTTP 200.

**Vá»‹ trÃ­ code.**

- Consumer event: `apps/analytics-service/src/presentation/messaging/messaging.controller.ts`
- Projection update: `apps/analytics-service/src/application/use-cases/record-events/record-events.use-case.ts`
- Read use case: `apps/analytics-service/src/application/use-cases/get-progress/get-progress.use-case.ts`
- Repository: `apps/analytics-service/src/infrastructure/persistence/prisma/prisma-learning-progress.repository.ts`

Code máº«u:

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

- **ASR-PERF-04:** dashboard láº¥y tá»« pre-computed/projection table, khÃ´ng real-time aggregate raw log.
- **ASR-PERF-07:** chart data tá»« aggregated data, response má»¥c tiÃªu < 200ms.
- **ASR-AV-06:** projected read model giáº£m Ã¡p lá»±c lÃªn exam_db; náº¿u analytics lag, exam flow váº«n cháº¡y, dashboard eventual consistent.
- **ASR-AV-05/DI-07:** lÃ½ tÆ°á»Ÿng lÃ  exam-service outbox -> RabbitMQ -> analytics idempotent. Code analytics consumer cÃ³ handler vÃ  cache invalidation, nhÆ°ng full guarantee phá»¥ thuá»™c viá»‡c exam-service bá»• sung outbox nhÆ° gap á»Ÿ UC13/14.

**Design pattern.**

- **CQRS:** write model á»Ÿ `exam-service/course-service`, read projection á»Ÿ `analytics-service`.
- **Pub-Sub:** analytics consume events nhÆ° `exam.session.completed`, `course.enrollment.progress-reset`.
- **Cache-Aside / Projection Cache:** `GetProgressUseCase` Ä‘á»c cache trÆ°á»›c, miss thÃ¬ query projection.

**Mapping sang ADD.**

- ADD Â§2.2.2.1 ASR-PERF-04: progress statistics from pre-aggregated table.
- ADD Â§2.2.2.3 ASR-PERF-07: chart from aggregated data.
- ADD Â§2.7.4 ASR-AV-06: cache-backed/projected read models.
- ADD Â§3.1 Logical View: analytics-service chá»‹u trÃ¡ch nhiá»‡m progress stats/SRS.

**Mapping sang SAD.**

- SAD Â§5.2.3 Progress Dashboard Load: Client -> Kong -> analytics-service -> indexed lookup on progress_stat -> return metrics.
- SAD Â§3.2.9 analytics-service: progress queries hit pre-aggregated table, no raw log aggregation.
- SAD Â§7.1.2: progress dashboard P95 < 200ms báº±ng indexed lookup.

---

## 10. UC35/UC36 - 2D Driving Practice & Realtime Error Feedback

**SRS/mapping flow vÃ  business rule.** Student báº¯t Ä‘áº§u practice 2D, há»‡ thá»‘ng validate JWT/student role/license tier/capability, táº¡o session. Trong session, client gá»­i telemetry nhÆ° speed, lane offset, collision. Server kiá»ƒm tra tráº¡ng thÃ¡i session, owner, ingest telemetry, detect lá»—i, tráº£ feedback `{errorCode, severity, penalty, message, hint}` Ä‘á»ƒ client render cáº£nh bÃ¡o. BR chÃ­nh: authorization, capability validation, server-side feedback, fatal/warning mapping, session end summary.

**Vá»‹ trÃ­ code.**

- Use cases: `apps/simulation-service/src/application/use-cases/practice2d/practice2d.use-cases.ts`
- Aggregate/FSM: `apps/simulation-service/src/domain/aggregates/practice2d/practice2d-session.aggregate.ts`

Code máº«u:

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

- **ASR-UX-02:** server xÃ¡c Ä‘á»‹nh lá»—i vÃ  tráº£ action response; client chá»‰ render alert, khÃ´ng tá»± tÃ­nh luáº­t. Target hiá»ƒn thá»‹ <= 300ms sau khi nháº­n response.
- **ASR-MOD-03:** map/scenario config Ä‘á»c runtime; thÃªm map má»›i báº±ng config, khÃ´ng release app má»›i.
- **ASR-AV-06:** simulation session persist vÃ o DB; service stateless scale Ä‘Æ°á»£c. Static error definitions/scenario cÃ³ thá»ƒ cache; lá»—i analytics/notification khÃ´ng áº£nh hÆ°á»Ÿng practice.
- **ASR-AV-01/03:** simulation-service cÃ³ health/metrics, giÃºp detect realtime service degradation.

**Design pattern.**

- **Finite State Machine (FSM):** session chá»‰ nháº­n telemetry khi `IN_PROGRESS`; `end()` chuyá»ƒn sang `COMPLETED/ABANDONED`.
- **Factory Method:** `Practice2dSession.create()` validate capability trÆ°á»›c khi táº¡o session.
- **Observer/Domain Event:** khi end session khÃ´ng abandoned, aggregate add `Practice2dSessionCompletedEvent`.

**Mapping sang ADD.**

- ADD Â§2.5.2.1 ASR-MOD-03: runtime map configurability.
- ADD Â§2.6.1.2 ASR-UX-02: instant road-map error alert.
- ADD Â§3.1 Logical View: simulation-service quáº£n lÃ½ driving scenarios/server FSM.

**Mapping sang SAD.**

- SAD Â§3.2.8 simulation-service: map types loaded from JSON configs, realtime via WebSocket/Socket.IO, server computes feedback.
- SAD Â§5.1.8: simulation-service inputs/outputs/storage.
- SAD Â§6.3.4 API & Service Protection: WSS/TLS, JWT/RBAC á»Ÿ WebSocket handshake.

---

## 11. CÃ¡c CÃ¢u Tráº£ Lá»i Nhanh Khi Tháº§y Há»i Availability

1. **Náº¿u má»™t service cháº¿t thÃ¬ sao?**`/health/live` vÃ  `/health/ready` cho Docker/Kubernetes biáº¿t service process/dependency status. Docker Compose dÃ¹ng healthcheck/restart, Kubernetes dÃ¹ng liveness/readiness probe Ä‘á»ƒ remove pod khá»i traffic vÃ  restart.
2. **Náº¿u question-service cháº­m lÃºc start exam thÃ¬ sao?**`exam-service` gá»i `question-service` qua `HttpQuestionPoolClient`, bÃªn trong dÃ¹ng `resilientFetch`: timeout, retry transient lá»—i, circuit breaker open Ä‘á»ƒ fail-fast. KhÃ´ng giá»¯ thread treo vÃ´ háº¡n.
3. **Náº¿u Redis cache course cháº¿t thÃ¬ sao?**`RedisCourseCacheService.safeExec()` catch lá»—i vÃ  fallback `null`, use case query DB nhÆ° cache miss. Há»‡ thá»‘ng degrade vá» latency DB nhÆ°ng khÃ´ng crash.
4. **Náº¿u analytics-service backlog thÃ¬ cÃ³ áº£nh hÆ°á»Ÿng submit exam khÃ´ng?**Theo kiáº¿n trÃºc, khÃ´ng. Exam result commit trong `exam_db`; analytics lÃ  consumer eventual consistency. Tuy nhiÃªn code cáº§n outbox cho `ExamCompleted` Ä‘á»ƒ Ä‘áº£m báº£o event khÃ´ng máº¥t khi RabbitMQ lá»—i.
5. **Náº¿u notification-service lá»—i thÃ¬ há»c viÃªn cÃ³ ná»™p bÃ i Ä‘Æ°á»£c khÃ´ng?**CÃ³. Notification lÃ  async qua RabbitMQ/DLQ, khÃ´ng náº±m trÃªn critical path cá»§a exam submission.
6. **Há»‡ thá»‘ng cÃ³ quan sÃ¡t lá»—i production khÃ´ng?**
   CÃ³ `/metrics` Prometheus, correlation-id, access log/ELK, smoke script kiá»ƒm tra `/health/live` vÃ  `/health/ready` qua Kong.

---

## 12. Äiá»ƒm Cáº§n Nhá»› Khi TrÃ¬nh BÃ y Gap

- **Gap 1 - SAD course cache stale:** SAD nÃ³i in-memory cache, nhÆ°ng code/ASR dÃ¹ng Redis TTL 600s. CÃ¢u tráº£ lá»i: Redis lÃ  quyáº¿t Ä‘á»‹nh má»›i tá»‘t hÆ¡n cho multi-replica; SAD cáº§n update Ä‘á»ƒ Ä‘á»“ng bá»™.
- **Gap 2 - ExamCompleted transactional outbox:** ASR/SAD yÃªu cáº§u ExamCompleted event ghi outbox cÃ¹ng transaction vá»›i completed session. Code hiá»‡n publish RabbitMQ sau transaction. CÃ¢u tráº£ lá»i: pháº§n grading/result DB Ä‘Ã£ atomic; Ä‘á»ƒ full compliance vá»›i ASR-DI-07/AV-05 cáº§n Ä‘Æ°a domain event vÃ o outbox trong `PrismaExamSessionRepository.save()` rá»“i relay background.
- **Gap 3 - Forgot password SRS 404 vs implementation generic response:** code cá»‘ tÃ¬nh khÃ´ng tráº£ 404 Ä‘á»ƒ chá»‘ng user enumeration. ÄÃ¢y lÃ  security improvement so vá»›i flow cÅ©, váº«n phÃ¹ há»£p ASR-SEC-02.


