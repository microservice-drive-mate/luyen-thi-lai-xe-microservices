# Hướng Dẫn Phát Triển Chi Tiết

Tài liệu này là checklist bắt buộc khi code trong repo `luyen-thi-lai-xe-microservices`. Mục tiêu là giúp dev/AI agent đọc đúng ngữ cảnh, sửa đúng kiến trúc, cập nhật đúng tài liệu, và không làm lệch API contract so với code.

Nguồn tài liệu chính của repo là `docs/`. Các tài liệu service ngắn trước đây đã được thay bằng API spec chi tiết trong `docs/api/`.

## 1. Đọc Gì Trước Khi Code

Trước khi sửa bất kỳ service nào, đọc theo thứ tự này:

1. [README root](../README.md): cách chạy repo, service list, port, script, gateway.
2. [Docs Index](./README.md): mục lục tài liệu chính.
3. [DDD + Clean Architecture](./architecture/clean-ddd-conventions.md): quy tắc kiến trúc, template code, database convention.
4. API spec của service cần sửa trong `docs/api/api-spec-<service>.md`.
5. File flow liên quan nếu có:
   - [Kong + Frontend Integration](./api/kong-frontend-integration.md)
   - [Identity And User Flow](./api/identity-user-flow.md)
   - [Media Service Flow](./api/media-service-flow.md)
   - [Scalar API Reference Guide](./api/scalar-api-reference-guide.md)
6. Nếu thay đổi config/hạ tầng:
   - [Consul Workflow](./devops/consul-workflow.md)
   - [System Resilience Guide](./devops/system-resilience-guide.md)
   - [Observability Runbook](./devops/observability-runbook.md)
7. Nếu thay đổi test/demo:
   - [Services Test Guide](./testing/services-test-guide.md)
   - [Requirements Traceability Matrix](./testing/requirements-traceability-matrix.md)
   - [ASR Testing Guide](./testing/asr-testing-guide.md)

Không bắt đầu implement endpoint hoặc sửa behavior public khi chưa đọc API spec hiện tại và controller/use case liên quan.

## 2. Nguồn Sự Thật Của Tài Liệu

Ưu tiên nguồn sự thật như sau:

| Nội dung                                                             | Nguồn chính                                  |
| -------------------------------------------------------------------- | -------------------------------------------- |
| Cách chạy repo, port, script                                         | `README.md`                                  |
| Endpoint, request, response, auth, error code, event contract public | `docs/api/api-spec-<service>.md`             |
| Gateway, frontend base URL, CORS, token flow                         | `docs/api/kong-frontend-integration.md`      |
| Luồng identity-user                                                  | `docs/api/identity-user-flow.md`             |
| Luồng media/upload/file lifecycle                                    | `docs/api/media-service-flow.md`             |
| DDD/Clean Architecture, layer boundary                               | `docs/architecture/clean-ddd-conventions.md` |
| Config Consul/env                                                    | `docs/devops/consul-workflow.md`             |
| Docker/Kong/Kubernetes/GCP/CI/CD/observability                       | `docs/devops/*.md`                           |
| Test scenario, traceability, demo                                    | `docs/testing/*.md`                          |
| Requirement/SRS/ASR                                                  | `docs/requirements/*.md`                     |

`docs/api` là nơi chính để mô tả service API. Không tạo lại các file service summary ngắn riêng nếu nội dung đã có trong API spec.

## 3. Khi Code Thì Phải Cập Nhật Doc Nào

### 3.1. Thay đổi endpoint HTTP

Cập nhật bắt buộc:

- `docs/api/api-spec-<service>.md`
- Swagger decorators trong DTO/controller nếu request/response đổi
- [Kong + Frontend Integration](./api/kong-frontend-integration.md) nếu route public qua Kong đổi
- [Scalar API Reference Guide](./api/scalar-api-reference-guide.md) nếu cách expose Swagger/docs đổi
- `scripts/smoke.ts` nếu endpoint nằm trong smoke test hoặc health/gateway contract
- `docs/testing/services-test-guide.md` nếu flow test/manual test đổi

Trong API spec phải ghi rõ:

- Base URL qua Kong
- Direct local URL
- Swagger URL local và qua Kong
- Method + path
- Auth/role
- Request body/query/path params
- Validation rule quan trọng
- Response success
- Error code có thể gặp
- Side effect/event/outbox nếu có
- Ghi chú frontend nếu endpoint dễ bị dùng sai

### 3.2. Thay đổi DTO/request/response

Cập nhật bắt buộc:

