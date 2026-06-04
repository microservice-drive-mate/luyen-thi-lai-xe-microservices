# Hướng dẫn Phát triển (Development Guidelines)

Cập nhật lần cuối: 2026-06-04

## Quy tắc Kiến trúc (Architecture Rules)

Sử dụng DDD + Clean Architecture một cách nhất quán:

```text
domain -> chỉ chứa các domain primitives
application -> domain, use cases, ports
infrastructure -> application + domain + chi tiết framework/db/messaging
presentation -> controllers, DTOs, messaging handlers
```

Tuyệt đối không import những thứ sau vào `domain/`:

- `@nestjs/*`
- `@prisma/*`
- RabbitMQ clients
- Keycloak clients
- Các API của HTTP framework

Các quy tắc nghiệp vụ (business rules) thuộc về các aggregates/entities/value objects, không phải repositories, mappers, controllers, hoặc Prisma services.

## Quy tắc về UUID

Tạo UUID ở layer application, sau đó truyền chúng vào các domain factories hoặc domain methods.

Tốt:

```ts
const course = Course.create({
  id: crypto.randomUUID(),
  title: command.title,
  instructors: command.instructorIds.map((instructorId) => ({
    id: crypto.randomUUID(),
    instructorId,
  })),
});
```

Tránh:

```ts
static create(props: CreateCourseProps): Course {
  return new Course(crypto.randomUUID(), props.title);
}
```

Điều này giữ cho hành vi của domain có tính xác định (deterministic) và dễ test.

## Aggregate Factory Pattern

Sử dụng:

- `static create()` cho các aggregates/entities mới
- `static reconstitute()` cho các đối tượng được load từ DB
- Các private aggregate constructors khi có thể
- Các getters bất biến/copy cho các mảng nội bộ

Ví dụ:

```ts
static create(props: CreateExamSessionProps): ExamSession {
  return new ExamSession(props.id, props.studentId, ...);
}

static reconstitute(props: ReconstituteExamSessionProps): ExamSession {
  return new ExamSession(props.id, props.studentId, ...);
}
```

## Quy tắc Use Case

Các Use cases nên:

- Xác thực sự tồn tại từ bên ngoài thông qua repositories/ports
- Tạo ID cho các aggregate roots mới và child entities
- Gọi các hành vi của domain
- Lưu trạng thái aggregate trước khi publish các domain events
- Xoá các domain events sau khi publish
- Trả về các lớp result hoặc các đối tượng result sẵn sàng cho DTO

Thứ tự event:

```ts
aggregate.doSomething();
await repository.save(aggregate);
const events = aggregate.getDomainEvents();
aggregate.clearDomainEvents();
await eventPublisher.publishAll(events);
```

Mỗi use case nên có một folder riêng theo action:

```text
application/use-cases/
  create-user-profile/
    create-user-profile.command.ts
    create-user-profile.use-case.ts
  get-user-profile/
    get-user-profile.query.ts
    get-user-profile.result.ts
    get-user-profile.use-case.ts
```

Đặt các coordinator/helper services ngoài `use-cases`, ví dụ trong `application/services`, trừ khi chúng đại diện cho một application action có boundary `execute()` rõ ràng.

## Khai báo Module (Module Wiring)

Ưu tiên cấu trúc sau:

```text
src/
  app.module.ts       # cấu hình gốc + cross-cutting modules
  <service>.module.ts # controllers/providers của bounded-context
```

Root module quản lý:

- `ConfigModule`
- Cấu hình schema Consul
- health và metrics
- logger
- Keycloak/các global guards (nếu có)
- module chia sẻ token blacklist

Feature module quản lý:

- controllers
- repositories
- use cases
- infrastructure adapters
- RabbitMQ publisher clients

## Quy tắc Bootstrap

Không vô hiệu hóa (suppress) các quy tắc lint không an toàn trên toàn bộ file `main.ts`.

Khi đăng ký các instances Nest middleware thông qua Express, hãy sử dụng các typed wrappers:

