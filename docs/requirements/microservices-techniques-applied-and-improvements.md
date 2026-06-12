# Kỹ thuật microservices đã triển khai và hướng mở rộng

> Tài liệu này được viết dựa trên `docs/requirements/microservices_techniques_implementation.md` và đối chiếu với trạng thái hiện tại của repo `luyen-thi-lai-xe-microservices`.
>
> Mục tiêu: ghi rõ kỹ thuật nào đã có trong hệ thống, kỹ thuật nào mới có baseline/một phần, và kỹ thuật nào có thể triển khai thêm để làm phần mềm mạnh hơn. Tài liệu này cố ý liệt kê chi tiết, kể cả các hướng nâng cấp khá "production-grade".

---

## 0. Phạm vi và quy ước trạng thái

### Phạm vi quan sát

- Monorepo backend microservices dùng `pnpm workspace`, `Turbo`, `NestJS`, `Prisma`.
- Production scope hiện có 10 service:
  - `identity-service`
  - `user-service`
  - `exam-service`
  - `course-service`
  - `question-service`
  - `notification-service`
  - `analytics-service`
  - `simulation-service`
  - `media-service`
  - `audit-service`
- `docs-service` là service phục vụ tài liệu API/Scalar trong môi trường dev hoặc nội bộ, không phải service nghiệp vụ production chính.
- Hạ tầng đi kèm: PostgreSQL per service, RabbitMQ, Redis, Consul, Keycloak, Kong, ELK, Prometheus, Grafana, Alertmanager, Jaeger, Docker Compose, Helm/Kubernetes, Terraform baseline, GitHub Actions, Jenkins, k6.

### Quy ước trạng thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| Đã triển khai | Có code/config/script/docs cụ thể trong repo và có thể dùng làm minh chứng. |
| Đã triển khai một phần | Đã có nền tảng hoặc áp dụng ở một số service/flow, nhưng chưa đồng bộ toàn hệ thống hoặc chưa production-hardening. |
| Có thể triển khai thêm | Chưa có hoặc chưa rõ baseline; nên làm nếu muốn hệ thống tốt hơn, đầy đủ hơn hoặc giống production hơn. |

### Các đường dẫn minh chứng chính

| Nhóm | Đường dẫn |
| --- | --- |
| Tổng quan hệ thống | `README.md` |
| Hướng dẫn phát triển | `docs/development-guidelines.md` |
| DDD/Clean Architecture | `docs/architecture/clean-ddd-conventions.md` |
| API contracts | `docs/api/*.md`, `apps/*/src/presentation/http/*controller.ts` |
| Docker Compose | `docker-compose.yaml`, `docker-compose.infra.yml`, `docker-compose.deploy.yml` |
| Kubernetes/Helm | `charts/luyen-thi-lai-xe/*` |
| Kong Gateway | `kong/kong.yaml`, `kong/kong.dev.yaml` |
| Consul config | `consul-seed-*.json`, `scripts/consul-*.ts`, `docker/consul/init.sh` |
| Observability | `packages/common/src/metrics`, `packages/common/src/tracing`, `docker/prometheus`, `docker/grafana`, `docker/logstash` |
| Resilience | `packages/common/src/http/resilient-http-client.ts`, `packages/common/src/messaging/rabbitmq-resilience.ts` |
| Testing | `apps/*/src/**/*.spec.ts`, `apps/*/test`, `tests`, `scripts/smoke.ts`, `load-tests` |
| CI/CD | `.github/workflows/*.yml`, `Jenkinsfile` |
| Terraform | `terraform/*` |

---

# 1. Tổng quan kỹ thuật đã triển khai

## 1.1. Kiến trúc Microservices

**Trạng thái: Đã triển khai**

Hệ thống đã được tách thành nhiều service theo nhóm nghiệp vụ rõ ràng thay vì gom tất cả vào một backend monolith.

| Service | Trách nhiệm chính |
| --- | --- |
| `identity-service` | Đăng nhập, đăng xuất, refresh token, quên mật khẩu, quản lý identity/Keycloak. |
| `user-service` | Hồ sơ người dùng, học viên, hạng giấy phép, đồng bộ identity. |
| `exam-service` | Đề thi, phiên thi, câu sai, kết quả thi. |
| `course-service` | Khóa học, bài học, ghi danh, tiến độ học. |
| `question-service` | Ngân hàng câu hỏi, chủ đề, lựa chọn đáp án, phiên bản câu hỏi. |
| `notification-service` | Notification in-app, email, push, cảnh báo học tập. |
| `analytics-service` | Read model tiến độ, dashboard học tập, thống kê nghiệp vụ. |
| `simulation-service` | Mô phỏng/practice 2D, phiên mô phỏng, lỗi thao tác. |
| `media-service` | Metadata file, upload/presigned URL, trạng thái file, storage adapter. |
| `audit-service` | Audit log bảo mật và hoạt động quan trọng. |

Các biểu hiện microservices đã có:

- Mỗi service có thư mục riêng trong `apps/<service>`.
- Mỗi service có `Dockerfile` riêng.
- Mỗi service có Prisma schema/migration riêng nếu có dữ liệu riêng.
- Kong làm API Gateway, frontend gọi một entrypoint thay vì gọi trực tiếp từng service.
- RabbitMQ dùng cho giao tiếp bất đồng bộ giữa service.
- Docker Compose và Helm chart triển khai nhiều service độc lập.
- Có script migration/seed độc lập theo service.
- Có health/ready/metrics endpoint đồng bộ qua common module.

**Có thể triển khai thêm**

- Thêm sơ đồ Context Map chính thức trong `docs/architecture`, mô tả quan hệ upstream/downstream, conformist, customer-supplier giữa các bounded context.
- Thêm bảng "service ownership" ghi rõ owner, SLA/SLO, database sở hữu, event publish/consume, dependency runtime.
- Thêm kiểm tra kiến trúc tự động, ví dụ `dependency-cruiser` hoặc custom script để cấm service import code nội bộ của service khác.
- Thêm ADR cho quyết định tách service, chọn RabbitMQ thay vì Kafka, chọn Kong/Consul/Keycloak.

---

## 1.2. Domain-Driven Design và Clean Architecture

**Trạng thái: Đã triển khai**

Repo có convention DDD/Clean Architecture riêng và nhiều service đã follow cấu trúc:

```text
domain/
application/
infrastructure/
presentation/
```

Các pattern đang có:

- Aggregate root: `IdentityUser`, `UserProfile`, `Course`, `CourseEnrollment`, `ExamTemplate`, `ExamSession`, `Question`, `QuestionTopic`, `Notification`, `AcademicWarning`, `FileObject`, `Practice2dSession`, `LearningProgress`.
- Child entity: `StudentDetail`, `Lesson`, `CourseRequirement`, `CourseMaterial`, `CourseInstructor`, `ExamSessionQuestion`, `QuestionOption`, `Practice2dFeedback`.
- Value Object: `Email`, `PhoneNumber`, `MimeType`, `FileSize`.
- Domain Event: `identity.user.created`, `identity.user.role-changed`, `exam.session.completed`, `course.enrollment.completed`, `course.material.linked`, `question.image.linked`, `media.file.deleted`, `user.avatar.linked`, ...
- Domain Exception: nhiều exception nghiệp vụ riêng trong `apps/*/src/domain/exceptions`.
- Repository port: interface/abstract class trong domain hoặc application.
- Infrastructure adapter: Prisma repository, RabbitMQ publisher, HTTP client, cache adapter.
- Use case/application service: mỗi nghiệp vụ chính có `*.use-case.ts`, input là `command/query`, output là result DTO.

**Đã triển khai một phần**

- Không phải service nào cũng có cùng mức độ DDD sâu. Một số service có domain model giàu hơn như `course-service`, `exam-service`, `question-service`, `identity-service`, `notification-service`; một số service thiên về CRUD/read model hơn như `analytics-service`, `audit-service`.
- Domain event đã có, nhưng chưa phải tất cả event đều đi qua outbox bền vững.

**Có thể triển khai thêm**

- Chuẩn hóa "rich domain model" cho mọi aggregate quan trọng, tránh business rule nằm trong controller/repository.
- Thêm domain service cho rule liên service hoặc rule không thuộc một aggregate duy nhất.
- Thêm optimistic locking/version field cho aggregate dễ bị update đồng thời như `ExamSession`, `CourseEnrollment`, `Question`.
- Thêm invariant checklist cho từng aggregate trong tài liệu.
- Thêm automated architecture test:
  - `domain` không import `@nestjs/*`, Prisma, Redis, RabbitMQ.
  - `presentation` không gọi trực tiếp Prisma repository.
  - `application` chỉ phụ thuộc port/abstract repository.

---

## 1.3. SRP, High Cohesion, Low Coupling và Independent Deployment

**Trạng thái: Đã triển khai**

Các service có ranh giới nghiệp vụ tương đối rõ:

- Auth/identity tách khỏi user profile.
- Course tách khỏi exam/question.
- Notification tách khỏi producer nghiệp vụ.
- Analytics tách thành read model riêng.
- Audit tách riêng để ghi log bảo mật.
- Media tách khỏi course/question/user, các service chỉ publish event linked/deleted.

Các biểu hiện giảm coupling:

- Không dùng foreign key chéo service; chỉ lưu UUID reference.
- Service giao tiếp qua REST/RabbitMQ thay vì join trực tiếp database service khác.
- Shared code nằm trong `packages/common`, chủ yếu là cross-cutting concerns: DDD base, config, logging, metrics, tracing, health, HTTP resilience, Redis, RabbitMQ resilience.
- Docker/Helm cho phép build/deploy từng service.

**Có thể triển khai thêm**

- Tách pipeline build/test/deploy theo changed service sâu hơn nữa để giảm thời gian CI.
- Thêm compatibility matrix giữa service và event/API version.
- Thêm policy không cho service đọc trực tiếp DB schema của service khác ở mức network/user DB.
- Tạo package "contracts" chỉ chứa DTO/event schema public, tránh reuse trực tiếp domain model.

---

# 2. Giao tiếp giữa các dịch vụ

## 2.1. REST/HTTP đồng bộ

**Trạng thái: Đã triển khai**

REST/HTTP đang được dùng cho:

- Client/frontend gọi qua Kong.
- Một số service gọi nhau qua HTTP client, ví dụ `exam-service` gọi user profile/question pool.
- Keycloak admin/token endpoints.
- Health, readiness, metrics, docs endpoint.

Các kỹ thuật đã có:

- Controller NestJS theo resource.
- DTO request/response và `class-validator`.
- `ValidationPipe({ transform: true, whitelist: true })` ở các service.
- Swagger/OpenAPI annotation qua `@nestjs/swagger`.
- Resilient HTTP client trong `packages/common/src/http/resilient-http-client.ts`:
  - timeout mặc định.
  - retry có backoff.
  - circuit breaker theo dependency.
  - inject trace context outbound.
