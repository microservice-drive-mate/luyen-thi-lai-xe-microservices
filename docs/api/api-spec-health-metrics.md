# Health & Metrics API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/health`, `/health/live`, `/health/ready`, `/metrics` (được định tuyến thông qua router của từng service cụ thể)  
**Direct local:** Xem danh sách cổng của từng dịch vụ dưới đây  
**Version:** 1.0.0

Tài liệu này đặc tả các API giám sát trạng thái hoạt động (**Health Check**) và xuất chỉ số hiệu năng (**Prometheus Metrics**) được tích hợp trên toàn bộ các dịch vụ (microservices) trong hệ thống **DriveMate**.

Qua Kong, các API này được truy cập bằng cách thêm tiền tố định tuyến của dịch vụ tương ứng (ví dụ: `/identity-service/health/ready`, `/user-service/health/live`, v.v.).

---

## Authentication

Tất cả các endpoint Health Check và Metrics đều là **Public** (không yêu cầu Bearer Token). Các bộ lọc xác thực (Guards) được cấu hình bỏ qua đối với các đường dẫn này.

| Endpoint | Role |
| --- | --- |
| `GET /health` | Public |
| `GET /health/live` | Public |
| `GET /health/ready` | Public |
| `GET /metrics` | Public |

---

## Response Format

Các endpoint `/health`, `/health/live` và `/health/ready` sử dụng chung định dạng bọc response chuẩn của hệ thống:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-30T07:10:00.000Z",
  "path": "/health/live",
  "data": {}
}
```

Trong trường hợp có sự cố (Ví dụ: `/health/ready` trả về HTTP 503), định dạng lỗi được bọc như sau:

```json
{
  "success": false,
  "code": "SERVICE_UNAVAILABLE",
  "message": "Service is not ready",
  "timestamp": "2026-05-30T07:05:46.019Z",
  "path": "/health/ready",
  "errors": {}
}
```

Endpoint `/metrics` là một ngoại lệ, nó trả về dữ liệu định dạng văn bản thô (**Plain Text**) trực tiếp mà không bọc qua JSON.

---

## Error Codes

| HTTP | Code | Nguyên nhân |
| ---: | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 503 | `SERVICE_UNAVAILABLE` | Dịch vụ chưa sẵn sàng do có ít nhất một dependency hạ tầng (Database, Redis, Keycloak, RabbitMQ) bị ngắt kết nối. |

---

## Shared Shapes

### `HealthLivenessReport`

| Field | Type | Description |
| --- | --- | --- |
| `service` | string | Tên của microservice hiện tại |
| `status` | string | Trạng thái của tiến trình (luôn là `ok` đối với liveness) |
| `timestamp` | string | Thời gian kiểm tra (ISO 8601) |
| `uptimeSeconds` | number | Số giây tiến trình đã chạy liên tục |
| `pid` | number | Process ID của tiến trình trên hệ điều hành |
| `memory` | object | Thông tin chi tiết về mức sử dụng bộ nhớ (RSS, Heap, v.v.) |

### `HealthReadinessReport`

| Field | Type | Description |
| --- | --- | --- |
| `service` | string | Tên của microservice hiện tại |
| `status` | string | Trạng thái tổng thể (`ok` hoặc `error`) |
| `timestamp` | string | Thời gian kiểm tra (ISO 8601) |
| `checks` | HealthDependencyReport[] | Danh sách kết quả kiểm tra từng dependency cụ thể |

### `HealthDependencyReport`

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Tên của dependency (ví dụ: `database`, `rabbitmq`, `keycloak`, `redis`) |
| `status` | string | Trạng thái kết nối (`ok`, `error`, `skipped`) |
| `target` | string | Địa chỉ kết nối của dependency |
| `latencyMs` | number | Độ trễ phản hồi tính bằng mili-giây |
| `error` | string | Thông tin lỗi chi tiết nếu kết nối thất bại (chỉ có khi status là `error`) |

---

## Endpoints

### GET `/health/live`

Kiểm tra trạng thái sống của tiến trình dịch vụ (Liveness Probe). Dùng để phát hiện và tự động khởi động lại container bị treo hoặc lỗi nặng.

**Headers**

```http
Accept: application/json
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-30T07:06:41.748Z",
  "path": "/health/live",
  "data": {
    "service": "identity-service",
    "status": "ok",
    "timestamp": "2026-05-30T07:06:41.747Z",
    "uptimeSeconds": 918,
    "pid": 40444,
    "memory": {
      "rss": 54353920,
      "heapTotal": 272400384,
      "heapUsed": 266331328,
      "external": 10571894,
      "arrayBuffers": 5057460
    }
  }
}
```

---

### GET `/health/ready`

Kiểm tra trạng thái sẵn sàng của dịch vụ (Readiness Probe). Dịch vụ sẽ thực hiện ping tới các dependency hạ tầng. Nếu có bất kỳ kết nối nào lỗi, endpoint trả về lỗi `503`.

**Headers**

```http
Accept: application/json
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-30T07:10:00.000Z",
  "path": "/health/ready",
  "data": {
    "service": "identity-service",
    "status": "ok",
    "timestamp": "2026-05-30T07:10:00.000Z",
    "checks": [
      {
        "name": "database",
        "status": "ok",
        "target": "postgresql://user:password@localhost:5432/identity_db",
        "latencyMs": 15
      },
      {
        "name": "rabbitmq",
        "status": "ok",
        "target": "amqp://guest:guest@localhost:5672",
        "latencyMs": 8
      },
      {
        "name": "keycloak",
        "status": "ok",
        "target": "http://localhost:8080",
        "latencyMs": 45
      }
    ]
  }
}
```

**Response `503 Service Unavailable`**

```json
{
  "success": false,
  "code": "SERVICE_UNAVAILABLE",
  "message": "Service is not ready",
  "timestamp": "2026-05-30T07:05:46.019Z",
  "path": "/health/ready",
  "errors": {
    "service": "identity-service",
    "status": "error",
    "timestamp": "2026-05-30T07:05:45.997Z",
    "checks": [
      {
        "name": "database",
        "status": "ok",
        "target": "postgresql://user:password@localhost:5432/identity_db",
        "latencyMs": 122
      },
      {
        "name": "rabbitmq",
        "status": "ok",
        "target": "amqp://guest:guest@localhost:5672",
        "latencyMs": 81
      },
      {
        "name": "keycloak",
        "status": "error",
        "target": "http://localhost:8080",
        "latencyMs": 6004,
        "error": "timeout of 1500ms exceeded"
      }
    ]
  }
}
```

---

### GET `/metrics`

Xuất chỉ số hiệu năng tương thích với Prometheus định dạng Plain Text.

**Headers**

```http
Accept: text/plain
```

**Response `200 OK`**

```text
# HELP nodejs_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE nodejs_process_cpu_user_seconds_total counter
nodejs_process_cpu_user_seconds_total{service="identity-service"} 3.422

# HELP nodejs_process_cpu_system_seconds_total Total system CPU time spent in seconds.
# TYPE nodejs_process_cpu_system_seconds_total counter
nodejs_process_cpu_system_seconds_total{service="identity-service"} 2.031

# HELP nodejs_eventloop_lag_seconds Lag of event loop in seconds.
# TYPE nodejs_eventloop_lag_seconds gauge
nodejs_eventloop_lag_seconds{service="identity-service"} 0.000102
```
