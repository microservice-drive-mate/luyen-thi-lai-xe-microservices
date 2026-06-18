# Performance Testing Setup

Tài liệu này mô tả bộ K6 performance test hiện tại của repo `luyen-thi-lai-xe-microservices`.

## 1. Phạm Vi

Bộ test cũ trong `load-tests/` đã được thay bằng package TypeScript tại `packages/performance-tests`.

Mục tiêu chính:

- Chạy smoke/load/soak/security test qua Kong `http://localhost:8000`.
- Ghi K6 metrics vào InfluxDB 1.8 database `k6`.
- Xem dashboard K6 trong Grafana infra sẵn có.
- Đối chiếu thêm RabbitMQ broker/app metrics qua Prometheus.

## 2. Cấu Trúc

| File | Vai trò |
| --- | --- |
| `packages/performance-tests/src/config.ts` | Base URL, SLO thresholds, service registry, enum dùng chung |
| `packages/performance-tests/src/helpers/http.ts` | Wrapper cho `k6/http`, tự gắn `X-K6-Trace-Id` và `X-K6-Scenario` |
| `packages/performance-tests/src/helpers/async.ts` | Đo latency WebSocket notification bằng custom trend `async_e2e_latency_ms` |
| `packages/performance-tests/src/services/*.ts` | Wrapper theo service: health, identity, exam, course, user, question, simulation |
| `packages/performance-tests/src/scenarios/*.ts` | `smoke`, `load`, `soak`, `security` |
| `docker-compose.observability.yml` | Chỉ chạy InfluxDB cho K6 |
| `docker/grafana/provisioning/dashboards/k6-dashboard.json` | Dashboard K6 auto-provision vào Grafana infra |
| `docker/grafana/provisioning/datasources/influxdb.yml` | Datasource `InfluxDB_K6` trỏ tới `http://host.docker.internal:8086` |

## 3. Cách Chạy

```powershell
pnpm infra:up
pnpm observability:up
pnpm perf:build
pnpm perf:smoke
```

> **Ghi chú bảo mật**: Khi chạy load test Local, script test (K6 `setup()`) sẽ tự động can thiệp qua Keycloak Admin API để hạ chuẩn băm mật khẩu của Keycloak xuống mức thấp nhất (`hashIterations(1)` thay vì `27500`). 
> **Mục đích**: Đã hạ chuẩn bảo mật ở Local để test hiệu năng hệ thống (tránh nghẽn CPU do thuật toán PBKDF2), giúp đánh giá chính xác các nút thắt cổ chai khác mà không bị nhiễu bởi tác vụ hashing.

URL vận hành:

| Thành phần | URL |
| --- | --- |
| Kong | `http://localhost:8000` |
| InfluxDB K6 | `http://localhost:8086` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:30000` |

`pnpm observability:up` chỉ bật InfluxDB. Grafana và Prometheus nằm trong `docker-compose.infra.yml`, nên cần `pnpm infra:up` hoặc tối thiểu:

```powershell
docker compose -f docker-compose.infra.yml up -d prometheus grafana rabbitmq
```

## 4. Scripts

| Script | Mục đích |
| --- | --- |
| `pnpm perf:build` | Bundle TypeScript sang `packages/performance-tests/dist/*.js` |
| `pnpm perf:smoke` | 3 VUs trong 30 giây, dùng trước khi chạy test nặng |
| `pnpm perf:load` | Ramp lên 50 VUs, có exam submit, course enroll và simulation telemetry |
| `pnpm perf:soak` | Soak dev mặc định 30 phút |
| `pnpm perf:soak:full` | Soak đầy đủ 2 giờ |
| `pnpm perf:security` | Brute force, JWT bypass, registration flood, exam flood |
| `pnpm perf:smoke:no-influx` | Chạy smoke không ghi InfluxDB |

Chạy thủ công:

```powershell
k6 run packages/performance-tests/dist/load.js `
  -e BASE_URL=http://localhost:8000 `
  -e TEST_USERNAME=student.b2@test.com `
  -e TEST_USER_PASSWORD=123456 `
  -e K6_SCENARIO=load-nightly `
  --out influxdb=http://localhost:8086/k6
```

## 5. Biến Môi Trường

| Biến | Mặc định | Ghi chú |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:8000` | Kong gateway |
| `K6_SCENARIO` | Theo script, ví dụ `load` | Được ghi thành tag `scenario` và header `X-K6-Scenario` |
| `TEST_USERNAME` | `student.b2@test.com` | User test seed sẵn |
| `TEST_USER_PASSWORD` | `123456` | Mật khẩu user test seed |
| `ADMIN_USERNAME` | `admin@test.com` | Dùng cho admin/question flow |
| `ADMIN_PASSWORD` | `123456` | Mật khẩu admin seed |
| `TEST_EXAM_ID` | `1` | Exam dùng cho start/submit |
| `TEST_COURSE_ID` | `1` | Course dùng cho enroll/detail |
| `TEST_MAP_ID` | `map-default` | Simulation map |
| `SOAK_DURATION` | `2h` trong source, `10m` ở script dev | Override thời gian giữ tải |
| `K6_ATTACK_TYPE` | `all` | Lọc security flow: `brute_force`, `jwt_bypass`, `registration_flood` |

## 6. Metrics Và Dashboard

Dashboard `K6 Load Testing - Luyen Thi Lai Xe` dùng hai nguồn:

| Nhóm panel | Datasource | Metric chính |
| --- | --- | --- |
| Overview, response time, throughput, errors, endpoint SLO | `InfluxDB_K6` | `http_req_duration`, `http_reqs`, `http_req_failed`, `vus` |
| E2E Async Latency | `InfluxDB_K6` | `async_e2e_latency_ms` |
| Security | `InfluxDB_K6` | HTTP tag `"status"`/`"name"` và custom counters `rate_limited_requests`, `blocked_requests` |
| RabbitMQ broker publish/deliver | `Prometheus` | RabbitMQ Prometheus plugin trên `rabbitmq:15692` |
| RabbitMQ app consumer | `Prometheus` | `rabbitmq_messages_processed_total`, `rabbitmq_consumer_duration_seconds` từ service `/metrics` |

Dashboard có biến `scenario`, lấy từ tag K6 `scenario`. Các scenario trong code đều set `tags.scenario` theo `K6_SCENARIO`, nên có thể lọc từng lần chạy.

Nếu panel security trống, kiểm tra:

- Đang chạy `pnpm perf:security` hoặc `K6_SCENARIO=security`.
- Query dùng tag `"name" =~ /^security_/`, nên request phải đi qua helper `http` với tag `security_*`.
- Rate limiter có thể chưa trả `429`; panel vẫn có series từ `401/403` nếu JWT bypass chạy.

Nếu panel E2E Async Latency trống, kiểm tra:

- Flow `exam_submit` có submit thành công.
- `notification-service` WebSocket `/notifications/socket.io` kết nối được.
- Event `notification.created` có `eventType` là `exam.session.passed` hoặc `exam.session.failed`.

Nếu panel RabbitMQ consumer trống, kiểm tra:

- Prometheus target `microservices-local` hoặc `microservices` đang `UP`.
- Service consumer đã xử lý message sau khi Prometheus bắt đầu scrape.
- Endpoint `/metrics` của service có `rabbitmq_consumer_duration_seconds` và `rabbitmq_messages_processed_total`.

## 7. Prometheus Coverage

Prometheus hiện lấy cả broker và app metrics:

| File | Job | Nội dung |
| --- | --- | --- |
| `docker/prometheus/prometheus.local.yml` | `rabbitmq` | Broker metrics từ `rabbitmq:15692` |
| `docker/prometheus/prometheus.local.yml` | `microservices-local` | `/metrics` của service local qua `host.docker.internal:3001-3011` |
| `docker/prometheus/prometheus.yml` | `rabbitmq` | Broker metrics trong Docker network |
| `docker/prometheus/prometheus.yml` | `microservices` | `/metrics` của service Docker DNS |

Như vậy monitoring có đủ:

- Publisher/broker throughput từ RabbitMQ plugin.
- Consumer success/retry/DLQ từ `RabbitMqRetryInterceptor`.
- Consumer processing latency từ `rabbitmq_consumer_duration_seconds`.

## 8. Verify

```powershell
pnpm perf:build
node -e "JSON.parse(require('fs').readFileSync('docker/grafana/provisioning/dashboards/k6-dashboard.json','utf8'))"
```

Khi infra đang chạy:

```powershell
curl http://localhost:8086/ping
curl http://localhost:9090/-/ready
curl http://localhost:30000/api/health
```