- Smoke script gọi health qua gateway.

**Đã triển khai một phần**

- API versioning chưa được chuẩn hóa toàn hệ thống.
- Error response đã có domain exception filter ở nhiều service, nhưng nên kiểm tra chuẩn response đồng nhất toàn bộ.
- Idempotency key cho HTTP write command chưa thấy chuẩn chung.

**Có thể triển khai thêm**

- Chuẩn hóa prefix version: `/api/v1/...` hoặc header versioning.
- Thêm OpenAPI diff trong CI để phát hiện breaking change.
- Thêm idempotency key cho endpoint tạo tài nguyên hoặc submit nhạy cảm:
  - `POST /exam-sessions/{id}/submit`
  - `POST /enrollments`
  - `POST /media/uploads`
  - `POST /auth/register`
- Thêm client SDK sinh từ OpenAPI cho frontend.
- Thêm standardized error envelope:

```json
{
  "success": false,
  "error": {
    "code": "EXAM_SESSION_NOT_FOUND",
    "message": "Exam session not found",
    "details": {},
    "correlationId": "req-..."
  }
}
```

- Thêm retry policy riêng cho HTTP status:
  - retry `408`, `429`, `5xx`.
  - không retry `400`, `401`, `403`, `404`, `409`.
- Thêm deadline propagation để request chain không vượt quá tổng thời gian cho phép.

---

## 2.2. RabbitMQ và messaging bất đồng bộ

**Trạng thái: Đã triển khai**

RabbitMQ được dùng cho event-driven communication. Các producer/consumer tiêu biểu:

| Event | Producer | Consumer |
| --- | --- | --- |
| `identity.user.created` | `identity-service` | `user-service`, `notification-service` |
| `identity.user.updated` | `identity-service` | `user-service` |
| `identity.user.role-changed` | `identity-service` | `user-service` |
| `identity.user.locked` | `identity-service` | `user-service` |
| `identity.user.deleted` | `identity-service` | `user-service` |
| `user.student.license-assigned` | `user-service` | `course-service` |
| `exam.session.completed` | `exam-service` | `analytics-service`, `notification-service` |
| `course.enrollment.created` | `course-service` | `analytics-service`, `notification-service` |
| `course.lesson.completed` | `course-service` | `analytics-service` |
| `course.enrollment.progress-reset` | `course-service` | `analytics-service` |
| `user.avatar.linked` | `user-service` | `media-service` |
| `course.material.linked` | `course-service` | `media-service` |
| `question.image.linked` | `question-service` | `media-service` |
| `media.file.deleted` | `media-service` | `user-service` |
| `security.audit.recorded` | nhiều service/outbox | `audit-service` |
| `notification.academic-warning.queued` | `notification-service` | `notification-service` |

RabbitMQ resilience đã có trong common package:

- Durable queue.
- `noAck: false`.
- `prefetchCount`.
- Retry queues theo TTL.
- DLQ.
- Header `x-retry-count`, `x-last-error`, `x-failed-at`.
- Correlation ID propagation.
- Metrics success/retry/DLQ.
- Idempotency memory TTL dựa trên `messageId`, `eventId`, `id` hoặc `metadata.eventId`.
- Smoke script `scripts/rabbitmq-resilience-smoke.ts`.

**Đã triển khai một phần**

- Idempotency hiện là memory TTL, chưa bền qua restart hoặc scale nhiều replica.
- Event schema/version chưa có registry chính thức.
- DLQ replay tool chưa thấy có UI/script vận hành hoàn chỉnh.
- Chưa có Inbox Pattern ở consumer để lưu event đã xử lý bền vững.

**Có thể triển khai thêm**

- Chuẩn hóa event envelope toàn hệ thống:

```json
{
  "eventId": "uuid",
  "eventName": "exam.session.completed",
  "eventVersion": 1,
  "occurredAt": "2026-06-12T10:00:00.000Z",
  "producer": "exam-service",
  "correlationId": "req-...",
  "causationId": "cmd-...",
  "aggregate": {
    "type": "ExamSession",
    "id": "..."
  },
  "payload": {}
}
```

- Lưu idempotency vào DB/Redis để chống duplicate sau restart.
- Thêm Inbox Pattern:
  - bảng `inbox_messages`.
  - unique `event_id`.
  - trạng thái `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`.
- Thêm DLQ replay CLI:
  - list DLQ.
  - inspect message.
  - requeue có kiểm soát.
  - discard kèm reason.
- Thêm event schema registry:
  - JSON Schema hoặc AsyncAPI.
  - validate schema ở producer/consumer.
  - CI check breaking change.
- Thêm dashboard RabbitMQ:
  - queue depth.
  - retry queue depth.
  - DLQ count.
  - consumer lag.
  - event processing latency.
- Nếu throughput/event replay lớn hơn, cân nhắc Kafka cho event streaming/read model, vẫn giữ RabbitMQ cho command/task queue.

---

## 2.3. Event-Driven Architecture

**Trạng thái: Đã triển khai**

Hệ thống đã áp dụng EDA ở nhiều luồng:

- Tạo user identity -> đồng bộ user profile -> gửi welcome/password reset.
- Gán hạng giấy phép -> đồng bộ license read model trong course.
- Hoàn tất bài thi -> cập nhật analytics -> gửi notification.
- Hoàn tất bài học/khóa học -> cập nhật analytics/notification.
- Link media vào user/course/question -> media service quản lý trạng thái file.
- Ghi audit event -> audit service lưu audit log tập trung.

**Đã triển khai một phần**

- Chưa có tài liệu event catalog tập trung kiểu AsyncAPI.
- Eventual consistency đã chấp nhận trong một số flow, nhưng chưa có UI/worker để người vận hành nhìn trạng thái event theo correlation ID.

**Có thể triển khai thêm**

- Tạo `docs/events/event-catalog.md` hoặc `docs/events/asyncapi.yaml`.
- Thêm event flow diagram cho các luồng chính:
  - Register user.
  - Change user role.
  - Assign license tier.
  - Start/submit exam.
  - Complete lesson/course.
  - Upload/link/delete media.
  - Academic warning.
- Thêm correlation dashboard từ request -> event -> consumer -> DB change.
- Thêm event replay cho analytics projection.
- Thêm backfill job để rebuild analytics read model từ event store nếu cần.

---

# 3. REST API và tài liệu API

## 3.1. RESTful API

**Trạng thái: Đã triển khai**

Các service có controller HTTP theo tài nguyên:

- `/auth`, `/admin`
- `/users`, `/admin/users`
- `/exams`, `/admin/exams`
- `/courses`, `/enrollments`, `/admin/courses`
- `/admin/questions`
- `/notifications`, `/admin/academic-warnings`
- `/analytics`
- `/simulation`
- `/media`, `/admin/media`
- `/admin/audit-logs`

Kong route các path này về đúng service.

Các kỹ thuật đã có:

- DTO request/response rõ ràng.
- Query DTO cho list/filter/pagination ở nhiều endpoint.
- Validation qua `class-validator` và `ValidationPipe`.
- Auth annotation qua `@ApiBearerAuth`.
- Role guard qua `@Roles`.
- Docs API từng service trong `docs/api`.

**Có thể triển khai thêm**

- Chuẩn hóa pagination response:

```json
{
  "items": [],
  "page": 1,
  "size": 20,
  "total": 100,
  "totalPages": 5
}
```

- Chuẩn hóa sort/filter:
  - `page`
  - `size`
  - `sort`
  - `q`
  - filter field cụ thể.
- Thêm OpenAPI lint bằng Spectral.
- Thêm negative API tests cho 400/401/403/404/409/422.

---

## 3.2. Swagger/OpenAPI và Scalar docs

**Trạng thái: Đã triển khai**

Repo có:

- Swagger docs từng service qua route `/<service>/docs` khi đi qua Kong.
- `docs-service` tổng hợp và render Scalar API Reference.
- `docs/api/api-spec-*.md` mô tả contract theo service.

**Có thể triển khai thêm**

- Tự động export OpenAPI JSON từ từng service trong CI và lưu artifact.
- Tạo portal docs tĩnh versioned:
  - `v1`
  - `staging`
  - `production`
- Thêm API changelog theo service.
- Thêm contract test từ OpenAPI bằng Schemathesis/Dredd hoặc custom Supertest.

---

## 3.3. API Versioning và HATEOAS

**Trạng thái: Có thể triển khai thêm**

API versioning chưa thấy được chuẩn hóa thành rule toàn hệ thống.

Khuyến nghị:

- Dùng URL versioning cho frontend dễ hiểu:

```text
/api/v1/auth/login
/api/v1/exams
/api/v1/courses
```

- Kong route `/api/v1/...` về service tương ứng.
- Giữ backward compatibility tối thiểu một version cũ.
- Với HATEOAS, không bắt buộc cho hệ thống này. Có thể áp dụng nhẹ ở các response cần điều hướng:
  - exam session result: link review, missed questions.
  - media object: link presigned download.
  - pagination: `next`, `prev`.

---

# 4. Quản lý dữ liệu trong microservices

## 4.1. Database per Service

**Trạng thái: Đã triển khai**

Mỗi service có Prisma schema riêng và PostgreSQL database/container riêng trong Docker Compose.

| Service | Prisma models tiêu biểu |
| --- | --- |
| `identity-service` | `IdentityUser` |
| `user-service` | `UserProfile`, `StudentDetail`, `LicenseAssignmentAudit`, `OutboxMessage` |
| `exam-service` | `ExamTemplate`, `ExamSession`, `ExamSessionQuestion`, `OutboxMessage` |
| `course-service` | `Course`, `Lesson`, `CourseEnrollment`, `StudentLicenseProfile`, `OutboxMessage` |
| `question-service` | `QuestionTopic`, `Question`, `QuestionVersion`, `QuestionOption` |
| `notification-service` | `Notification`, `AcademicWarning`, `DeviceToken` |
| `analytics-service` | `StudentLearningProfile`, `DailyActivity`, `QuestionAccuracyTracker` |
| `simulation-service` | `Maneuver`, `SimulationSession`, `Practice2dSession`, `Practice2dFeedbackEvent` |
| `media-service` | `FileObject` |
| `audit-service` | `AuditLog` |

Các kỹ thuật đã có:

- Prisma migration trong `apps/<service>/prisma/migrations`.
- Script migrate all: `scripts/prisma-migrate-all.ts`.
- Script seed all: `scripts/prisma-seed-all.ts`.
- Dockerfile migration runner riêng.
- Kubernetes migration Job trong Helm chart.
- Không tạo foreign key chéo service; dùng UUID reference/read model.

