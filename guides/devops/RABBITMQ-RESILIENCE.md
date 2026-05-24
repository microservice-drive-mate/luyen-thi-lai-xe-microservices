# RabbitMQ Resilience, DLQ, Retry và Backoff

Tài liệu này mô tả phần gia cố RabbitMQ để message lỗi không làm sập toàn bộ luồng xử lý.

## Mục tiêu

- Mỗi consumer queue có một Dead Letter Queue để hứng message lỗi cuối cùng.
- Message lỗi không bị retry vô hạn trong queue chính.
- Retry dùng backoff theo các retry queue có TTL: `5s -> 30s -> 120s`.
- Sau khi vượt quá số lần retry, message được đưa vào DLQ để vận hành kiểm tra hoặc replay thủ công.
- Consumer dùng `noAck: false` và ack message theo kết quả xử lý.
- Consumer có lớp idempotency theo `messageId`, `eventId` hoặc `metadata.eventId` để tránh xử lý trùng trong retry/redelivery.
- Prometheus/Grafana theo dõi retry, DLQ và RabbitMQ queue depth.
- Alertmanager cảnh báo khi DLQ có message hoặc retry backlog tăng cao.

## RabbitMQ Topology

Với queue chính `<service>_service_events`, hệ thống tạo thêm:

| Thành phần | Tên queue |
| ---------- | --------- |
| Queue chính | `<service>_service_events` |
| Retry lần 1 | `<service>_service_events.retry.1` |
| Retry lần 2 | `<service>_service_events.retry.2` |
| Retry lần 3 | `<service>_service_events.retry.3` |
| Dead Letter Queue | `<service>_service_events.dlq` |

Ví dụ với `user-service`:

```text
user_service_events
user_service_events.retry.1
user_service_events.retry.2
user_service_events.retry.3
user_service_events.dlq
```

## Retry và Backoff

```text
Message -> queue chính -> handler
  -> thành công: ack
  -> lỗi lần 1: publish sang .retry.1, ack message gốc
  -> retry.1 hết TTL 5s: RabbitMQ dead-letter về queue chính
  -> lỗi lần 2: publish sang .retry.2, ack message gốc
  -> retry.2 hết TTL 30s: RabbitMQ dead-letter về queue chính
  -> lỗi lần 3: publish sang .retry.3, ack message gốc
  -> retry.3 hết TTL 120s: RabbitMQ dead-letter về queue chính
  -> lỗi sau retry lần 3: publish sang .dlq, ack message gốc
```

Các header được gắn thêm khi retry/DLQ:

| Header | Ý nghĩa |
| ------ | ------- |
| `x-original-queue` | Queue chính ban đầu |
| `x-retry-count` | Số lần retry đã thực hiện |
| `x-last-error` | Lỗi gần nhất |
| `x-failed-at` | Thời điểm lỗi gần nhất |
| `x-correlation-id` | Mã truy vết request/event nếu có |

## Shared Resilience Module

Logic RabbitMQ resilience nằm trong `@repo/common`:

```text
packages/common/src/messaging/rabbitmq-resilience.ts
```

Các helper chính:

- `assertRabbitMqResilienceTopology()`: tạo queue chính, retry queues và DLQ khi service khởi động.
- `createRabbitMqConsumerOptions()`: cấu hình RMQ consumer với `noAck: false`, durable queue và DLQ routing.
- `createRabbitMqClientOptions()`: cấu hình RMQ producer thống nhất với consumer để tránh lệch queue arguments.
- `RabbitMqRetryInterceptor`: ack message thành công, hoặc chuyển message lỗi sang retry queue/DLQ.

Consumer thành công sẽ được `ack`. Consumer lỗi sẽ được publish sang retry queue hoặc DLQ rồi `ack` message gốc để tránh loop vô hạn trong queue chính.

Interceptor cũng lưu khóa idempotency thành công trong memory TTL 24 giờ. Nếu RabbitMQ gửi lại cùng message trong cửa sổ này, service sẽ `ack` và bỏ qua handler để không tạo side effect trùng lặp. Khóa ưu tiên theo thứ tự: AMQP `messageId`, payload `eventId`, payload `id`, `metadata.eventId`.