- DTO class trong code
- Swagger decorators (`@ApiProperty`, `@ApiPropertyOptional`, enum, example)
- `docs/api/api-spec-<service>.md`
- Frontend flow docs nếu field đó được frontend dùng trực tiếp
- Test controller/use case liên quan

Nếu đổi tên field hoặc enum value, phải tìm toàn repo:

```powershell
rg "oldFieldName|OldEnumValue"
```

và cập nhật seed, tests, docs, event payload nếu liên quan.

### 3.3. Thay đổi auth, role, JWT, Keycloak

Cập nhật bắt buộc:

- `docs/api/api-spec-identity.md` nếu thuộc identity-service
- API spec của service bị ảnh hưởng
- [Kong + Frontend Integration](./api/kong-frontend-integration.md)
- [Identity And User Flow](./api/identity-user-flow.md)
- `docker/keycloak/realm-export.json` nếu realm/client/role đổi
- `.env.example`, `consul-seed-*.json`, `docker/consul/init.sh` nếu config auth đổi
- Test auth/RBAC

Ghi rõ:

- Endpoint public hay cần JWT
- Role nào được gọi
- Service đọc user từ đâu (`JWT.sub`, `@AuthenticatedUser()`, header debug, service token)
- Frontend có cần refresh/logout hay xử lý `401/403` khác không

### 3.4. Thay đổi event RabbitMQ hoặc outbox

Cập nhật bắt buộc:

- API spec của service publish event
- API spec của service consume event nếu behavior public/read model đổi
- `docs/testing/services-test-guide.md` nếu có flow kiểm thử event
- [System Resilience Guide](./devops/system-resilience-guide.md) nếu đổi retry/ack/nack/durable queue
- [DevOps Status Report](./devops/devops-status-report.md) nếu thay đổi lớn về event-driven baseline

Event contract trong docs phải có:

- `eventName`
- Producer service
- Consumer service
- Queue/exchange nếu public trong repo
- Payload example
- Idempotency rule
- Retry/failure behavior nếu có
- Outbox/inbox behavior nếu có

### 3.5. Thay đổi Prisma schema hoặc migration

Cập nhật bắt buộc:

- API spec nếu model field ảnh hưởng response/filter/query
- `docs/architecture/clean-ddd-conventions.md` nếu đổi convention database
- `docs/testing/services-test-guide.md` nếu cần test data mới
- Seed scripts nếu demo data phụ thuộc field mới
- README nếu thay đổi cách migrate/seed

Luôn kiểm tra:

```powershell
pnpm run db:generate
pnpm --dir apps/<service> run check-types
```

Nếu thay đổi migration nhiều service:

```powershell
pnpm run db:deploy
pnpm run db:seed
```

### 3.6. Thay đổi Consul/env/config

Cập nhật bắt buộc:

- [Consul Workflow](./devops/consul-workflow.md)
- `.env.example`
- `.env.vps.example` nếu deploy/VPS cần config
- `deploy/*.env.example` nếu staging/production cần config
- `consul-seed-development-local.json`
- `consul-seed-development.json`
- `consul-seed-staging.json`
- `consul-seed-production.json`
- `docker/consul/init.sh` nếu Docker init cần seed config
- `charts/luyen-thi-lai-xe/values*.yaml` nếu Kubernetes cần config

Trong docs phải ghi:

- Tên key Consul
- Env var fallback
- Default value nếu có
- Môi trường áp dụng
- Có phải secret không
- Cách verify config đã load đúng

### 3.7. Thay đổi Docker, Kong, Helm, CI/CD, DevOps

Cập nhật theo phạm vi:

- Kong route/CORS/rate-limit: [Kong + Frontend Integration](./api/kong-frontend-integration.md)
- Docker Compose/local infra: `README.md`, [Consul Workflow](./devops/consul-workflow.md), DevOps docs liên quan
- Observability/logging/metrics/tracing: [ELK Logging Guide](./devops/elk-logging-guide.md), [Observability Runbook](./devops/observability-runbook.md), [OpenTelemetry Jaeger Tracing](./devops/opentelemetry-jaeger-tracing.md)
- Backup/restore: [Backup Strategy](./devops/backup-strategy.md)
- GCP/GKE/Helm: [GCP Setup](./devops/gcp-setup.md), [Kubernetes GCP Deployment](./devops/kubernetes-gcp-deployment.md)
- GitHub Actions/release: [GitHub Actions Release Safety](./devops/github-actions-release-safety.md)
- Jenkins: [Jenkins + Docker Compose](./devops/jenkins-docker-compose.md)
- DORA/deployment events: [DORA Metrics Guide](./devops/dora-metrics-guide.md), [Deployment Event Store](./devops/deployment-event-store.md)