**Có thể triển khai thêm**

- Tạo data ownership matrix:

| Dữ liệu | Service sở hữu | Service được đọc trực tiếp | Service nhận bản sao/read model |
| --- | --- | --- | --- |
| Identity user | `identity-service` | `identity-service` | `user-service`, `notification-service` |
| User profile | `user-service` | `user-service` | `course-service`, `exam-service` qua API/event |
| Course enrollment | `course-service` | `course-service` | `analytics-service`, `notification-service` |

- Tách DB user/password riêng từng service trong tất cả môi trường.
- Áp dụng least privilege cho database account.
- Thêm PITR/offsite backup khi lên production thật.

---

## 4.2. Eventual Consistency

**Trạng thái: Đã triển khai**

Một số luồng đã chấp nhận dữ liệu nhất quán sau một khoảng trễ:

- Identity tạo user -> user profile xuất hiện sau khi `user-service` consume event.
- User gán license tier -> course read model `student_license_profiles` đồng bộ sau event.
- Course/exam activity -> analytics read model cập nhật qua event.
- Media link/delete -> service khác cập nhật trạng thái sau event.

**Có thể triển khai thêm**

- Ghi rõ eventual consistency trong API docs cho endpoint có thể trả `404` tạm thời.
- Frontend nên có retry/backoff ngắn cho các read-after-write bất đồng bộ.
- Thêm "pending sync" status nếu nghiệp vụ cần hiển thị.
- Thêm audit/correlation view để debug event chưa xử lý.

---

## 4.3. Saga Pattern

**Trạng thái: Đã triển khai một phần**

Hệ thống hiện có các flow dạng choreography qua event:

- Register user -> create profile -> welcome notification.
- Assign license -> sync course read model.
- Complete exam/course -> analytics/notification.

Tuy nhiên chưa thấy Saga Orchestrator hoặc Saga state table chính thức.

**Có thể triển khai thêm**

Áp dụng Saga cho các flow có nhiều bước và cần compensation:

### Saga: đăng ký tài khoản

```text
1. identity-service tạo user trong Keycloak.
2. identity-service lưu IdentityUser.
3. publish identity.user.created.
4. user-service tạo UserProfile.
5. notification-service gửi welcome email.
6. Nếu bước 4 fail lâu: đánh dấu identity cần repair hoặc khóa account tạm.
```

Nâng cấp:

- Tạo `registration_sagas` trong `identity-service`.
- Trạng thái: `STARTED`, `IDENTITY_CREATED`, `PROFILE_SYNCED`, `WELCOME_SENT`, `COMPLETED`, `COMPENSATING`, `FAILED`.
- Có job retry/repair.
- Có admin endpoint xem saga stuck.

### Saga: ghi danh khóa học

```text
1. course-service kiểm tra license read model.
2. tạo enrollment.
3. publish course.enrollment.created.
4. analytics-service tạo/refresh progress.
5. notification-service gửi thông báo.
```

Nâng cấp:

- Nếu analytics/notification fail thì enrollment vẫn thành công nhưng có retry event.
- Nếu rule nghiệp vụ yêu cầu "all or nothing", dùng saga state và compensation `cancel enrollment`.

### Saga: nộp bài thi

```text
1. exam-service khóa session.
2. chấm điểm.
3. lưu kết quả.
4. publish exam.session.completed/passed/failed.
5. analytics cập nhật dashboard.
6. notification gửi kết quả.
```

Nâng cấp:

- Bảng saga/outbox/inbox để đảm bảo không mất event.
- Compensation nếu submit bị duplicate hoặc session hết hạn.

---

## 4.4. Outbox Pattern

**Trạng thái: Đã triển khai một phần**

Outbox đã có ở:

- `user-service`
- `course-service`
- `exam-service`

Mục tiêu hiện tại nổi bật là audit outbox:

- Repository ghi `OutboxMessage` cùng transaction với thay đổi DB.
- `AuditOutboxRelayService` publish event `security.audit.recorded`.
- `audit-service` consume và lưu audit log.

**Chưa hoàn chỉnh**

- Chưa phải mọi domain event đều đi qua outbox.
- Chưa có Debezium/CDC.
- Chưa có outbox relay chung tái sử dụng cho mọi service/event.
- Chưa có dashboard outbox lag/failure.

**Có thể triển khai thêm**

- Chuẩn hóa outbox cho mọi producer quan trọng:
  - `identity-service`: user created/updated/deleted.
  - `course-service`: enrollment/lesson/material events.
  - `exam-service`: exam session completed/passed/failed.
  - `question-service`: question created/deactivated/image linked.
  - `media-service`: file uploaded/deleted.
- Thiết kế bảng outbox chuẩn:

```sql
outbox_messages(
  id,
  event_name,
  event_version,
  aggregate_type,
  aggregate_id,
  payload,
  headers,
  status,
  retry_count,
  next_retry_at,
  created_at,
  published_at,
  last_error
)
```

- Thêm relay worker chung trong `packages/common`.
- Thêm exponential backoff cho outbox publish.
- Thêm alert khi outbox pending quá lâu.
- Dùng Debezium để đọc outbox và publish sang Kafka/RabbitMQ nếu muốn production-grade hơn.

---

## 4.5. CQRS và Read Model

**Trạng thái: Đã triển khai một phần**

Các biểu hiện CQRS/read model đã có:

- `analytics-service` có các bảng đọc tối ưu:
  - `student_learning_profiles`
  - `daily_activities`
  - `question_accuracy_trackers`
- `course-service` có `student_license_profiles` làm read model đồng bộ từ `user-service`.
- Course list/detail có cache-aside Redis để tối ưu query.
- Analytics progress có cache Redis.

**Có thể triển khai thêm**

- Tách rõ command model và query model trong docs:
  - command service sở hữu write model.
  - query/read model chỉ phục vụ dashboard/list/search.
- Thêm projection worker có khả năng replay event.
- Thêm version checkpoint cho từng projection:

```text
projection_name
last_event_id
last_processed_at
lag_seconds
status
```

- Cân nhắc search read model bằng Elasticsearch/OpenSearch cho:
  - search câu hỏi.
  - search khóa học.
  - audit log filtering nâng cao.
- Với analytics nâng cao, thêm warehouse hoặc OLAP nhỏ:
  - ClickHouse
  - BigQuery
  - PostgreSQL materialized view.

---

## 4.6. Polyglot Persistence

**Trạng thái: Đã triển khai**

Hệ thống dùng nhiều loại storage theo mục đích:

| Công nghệ | Vai trò |
| --- | --- |
| PostgreSQL | Dữ liệu nghiệp vụ chính per service. |
| Redis | Token blacklist, cache-aside, Socket.IO adapter/cache. |
| RabbitMQ | Message broker, retry queue, DLQ. |
| Keycloak DB | Identity provider metadata. |
| Consul KV | Centralized config. |
| Object storage/Azure Blob adapter | File/media storage. |
| Elasticsearch | Logging/search logs qua ELK. |
| Prometheus TSDB | Metrics time-series. |

**Có thể triển khai thêm**

- Dùng managed services khi deploy production thật:
  - Cloud SQL PostgreSQL.
  - Memorystore Redis.
  - Managed RabbitMQ/CloudAMQP hoặc Pub/Sub nếu đổi nền tảng.
  - Google Secret Manager.
  - Cloud Storage cho media/backup.
- Thiết kế data retention riêng cho log, metrics, audit, event.

---

# 5. Docker, container và Kubernetes

## 5.1. Docker

**Trạng thái: Đã triển khai**

Repo có:

- `Dockerfile.service` dùng chung.
- `apps/*/Dockerfile` cho service.
- `Dockerfile.migration-runner`.
- `.dockerignore`.
- Runtime image được harden bằng cách giảm dev dependencies và bỏ một số tool không cần thiết.

**Có thể triển khai thêm**

- Thêm image labels chuẩn OCI:

```text
org.opencontainers.image.source
org.opencontainers.image.revision
org.opencontainers.image.created
```

- Thêm non-root user check trong CI.
- Thêm image size budget.
- Thêm Trivy filesystem scan và secret scan ngoài image scan.
- Thêm distroless image nếu muốn giảm attack surface sâu hơn.

---

## 5.2. Docker Compose

**Trạng thái: Đã triển khai**

Các compose file:

- `docker-compose.infra.yml`: hạ tầng local/hybrid.
- `docker-compose.yaml`: full stack local.
- `docker-compose.deploy.yml`: deploy legacy qua VM/SSH/Compute Engine.

Các thành phần có trong compose:

- 10 app services.
- PostgreSQL per service.
- RabbitMQ management + Prometheus plugin.
- Redis.
- Consul + init seed.
- Keycloak + DB + SMTP config + backup.
- Kong DB-less.
- ELK.
- Jaeger.
- Prometheus.
- Alertmanager.
- Grafana.
- Mailpit.
- DORA metrics exporter.
- Backup jobs.

**Có thể triển khai thêm**

- Thêm compose profile:
  - `minimal`: chỉ DB/RabbitMQ/Redis/Consul/Keycloak/Kong.
  - `observability`: Prometheus/Grafana/ELK/Jaeger.
  - `perf`: thêm k6 runner.
- Thêm health dependency chặt hơn cho app services.
- Thêm Makefile hoặc task runner wrapper để lệnh ngắn hơn.

---

## 5.3. Kubernetes và Helm

**Trạng thái: Đã triển khai**

Helm chart `charts/luyen-thi-lai-xe` có:

- Deployment/Service cho 10 production services.
- PostgreSQL, RabbitMQ, Redis, Consul, Keycloak, Kong.
- ConfigMap/Secret.
- Ingress.
- RBAC.
- Migration Job.
- Consul seed Job.
- Health probes `/health/live`, `/health/ready`.
- Resources requests/limits.
- HPA template `templates/hpa.yaml`.
- Values riêng:
  - `values.yaml`
  - `values-staging.example.yaml`
  - `values-production.example.yaml`
  - `values-gcp.example.yaml`
  - `values-docker-desktop.example.yaml`

HPA trong `values.yaml` đã bật cho một số service quan trọng như `identity-service`, `exam-service`, `course-service`, `analytics-service`, `simulation-service`.

**Đã triển khai một phần**

- HPA có template và values, nhưng cần verify trên cluster thật với metrics-server.
- Kubernetes hiện self-contained nhiều dependency trong cluster; production thật nên cân nhắc managed database/Redis/object storage.

**Có thể triển khai thêm**

- PodDisruptionBudget cho service quan trọng.
- NetworkPolicy để giới hạn service nào được gọi DB/RabbitMQ/Redis.
- External Secrets Operator với Google Secret Manager/Vault.
- KEDA autoscaling theo RabbitMQ queue depth cho consumer service.
- VPA recommendation cho resource tuning.
- Topology spread constraints để pod không dồn vào một node.
- Readiness gate kiểm tra dependency sâu hơn.
- Helm test hook để smoke test release.
- Argo CD/Flux GitOps.

