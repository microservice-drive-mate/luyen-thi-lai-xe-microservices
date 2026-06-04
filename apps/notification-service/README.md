# Notification Service

Notification Service là service trung tâm để gửi và lưu thông báo cho hệ thống **Luyện thi lái xe**. Service này xử lý 3 nhóm kênh:

- `IN_APP`: lưu thông báo vào database để frontend đọc qua API.
- `EMAIL`: gửi email qua SMTP. Khi dev thì dùng Mailpit.
- `PUSH`: gửi push notification qua Firebase Cloud Messaging (FCM). Nếu chưa cấu hình Firebase thì service vẫn chạy, chỉ bỏ qua phần push.

Luồng chính của service là bất đồng bộ: các service khác emit RabbitMQ event vào queue `notification_service_events`, notification-service consume event, tạo bản ghi, gửi email/push nếu có, retry khi lỗi và đưa vào DLQ khi hết số lần retry.

## 1. Service này dùng để làm gì?

Các use case hiện có:

- Gửi email/in-app chào mừng khi identity-service tạo user mới.
- Gửi email reset mật khẩu khi có event `identity.user.password-reset-requested`.
- Gửi thông báo kết quả thi khi exam-service phát event `exam.session.passed` hoặc `exam.session.failed`.
- Gửi cảnh báo học tập từ API `POST /admin/academic-warnings`.
- Gửi thông báo cập nhật khóa học qua event `course.updated` nếu course-service hoặc service khác emit event này.
- Đăng ký/hủy device token để gửi push notification.
- Cho người dùng xem và đánh dấu đã đọc thông báo của chính mình.

## 2. Kiến trúc nhanh

```txt
identity-service ─┐
exam-service      ├─ RabbitMQ queue: notification_service_events
course-service   ─┘
                         │
                         ▼
                 notification-service
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    Postgres          SMTP/Mailpit       Firebase FCM
 notifications       email              push
 device_tokens
 academic_warnings
```

Thành phần chính trong source:

```txt
src/
├── presentation/http
│   ├── notification.controller.ts      # API đọc thông báo, tạo cảnh báo học tập
│   └── device-token.controller.ts      # API đăng ký/hủy device token
├── presentation/messaging
│   └── messaging.controller.ts         # @EventPattern consume RabbitMQ event
├── application/use-cases
│   ├── notification-dispatcher.service.ts
│   ├── send-welcome-email.use-case.ts
│   ├── send-password-reset.use-case.ts
│   ├── send-exam-result.use-case.ts
│   ├── send-academic-warning.use-case.ts
│   ├── send-course-update.use-case.ts
│   ├── register-device-token.use-case.ts
│   └── unregister-device-token.use-case.ts
├── infrastructure/messaging
│   ├── rabbitmq.constants.ts           # tên queue/exchange/DLQ
│   ├── rabbitmq-topology.service.ts    # tạo queue, retry queue, DLQ
│   └── retry.publisher.ts
├── infrastructure/providers
│   ├── smtp.provider.ts
│   └── fcm-push.provider.ts
└── infrastructure/persistence/prisma
```

## 3. Cấu hình `.env`

Không đặt `.env` riêng trong `apps/notification-service`. Các biến local/dev của notification-service để chung trong file `.env` ở root repo:

```env
# Notification service
NOTIFICATION_SMTP_HOST=localhost
NOTIFICATION_SMTP_PORT=1025
NOTIFICATION_SMTP_USER=
NOTIFICATION_SMTP_PASS=
NOTIFICATION_SMTP_FROM=no-reply@luyen-thi-lai-xe.local
NOTIFICATION_FCM_CREDENTIALS=
NOTIFICATION_RETRY_MAX_ATTEMPTS=3
NOTIFICATION_RETRY_INTERVAL_MS=300000

# Nếu cần override riêng cho development-local khi seed docker/consul/init.sh
NOTIFICATION_SMTP_HOST_LOCAL=localhost
NOTIFICATION_SMTP_PORT_LOCAL=1025
NOTIFICATION_SMTP_USER_LOCAL=
NOTIFICATION_SMTP_PASS_LOCAL=
NOTIFICATION_SMTP_FROM_LOCAL=no-reply@luyen-thi-lai-xe.local
NOTIFICATION_FCM_CREDENTIALS_LOCAL=
NOTIFICATION_RETRY_MAX_ATTEMPTS_LOCAL=3
NOTIFICATION_RETRY_INTERVAL_MS_LOCAL=300000
```