Không sửa hạ tầng mà bỏ qua docs. Hạ tầng sai docs là lỗi rất tốn thời gian debug.

### 3.8. Thay đổi requirement/use case

Cập nhật bắt buộc:

- `docs/requirements/srs-document.md`
- `docs/requirements/use-case-implementation-summary.md`
- `docs/requirements/srs-asr-mapping-summary.md` nếu ảnh hưởng ASR/kiến trúc
- `docs/testing/requirements-traceability-matrix.md`
- `docs/testing/test-summary-report.md` nếu test coverage thay đổi

Nếu chỉ sửa bug không đổi requirement, ghi chú trong PR là không cần cập nhật SRS/RTM.

## 4. Quy Tắc Kiến Trúc Khi Code

Repo dùng DDD + Clean Architecture. Hướng phụ thuộc:

```text
domain -> application -> infrastructure/presentation
```

Diễn giải cụ thể:

- `domain/`: aggregate, entity, value object, domain event, domain exception, repository interface nếu repo đang đặt ở domain.
- `application/`: use case, command/query, result, port interface, orchestration nghiệp vụ.
- `infrastructure/`: Prisma repository, mapper DB, RabbitMQ publisher/consumer adapter, HTTP client, cache, external service client, outbox relay.
- `presentation/`: HTTP controller, DTO, auth guard decorator usage, messaging controller.
- `app.module.ts`: wiring module/provider.
- `main.ts`: bootstrap HTTP, global pipe/filter/interceptor, Swagger.

Không được:

- Import `@nestjs/*` vào domain.
- Import Prisma client vào domain/application.
- Đưa business rule vào controller.
- Đưa business rule vào Prisma repository.
- Tạo foreign key chéo service.
- Gọi service khác trực tiếp từ domain.
- Hardcode URL/secret/config trong code.

Được phép:

- Use case gọi repository/port.
- Infrastructure implement port.
- Controller map DTO sang command/query.
- Mapper chuyển Prisma model sang aggregate/result.
- Application publish event qua event publisher port sau khi save thành công.

## 5. Quy Tắc Domain

Aggregate/entity/value object phải giữ invariant nghiệp vụ. Ví dụ:

- Không cho enroll nếu course inactive.
- Không cho submit exam session đã completed.
- Không cho assign license tier cho user không phải `STUDENT`.
- Không cho delete hard course khi đang có enrollment.

Domain nên có method rõ nghĩa:

```ts
course.activate();
session.submit(answers, submittedAt);
profile.assignLicenseTier(tier, changedById);
```

Tránh kiểu:

```ts
profile.role = "STUDENT";
profile.studentDetail = {};
```

ID nên tạo ở application layer để domain dễ test:

```ts
const profile = UserProfile.create({
  id: crypto.randomUUID(),
  email: command.email,
});
```

Nếu object load từ DB, dùng `reconstitute()` để không phát event tạo mới.

## 6. Quy Tắc Use Case

Use case là nơi điều phối nghiệp vụ:

1. Nhận command/query.
2. Validate điều kiện ngoài domain nếu cần.
3. Load aggregate/read model qua repository/port.
4. Gọi method domain.
5. Save aggregate.
6. Publish event/outbox nếu có.
7. Trả result.

Use case không nên:

- Nhận trực tiếp Express `Request`.
- Trả trực tiếp DTO HTTP nếu có result riêng.
- Biết chi tiết Prisma query phức tạp.
- Tự parse JWT.
- Tự gọi `res.status()`.

Controller chịu trách nhiệm lấy auth context/request context rồi truyền command/query rõ ràng.

## 7. Quy Tắc Controller Và DTO

Controller nên mỏng:

```ts
@Patch(':id/license-tier')
async assignLicenseTier(
  @Param('id') id: string,
  @Body() body: AssignLicenseTierRequestDto,
  @AuthenticatedUser() user: AuthenticatedUser,
) {
  const result = await this.useCase.execute(
    new AssignLicenseTierCommand(id, body.licenseTier, user.sub),
  );
  return UserProfileResponseDto.fromResult(result);
}
```

DTO request phải có:

- `class-validator`
- `class-transformer` nếu cần convert date/number/boolean
- Swagger decorators
- Example thực tế
- Enum rõ ràng nếu field là enum

DTO response phải mô tả shape frontend nhận được. Không trả anonymous object phức tạp nếu API public.

## 8. Prisma Và Database