---

## 5.4. Terraform/IaC

**Trạng thái: Đã triển khai một phần**

Repo có Terraform baseline:

- `terraform/main.tf`
- `terraform/modules/gcp-k3s-vm`
- VM GCP/K3s, network, static IP, startup script, output URL/kubeconfig command.

**Có thể triển khai thêm**

- Mở rộng Terraform cho GKE production:
  - VPC/subnet/firewall.
  - GKE cluster/node pools.
  - Cloud SQL PostgreSQL.
  - Memorystore Redis.
  - Artifact/GHCR access.
  - Google Secret Manager.
  - Cloud DNS/static IP/TLS certificate.
  - IAM service accounts.
  - Cloud Storage backup bucket.
- Thêm remote state:
  - GCS backend.
  - state locking.
  - workspace per env.
- Thêm CI `terraform fmt`, `validate`, `plan`.
- Thêm policy-as-code:
  - Checkov.
  - tfsec.
  - OPA/Conftest.

---

# 6. Service Discovery và Load Balancing

## 6.1. Service Discovery

**Trạng thái: Đã triển khai một phần**

Hiện có nhiều cơ chế:

- Docker Compose dùng Docker DNS theo service name.
- Kubernetes dùng Service DNS.
- Consul đang dùng chủ yếu như centralized config/KV seed.
- Kong route theo upstream service name trong Docker/Kubernetes.

**Có thể triển khai thêm**

- Nếu muốn Consul đúng nghĩa service discovery:
  - Service tự register vào Consul khi start.
  - Health check register theo `/health/ready`.
  - Kong hoặc service client resolve qua Consul DNS/API.
- Nếu chạy Kubernetes là chính, có thể giữ service discovery bằng K8s Service DNS, không cần Consul discovery runtime.
- Thêm service dependency map tự động từ config/Kong/events.

---

## 6.2. Load Balancing

**Trạng thái: Đã triển khai**

- Kong là entrypoint và route request về service.
- Docker/Kubernetes service name có thể load balance khi có nhiều replica.
- HPA template hỗ trợ tăng replica theo CPU/memory.
- Kubernetes Service/Ingress làm load balancing trong cluster.

**Có thể triển khai thêm**

- Load balancing theo latency/health nếu dùng service mesh.
- Sticky session chỉ khi thật sự cần WebSocket/socket flow.
- KEDA scale consumer theo RabbitMQ queue backlog.
- Circuit breaker/rate limit ở gateway hoặc mesh.

---

# 7. API Gateway và Networking

## 7.1. Kong API Gateway

**Trạng thái: Đã triển khai**

Kong DB-less config có:

- Route cho toàn bộ service production.
- Swagger route qua `/<service>/docs`.
- CORS plugin.
- Correlation ID plugin.
- Zipkin plugin gửi trace gateway vào Jaeger.
- Rate limiting plugin local.

**Đã triển khai một phần**

- Gateway đang rate limit global/local, chưa thấy rate limit chi tiết theo consumer/role/route.
- Auth vẫn chủ yếu enforce ở service bằng Keycloak guard. Kong chưa phải OAuth2/JWT policy enforcement point đầy đủ.

**Có thể triển khai thêm**

- Route-level rate limit:
  - login thấp hơn.
  - read API cao hơn.
  - upload riêng.
- Consumer-based quota:
  - anonymous.
  - student.
  - instructor.
  - admin.
- JWT validation hoặc OIDC plugin ở Kong nếu muốn chặn sớm trước service.
- Request size limit cho upload.
- Response/request transform chuẩn hóa header.
- Plugin Prometheus của Kong để quan sát gateway latency/status.
- mTLS giữa Kong và service nếu triển khai production.

---

## 7.2. Ingress, DNS và TLS

**Trạng thái: Đã triển khai một phần**

Helm có Ingress template và values cho GCP/staging/production.

**Có thể triển khai thêm**

- Cert-manager + Let's Encrypt.
- Managed certificate nếu dùng GKE.
- DNS automation bằng ExternalDNS.
- WAF/CDN phía trước nếu public production.
- Tách host:
  - `api.example.com`
  - `auth.example.com`
  - `docs.internal.example.com`
  - `grafana.internal.example.com`

---

# 8. Bảo mật, Authentication và Authorization

## 8.1. Keycloak, OAuth2/JWT

**Trạng thái: Đã triển khai**

Hệ thống dùng Keycloak cho:

- Login.
- Refresh token.
- Logout/session revocation.
- Forgot password/password reset.
- Realm roles.
- Keycloak Admin API.
- Realm import/export.
- Demo users.

Các service dùng:

- `nest-keycloak-connect`.
- `@Roles`.
- `@AuthenticatedUser`.
- JWT verifier/custom guard ở một số service.
- Redis token blacklist cho logout.

**Có thể triển khai thêm**

- Refresh token rotation.
- Device/session management UI.
- Fine-grained permissions/scopes thay vì chỉ realm role.
- Token exchange cho service-to-service call.
- Short-lived access token + rotated refresh token.
- Step-up auth cho admin action nhạy cảm.
- Account lockout/risk-based login policy rõ trong docs.

---

## 8.2. RBAC và Authorization

**Trạng thái: Đã triển khai**

Controller dùng role như:

- `ADMIN`
- `CENTER_MANAGER`
- `INSTRUCTOR`
- `STUDENT`

Role guard đang bảo vệ nhiều endpoint admin/student/instructor.

**Có thể triển khai thêm**

- Tạo permission matrix chính thức:

| Resource | Action | ADMIN | CENTER_MANAGER | INSTRUCTOR | STUDENT |
| --- | --- | ---: | ---: | ---: | ---: |
| Course | create | yes | yes | no | no |
| Course | enroll | no | no | no | yes |
| ExamSession | submit own | no | no | no | yes |
| AuditLog | read | yes | yes | no | no |

- Chuyển từ RBAC thuần sang RBAC + ABAC:
  - student chỉ đọc tài nguyên của chính mình.
  - instructor chỉ xem lớp/khóa được phân công.
  - center manager chỉ quản lý center của mình nếu sau này có multi-center.
- Thêm policy engine:
  - CASL trong app.
  - OPA nếu muốn externalized authorization.
- Thêm authorization tests dạng matrix.

---

## 8.3. Secret Management và DevSecOps

**Trạng thái: Đã triển khai một phần**

Đã có:

- `.env.example`, `.env.vps.example`, `deploy/*.env.example`.
- `.gitignore` chặn `.env`, backups.
- Kubernetes Secret template.
- Consul seed chỉ nên chứa non-secret config.
- Trivy image scan trong GitHub Actions.
- SBOM/Cosign baseline trong workflow release.
- Docker runtime hardening baseline.

**Có thể triển khai thêm**

- Dùng secret manager chính thức:
  - Google Secret Manager.
  - HashiCorp Vault.
  - External Secrets Operator.
- Secret rotation runbook:
  - DB password.
  - RabbitMQ password.
  - Keycloak admin/client secret.
  - JWT/client credentials.
  - storage account keys.
- Admission policy bắt buộc verify Cosign signature trước khi Kubernetes chạy image.
- CodeQL/Semgrep/Snyk/Dependabot.
- OWASP ZAP baseline scan qua staging.
- Container runtime security:
  - read-only root filesystem.
  - drop Linux capabilities.
  - seccomp/AppArmor profile.
  - non-root enforced.
- NetworkPolicy để khóa east-west traffic.

---

# 9. Cấu hình tập trung và quản lý môi trường

## 9.1. Centralized Config với Consul

**Trạng thái: Đã triển khai**

Hệ thống dùng Consul KV cho config theo môi trường:

```text
config/<environment>/<service-name>/<path>
```

Đã có:

- `consul-seed-development-local.json`
- `consul-seed-development.json`
- `consul-seed-staging.json`
- `consul-seed-production.json`
- `scripts/consul-seed.ts`
- `scripts/consul-list.ts`
- `scripts/consul-get.ts`
- `docker/consul/init.sh`
- Thứ tự ưu tiên config: env -> Consul -> default.

**Có thể triển khai thêm**

- Runtime config reload cho key an toàn reload.
- Config schema validation tập trung.
- Config drift detection giữa staging/production.
- Config change audit log.
- Tách secret khỏi Consul hoàn toàn nếu Consul không bật ACL/encryption.
- Consul ACL + TLS nếu dùng production.

---

## 9.2. Kubernetes ConfigMap/Secret

**Trạng thái: Đã triển khai**

Helm chart có ConfigMap/Secret templates.

**Có thể triển khai thêm**

- External Secrets Operator.
- Sealed Secrets hoặc SOPS nếu muốn GitOps.
- Secret checksum annotation để rollout pod khi secret đổi.
- Policy cấm secret plaintext trong values thật.

---

# 10. Logging, Monitoring, Tracing

## 10.1. Health check và readiness/liveness

**Trạng thái: Đã triển khai**

Các endpoint chuẩn:

```text
/health
/health/live
/health/ready
/metrics
```

Được dùng bởi:

- Smoke test.
- Docker healthcheck.
- Kubernetes probes.
- Prometheus scrape.

**Có thể triển khai thêm**

- Readiness detail theo dependency:
  - DB.
  - Redis.
  - RabbitMQ.
  - Keycloak.
  - Consul.
- Tách public health và internal detailed health.
- Thêm startup probe cho service khởi động chậm.

---

## 10.2. Centralized Logging với ELK

**Trạng thái: Đã triển khai**

Hạ tầng có:

- Elasticsearch.
- Logstash.
- Kibana.
- `docker/logstash/logstash.conf`.
- Common logger module có correlation ID.
- Access log interceptor.

**Có thể triển khai thêm**

- Chuẩn hóa JSON log fields:

```json
{
  "timestamp": "...",
  "level": "info",
  "service": "exam-service",
  "context": "SubmitSessionUseCase",
  "message": "...",
  "correlationId": "...",
  "traceId": "...",
  "spanId": "...",
  "userId": "...",
  "eventName": "exam.session.completed"
}
```

- Log sampling cho endpoint traffic cao.
- PII masking cho email/phone/token.
- Log retention policy.
- Alert khi error log tăng đột biến.
- Kibana saved searches/dashboard theo service.

---

## 10.3. Monitoring với Prometheus/Grafana/Alertmanager

**Trạng thái: Đã triển khai**

Repo có:

- `packages/common/src/metrics`.
- `/metrics` endpoint.
- Prometheus config local/full.
- Grafana provisioning.
- Dashboard:
  - microservices observability.
  - DORA metrics.
  - business metrics.