Service đọc config theo thứ tự:

1. Environment variables.
2. Consul KV tại `config/<NODE_ENV>/notification-service/...`.
3. Default trong `app.module.ts`.

Các key Consul quan trọng:

| Key | Local mặc định | Docker mặc định | Ghi chú |
| --- | --- | --- | --- |
| `port` | `3006` | `3000` | Docker map ra host `3006:3000` |
| `database.url` | `postgresql://user:password@localhost:5437/notification_db` | `postgresql://user:password@db-notification:5432/notification_db` | DB riêng của notification |
| `rabbitmq.url` | `amqp://localhost:5672` | `amqp://rabbitmq:5672` | Queue chính `notification_service_events` |
| `smtp.host` | `localhost` | `mailpit` | Mailpit UI ở `http://localhost:8025` |
| `smtp.port` | `1025` | `1025` | SMTP dev |
| `push.fcmCredentials` | rỗng | rỗng | JSON service account Firebase, để rỗng thì tắt push thật |
| `retry.maxAttempts` | `3` | `3` | Số lần retry tối đa |
| `retry.intervalMs` | `300000` | `300000` | TTL retry queue, 5 phút |

Sau khi sửa `.env`, seed lại Consul:

```bash
npm run consul:seed:local
```

## 4. Chạy local

Từ root repo:

```bash
# 1. Bật infra: Postgres, RabbitMQ, Consul, Mailpit, Keycloak, Redis...
npm run infra:up

# 2. Seed Consul môi trường development-local
npm run consul:seed:local

# 3. Generate Prisma client
npm --workspace=apps/notification-service run prisma:generate

# 4. Chạy migration cho notification DB
npm --workspace=apps/notification-service run db:migrate

# 5. Chạy service
npm --workspace=apps/notification-service run start:dev
```

URL hay dùng:

| Mục đích | URL |
| --- | --- |
| Notification Swagger | `http://localhost:3006/docs` |
| Metrics | `http://localhost:3006/metrics` |
| Mailpit | `http://localhost:8025` |
| RabbitMQ UI | `http://localhost:15672` (`guest`/`guest`) |
| Consul UI | `http://localhost:8500` |

## 5. HTTP API

Các API này dùng cho frontend/admin, không dùng để service khác gọi trực tiếp khi muốn gửi thông báo. Service-to-service nên dùng RabbitMQ event ở phần sau.

| Method | Path | Ai dùng | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/notifications/me?page=1&size=20` | User đã đăng nhập | Lấy thông báo của chính user theo JWT `sub` |
| `PATCH` | `/notifications/:id/read` | User đã đăng nhập | Đánh dấu một thông báo là đã đọc |
| `POST` | `/notifications/devices` | App/mobile frontend | Đăng ký device token để nhận push |
| `DELETE` | `/notifications/devices/:token` | App/mobile frontend | Hủy device token |
| `POST` | `/admin/academic-warnings` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` | Tạo cảnh báo học tập, trả `202 Accepted` và gửi bất đồng bộ |
| `GET` | `/metrics` | Prometheus/internal | Scrape metrics |

Ví dụ đăng ký device token:

```http
POST /notifications/devices
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "fcm-device-token",
  "platform": "android"
}
```

Ví dụ tạo cảnh báo học tập:

```http
POST /admin/academic-warnings
Authorization: Bearer <admin_or_instructor_token>
Content-Type: application/json

{
  "studentId": "uuid-cua-hoc-vien",
  "reason": "ABSENT_TOO_MUCH",
  "severity": "HIGH",
  "message": "Bạn đã vắng nhiều buổi học, vui lòng liên hệ trung tâm."
}
```