Mỗi service có database/schema riêng. Không tạo foreign key chéo service.

Checklist khi sửa Prisma:

1. Sửa `apps/<service>/prisma/schema.prisma`.
2. Tạo migration nếu đổi schema DB:

```powershell
pnpm run db:migrate
```

3. Generate client:

```powershell
pnpm run db:generate
```

4. Sửa mapper/repository.
5. Sửa seed nếu field bắt buộc mới.
6. Sửa API spec nếu response/filter/query đổi.
7. Chạy typecheck service:

```powershell
pnpm --dir apps/<service> run check-types
```

Khi thêm index vì performance, ghi lý do trong migration hoặc docs liên quan nếu nó phục vụ ASR/performance.

## 9. Consul, Env Và Secret

Độ ưu tiên config:

```text
env var -> Consul -> default
```

Không hardcode secret trong:

- source code
- docs
- Dockerfile
- docker-compose
- Helm values thật
- Keycloak realm export

Chỉ dùng placeholder như `change-me`, `<secret>`, hoặc local dummy password.

Khi thêm config, phải trả lời được:

- Service nào đọc config?
- Key Consul là gì?
- Env var fallback là gì?
- Có default không?
- Local/dev/staging/production lấy giá trị từ đâu?
- Có cần cập nhật `.env.example` không?
- Có cần cập nhật Helm/Compose không?

## 10. Kong, Frontend Và Auth

Frontend gọi qua:

```text
http://localhost:8000
```

Không gọi trực tiếp service port trong flow bình thường.

Khi thêm route mới:

1. Kiểm tra controller path.
2. Kiểm tra route trong `kong/kong.dev.yaml`.
3. Kiểm tra route trong `kong/kong.yaml`.
4. Cập nhật [Kong + Frontend Integration](./api/kong-frontend-integration.md) nếu route frontend dùng.
5. Cập nhật API spec service.
6. Test qua Kong, không chỉ test direct local.

Auth rule:

- Public endpoint phải có `@Public()` rõ ràng.
- Protected endpoint phải có role/JWT rule rõ.
- Admin endpoint phải đặt dưới `/admin/...` nếu là API quản trị.
- Frontend gửi `Authorization: Bearer <access_token>`.
- Không yêu cầu frontend tự gửi `x-user-id`.

## 11. RabbitMQ, Event Và Outbox

Khi publish event:

- Event name ổn định, ví dụ `identity.user.created`.
- Payload có schema rõ.
- Producer không publish trước khi DB save thành công.
- Nếu dùng outbox, event nằm cùng transaction với thay đổi DB.
- Consumer xử lý idempotent nếu event có thể bị nhận lại.

Khi consume event:

- Log đủ `eventName`, `correlationId` nếu có.
- Ack khi xử lý thành công.
- Nack/retry theo rule rõ ràng khi fail.
- Không crash service vì một event dữ liệu lỗi nếu có thể xử lý an toàn.

Docs API spec phải ghi cả events consumed/published nếu event ảnh hưởng behavior public hoặc read model.

## 12. Response, Error Và Logging