```ts
const tracingMiddleware = new TracingMiddleware(serviceName);
app.use((request: Request, response: Response, next: NextFunction) =>
  tracingMiddleware.use(request, response, next),
);
```

Giữ cho cài đặt HTTP toàn cục (global) nhất quán:

- CORS
- validation pipe
- correlation/tracing/access-log interceptors
- `ApiResponseInterceptor`
- `ApiExceptionFilter`
- service domain exception filter (nếu có)
- `setupMicroserviceSwagger`

## Quy tắc Prisma

Mỗi Prisma service phải sử dụng client package được tạo riêng của nó:

- `@prisma/identity-client`
- `@prisma/user-client`
- `@prisma/course-client`
- `@prisma/question-client`
- `@prisma/exam-client`
- `@prisma/media-client`

Không import `@prisma/client` trong code runtime của service.

Không tạo khóa ngoại (foreign keys) chéo giữa các service. Chỉ lưu UUID references.

Chạy generation/typecheck cấp độ service sau khi thay đổi Prisma hoặc repository:

```bash
npm --workspace=apps/<service> run check-types
```

## Consul và Secrets

Độ ưu tiên cấu hình là:

```text
biến môi trường (env vars) -> Consul -> defaults
```

Khi thêm config:

- Thêm env fallback trong `ConsulConfigFactory`
- Seed Docker values trong `docker/consul/init.sh`
- Cập nhật các seed files cho local/staging/production nếu cần
- Không bao giờ commit real secrets

Chỉ sử dụng `.env.example` làm placeholders.

## API Docs

Mọi service đều expose `/docs-json` qua `setupMicroserviceSwagger`.

`docs-service` tập trung (centralizes) việc duyệt:

- `/` trang đích (landing page)
- `/docs` trang reference Scalar mặc định
- `/docs/scalar/:serviceName` trang reference Scalar cho từng service theo tên
- `/docs-proxy` OpenAPI proxy được cho phép (allowlisted)

Khi thay đổi hành vi public:

- Cập nhật DTO Swagger decorators nếu cấu trúc request/response thay đổi
- Cập nhật `guides/api/api-spec-<service>.md`
- Cập nhật hướng dẫn test tương ứng
- Xác minh `docs-service` vẫn có thể fetch được `/docs-json` của service

## HTTP và DTO

Các Controllers nên:

- Nhận request DTO classes
- Trả về response DTO classes
- Chỉ gọi đến use cases
- Tránh việc trả về các kiểu đối tượng ẩn danh
- Tránh import các infrastructure adapters

Các DTOs nên:

- Sử dụng `class-validator`
- Sử dụng `@ApiProperty` / `@ApiPropertyOptional`
- Cung cấp `static fromResult()` khi việc mapping phức tạp (non-trivial)

## Hướng dẫn Testing

Sử dụng cách check nhỏ nhất và nhanh nhất có ích trước:

```bash
npm --workspace=apps/<service> run check-types
npm --workspace=apps/<service> run build
```

Sau đó mở rộng khi thay đổi ảnh hưởng đến các shared packages hoặc nhiều services:

```bash
npm --workspace=packages/common run build
npx turbo run check-types
npx turbo run build
```

Chỉ sử dụng placeholder e2e specs khi suite test thực sự yêu cầu base hạ tầng tích hợp từ bên ngoài. Ưu tiên các tests smoke thực tế cho controllers có thể test với simulated (mocked) use cases.

## Checklist Tài liệu

Trước khi hoàn tất thay đổi, hãy cập nhật tài liệu nếu phù hợp:

- API spec cho các thay đổi về endpoint/DTO/behavior
- Hướng dẫn test cho các thay đổi workflow
- Consul workflow cho các thay đổi về config key
- README/change log cho các lần refactors lớn trên toàn kiến trúc

Viết tài liệu gần với những gì đã thay đổi và tránh việc mô tả hành vi mà code không cung cấp.
