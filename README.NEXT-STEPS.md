# Roadmap Hoàn Thiện Kiến Trúc Microservices

Tài liệu này là plan hành động cho repo hiện tại để đạt mức microservices chuẩn. Thứ tự dưới đây được xếp theo ưu tiên thực thi, làm từ trên xuống dưới.

Mục tiêu chung:

- Mỗi service độc lập, dễ scale, dễ deploy.
- Hệ thống có khả năng phục hồi, dễ quan sát, dễ vận hành.
- Team có quy trình rõ ràng để phát triển lâu dài.

## Thứ tự ưu tiên tổng quan

1. P0: Core Service Foundation
2. P0: Infrastructure Foundation
3. P0: Inter-service Communication Standard
4. P1: Resiliency
5. P1: Observability
6. P1-P2: CI/CD + Containerization + Orchestration

---

## 1) Core Service Foundation (P0)

Đây là nền tảng của từng service, phải xong trước khi mở rộng tính năng.

### 1.1 Database per Service

Mục tiêu:

- Mỗi service quản lý DB riêng, không chia sẻ schema.

Việc cần làm:

1. Chốt ORM chung cho repo (đề xuất Prisma).
2. Tạo migration cho từng service theo thứ tự: identity -> user -> notification -> các service còn lại.
3. Thêm seed script cho dữ liệu tối thiểu để test local.
4. Thêm volume cho các DB trong [docker-compose.yaml](docker-compose.yaml) để tránh mất dữ liệu.

Cách làm chi tiết:

1. Tạo folder schema/migration riêng trong từng service.
2. Thêm script ở package.json mỗi service: db:migrate, db:seed, db:reset.
3. Tạo endpoint health check có kiểm tra kết nối DB.

Definition of Done:

- Khởi tạo DB bằng migration, không tạo tay.
- Restart container vẫn giữ dữ liệu.
- Có dữ liệu seed để demo và test.

### 1.2 Business Logic theo Bounded Context

Mục tiêu:

- Mỗi service chỉ giải quyết một phạm vi nghiệp vụ rõ ràng.

Việc cần làm:

1. Ghi rõ boundary của 8 services trong 1 bảng mapping domain.
2. Tránh để service A truy cập trực tiếp DB service B.
3. Đưa rule domain chung vào [packages/common/src](packages/common/src) chỉ khi thực sự dùng chung.

Cách làm chi tiết:

1. Tạo tài liệu domain boundary trong [README.md](README.md).
2. Khi mở rộng tính năng, check boundary trước khi code.

Definition of Done:

- Mỗi endpoint mới đều thuộc đúng service owner.
- Không có truy cập DB chéo service.

### 1.3 API Layer (REST/gRPC)

Mục tiêu:

- API rõ ràng, version được, có validation.

Việc cần làm:

1. Chuẩn hóa REST API cho tất cả service trước, gRPC có thể thêm sau cho internal high-throughput.
2. Thêm validation DTO cho input, map lỗi theo format thống nhất.
3. Thêm OpenAPI cho mỗi service.

Cách làm chi tiết:

1. Định nghĩa convention endpoint: /v1/<resource>.
2. Viết error response contract dùng chung trong common.

Definition of Done:

- Service nào cũng có swagger và input validation.
- API contract được version hóa.

---

## 2) Infrastructure Foundation (P0)

### 2.1 API Gateway

Hiện trạng:

- Đã có Kong trong [kong/kong.yaml](kong/kong.yaml).

Việc cần làm tiếp:

1. Chuẩn hóa route naming và prefix version (vd /v1/auth).
2. Bật plugin auth, request id, CORS policy, rate limit theo môi trường.
3. Tách config dev/prod cho gateway.

Cách làm chi tiết:

1. Tạo convention route table trong README.
2. Test route bằng smoke test script sau mỗi thay đổi Kong config.

Definition of Done:

- Tất cả request client đi qua gateway.
- Có auth + rate limit + log context tại gateway.

### 2.2 Service Discovery

Hiện trạng:

- Đang dùng static service name trong Docker network.

Việc cần làm tiếp:

1. Ngắn hạn: duy trì service name naming convention để ổn định local.
2. Trung hạn: khi lên K8s, dùng service discovery native của Kubernetes.
3. Chuẩn bị health/readiness endpoint để orchestration có thể route đúng.

Definition of Done:

- Service giao tiếp qua DNS/service name, không hardcode IP.
- Có readiness/liveness endpoint.

### 2.3 Config Management

Việc cần làm:

1. Tạo env template cho root và từng service.
2. Validate env lúc startup (fail-fast).
3. Tách secrets khỏi compose/file code.

Cách làm chi tiết:

1. Thêm .env.example cho từng app.
2. Dùng schema validate env (zod/joi).
3. Nếu deploy cloud: đưa secret vào secret manager.

Definition of Done:

- Clone repo, copy env, chạy được.
- Sai env thì service dừng ngay với lỗi rõ ràng.

---

## 3) Inter-service Communication Standard (P0)

Có 2 kênh cần chuẩn hóa song song.

### 3.1 Synchronous (HTTP/REST, gRPC)

Việc cần làm:

1. Chốt service nào gọi sync service nào.
2. Thêm timeout, retry có giới hạn, và fallback.
3. Nếu cần hiệu năng cao cho internal call, lập kế hoạch gRPC cho cặp service nhiều traffic.

Definition of Done:

- Có ma trận call graph giữa services.
- Mỗi external/internal sync call đều có timeout.

### 3.2 Asynchronous (RabbitMQ)

Hiện trạng:

- Đã có RabbitMQ và demo event identity -> notification.

Việc cần làm:

1. Chuẩn hóa tên exchange, queue, routing key.
2. Chuẩn hóa event contract và version hóa payload.
3. Đưa event constants vào [packages/common/src](packages/common/src).

Cách làm chi tiết:

1. Event naming format: domain.action.v1.
2. Queue naming format: service.purpose.queue.
3. Tạo tài liệu event catalog (publisher, consumer, schema).

Definition of Done:

- Producer/consumer không hardcode chuỗi event tùy ý.
- Event contract được version hóa và tái sử dụng được.

---

## 4) Resiliency (P1)

### 4.1 Circuit Breaker

Việc cần làm:

1. Áp dụng circuit breaker cho sync call quan trọng.
2. Track trạng thái open/half-open/closed qua metric.

Cách làm chi tiết:

1. Chọn thư viện phù hợp NestJS.
2. Cấu hình threshold theo SLA (error rate, timeout).

Definition of Done:

- Một service bị lỗi không làm sập dây chuyền các service còn lại.

### 4.2 Retry Logic

Việc cần làm:

1. Retry có backoff cho lỗi tạm thời (network timeout).
2. Không retry vô hạn.
3. Cho async flow: thêm DLQ và xử lý poison message.

Cách làm chi tiết:

1. Sync retry tối đa 2-3 lần, exponential backoff.
2. Async retry qua dead-letter exchange và TTL.

Definition of Done:

- Lỗi tạm thời được tự phục hồi.
- Message lỗi được đẩy vào DLQ để điều tra.

---

## 5) Observability (P1)

### 5.1 Centralized Logging

Việc cần làm:

1. Chuẩn hóa structured log JSON cho tất cả service.
2. Đẩy log về 1 hệ thống tập trung (ELK hoặc EFK).
3. Gắn correlation id cho mỗi request/event.

Definition of Done:

- Tìm được log của 1 request xuyên qua nhiều service.

### 5.2 Distributed Tracing

Việc cần làm:

1. Tích hợp OpenTelemetry.
2. Đẩy trace về Jaeger/Zipkin/Tempo.

Definition of Done:

- Xem được trace end-to-end từ gateway đến service cuối.

### 5.3 Metrics and Health Check

Việc cần làm:

1. Export metrics cho từng service.
2. Dùng Prometheus + Grafana dashboard.
3. Có endpoint /health và /ready.

Definition of Done:

- Có dashboard latency, error rate, throughput, resource usage.
- Có alert cơ bản khi service down hoặc error đột biến.

---

## 6) CI/CD + Containerization + Orchestration (P1-P2)

### 6.1 Containerization

Hiện trạng:

- Đã có Dockerfile cho các service.

Việc cần làm:

1. Chuẩn hóa Dockerfile template cho mỗi service mới.
2. Thêm security scan image (Trivy).

Definition of Done:

- Mỗi service build image được và pass security scan cơ bản.

### 6.2 CI Pipeline

Việc cần làm:

1. Tạo CI pipeline: lint -> typecheck -> test -> build.
2. Chỉ build service thay đổi (turbo filter).
3. Lưu artifact test report.

Definition of Done:

- PR fail quality gate thì không được merge.

### 6.3 CD + Orchestration (Kubernetes)

Việc cần làm:

1. Tạo manifest Helm/Kustomize cho service deployment.
2. Cấu hình readiness/liveness probe.
3. Cấu hình HPA để auto-scale.
4. Thiết lập rollout strategy (rolling/canary).

Definition of Done:

- Có thể deploy tự động lên môi trường staging.
- Có khả năng scale và rollback an toàn.

---

## Kế hoạch theo milestone

### Milestone 1 (2-3 tuần) - Foundation

1. Hoàn thành Config Management.
2. Hoàn thành migration + seed cho identity và user.
3. Chuẩn hóa API contract + event contract trong common.

### Milestone 2 (2-3 tuần) - Reliable Communication

1. Hoàn thiện vertical slice đăng ký user -> event -> notification.
2. Thêm timeout/retry cho sync calls.
3. Thêm DLQ + idempotency cho async flow.

### Milestone 3 (2-3 tuần) - Operability

1. Triển khai logging tập trung + tracing + metrics.
2. Có dashboard và alert tối thiểu.

### Milestone 4 (2-4 tuần) - Delivery at Scale

1. Hoàn thiện CI quality gate.
2. Chuẩn bị Kubernetes deployment cho staging.
3. Chốt quy trình release/rollback.

---

## Checklist làm ngay (Top 10)

1. Tạo env template và env validation cho 8 services.
2. Thêm volume cho các DB trong [docker-compose.yaml](docker-compose.yaml).
3. Chọn ORM và tạo migration đầu tiên cho identity-service.
4. Chốt event naming convention domain.action.v1.
5. Đưa constants event vào [packages/common/src](packages/common/src).
6. Thêm timeout cho mỗi HTTP call giữa services.
7. Thêm DLQ cho queue quan trọng.
8. Thêm request id/correlation id middleware.
9. Dùng CI tối thiểu lint + test + build.
10. Viết e2e test cho 1 luồng nghiệp vụ xuyên suốt qua gateway.