Response HTTP dùng shared envelope:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-06-09T00:00:00.000Z",
  "path": "/users/me",
  "data": {}
}
```

Lỗi nên có code ổn định:

```json
{
  "success": false,
  "code": "USER_PROFILE_NOT_FOUND",
  "message": "User profile not found",
  "timestamp": "2026-06-09T00:00:00.000Z",
  "path": "/admin/users/:id"
}
```

Không để frontend phụ thuộc vào message tiếng Việt/tiếng Anh. Frontend nên map theo `code`.

Với lỗi nghiệp vụ/domain, tạo class riêng kế thừa `DomainException` trong `domain/exceptions` và map HTTP status trong `infrastructure/filters/domain-exception.filter.ts`. Use case/domain không throw trực tiếp `BadRequestException`, `NotFoundException`, `ConflictException`... của NestJS; các exception Nest chỉ nên dùng ở presentation/infrastructure cho lỗi framework, auth, hoặc transport-specific.

Khi thêm/sửa domain exception:

- Đặt `code` ổn định, viết hoa snake case, ví dụ `COURSE_NOT_FOUND`.
- Register status tương ứng trong `DomainExceptionFilter`.
- Cập nhật `docs/api/api-spec-<service>.md` phần `Error Codes` và `Common errors`.
- Thêm/sửa test use case hoặc aggregate cho nhánh lỗi đó.

Log không được chứa:

- password
- access token
- refresh token
- SMTP password
- storage account key
- database URL có password
- Keycloak client secret

## 13. API Docs Phải Đúng Với Code Như Thế Nào

Khi cập nhật `docs/api/api-spec-<service>.md`, phải đối chiếu tối thiểu:

- Controller path trong `apps/<service>/src/presentation/http/*.controller.ts`
- Method decorators: `@Get`, `@Post`, `@Patch`, `@Delete`
- DTO request trong `presentation/dtos`
- Response DTO/result mapper
- Domain exception filter/error code
- Role decorators/guards
- Kong route trong `kong/kong.dev.yaml` và `kong/kong.yaml`
- Service port trong compose/local config
- Event publisher/consumer nếu endpoint có side effect

Gợi ý lệnh rà endpoint:

```powershell
rg -n "@(Controller|Get|Post|Patch|Put|Delete)\\(" apps/<service>/src -g "*.controller.ts"
```

Gợi ý lệnh rà DTO:

```powershell
rg -n "class .*Dto|@ApiProperty|@Is|@Validate" apps/<service>/src/presentation/dtos
```

Gợi ý lệnh rà event:

```powershell
rg -n "eventName|emit|publish|MessagePattern|EventPattern|queue" apps/<service>/src
```

Không viết API spec theo trí nhớ. Luôn đọc code trước.

## 14. DevOps Docs Có Cần Cập Nhật Không

Có, nếu thay đổi chạm vào vận hành. Bảng nhanh:

| Thay đổi                                   | Tài liệu cần cập nhật                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Thêm/sửa config key                        | `docs/devops/consul-workflow.md`                                                        |
| Đổi Docker Compose service/env/port/volume | `README.md`, tài liệu DevOps liên quan                                                  |
| Đổi Kong route/plugin/CORS/rate limit      | `docs/api/kong-frontend-integration.md`                                                 |
| Đổi health/metrics                         | `docs/api/api-spec-health-metrics.md`, `docs/devops/observability-runbook.md`           |
| Đổi logging/ELK                            | `docs/devops/elk-logging-guide.md`                                                      |
| Đổi tracing                                | `docs/devops/opentelemetry-jaeger-tracing.md`                                           |
| Đổi backup/restore                         | `docs/devops/backup-strategy.md`                                                        |
| Đổi Helm/GCP                               | `docs/devops/kubernetes-gcp-deployment.md`, `docs/devops/gcp-setup.md`                  |
| Đổi CI/CD/release                          | `docs/devops/github-actions-release-safety.md`, `docs/devops/jenkins-docker-compose.md` |
| Đổi DORA/deployment event                  | `docs/devops/dora-metrics-guide.md`, `docs/devops/deployment-event-store.md`            |
| Đổi incident/runbook                       | `docs/devops/incident-management-process.md`, `docs/devops/observability-runbook.md`    |

DevOps docs phải ghi được cách verify, không chỉ mô tả ý tưởng.

## 15. Test Và Quality Gate

Chọn check theo phạm vi thay đổi.

Thay đổi một service:

```powershell
pnpm --dir apps/<service> run check-types
pnpm --dir apps/<service> run build
```

Thay đổi shared package:

```powershell
pnpm --dir packages/common run build
pnpm run check-types
pnpm run build
```

Thay đổi Prisma:

```powershell
pnpm run db:generate
pnpm run db:deploy
pnpm run db:seed
```

Thay đổi gateway/health/API integration:

```powershell
pnpm run smoke
```

Thay đổi observability/RabbitMQ:

```powershell
pnpm run observability:smoke
pnpm run rabbitmq:smoke
```

## 16. Checklist Trước Khi Kết Thúc Task

Trước khi báo xong, tự kiểm tra:

- Đã đọc API spec và architecture docs liên quan chưa?
- Code có giữ đúng layer boundary không?
- Endpoint mới có Swagger decorators chưa?
- API spec có đúng controller/DTO/response hiện tại không?
- Kong route có cần cập nhật không?
- Frontend flow docs có cần cập nhật không?
- Config mới có đủ env/Consul/Compose/Helm docs chưa?
- Event mới có producer/consumer contract trong docs chưa?
- Prisma schema đổi có migration/generate/seed docs chưa?
- Test guide/RTM/SRS có cần cập nhật không?
- README có cần cập nhật cách chạy/port/script không?
- Đã chạy check hẹp nhất có ích chưa?

Nếu câu trả lời là “có thể có” cho docs nào, hãy cập nhật docs đó ngay trong cùng thay đổi. Docs không phải phần phụ; docs là contract để frontend, tester và người deploy không phải đoán.
