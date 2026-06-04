# Notification Service

Notification Service là service trung tâm để lưu và gửi thông báo cho hệ thống Luyện thi lái xe. Runtime hiện tại chạy NestJS HTTP API và RabbitMQ microservice trong cùng một process.

Service hỗ trợ 3 kênh:

- `IN_APP`: tạo bản ghi trong database để frontend đọc qua API.
- `EMAIL`: gửi email qua SMTP. Cấu hình SMTP dùng chung bộ biến `KEYCLOAK_SMTP_*` ở root `.env`.
- `PUSH`: gửi push notification qua Firebase Cloud Messaging. Nếu chưa có `FCM_CREDENTIALS`, provider sẽ bỏ qua push thật nhưng service vẫn chạy.

Luồng chính là bất đồng bộ: service khác emit RabbitMQ event vào queue `notification_service_events`, notification-service consume event, tạo notification, dispatch theo kênh phù hợp, rồi để common `RabbitMqRetryInterceptor` xử lý retry/DLQ khi handler throw lỗi.

## Use Cases

- Gửi welcome notification khi identity-service emit `identity.user.created`.
- Gửi password reset email khi có event `identity.user.password-reset-requested`.
- Gửi kết quả thi khi exam-service emit `exam.session.passed` hoặc `exam.session.failed`.
- Tạo academic warning qua `POST /admin/academic-warnings`, sau đó queue event `notification.academic-warning.queued` để dispatch bất đồng bộ.
- Consume `course.updated` nếu service khác route event này vào notification queue.
- Đăng ký/hủy device token cho push notification.
- Cho user đọc notification của mình và đánh dấu đã đọc.

## Runtime Architecture

```txt
identity-service ----\
exam-service ---------+--> RabbitMQ queue: notification_service_events
notification HTTP ----/
course-service -------/
                                |
                                v
                         notification-service
                                |
               +----------------+----------------+
               v                v                v
            Postgres          SMTP           Firebase FCM
```

Thư mục quan trọng:

```txt
src/
  main.ts                                  # HTTP + RMQ bootstrap, Swagger, metrics, retry/DLQ
  app.module.ts                            # Consul config, Keycloak guards, providers
  presentation/http/
    notification.controller.ts             # /notifications/me, /notifications/:id/read, /admin/academic-warnings
    device-token.controller.ts             # /notifications/devices
  presentation/messaging/
    messaging.controller.ts                # @EventPattern handlers
  application/use-cases/
    notification-dispatcher.service.ts
    send-welcome-email.use-case.ts
    send-password-reset.use-case.ts
    send-exam-result.use-case.ts
    send-academic-warning.use-case.ts
    send-course-update.use-case.ts
  infrastructure/messaging/
    notification-event.publisher.ts        # Publish internal academic-warning event
  infrastructure/providers/
    smtp.provider.ts
    fcm-push.provider.ts
  infrastructure/persistence/prisma/
```

## Config

Không cần tạo `.env` riêng trong `apps/notification-service`. Đặt biến local/dev ở file `.env` root repo.

```env
KEYCLOAK_SMTP_HOST=smtp.gmail.com
KEYCLOAK_SMTP_PORT=587
KEYCLOAK_SMTP_USER=your-email@gmail.com
KEYCLOAK_SMTP_PASSWORD=your-app-password
KEYCLOAK_SMTP_SSL=false
KEYCLOAK_SMTP_STARTTLS=true
KEYCLOAK_SMTP_FROM=your-email@gmail.com

# Firebase service-account JSON. Để trống thì push sẽ bị skip.
FCM_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-...@....iam.gserviceaccount.com"}

NOTIFICATION_RETRY_MAX_ATTEMPTS=3
NOTIFICATION_RETRY_INTERVAL_MS=300000
```

Config được resolve theo thứ tự chung của repo:

1. Environment variables.
2. Consul KV `config/<NODE_ENV>/notification-service/...`.
3. Default trong `app.module.ts`.

Notification-service dùng chung SMTP config với Keycloak: `KEYCLOAK_SMTP_HOST`, `KEYCLOAK_SMTP_PORT`, `KEYCLOAK_SMTP_USER`, `KEYCLOAK_SMTP_PASSWORD`, `KEYCLOAK_SMTP_FROM`, `KEYCLOAK_SMTP_SSL`, `KEYCLOAK_SMTP_STARTTLS`. Push dùng `FCM_CREDENTIALS` từ root `.env`; đây là JSON service account Firebase Admin SDK trên một dòng.