- Alertmanager.
- Alert rules:
  - metrics endpoint down.
  - high 5xx.
  - high latency.
  - high memory/CPU.
  - RabbitMQ DLQ/retry backlog.
- RabbitMQ Prometheus plugin.

Metrics đã có:

- HTTP request count/latency/status class.
- Node/process metrics.
- RabbitMQ message success/retry/DLQ.
- Business metrics:
  - users created.
  - exam sessions started/completed.
  - course lessons/enrollments completed.
  - notification delivery.
  - media upload.
- DORA metrics.

**Có thể triển khai thêm**

- SLI/SLO dashboard:
  - availability.
  - p95/p99 latency.
  - error rate.
  - saturation.
- Error budget burn alerts.
- Golden signals theo service.
- RED/USE dashboards.
- Prometheus long-term storage:
  - Thanos.
  - Cortex.
  - Mimir.
- Synthetic monitoring gọi flow thật định kỳ.
- Alert theo business:
  - pass rate giảm bất thường.
  - notification failure tăng.
  - upload failure tăng.
  - số submit exam giảm đột ngột.

---

## 10.4. Distributed Tracing với OpenTelemetry/Jaeger

**Trạng thái: Đã triển khai**

Repo có:

- `packages/common/src/tracing`.
- OpenTelemetry SDK bootstrap.
- HTTP tracing middleware.
- Nest/RabbitMQ tracing interceptor.
- Kong Zipkin plugin gửi span về Jaeger.
- Jaeger trong Docker Compose và Helm.
- `resilientFetch`/Axios inject trace context.

**Có thể triển khai thêm**

- Thêm span attributes chuẩn:
  - `service.name`
  - `enduser.id`
  - `messaging.system`
  - `messaging.destination`
  - `db.system`
  - `http.route`
  - `business.use_case`
- Sampling policy theo môi trường:
  - dev: 100%.
  - staging: 20-50%.
  - production: 1-10% + tail sampling error traces.
- Trace correlation với logs bằng `traceId`.
- Trace event-driven flow qua `correlationId` và `causationId`.
- OpenTelemetry Collector thay vì service gửi trực tiếp Jaeger.

---

# 11. Resilience và design patterns chịu lỗi

## 11.1. HTTP Timeout, Retry, Circuit Breaker

**Trạng thái: Đã triển khai**

`packages/common/src/http/resilient-http-client.ts` hỗ trợ:

- Timeout mặc định 3000ms.
- Retry mặc định 2 lần.
- Backoff factor.
- Circuit breaker:
  - failure threshold.
  - open window.
- Retry status: `408`, `429`, `5xx`.
- Axios interceptor.
- Fetch wrapper.
- Trace context propagation.

**Có thể triển khai thêm**

- Circuit breaker metrics:
  - state open/half-open/closed.
  - open count.
  - rejected request count.
- Half-open probe chính thức.
- Bulkhead/concurrency limit theo dependency.
- Request budget/deadline propagation.
- Fallback rõ cho từng dependency:
  - Keycloak public key cache.
  - Question pool snapshot.
  - Redis cache fallback DB.
- Chaos test service dependency down.

---

## 11.2. RabbitMQ Retry, DLQ và Idempotency

**Trạng thái: Đã triển khai**

Đã có:

- Retry queue TTL.
- DLQ.
- Manual ack.
- Durable queue.
- Persistent message.
- Prefetch.
- Idempotency memory TTL.
- Metrics retry/DLQ.
- Smoke script.

**Có thể triển khai thêm**

- Durable idempotency store bằng Redis/PostgreSQL.
- Inbox Pattern.
- DLQ replay tool.
- Poison message quarantine.
- Alert theo eventName chứ không chỉ queue.
- Retry policy theo loại lỗi:
  - validation error -> DLQ ngay.
  - transient network -> retry.
  - dependency down -> retry dài hơn.

---

## 11.3. Rate Limiting

**Trạng thái: Đã triển khai một phần**

Kong có plugin `rate-limiting` local:

```text
second: 100
hour: 1000
policy: local
```

**Có thể triển khai thêm**

- Rate limit theo route:
  - `/auth/login`: rất thấp.
  - `/media`: riêng theo upload.
  - `/admin/*`: riêng.
- Rate limit theo user/role/IP.
- Dùng Redis-backed rate limiting để chạy nhiều Kong replica.
- Thêm response `429` chuẩn.
- Thêm k6 security scenario test cho rate limit.

---

## 11.4. Bulkhead, Fallback, Degrade, Load Shedding

**Trạng thái: Có thể triển khai thêm**

Các pattern nên cân nhắc:

- Bulkhead:
  - giới hạn connection/request song song tới Keycloak, question-service, media storage.
  - tránh dependency chậm kéo sập toàn service.
- Fallback:
  - Redis down -> DB fallback.
  - notification provider down -> lưu pending retry.
  - analytics down -> vẫn cho exam/course hoàn thành.
- Degrade:
  - nếu analytics chậm, trả dashboard cache cũ.
  - nếu media storage lỗi, cho retry upload sau.
- Load shedding:
  - từ chối request sớm khi queue/backlog quá cao.
- Timeout budget:
  - tổng request từ gateway đến service không vượt quá deadline.

---

# 12. CI/CD, deployment và cloud

## 12.1. GitHub Actions

**Trạng thái: Đã triển khai**

Workflow hiện có:

| Workflow | Vai trò |
| --- | --- |
| `pr-validation.yml` | Quality gate PR, detect changed services, build/scan image, label PR. |
| `ci.yml` | Main image release, build/scan/push GHCR, deploy staging bằng Helm. |
| `production-release.yml` | Production release thủ công với immutable image tag. |
| `rollback-release.yml` | Rollback Helm release theo revision, smoke test, deployment event. |
| `devops-smoke.yml` | Smoke observability/RabbitMQ/restore. |
| `dora-report.yml` | Tạo DORA report. |
| `incident-labeler.yml` | Label incident theo environment/severity. |
| `deploy-compose-legacy.yml` | Deploy compose legacy. |

Đã có:

- Quality gate.
- Build image.
- Trivy scan.
- GHCR push.
- SBOM/Cosign baseline.
- Helm deploy.
- Rollback workflow.
- Deployment event/DORA metrics.

**Có thể triển khai thêm**

- Required status checks trong GitHub branch protection.
- Required reviewers cho production environment.
- OpenAPI breaking-change check.
- Contract test gate.
- k6 smoke/load gate cho staging.
- Helm chart test/lint/template trong PR.
- Terraform plan trong PR.
- Progressive delivery:
  - canary.
  - blue-green.
  - automated rollback theo metrics.

---

## 12.2. Jenkins

**Trạng thái: Đã triển khai**

`Jenkinsfile` có:

- lint.
- typecheck.
- test.
- build.
- image push.
- staging deploy.
- production manual approval.
- deployment event cho DORA.

**Có thể triển khai thêm**

- Chọn rõ GitHub Actions là đường chính hay Jenkins là đường chính để tránh drift.
- Nếu giữ cả hai:
  - cùng dùng một deployment event schema.
  - cùng image tag policy.
  - cùng smoke gate.

---

## 12.3. Deployment Strategy

**Trạng thái: Đã triển khai một phần**

Đã có:

- Helm release.
- Kubernetes rolling update mặc định.
- Rollback workflow theo Helm revision.
- Docker Compose deploy legacy.

**Có thể triển khai thêm**

- Blue-green deployment:
  - `stable` và `preview` release.
  - switch ingress traffic.
- Canary deployment:
  - 5% -> 25% -> 50% -> 100%.
  - tự rollback nếu error rate/latency vượt threshold.
- Argo Rollouts hoặc Flagger.
- Feature flags:
  - Unleash.
  - OpenFeature.
- Expand-contract migration strategy:
  - expand schema.
  - deploy app tương thích 2 version.
  - backfill.
  - contract old schema.

---

# 13. Testing

## 13.1. Unit Test

**Trạng thái: Đã triển khai**

Repo có nhiều `*.spec.ts` đặt gần domain/use case/service.

Đang test các phần:

- Aggregate business rule.
- Use case.
- Auth/token/logout.
- Notification dispatcher.
- Cache behavior.
- Domain exception.
- Exam submit/save answer.
- Course rule.
- Academic warning retry.

**Có thể triển khai thêm**

- Tăng coverage cho các aggregate quan trọng.
- Mutation testing cho domain rule khó.
- Property-based testing cho:
  - score calculation.
  - exam pass/fail.
  - question randomization.
  - course progress percentage.

---

## 13.2. Service E2E và Integration Test

**Trạng thái: Đã triển khai**

Đã có:

- `apps/*/test/app.e2e-spec.ts` cho nhiều service.
- `tests/event-propagation/identity-user-sync.integration-spec.ts` kiểm tra đồng bộ identity -> user qua RabbitMQ.
- `tests/jest.integration.json`.

**Có thể triển khai thêm**

- Testcontainers cho DB/RabbitMQ/Redis/Keycloak.
- Integration test cho các event flow:
  - exam completed -> analytics updated.
  - course lesson completed -> analytics updated.
  - media file deleted -> user/course/question cleanup.
  - audit outbox -> audit-service.
- E2E qua Kong cho flow người dùng:
  - login.
  - xem khóa học.
  - ghi danh.
  - làm bài thi.
  - nộp bài.
  - xem analytics.
  - nhận notification.

---

## 13.3. Smoke Test

**Trạng thái: Đã triển khai**

Script:

- `scripts/smoke.ts`
- `scripts/observability-smoke.ts`
- `scripts/rabbitmq-resilience-smoke.ts`
- `scripts/db-restore-test.ts`
- `scripts/k8s-smoke.sh`

**Có thể triển khai thêm**

- Lưu kết quả smoke theo release artifact.
- Smoke test sau deploy staging/production bắt buộc.
- Synthetic scheduled smoke test mỗi 5 phút.
- Smoke test có auth thật và vài endpoint write/read nhẹ.

---

## 13.4. k6 Load/Stress/Spike/Smoke/Security

**Trạng thái: Đã triển khai một phần**

Repo có thư mục `load-tests` với:

- `scenarios/load.js`
- `scenarios/stress.js`
- `scenarios/spike.js`
- `scenarios/smoke.js`
- services helper cho identity, exam, course, health.

**Có thể triển khai thêm**

- Thêm `soak.js` chạy tải vừa trong 30-60 phút.
- Thêm `security.js`:
  - no token -> 401.
  - bad token -> 401.
  - wrong role -> 403.
  - rate limit -> 429.
  - invalid payload không gây 500.
- Đưa k6 vào CI cho staging:
  - smoke mỗi deploy.
  - load ngắn trước release.
  - stress/spike theo lịch.