Lưu ý: cơ chế này chống duplicate trong phạm vi instance đang chạy. Nếu cần exactly-once bền vững qua restart, từng service nên bổ sung bảng processed-message riêng hoặc unique constraint nghiệp vụ.

## Service Rollout

- `user-service`
- `course-service`
- `exam-service`
- `question-service`
- `analytics-service`
- `notification-service`
- `media-service`
- `audit-service`

`identity-service` là producer, không consume RabbitMQ event trong `main.ts`, nhưng producer client cũng dùng `createRabbitMqClientOptions()`.

Các handler cũ có `try/catch` đã được chỉnh để log lỗi rồi `throw` lại. Nếu handler nuốt lỗi, interceptor không thể đưa message vào retry queue hoặc DLQ.

## Metrics, Dashboard và Alert

App metrics expose qua `/metrics`:

| Metric | Ý nghĩa |
| ------ | ------- |
| `rabbitmq_messages_processed_total` | Tổng message RabbitMQ theo `queue` và `outcome` (`success`, `retry`, `dlq`) |
| `rabbitmq_message_retries_total` | Tổng message được đưa vào retry queue |
| `rabbitmq_messages_dead_lettered_total` | Tổng message được đưa vào DLQ |

RabbitMQ queue depth lấy từ RabbitMQ Prometheus plugin:

```text
http://localhost:15692/metrics
```

Prometheus scrape thêm job `rabbitmq`. Grafana dashboard `Microservices Observability` có thêm:

- `RabbitMQ Retry and DLQ Rate`
- `RabbitMQ Retry and DLQ Queue Depth`

Alert đã cấu hình:

| Alert | Điều kiện |
| ----- | --------- |
| `RabbitMqDlqHasMessages` | Có message trong queue `.dlq` hơn 2 phút |
| `RabbitMqRetryBacklogHigh` | Queue `.retry.*` có hơn 50 message trong 5 phút |
| `RabbitMqMessagesDeadLettered` | Service đưa message vào DLQ trong 5 phút gần nhất |
| `RabbitMqRetryRateHigh` | Retry rate vượt 0.2 msg/s trong 5 phút |

## Smoke Test và Runbook

Sau khi chạy infra và services:

```bash
npm run rabbitmq:smoke
```

Script kiểm tra:

- RabbitMQ Management API hoạt động.
- RabbitMQ Prometheus plugin expose metric `rabbitmq_queue_messages_ready`.
- Mỗi consumer queue có đủ queue chính, `.retry.1`, `.retry.2`, `.retry.3` và `.dlq`.

Biến môi trường tùy chỉnh:

| Biến | Mặc định |
| ---- | -------- |
| `RABBITMQ_MANAGEMENT_URL` | `http://localhost:15672` |
| `RABBITMQ_PROMETHEUS_URL` | `http://localhost:15692` |
| `RABBITMQ_MANAGEMENT_USER` | `guest` |
| `RABBITMQ_MANAGEMENT_PASSWORD` | `guest` |
| `RABBITMQ_CONSUMER_QUEUES` | Danh sách queue service mặc định |

## Lưu ý vận hành

RabbitMQ không cho sửa argument của queue đã tồn tại. Nếu môi trường local đã từng tạo queue cũ không có DLQ arguments, cần xóa queue cũ hoặc reset RabbitMQ volume trước khi chạy lại.

Trong local có thể làm nhanh bằng RabbitMQ UI:

```text
http://localhost:15672
```

Sau đó kiểm tra tab `Queues` để thấy các queue `.retry.1`, `.retry.2`, `.retry.3` và `.dlq`.

Không purge DLQ khi chưa điều tra lỗi vì DLQ là bằng chứng vận hành để truy vết theo `x-correlation-id`.

## Replay DLQ thủ công

Quy trình an toàn:

1. Mở RabbitMQ UI và xác định queue `.dlq`.
2. Lấy message mẫu, kiểm tra `x-last-error`, `x-retry-count`, `x-correlation-id`.
3. Tìm log cùng `x-correlation-id` trong Kibana để xác định lỗi gốc.
4. Sửa lỗi code/config/data trước khi replay.
5. Publish lại payload sang queue chính tương ứng.
6. Chỉ purge DLQ sau khi đã xác nhận message được xử lý thành công hoặc không còn giá trị nghiệp vụ.