Consul keys quan trọng:

| Key | Local default | Docker default | Ghi chú |
| --- | --- | --- | --- |
| `port` | `3006` | `3000` | Docker map host `3006:3000` |
| `database.url` | `postgresql://user:password@localhost:5437/notification_db` | `postgresql://user:password@db-notification:5432/notification_db` | DB riêng của notification |
| `rabbitmq.url` | `amqp://localhost:5672` | `amqp://rabbitmq:5672` | Queue chính `notification_service_events` |
| `smtp.host` | từ `KEYCLOAK_SMTP_HOST` | từ `KEYCLOAK_SMTP_HOST` | Dùng chung mail thật với Keycloak |
| `smtp.port` | từ `KEYCLOAK_SMTP_PORT` | từ `KEYCLOAK_SMTP_PORT` | Gmail thường là `587` |
| `smtp.from` | từ `KEYCLOAK_SMTP_FROM` | từ `KEYCLOAK_SMTP_FROM` | From address |
| `smtp.secure` | từ `KEYCLOAK_SMTP_SSL` | từ `KEYCLOAK_SMTP_SSL` | `true` cho SMTP 465 |
| `smtp.starttls` | từ `KEYCLOAK_SMTP_STARTTLS` | từ `KEYCLOAK_SMTP_STARTTLS` | `true` cho SMTP 587 yêu cầu STARTTLS |
| `push.fcmCredentials` | từ `FCM_CREDENTIALS` | từ `FCM_CREDENTIALS` | Firebase service-account JSON. Để trống thì skip push |
| `retry.maxAttempts` | `3` | `3` | Số lần retry trước khi vào DLQ |
| `retry.intervalMs` | `300000` | `300000` | Delay mỗi lần retry |

Sau khi sửa `.env`, seed lại Consul:

```bash
npm run consul:seed:local
```

## Run Local

Từ root repo:

```bash
npm run infra:up
npm run consul:seed:local
npm --workspace=apps/notification-service run prisma:generate
npm --workspace=apps/notification-service run db:migrate
npm --workspace=apps/notification-service run start:dev
```

URL hay dùng:

| Mục đích | URL |
| --- | --- |
| Swagger | `http://localhost:3006/docs` |
| Metrics | `http://localhost:3006/metrics` |
| Health | `http://localhost:3006/health` |
| RabbitMQ UI | `http://localhost:15672` (`guest`/`guest`) |
| Consul UI | `http://localhost:8500` |

## HTTP API

| Method | Path | Ai dùng | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/notifications/me?page=1&size=20` | Authenticated user | Lấy notification của user hiện tại theo JWT `sub` |
| `PATCH` | `/notifications/:id/read` | Authenticated user | Đánh dấu notification đã đọc |
| `POST` | `/notifications/devices` | App/mobile frontend | Đăng ký device token |
| `DELETE` | `/notifications/devices/:token` | App/mobile frontend | Hủy device token |
| `POST` | `/admin/academic-warnings` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` | Queue academic warning, trả `202 Accepted` |
| `GET` | `/metrics` | Prometheus/internal | Scrape metrics |

Ví dụ tạo academic warning:

```http
POST /admin/academic-warnings
Authorization: Bearer <admin_or_instructor_token>
Content-Type: application/json

{
  "studentIds": ["student-user-id-1", "student-user-id-2"],
  "reason": "ABSENT_TOO_MUCH",
  "severity": "HIGH",
  "message": "Bạn đã vắng nhiều buổi học, vui lòng liên hệ trung tâm.",
  "deliveryChannels": ["IN_APP"]
}
```

Endpoint này chỉ cho request `IN_APP`. `EMAIL` và `PUSH` không được yêu cầu trực tiếp từ admin API; notification-service tự resolve theo config và payload event. Controller tạo record `AcademicWarning`, publish event `notification.academic-warning.queued` kèm `warningId`, rồi trả `202 Accepted`.

Response:

```json
{
  "status": "ACCEPTED",
  "accepted": 2,
  "studentIds": ["student-user-id-1", "student-user-id-2"],
  "message": "Academic warning notifications were queued for asynchronous delivery."
}
```

