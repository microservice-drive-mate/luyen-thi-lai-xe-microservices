# Tài liệu về các Thay đổi Refactor

Cập nhật lần cuối: 2026-06-04

## Tóm tắt

Lần refactor này thực hiện quá trình dọn dẹp Clean Architecture theo kế hoạch và migrate tài liệu API sang Scalar cho NestJS microservices monorepo.

Kết quả chính:

- Các Domain layer không còn tạo UUID bằng `crypto.randomUUID()` nữa.
- `identity-service` hiện có một `AppModule` gốc cộng thêm `IdentityModule` cho feature.
- Xóa bỏ các scaffold `getHello()` controllers/services không còn sử dụng của Nest.
- Các file cấu hình `main.ts` không còn dựa vào các suppressions ESLint không an toàn trên diện rộng.
- `docs-service` hiện phục vụ trang Scalar API Reference thay vì Swagger UI tập trung.
- Shared OpenAPI generation nay đã bổ sung thêm các common error responses, global bearer security metadata, và service `servers`.

## Chi tiết Refactor

### Tạo UUID

Việc tạo UUID đã được chuyển từ các domain objects sang các application use cases.

Các services đã thay đổi:

- `course-service`
- `exam-service`
- `question-service`
- `simulation-service`
- `user-service`

Các domain factories và methods nay sẽ nhận các UUID thông qua props hoặc parameters của method. Điều này giúp cho các aggregates/entities dễ đoán hơn (deterministic) và dễ viết unit test.

Ví dụ:

- `Course.create({ id, instructors, requirement, ... })`
- `CourseEnrollment.create({ id, courseId, studentId })`
- `Question.create({ id, options: [{ id, ... }], ... })`
- `ExamSession.create({ id, questions: [{ id, ... }], ... })`
- `Practice2dSession.create({ id, ... })`
- `UserProfile.create({ id, studentDetailId, ... })`

`media-service` đã sử dụng việc tạo UUID ở application layer từ trước và không bị thay đổi.

### Tách Module Identity (Identity Module Split)

Tệp `apps/identity-service/src/app.module.ts` giờ chỉ tập trung vào các kết nối mang tính tổng thể (cross-cutting):

- logger, health, metrics
- Cấu hình qua Consul
- Tích hợp Keycloak auth
- Module loại bỏ token (token blacklist module)
- Các global guards

Feature module mới:

- `apps/identity-service/src/identity.module.ts`

Nó chứa các kết nối bounded-context của identity:

- `AuthController`, `AdminController`
- Liên kết với Prisma repository
- Keycloak admin adapter
- RabbitMQ event/audit publishers
- Các identity use cases và ports

### Dọn dẹp Scaffold

Đã xóa các file scaffold không sử dụng từ các service nơi module không còn đăng ký chúng nữa:

- `app.controller.ts`
- `app.service.ts`
- Các phần kiểm tra scaffold cho `Hello World`

Các services bị ảnh hưởng:

- `user-service`
- `course-service`
- `exam-service`
- `question-service`
- `simulation-service`
- `analytics-service`

Các bài test scaffold e2e đã được thay thế bằng các placeholders cụ thể ở nơi nào hiện chưa có smoke e2e test dựa trên cơ sở hạ tầng tích hợp.

### Dọn dẹp Bootstrap

Các unsafe suppressions lớn trong file `main.ts` đã được gỡ bỏ khỏi:

- `identity-service`
- `course-service`
- `question-service`
- `exam-service`
- `notification-service`
- `simulation-service`
- `analytics-service`

Typed middleware wrapper tương tự cũng đã được áp dụng cho:

- `user-service`
- `media-service`
- `audit-service`
- `docs-service`

Pattern như sau:

```ts
const correlationIdMiddleware = new CorrelationIdMiddleware();
app.use((request: Request, response: Response, next: NextFunction) =>
  correlationIdMiddleware.use(request, response, next),
);
```

### Scalar API Docs

`docs-service` hiện đang sử dụng `@scalar/nestjs-api-reference`.

Các routes:

- `/` - trang đích (landing page) chứa các link service đang chạy
- `/docs` - trang Scalar reference mặc định, dùng service đang chạy đầu tiên
- `/docs/scalar/:serviceName` - Scalar reference cho một service nhất định
- `/docs-config` - config của Swagger UI mang tính tương thích ngược
- `/docs-services` - danh sách service hiện có dành cho các UI client
- `/docs-proxy?url=...` - OpenAPI proxy được phép truy cập
- `/docs-proxy?service=...` - OpenAPI proxy dựa theo service slug
- `/docs-json` - placeholder OpenAPI document

Hành vi tự động discovery (khám phá) các service tĩnh vẫn được giữ nguyên:

- Được cấu hình trong `swagger.services`
- Fallback khi sử dụng thư mục của Consul
- Các cổng dự phòng để phát triển local
- Probe kiểm tra "alive" trước khi listing services

### Shared OpenAPI Metadata