- Xuất kết quả k6 vào Prometheus/Grafana/HTML report.
- Gắn threshold theo SLO:
  - p95 login < 800ms.
  - p95 list exams/courses < 600ms.
  - error rate < 1%.

---

## 13.5. Contract Test

**Trạng thái: Có thể triển khai thêm**

Chưa thấy Pact/contract test chính thức.

Nên ưu tiên contract test cho các cặp:

| Consumer | Provider | Contract |
| --- | --- | --- |
| `exam-service` | `question-service` | question pool response. |
| `exam-service` | `user-service` | user profile/license. |
| `course-service` | `user-service` | license tier/profile. |
| `frontend` | Kong/API services | OpenAPI response/request. |
| `analytics-service` | event producers | event schema. |
| `notification-service` | event producers | event schema. |

Hướng triển khai:

- Pact cho HTTP consumer-provider.
- AsyncAPI/schema tests cho RabbitMQ events.
- Provider verification trong CI.
- Contract artifact version theo commit/release.

---

## 13.6. Security Testing

**Trạng thái: Đã triển khai một phần**

Đã có unit/integration tests liên quan:

- login JWT.
- lock account.
- logout token blacklist Redis.
- guard chặn token blacklist.
- role guard ở controller.

**Có thể triển khai thêm**

- k6 security scenario.
- OWASP ZAP baseline scan qua Kong.
- Semgrep/CodeQL.
- Dependency vulnerability scan.
- Secret scanning.
- Authorization matrix tests.
- Fuzz test input cho endpoint public.

---

# 14. Documentation, traceability và vận hành

## 14.1. API docs và development governance

**Trạng thái: Đã triển khai**

Repo có:

- `docs/api/api-spec-*.md`.
- `docs/api/kong-frontend-integration.md`.
- `docs/development-guidelines.md`.
- `docs/testing/requirements-traceability-matrix.md`.
- `docs/testing/test-summary-report.md`.
- `docs/devops/*`.
- `docs/architecture/clean-ddd-conventions.md`.

**Có thể triển khai thêm**

- ADR index:
  - `docs/adr/0001-use-nestjs.md`
  - `docs/adr/0002-use-rabbitmq.md`
  - `docs/adr/0003-use-kong.md`
  - `docs/adr/0004-use-keycloak.md`
- Runbook theo sự cố:
  - RabbitMQ DLQ tăng.
  - Keycloak down.
  - DB migration fail.
  - Redis down.
  - high latency.
  - high 5xx.
- Release checklist.
- Data retention policy.
- Threat model document.

---

## 14.2. Backup, Restore, Incident, DORA

**Trạng thái: Đã triển khai**

Đã có:

- PostgreSQL backup script.
- Keycloak export backup.
- Restore test script.
- DORA event/report/export.
- Incident issue template/labeler.
- Postmortem template.
- DevOps runbooks.

**Có thể triển khai thêm**

- Offsite backup lên Cloud Storage/S3.
- PITR cho PostgreSQL production.
- Restore drill định kỳ và lưu bằng chứng.
- RTO/RPO chính thức:
  - RTO: thời gian khôi phục mục tiêu.
  - RPO: lượng dữ liệu mất tối đa chấp nhận được.
- Game day/incident drill.
- Multi-region DR sau MVP.

---

# 15. Ma trận tổng hợp theo nhóm kỹ thuật trong file gốc

| Nhóm kỹ thuật | Trạng thái hiện tại | Minh chứng chính | Nâng cấp nên làm |
| --- | --- | --- | --- |
| Microservices | Đã triển khai | `apps/*`, `README.md`, Docker/Helm | Context map, ownership matrix, ADR. |
| DDD/Clean Architecture | Đã triển khai | `domain/application/infrastructure/presentation`, `docs/architecture` | Architecture test, invariant docs, optimistic locking. |
| REST/HTTP | Đã triển khai | Controllers, DTOs, Kong routes | API versioning, idempotency key, OpenAPI diff. |
| RabbitMQ/Messaging | Đã triển khai | `@EventPattern`, RabbitMQ resilience | Event schema registry, Inbox, durable idempotency, DLQ replay. |
| Event-Driven Architecture | Đã triển khai | event flows identity/user/course/exam/media/audit | AsyncAPI, event catalog, replay/projection tooling. |
| Database per Service | Đã triển khai | Prisma schema per service, DB compose | DB least privilege, PITR/offsite backup. |
| Eventual Consistency | Đã triển khai | read models, event sync | UI pending/retry semantics, correlation dashboard. |
| Saga | Một phần | choreography event flow | Saga state table/orchestrator/compensation. |
| Outbox | Một phần | `OutboxMessage` in user/course/exam | Generalized outbox, Debezium, outbox metrics. |
| CQRS | Một phần | analytics read model, course license read model | Projection replay, query model docs, search read model. |
| Docker | Đã triển khai | Dockerfiles, compose | non-root enforcement, image labels, image size budget. |
| Docker Compose | Đã triển khai | compose infra/full/deploy | profiles, stronger health dependencies. |
| Kubernetes/Helm | Đã triển khai | chart, probes, resources, HPA template | PDB, NetworkPolicy, ExternalSecrets, KEDA, GitOps. |
| Service Discovery | Một phần | Docker/K8s DNS, Consul config | Consul service registry hoặc chuẩn hóa chỉ dùng K8s DNS. |
| Load Balancing | Đã triển khai | Kong, K8s Service, HPA | traffic split, mesh-level balancing. |
| API Gateway | Đã triển khai | Kong routes/plugins | route/user-based quota, OIDC at gateway, mTLS upstream. |
| Security/Auth | Đã triển khai | Keycloak, JWT, RBAC, Redis blacklist | ABAC, permission matrix, refresh rotation, mTLS. |
| Centralized Config | Đã triển khai | Consul seed/scripts | config reload, drift detection, Consul ACL/TLS. |
| Secrets | Một phần | env examples, K8s Secret | Vault/GSM/External Secrets, rotation. |
| Logging | Đã triển khai | Winston/common logger, ELK | PII masking, retention, traceId in logs. |
| Monitoring | Đã triển khai | Prometheus/Grafana/alerts | SLO/error budget, synthetic monitoring. |
| Tracing | Đã triển khai | OTel, Jaeger, Kong Zipkin | Collector, sampling, event trace linkage. |
| Resilience | Đã triển khai | HTTP retry/circuit, RabbitMQ retry/DLQ | bulkhead, durable idempotency, chaos tests. |
| Rate Limiter | Một phần | Kong rate-limiting local | Redis-backed, per route/user/role. |
| CI/CD | Đã triển khai | GitHub Actions, Jenkins | contract/k6/terraform gates, progressive delivery. |
| Registry/SBOM/Signing | Một phần/đã có baseline | GHCR, Trivy, SBOM/Cosign workflow | admission policy verify image signature. |
| Cloud/IaC | Một phần | Helm, Terraform K3s VM | Full GKE/Cloud SQL/Secret Manager Terraform. |
| Unit/E2E/Integration Test | Đã triển khai | `*.spec.ts`, `apps/*/test`, `tests` | Testcontainers, broader cross-service flows. |
| Contract Test | Có thể triển khai | Chưa thấy Pact | Pact/OpenAPI/AsyncAPI verification. |
| k6 Performance Test | Một phần | `load-tests` | soak/security scenario, CI gate, Grafana result. |
| Security Test | Một phần | auth tests | OWASP ZAP, k6 security, authorization matrix. |

---

# 16. Roadmap đề xuất không ngại overengineer

## 16.1. Giai đoạn 1 - Hoàn thiện minh chứng đồ án và giảm rủi ro gần

Nên làm trước vì dễ chứng minh trong báo cáo/demo:

1. Tạo event catalog/AsyncAPI cho các event RabbitMQ hiện có.
2. Chuẩn hóa event envelope có `eventId`, `eventVersion`, `correlationId`, `producer`, `occurredAt`.
3. Bổ sung contract test mẫu:
   - `exam-service` -> `question-service`.
   - event `identity.user.created` -> `user-service`.
4. Thêm k6 security scenario.
5. Lưu kết quả smoke/k6 làm artifact trong CI.
6. Thêm API versioning guideline và áp dụng dần qua Kong.
7. Thêm permission matrix RBAC vào docs.
8. Thêm runbook DLQ replay thủ công.
9. Verify Helm HPA trên cluster thật và chụp minh chứng.
10. Thêm OpenAPI lint/diff trong CI.

## 16.2. Giai đoạn 2 - Production hardening

Nên làm nếu muốn hệ thống vững hơn khi deploy thật:

1. External secret manager:
   - Google Secret Manager hoặc Vault.
   - External Secrets Operator.
2. NetworkPolicy Kubernetes.
3. PodDisruptionBudget và topology spread.
4. Redis-backed Kong rate limit.
5. Durable idempotency store cho RabbitMQ consumer.
6. Inbox Pattern ở consumer quan trọng.
7. Generalized Outbox Pattern cho tất cả producer quan trọng.
8. Outbox/Inbox/RabbitMQ dashboard.
9. SLO/error budget dashboard.
10. OWASP ZAP baseline scan.
11. CodeQL/Semgrep security scan.
12. Cosign admission policy bằng Kyverno/Gatekeeper.
13. Offsite backup + restore drill.
14. PITR cho PostgreSQL production.
15. Expand-contract migration checklist trong release process.

## 16.3. Giai đoạn 3 - Advanced architecture/platform

Nên làm nếu muốn hệ thống ở mức rất mạnh:

1. GitOps bằng Argo CD/Flux.
2. Progressive delivery:
   - canary.
   - blue-green.
   - auto rollback theo metrics.
3. Service mesh:
   - Istio hoặc Linkerd.
   - mTLS service-to-service.
   - traffic split.
   - mesh telemetry.
4. KEDA autoscaling theo RabbitMQ queue depth.
5. Full Terraform cho GKE/Cloud SQL/Memorystore/DNS/TLS/Secret Manager.
6. OpenTelemetry Collector + tail sampling.
7. Debezium Outbox CDC.
8. Kafka cho event streaming/analytics nếu RabbitMQ không còn đủ.
9. Projection replay framework cho analytics.
10. Data warehouse:
    - BigQuery.
    - ClickHouse.
11. Feature flags bằng OpenFeature/Unleash.
12. Chaos engineering:
    - kill service.
    - RabbitMQ unavailable.
    - Redis unavailable.
    - DB latency injection.
13. Multi-region/failover nếu có nhu cầu production lớn.

---

# 17. Các chỗ nên nhấn mạnh trong báo cáo

## 17.1. Đoạn mô tả ngắn phần đã áp dụng

Có thể dùng đoạn này trong báo cáo:

```text
Hệ thống Luyện Thi Lái Xe được thiết kế theo kiến trúc microservices với 10 service nghiệp vụ chính. Mỗi service phụ trách một bounded context riêng như identity, user, exam, course, question, notification, analytics, simulation, media và audit. Các service được tổ chức theo DDD/Clean Architecture gồm domain, application, infrastructure và presentation, giúp tách business rule khỏi chi tiết framework, database và messaging.

Giao tiếp đồng bộ được thực hiện qua REST API và API Gateway Kong. Giao tiếp bất đồng bộ được triển khai bằng RabbitMQ theo hướng event-driven architecture, hỗ trợ các luồng như đồng bộ user profile sau khi tạo identity, cập nhật analytics sau khi hoàn thành bài thi/bài học, gửi notification và ghi audit log. Hệ thống đã có retry queue, dead-letter queue, correlation ID, metrics và cơ chế idempotency cơ bản cho message consumer.

Về dữ liệu, hệ thống áp dụng Database per Service với PostgreSQL và Prisma migration riêng cho từng service. Một số read model được triển khai để hỗ trợ CQRS/eventual consistency như analytics progress và student license profile trong course-service. Redis được dùng cho cache-aside, token blacklist và một số nhu cầu runtime khác.

Hệ thống đã được container hóa bằng Docker, có Docker Compose cho local/full stack/deploy và Helm chart cho Kubernetes. Hạ tầng quan sát gồm health endpoints, Prometheus, Grafana, Alertmanager, ELK, OpenTelemetry và Jaeger. CI/CD được triển khai bằng GitHub Actions và Jenkins, có build/test/scan image, GHCR, SBOM/Cosign baseline, Helm deploy, rollback workflow và DORA metrics.

Kiểm thử gồm unit test, service E2E, integration test event propagation, smoke test, observability smoke, RabbitMQ resilience smoke, restore test và k6 load/stress/spike/smoke baseline.
```

## 17.2. Các điểm nên demo

- Chạy full stack hoặc hybrid local qua Docker Compose.
- Gọi API qua Kong.
- Mở Scalar/Swagger docs.
- Login bằng Keycloak và gọi endpoint có role.
- Tạo user hoặc đổi role rồi quan sát event đồng bộ sang user-service.
- Gán license tier rồi kiểm tra `student_license_profiles`.
- Submit exam rồi quan sát analytics/notification event.
- Mở RabbitMQ UI xem queue.
- Mở Prometheus/Grafana xem metrics.
- Mở Jaeger xem trace.
- Chạy `pnpm run smoke`.
- Chạy `pnpm run rabbitmq:smoke`.
- Chạy k6 `load-tests/scenarios/smoke.js` hoặc `load.js`.
- Xem Docker/Helm/Kubernetes manifests.

---

# 18. Checklist "đã/có thể triển khai"

## Đã triển khai tốt

- [x] Microservices theo nghiệp vụ.
- [x] Monorepo pnpm/Turbo.
- [x] DDD/Clean Architecture baseline.
- [x] REST API qua NestJS.
- [x] Kong API Gateway.
- [x] Swagger/OpenAPI/Scalar docs.
- [x] RabbitMQ async messaging.
- [x] Event-driven flows.
- [x] Database per Service.
- [x] Prisma migration/seed.
- [x] Redis cache/token blacklist.
- [x] Docker/Docker Compose.
- [x] Helm/Kubernetes baseline.
- [x] Keycloak JWT/OAuth2/RBAC.
- [x] Consul centralized config.
- [x] Health/readiness/liveness/metrics.
- [x] Prometheus/Grafana/Alertmanager.
- [x] ELK logging baseline.
- [x] OpenTelemetry/Jaeger tracing.
- [x] HTTP timeout/retry/circuit breaker.
- [x] RabbitMQ retry/DLQ.
- [x] GitHub Actions/Jenkins CI-CD.
- [x] Trivy/SBOM/Cosign baseline.
- [x] Backup/restore baseline.
- [x] Unit/E2E/integration/smoke tests.
- [x] k6 baseline.
- [x] DORA metrics.

## Đã có một phần, nên hoàn thiện

- [ ] API versioning.
- [ ] Standard error envelope toàn hệ thống.
- [ ] Idempotency key cho HTTP write requests.
- [ ] Durable idempotency cho RabbitMQ.
- [ ] Inbox Pattern.
- [ ] Outbox Pattern cho mọi domain event quan trọng.
- [ ] Saga state/orchestrator.
- [ ] Contract test.
- [ ] AsyncAPI/event schema registry.
- [ ] DLQ replay tooling.
- [ ] External secret manager.
- [ ] NetworkPolicy.
- [ ] PDB/topology spread.
- [ ] Redis-backed per-user/route rate limit.
- [ ] SLO/error budget.
- [ ] OpenAPI diff gate.
- [ ] k6 security/soak gate.
- [ ] Terraform full cloud infra.
- [ ] GitOps/progressive delivery.

## Có thể triển khai thêm nếu muốn rất mạnh

- [ ] Service mesh mTLS.
- [ ] KEDA queue autoscaling.
- [ ] Debezium Outbox CDC.
- [ ] Kafka event streaming.
- [ ] Projection replay framework.
- [ ] BigQuery/ClickHouse analytics.
- [ ] Feature flags.
- [ ] Chaos engineering.
- [ ] Policy-as-code/admission control.
- [ ] Multi-region disaster recovery.
- [ ] PITR managed database.
- [ ] Synthetic monitoring.
- [ ] Permission/ABAC policy engine.

---

# 19. Các pattern đã được sử dụng trong đồ án

Mục này liệt kê riêng các pattern đã xuất hiện trong đồ án, bao gồm cả pattern đã dùng rõ ràng trong code/config và pattern đã dùng ở mức baseline/một phần.

## 19.1. Architectural Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| Microservices Architecture | Đã dùng | 10 service trong `apps/*` | Tách hệ thống theo nghiệp vụ, mỗi service có runtime/database/API riêng. |
| Domain-Driven Design | Đã dùng | `domain/aggregates`, `domain/events`, `domain/exceptions` | Đặt business rule vào aggregate/domain thay vì controller hoặc ORM. |
| Bounded Context | Đã dùng | identity, user, exam, course, question, notification, analytics, simulation, media, audit | Mỗi context có mô hình dữ liệu và ngôn ngữ nghiệp vụ riêng. |
| Clean Architecture | Đã dùng | `domain`, `application`, `infrastructure`, `presentation` | Tách business logic khỏi framework, database, messaging. |
| Ports and Adapters / Hexagonal Architecture | Đã dùng | repository port, event publisher port, storage provider, HTTP client port | Application phụ thuộc abstraction, infrastructure implement adapter cụ thể. |
| Layered Architecture | Đã dùng | controller -> use case -> repository/domain -> Prisma/RabbitMQ | Giữ trách nhiệm từng tầng rõ ràng. |
| Dependency Inversion | Đã dùng | abstract repository/port được inject bằng implementation | Domain/application không phụ thuộc trực tiếp Prisma/RabbitMQ/Keycloak. |
| Modular Monorepo Pattern | Đã dùng | `pnpm workspace`, `Turbo`, `packages/common`, `apps/*` | Quản lý nhiều service trong một repo nhưng vẫn tách package/service. |
| Shared Kernel | Đã dùng có kiểm soát | `packages/common` | Chia sẻ base class, logging, metrics, tracing, health, resilience; không chia sẻ domain model riêng của service. |
| Service per Business Capability | Đã dùng | service map trong `README.md` | Tách service theo năng lực nghiệp vụ thay vì theo table database. |

## 19.2. Tactical DDD Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| Aggregate Root | Đã dùng | `IdentityUser`, `UserProfile`, `Course`, `CourseEnrollment`, `ExamSession`, `Question`, `Notification`, `FileObject` | Một object gốc kiểm soát invariant và thay đổi bên trong aggregate. |
| Entity | Đã dùng | `StudentDetail`, `Lesson`, `ExamSessionQuestion`, `QuestionOption`, `Practice2dFeedback` | Object có identity riêng trong aggregate hoặc domain. |
| Value Object | Đã dùng | `Email`, `PhoneNumber`, `MimeType`, `FileSize` | Đóng gói validation/ý nghĩa nghiệp vụ của giá trị. |
| Domain Event | Đã dùng | `identity.user.created`, `exam.session.completed`, `course.lesson.completed`, `media.file.deleted` | Biểu diễn sự kiện nghiệp vụ đã xảy ra để service khác phản ứng. |
| Domain Exception | Đã dùng | `course-not-found`, `exam.exceptions`, `user-already-exists`, ... | Chuẩn hóa lỗi nghiệp vụ thay vì throw lỗi hạ tầng. |
| Repository Pattern | Đã dùng | `domain/repositories/*`, `Prisma*Repository` | Ẩn chi tiết Prisma/database khỏi domain/application. |
| Factory Method | Đã dùng | các hàm `create`, `reconstitute` trong aggregate | Tạo aggregate hợp lệ hoặc khôi phục từ persistence. |
| Mapper Pattern | Đã dùng | `infrastructure/persistence/mappers/*` | Chuyển đổi Prisma model sang aggregate/result DTO. |
| Use Case / Application Service | Đã dùng | `application/use-cases/*/*.use-case.ts` | Mỗi nghiệp vụ được orchestration trong một class rõ trách nhiệm. |
| Command / Query Object | Đã dùng | `*.command.ts`, `*.query.ts` | Đóng gói input cho write/read use case. |
| DTO Pattern | Đã dùng | `presentation/dtos/*` | Tách request/response API khỏi domain object. |
| Specification/Policy-like Rule | Đã dùng một phần | rule kiểm tra quyền, license, course capacity, exam availability | Gom điều kiện nghiệp vụ trong domain/use case thay vì rải trong controller. |

## 19.3. Integration và Communication Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| API Gateway Pattern | Đã dùng | Kong `kong/kong.yaml`, `kong/kong.dev.yaml` | Một entrypoint cho frontend, route request tới service nội bộ. |
| Gateway Routing | Đã dùng | route `/auth`, `/users`, `/exams`, `/courses`, `/media`, ... | Ẩn topology nội bộ service với client. |
| Synchronous Request/Response | Đã dùng | REST API, service-to-service HTTP client | Dùng khi cần phản hồi ngay. |
| Asynchronous Messaging | Đã dùng | RabbitMQ, `@EventPattern` | Tách producer/consumer, xử lý nền. |
| Publish/Subscribe | Đã dùng | identity/course/exam/media events | Một event có thể được nhiều service consume. |
| Producer/Consumer | Đã dùng | RabbitMQ publisher/controller messaging | Service phát event và service khác xử lý event. |
| Event-Driven Architecture | Đã dùng | identity -> user, exam/course -> analytics/notification, media events | Hệ thống phản ứng theo event nghiệp vụ. |
| Choreography Saga | Đã dùng một phần | các flow tạo user, submit exam, complete course | Các service phối hợp qua event, chưa có saga state/orchestrator đầy đủ. |
| Correlation ID Pattern | Đã dùng | Kong plugin, common middleware/logger, RabbitMQ headers | Truy vết request/event xuyên service. |
| Request Context Propagation | Đã dùng | OpenTelemetry trace context, `traceparent`, correlation header | Truyền ngữ cảnh qua HTTP/RabbitMQ. |
| Contract Documentation Pattern | Đã dùng | `docs/api/api-spec-*.md`, Swagger/Scalar | API contract được ghi lại cho frontend/tester. |