## RabbitMQ Events

Service-to-service không gọi HTTP controller của notification-service để gửi notification nội bộ. Hãy emit event vào queue `notification_service_events`.

Trong service publisher, ưu tiên helper chung:

```ts
import { ClientsModule } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { createRabbitMqClientOptions } from '@repo/common';

export const NOTIFICATION_SERVICE_CLIENT = 'NOTIFICATION_SERVICE_CLIENT';

ClientsModule.registerAsync([
  {
    name: NOTIFICATION_SERVICE_CLIENT,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) =>
      createRabbitMqClientOptions(configService, 'notification_service_events'),
  },
]);
```

Emit event:

```ts
await lastValueFrom(
  notificationClient.emit('course.updated', {
    recipientId: 'user-id',
    recipientEmail: 'student@example.com',
    courseId: 'course-id',
    courseTitle: 'B2 cơ bản',
    updateSummary: 'Khóa học vừa được cập nhật lịch học mới.',
  }),
);
```

Notification-service hiện consume:

| Event pattern | Payload chính | Kênh gửi |
| --- | --- | --- |
| `identity.user.created` | `userId`, `email`, `fullName?` | `IN_APP`, `EMAIL` |
| `identity.user.password-reset-requested` | `userId`, `email`, `resetUrl` | `EMAIL` |
| `exam.session.passed` | `studentId` hoặc `userId`, `email?`, `sessionId?`, `licenseCategory?`, `score?` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có email |
| `exam.session.failed` | giống `exam.session.passed` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có email |
| `notification.academic-warning.queued` | `warningId?`, `studentId`, `reason`, `severity`, `message`, `createdById`, `studentEmail?` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có `studentEmail` |
| `course.updated` | `recipientId`, `recipientEmail?`, `courseId`, `courseTitle`, `updateSummary` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có email |

## Retry Và DLQ

Runtime hiện tại dùng common `assertRabbitMqResilienceTopology` và `RabbitMqRetryInterceptor` từ `@repo/common`.

Topology:

| Thành phần | Tên |
| --- | --- |
| Queue chính | `notification_service_events` |
| Retry queue | `notification_service_events.retry.1`, `notification_service_events.retry.2`, ... |
| DLQ | `notification_service_events.dlq` |

Số retry queue bằng `retry.maxAttempts`. Mỗi retry queue có TTL bằng `retry.intervalMs` và dead-letter routing quay lại queue chính bằng default exchange.

Luồng lỗi:

1. Handler throw lỗi.
2. Interceptor ack message cũ và publish message sang retry queue tiếp theo, kèm headers `x-retry-count`, `x-last-error`, `x-failed-at`.
3. Hết TTL, RabbitMQ đưa message về `notification_service_events`.
4. Vượt `retry.maxAttempts`, interceptor publish message sang `notification_service_events.dlq`.

Lưu ý local: nếu trước đó RabbitMQ đã tạo queue theo topology cũ, có thể gặp `PRECONDITION_FAILED` khi start service. Xóa các queue notification cũ trong RabbitMQ UI hoặc reset volume RabbitMQ local rồi start lại.

## Database

Schema Prisma nằm ở `apps/notification-service/prisma/schema.prisma`.

| Model | Ý nghĩa |
| --- | --- |
| `Notification` | Một bản ghi notification/kênh gửi, có `status`, `eventType`, `isRead`, `retryCount`, `errorMessage`, `deliveredAt` |
| `AcademicWarning` | Audit warning học tập, có delivery status và thông tin retry |
| `DeviceToken` | Device token của user để gửi push |

Lệnh hay dùng:

```bash
npm --workspace=apps/notification-service run prisma:generate
npm --workspace=apps/notification-service run db:migrate
npm --workspace=apps/notification-service run db:deploy
npm --workspace=apps/notification-service run db:seed
```

## Quick Checks

```bash
npm --workspace=apps/notification-service run check-types
npm --workspace=apps/notification-service run build
docker compose config --quiet
```

Nếu đổi contract event hoặc endpoint, cập nhật thêm:

- `guides/api/api-spec-notification.md`
- `guides/testing/notification-service-test-guide.md`
- `docker/consul/init.sh`
- `consul-seed-development-local.json`
- `consul-seed-development.json`
- `consul-seed-production.json`