`packages/common/src/config/swagger.setup.ts` hiện tại được bổ sung cho các tài liệu OpenAPI generation với:

- `components.responses` cho các lỗi 400, 401, 403, 404, 500
- Các reference của error response dùng chung lên những operation nào mà chưa định nghĩa chúng
- Dữ liệu Bearer security global
- Các `servers` sinh ra từ `swagger.serverUrl`, `SWAGGER_SERVER_URL`, hoặc service `port`

### Supporting Context Domain Models

`notification-service` và `analytics-service` đã được refactor để không còn là các context chỉ có repository/use case anemic.

`notification-service` hiện có các domain model mới:

- `Notification`: tạo queued/delivered notification, mark delivered, mark failed, mark read.
- `AcademicWarning`: tạo warning, mark queued, mark pending retry, record retry failure.
- `DeviceToken`: tạo registration snapshot với UUID được truyền từ application layer.

Controller queue academic warning không còn gọi repository trực tiếp; luồng này đi qua `QueueAcademicWarningsUseCase`.

`analytics-service` hiện có `StudentLearningProgress` aggregate/projection model để giữ:

- Công thức average exam score sau mỗi exam completed event.
- Date-only projection cho daily activity.
- Lesson completion projection.
- Pass rate và completion percentage.
- Weak topics projection cho dashboard.

Repository vẫn là nơi xử lý Prisma transaction, nhưng các công thức và state projection đã được đưa về domain.

### Use Case Folder Structure

`notification-service` use cases hiện đã được chia theo từng action, đồng bộ với convention của `user-service`:

```text
application/use-cases/
  list-notifications/
    list-notifications.query.ts
    list-notifications.use-case.ts
  mark-notification-read/
    mark-notification-read.command.ts
    mark-notification-read.use-case.ts
```

Pattern tương tự đã được áp dụng cho device-token registration, academic-warning queue/retry, và các workflow gửi notification. `NotificationDispatcher` đã được chuyển sang `application/services` vì nó là coordinator service, không phải một use case boundary trực tiếp.

## Thay Đổi Không Dự Định (Intentional Non-Changes)

Các thay đổi sau đây đã được kiểm tra và cố ý giữ lại như cũ:

- `new Date()` trong các hàm của domain: ít rủi ro hơn, code hiện tại sử dụng rất nhiều domain timestamps, và DB vẫn là nơi tạo persisted update timestamps nếu đã được cấu hình.
- Lượng thay đổi lớn (churn) của Swagger decorator trên từng controller: hầu hết các controller và DTOs đã có những annotation cần thiết; shared OpenAPI bổ sung các siêu dữ liệu còn khuyết mà không cần những chỉnh sửa cồng kềnh.

## Kiểm tra Đã Thực hiện

Các câu lệnh chạy thành công:

```bash
npm --workspace=packages/common run build
npm --workspace=apps/docs-service run build
npm --workspace=apps/course-service run check-types
npm --workspace=apps/question-service run check-types
npm --workspace=apps/exam-service run check-types
npm --workspace=apps/user-service run check-types
npm --workspace=apps/simulation-service run check-types
npm --workspace=apps/identity-service run check-types
npm --workspace=apps/notification-service run check-types
npm --workspace=apps/analytics-service run check-types
npm --workspace=apps/media-service run check-types
npm --workspace=apps/audit-service run check-types
npx turbo run check-types
npx turbo run build
npm --workspace=apps/question-service run test
npm --workspace=apps/exam-service run test
npm --workspace=apps/docs-service run test:e2e
npm --workspace=apps/notification-service run test
npm --workspace=apps/analytics-service run test
```

Format/check Biome đã được tiến hành trên đường dẫn các service/common được sửa đổi:

```bash
npx biome check --write --no-errors-on-unmatched apps/course-service/src apps/course-service/test apps/question-service/src apps/exam-service/src apps/user-service/src apps/user-service/test apps/simulation-service/src apps/simulation-service/test apps/identity-service/src apps/identity-service/test apps/docs-service/src apps/docs-service/test apps/analytics-service/src apps/analytics-service/test apps/notification-service/src apps/media-service/src apps/audit-service/src packages/common/src/config/swagger.setup.ts
```

Các cảnh báo Biome (warnings) còn sót lại là thuộc về các cảnh báo cố hữu xoay quanh các (static-only) mapper/DTO classes và 1 tham số constructor chưa sử dụng.

## Cải tiến cho Tương lai (Follow-Up Improvements)

Các đề xuất phát triển trong tương lai:

- Thêm các unit test trọng tâm việc chuyển giao (handoff) UUID vào application use cases.
- Convert (static-only) mapper classes sang dạng functions tùy ý nếu team muốn thoả mãn các cảnh báo liên quan của Biome.
- Cân nhắc 1 shared bootstrap helper nhỏ dành cho đăng ký HTTP middleware, phòng trường hợp file main vẫn tiếp tục tụ hợp (converging).
- Thêm bài kiểm tra live browser smoke đánh giá Scalar ngay khi local infra (hạ tầng local) đi vào hoạt động.