## 19.4. Data Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| Database per Service | Đã dùng | Prisma schema và PostgreSQL riêng từng service | Mỗi service sở hữu dữ liệu của mình. |
| Polyglot Persistence | Đã dùng | PostgreSQL, Redis, RabbitMQ, Consul, Elasticsearch, Prometheus, object storage | Chọn storage theo mục đích thay vì một DB cho mọi thứ. |
| Eventual Consistency | Đã dùng | identity-user sync, license read model, analytics projection | Chấp nhận dữ liệu đồng bộ trễ qua event. |
| Read Model / Projection | Đã dùng | `analytics-service`, `student_license_profiles` trong `course-service` | Tạo bảng đọc tối ưu từ event/dữ liệu nghiệp vụ. |
| CQRS | Đã dùng một phần | analytics read model, command/use case tách query/use case | Tách hướng đọc và ghi ở một số flow, chưa CQRS toàn hệ thống. |
| Cache-Aside | Đã dùng | `RedisCourseCacheService`, `ProgressCacheService` | Đọc cache trước, miss thì đọc DB rồi ghi cache. |
| Token Blacklist | Đã dùng | `identity-service`, Redis blacklist | Thu hồi token sau logout/session revoke. |
| Outbox Pattern | Đã dùng một phần | `OutboxMessage` trong `user-service`, `course-service`, `exam-service` | Ghi event/audit message cùng transaction rồi relay ra RabbitMQ. |
| Audit Log Pattern | Đã dùng | `audit-service`, event `security.audit.recorded` | Ghi vết hành động bảo mật/nghiệp vụ quan trọng. |
| Migration Runner Pattern | Đã dùng | `Dockerfile.migration-runner`, Helm migration Job | Tách chạy migration khỏi application runtime container. |
| Seed Data Pattern | Đã dùng | `scripts/prisma-seed-all.ts`, `apps/*/prisma/seed.ts` | Tạo dữ liệu demo/test nhất quán. |

## 19.5. Resilience Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| Timeout Pattern | Đã dùng | `resilient-http-client.ts`, smoke scripts | Tránh request treo vô hạn khi dependency chậm. |
| Retry Pattern | Đã dùng | HTTP resilience, RabbitMQ retry queues, notification retry | Thử lại lỗi tạm thời có giới hạn. |
| Exponential Backoff | Đã dùng cho HTTP | `retryBackoffFactor` trong resilient HTTP client | Giảm áp lực khi retry. |
| Circuit Breaker | Đã dùng | `resilient-http-client.ts` | Ngắt tạm dependency lỗi liên tiếp để bảo vệ service. |
| Dead Letter Queue | Đã dùng | `rabbitmq-resilience.ts` | Đưa message lỗi quá số lần retry vào DLQ. |
| Idempotent Consumer | Đã dùng một phần | memory TTL trong RabbitMQ retry interceptor | Bỏ qua message trùng trong một khoảng thời gian. |
| Manual Ack | Đã dùng | RabbitMQ `noAck: false`, interceptor ack sau xử lý | Chỉ xác nhận message khi xử lý thành công/retry xong. |
| Health Check Pattern | Đã dùng | `/health`, `/health/live`, `/health/ready` | Kiểm tra service sống/sẵn sàng. |
| Graceful Degradation / Fallback | Đã dùng một phần | Redis cache fallback DB, notification retry/pending | Service vẫn hoạt động giảm cấp khi dependency phụ lỗi. |
| Rate Limiting | Đã dùng một phần | Kong plugin `rate-limiting` | Giới hạn request để bảo vệ gateway/service. |
| Bulkhead | Chưa rõ/chưa chuẩn hóa | Có thể bổ sung | Giới hạn concurrency theo dependency để tránh lan truyền lỗi. |

## 19.6. Security Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| OAuth2/OIDC Identity Provider | Đã dùng | Keycloak | Ủy quyền/xác thực tập trung. |
| JWT Bearer Token | Đã dùng | protected API, `Authorization: Bearer` | Xác thực request stateless. |
| RBAC | Đã dùng | `@Roles`, realm roles Keycloak | Phân quyền theo vai trò. |
| Session Revocation | Đã dùng | logout + Redis blacklist | Thu hồi token sau đăng xuất. |
| Centralized Identity Management | Đã dùng | Keycloak realm/users/roles | Quản lý user/role tập trung thay vì tự lưu password trong từng service. |
| Secret Externalization | Đã dùng một phần | `.env.example`, deploy env, Kubernetes Secret | Không hardcode secret vào code/config public. |
| Security Audit Trail | Đã dùng | `audit-service`, audit outbox | Lưu vết hành động nhạy cảm. |
| Principle of Least Privilege | Đã dùng một phần | role guard, service boundary | Mỗi role/service chỉ có quyền cần thiết, còn có thể harden thêm ở DB/network. |

## 19.7. Observability Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| Structured Logging | Đã dùng | common logger/Winston, ELK | Log có service/context/correlationId để tìm lỗi. |
| Centralized Logging | Đã dùng | Elasticsearch, Logstash, Kibana | Gom log nhiều service về một nơi. |
| Metrics Endpoint Pattern | Đã dùng | `/metrics`, `MetricsModule` | Expose metrics cho Prometheus scrape. |
| RED Metrics | Đã dùng một phần | HTTP request count/latency/status | Theo dõi rate, errors, duration. |
| Business Metrics | Đã dùng | users/exams/courses/notifications/media metrics | Theo dõi chỉ số nghiệp vụ, không chỉ hạ tầng. |
| Distributed Tracing | Đã dùng | OpenTelemetry, Jaeger, Kong Zipkin | Xem request đi qua gateway/service/message như thế nào. |
| Alerting Pattern | Đã dùng | Prometheus rules, Alertmanager | Cảnh báo khi service down, 5xx cao, latency cao, DLQ tăng. |
| Runbook Pattern | Đã dùng | `docs/devops/*runbook*`, incident docs | Có hướng dẫn vận hành/xử lý sự cố. |

## 19.8. DevOps, Deployment và Testing Patterns

| Pattern | Trạng thái | Đã dùng ở đâu | Ý nghĩa trong đồ án |
| --- | --- | --- | --- |
| CI/CD Pipeline | Đã dùng | GitHub Actions, Jenkins | Tự động lint/test/build/scan/deploy. |
| Immutable Image Tag | Đã dùng | GHCR tag theo SHA trong workflow | Deploy đúng artifact đã build/test. |
| Rolling Update | Đã dùng | Kubernetes Deployment/Helm mặc định | Cập nhật service từng pod, giảm downtime. |
| Rollback Pattern | Đã dùng | `rollback-release.yml`, Helm revision | Quay lại release trước khi deploy lỗi. |
| Infrastructure as Code | Đã dùng một phần | Helm, Terraform baseline, Compose | Hạ tầng được mô tả bằng code/config. |
| Configuration as Code | Đã dùng | Kong DB-less YAML, Consul seed, Helm values | Config có version trong repo. |
| DevSecOps Pipeline | Đã dùng một phần | Trivy, SBOM, Cosign baseline | Kiểm tra bảo mật image và supply chain. |
| DORA Metrics Pattern | Đã dùng | DORA report/export/dashboard | Đo hiệu quả delivery: frequency, lead time, MTTR, CFR. |
| Test Pyramid / Multi-level Testing | Đã dùng | unit, service E2E, integration, smoke, k6 | Kiểm thử nhiều tầng từ domain đến hệ thống. |
| Smoke Test Pattern | Đã dùng | `scripts/smoke.ts`, `k8s-smoke.sh` | Kiểm tra nhanh hệ thống sau deploy. |
| Performance Testing Pattern | Đã dùng | `load-tests/scenarios/load.js`, `stress.js`, `spike.js` | Đo tải thường, tải cao, tải đột biến. |
| Restore Rehearsal Pattern | Đã dùng | `scripts/db-restore-test.ts` | Kiểm tra backup có khôi phục được thật không. |

## 19.9. Các pattern đã dùng một phần và nên gọi đúng trong báo cáo

Các pattern dưới đây có xuất hiện trong đồ án, nhưng nên trình bày là "đã triển khai một phần" hoặc "baseline" để chính xác:

| Pattern | Vì sao chỉ nên ghi một phần |
| --- | --- |
| Saga Pattern | Hiện chủ yếu là choreography qua event, chưa có saga state table/orchestrator/compensation đầy đủ. |
| Outbox Pattern | Đã có cho audit ở một số service, chưa áp dụng cho mọi domain event quan trọng. |
| CQRS | Đã có read model/projection ở analytics/course, chưa tách command/query model toàn hệ thống. |
| Idempotent Consumer | Đã có memory TTL, chưa bền qua restart hoặc nhiều replica. |
| Rate Limiting | Đã có Kong local rate limit, chưa theo user/route/role và chưa Redis-backed. |
| IaC | Đã có Helm/Compose/Terraform baseline, chưa full cloud infra production. |
| DevSecOps | Đã có scan/SBOM/signing baseline, chưa có admission policy bắt buộc verify image signature. |

---

# 20. Kết luận

Repo hiện tại đã vượt mức "microservices demo cơ bản": hệ thống đã có tách service theo domain, DDD/Clean Architecture, database per service, gateway, auth, messaging, observability, resilience, CI/CD, Kubernetes/Helm, backup và testing khá đầy đủ.

Các điểm nên nâng cấp tiếp không nằm ở việc "có microservices hay chưa", mà nằm ở production-hardening:

- Chuẩn hóa contract/version cho API và event.
- Làm bền idempotency/outbox/inbox.
- Hoàn thiện saga cho flow phân tán.
- Thêm secret manager và policy bảo mật runtime.
- Tăng mức tự động hóa kiểm thử contract, security, performance.
- Hoàn thiện SLO/observability và progressive delivery.

Nếu dùng cho báo cáo môn học, có thể trình bày theo hướng: hệ thống đã triển khai đầy đủ nền tảng microservices thực tế, đồng thời vẫn có roadmap nâng cấp rõ ràng để tiến tới production-grade architecture.