API này không gửi ngay trong request HTTP. Controller publish event `notification.academic-warning.queued` vào RabbitMQ, sau đó worker của notification-service consume và dispatch `IN_APP`, `PUSH`, thêm `EMAIL` nếu payload có `studentEmail`.

## 6. Cách service khác gửi thông báo

Nguyên tắc chung:

- Không gọi thẳng controller HTTP của notification-service để gửi thông báo nội bộ.
- Emit event vào RabbitMQ queue `notification_service_events`.
- `pattern` của event phải trùng với `@EventPattern(...)` trong `messaging.controller.ts`.
- Payload nên có đủ `userId` hoặc `studentId`; nếu muốn gửi email thì thêm `email` hoặc `recipientEmail`.

### 6.1 Đăng ký RMQ client trong service gọi

Ví dụ trong module của service muốn gửi thông báo:

```ts
import { ClientsModule, Transport } from '@nestjs/microservices';

export const NOTIFICATION_SERVICE_CLIENT = 'NOTIFICATION_SERVICE_CLIENT';

ClientsModule.registerAsync([
  {
    name: NOTIFICATION_SERVICE_CLIENT,
    useFactory: () => ({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: 'notification_service_events',
        queueOptions: { durable: true },
      },
    }),
  },
]);
```

Nếu service đang dùng `ConfigService`, lấy URL từ `rabbitmq.url` giống exam-service/identity-service.

### 6.2 Emit event

```ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { NOTIFICATION_SERVICE_CLIENT } from './your.module';

@Injectable()
export class SomePublisher {
  constructor(
    @Inject(NOTIFICATION_SERVICE_CLIENT)
    private readonly notificationClient: ClientProxy,
  ) {}

  async notify(): Promise<void> {
    await lastValueFrom(
      this.notificationClient.emit('course.updated', {
        recipientId: 'user-id',
        recipientEmail: 'student@example.com',
        courseId: 'course-id',
        courseTitle: 'B2 cơ bản',
        updateSummary: 'Khóa học vừa được cập nhật lịch học mới.',
      }),
    );
  }
}
```

## 7. Event notification-service đang consume

| Event pattern | Service phát hiện tại | Payload chính | Kênh gửi |
| --- | --- | --- | --- |
| `identity.user.created` | identity-service | `userId`, `email`, `fullName?` | `IN_APP`, `EMAIL` |
| `identity.user.password-reset-requested` | Chưa thấy publisher chính thức trong code hiện tại | `userId`, `email`, `resetUrl` | `EMAIL` |
| `exam.session.passed` | exam-service | `studentId` hoặc `userId`, `email?`, `sessionId?`, `licenseCategory?`, `score?` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có email |
| `exam.session.failed` | exam-service | giống `exam.session.passed` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có email |
| `notification.academic-warning.queued` | notification-service HTTP controller | `studentId`, `reason`, `severity`, `message`, `createdById`, `studentEmail?`, `warningId?` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có `studentEmail` |
| `course.updated` | Handler đã có, course-service chưa route mặc định | `recipientId`, `recipientEmail?`, `courseId`, `courseTitle`, `updateSummary` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có email |

### Identity-service đang gọi như nào?

Identity-service có `IdentityEventPublisher`. Với event `identity.user.created`, publisher emit song song sang:

- user-service queue.
- notification-service queue `notification_service_events`.

Notification-service nhận event này và chạy `SendWelcomeEmailUseCase`.

### Exam-service đang gọi như nào?

Exam-service có `RabbitMqEventPublisher`. Các event:

- `exam.session.passed`
- `exam.session.failed`

được route riêng sang client `NOTIFICATION_SERVICE_CLIENT`, queue `notification_service_events`. Notification-service nhận event và chạy `SendExamResultUseCase`.

### Course-service muốn gửi thông báo thì làm sao?

Notification-service đã có handler `course.updated`, nhưng course-service hiện chưa có `NOTIFICATION_SERVICE_CLIENT` trong publisher mặc định. Khi cần bật thông báo cập nhật khóa học, thêm một client trỏ tới queue `notification_service_events`, rồi route event `course.updated` sang client đó.

Payload đề xuất:

```ts
await lastValueFrom(
  notificationClient.emit('course.updated', {
    recipientId: studentUserId,
    recipientEmail: studentEmail,
    courseId,
    courseTitle,
    updateSummary: 'Giảng viên đã cập nhật lịch học.',
  }),
);
```

## 8. Retry, retry queue và DLQ

Topology RabbitMQ:

| Thành phần | Tên | Ghi chú |
| --- | --- | --- |
| Queue chính | `notification_service_events` | Notification-service consume với `noAck=false` |
| Retry exchange | `notification.retry` | Publish message lỗi vào đây |
| Retry queue | `notification_service_retry` | Giữ message theo TTL `retry.intervalMs`, hết TTL route lại queue chính |
| DLQ exchange | `notification.dlx` | Nhận message hết retry |
| DLQ | `notification_service_dlq` | Kiểm tra bằng RabbitMQ UI |

Luồng lỗi:

1. Handler lỗi.
2. Nếu `retryCount + 1 <= retry.maxAttempts`, service ack message cũ và publish message mới vào retry queue.
3. Hết TTL, RabbitMQ đưa message quay lại `notification_service_events`.
4. Nếu vượt `retry.maxAttempts`, service `nack(..., false, false)` để message vào DLQ.

Lưu ý: TTL là argument của queue. Nếu đổi `NOTIFICATION_RETRY_INTERVAL_MS`, có thể cần xóa queue `notification_service_retry` cũ trong RabbitMQ UI rồi restart service để RabbitMQ tạo lại queue với TTL mới.

## 9. Database

Schema Prisma ở `apps/notification-service/prisma/schema.prisma`.

| Model | Ý nghĩa |
| --- | --- |
| `Notification` | Một bản ghi cho mỗi thông báo/kênh gửi, có `status`, `eventType`, `isRead`, `retryCount`, `errorMessage` |
| `AcademicWarning` | Audit cảnh báo học tập do instructor/admin tạo |
| `DeviceToken` | Device token của user để gửi push |

Lệnh thường dùng:

```bash
npm --workspace=apps/notification-service run prisma:generate
npm --workspace=apps/notification-service run db:migrate
npm --workspace=apps/notification-service run db:deploy
npm --workspace=apps/notification-service run db:seed
```

## 10. Test thủ công nhanh

### Test email welcome từ RabbitMQ UI

1. Mở `http://localhost:15672`, đăng nhập `guest`/`guest`.
2. Vào queue `notification_service_events`.
3. Publish message:

```json
{
  "pattern": "identity.user.created",
  "data": {
    "userId": "00000000-0000-0000-0000-000000000001",
    "email": "student@example.com",
    "fullName": "Nguyen Van A"
  }
}
```

4. Mở Mailpit `http://localhost:8025` để xem email.
5. Kiểm tra bảng `notifications` để thấy bản ghi `IN_APP` và `EMAIL`.

### Test kết quả thi

Publish message:

```json
{
  "pattern": "exam.session.passed",
  "data": {
    "studentId": "00000000-0000-0000-0000-000000000001",
    "email": "student@example.com",
    "sessionId": "session-1",
    "licenseCategory": "B2",
    "score": 28
  }
}
```

Kết quả mong đợi:

- Có notification `IN_APP`.
- Có notification `PUSH`; nếu chưa cấu hình Firebase thì provider bỏ qua push thật.
- Có notification `EMAIL` và email xuất hiện trong Mailpit.

## 11. Checklist trước khi merge

```bash
npm --workspace=apps/notification-service run prisma:generate
npm --workspace=apps/notification-service run check-types
npm --workspace=apps/notification-service run build
npx turbo run check-types
docker compose config --quiet
```

Nếu đổi contract event hoặc endpoint, cập nhật thêm:

- `guides/api/api-spec-notification.md`
- `guides/testing/notification-service-test-guide.md`
- `docker/consul/init.sh` hoặc các file `consul-seed-*.json` nếu thêm key config mới
