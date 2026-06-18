# Hướng dẫn Kiểm thử (Testing Guide)

Tài liệu này cung cấp toàn bộ quy chuẩn, cấu hình và lệnh chạy dành cho hệ thống kiểm thử tự động của dự án **Luyện thi lái xe Microservices**. Hệ thống bao gồm 10 services độc lập, được quản lý dưới dạng Monorepo thông qua Turborepo và pnpm.

---

## 1. Triết lý kiểm thử (Testing Philosophy)

Để đảm bảo độ ổn định của hệ thống phân tán, dự án tuân thủ chặt chẽ 3 tầng kiểm thử:

1. **Unit Testing (Kiểm thử mức Đơn vị)**:
   - **Mục tiêu**: Kiểm tra logic nghiệp vụ lõi (Domain Logic) bên trong các `UseCases` và tính toàn vẹn của HTTP/Event `Controllers`.
   - **Quy tắc Vàng**: **Hoàn toàn cô lập (Isolated)**. Tuyệt đối không kết nối đến Database thật, Redis, hay RabbitMQ. Toàn bộ `Repositories`, `Clients`, `Publishers` phải được mock bằng `jest.fn()`.
   - **Tốc độ**: Cực nhanh, chạy tính bằng mili-giây.

2. **End-to-End Testing (Kiểm thử Tích hợp Toàn trình - E2E)**:
   - **Mục tiêu**: Kiểm tra sự hoạt động trơn tru của toàn bộ vòng đời Request → Controller → UseCase → Database.
   - **Quy tắc**: **KHÔNG DÙNG SQLITE**. Vì dự án sử dụng PostgreSQL với Prisma (chứa các tính năng đặc thù như JSONB, Arrays, Enum, GIS), việc dùng SQLite sẽ gây sai lệch.
   - **Giải pháp E2E Database**: Sử dụng **Testcontainers** (tự động spin-up Docker container chứa PostgreSQL khi chạy test, và tự động dọn dẹp khi xong).
   - **Giải pháp Event Broker**: Với RabbitMQ, dùng in-memory message broker mock trong NestJS Microservices.

3. **Performance Testing (Kiểm thử Hiệu năng - K6)**:
   - **Mục tiêu**: Đảm bảo SLO (Service Level Objectives) dưới tải thực tế.
   - **Công cụ**: [K6](https://k6.io/) + **InfluxDB** + **Grafana** để giám sát real-time.
   - **Package**: `packages/performance-tests` - module TypeScript độc lập trong Monorepo.
   - **Nguyên tắc cốt lõi**: Zero-Data Bloat (dọn sạch DB sau mỗi run), SLO Thresholds cứng, Observability (X-K6-Trace-Id tự động nhúng vào mọi request).

---

## 2. Hướng dẫn chạy Unit & E2E Test

### 2.1. Tại Cấp độ Từng Service (Local Service Level)

Khi đang dev tính năng mới trong một service cụ thể, chỉ cần làm việc nội bộ trong service đó.

1. Di chuyển vào thư mục service:
   ```bash
   cd apps/identity-service
   ```
2. Chạy toàn bộ Unit test 1 lần:
   ```bash
   pnpm run test
   ```
3. **Chạy Unit Test ở chế độ Watch** (Khuyên dùng khi đang code):
   ```bash
   pnpm run test:watch
   ```
4. Chạy Coverage:
   ```bash
   pnpm run test:cov
   ```
5. Chạy E2E Test:
   ```bash
   # Đảm bảo Docker đang bật (cần Testcontainers)
   pnpm run test:e2e
   ```
6. **Debug Test**:
   ```bash
   pnpm run test:debug
   ```

### 2.2. Tại Cấp độ Toàn Hệ thống (Root/Turborepo Level)

Turborepo phân tích dependency tree, chạy song song và tận dụng cache.

```bash
# Toàn bộ Unit Test trên tất cả services
pnpm test:all

# Toàn bộ E2E Test (concurrency=2 để tiết kiệm RAM)
pnpm test:e2e:all

# Chỉ Core Services (Identity, Exam, Course)
pnpm test:core

# Filter thủ công
pnpm turbo run test --filter=exam-service --filter=user-service
```

---

## 3. Cấu trúc File Test Chuẩn mực

- **Unit Test**: Đặt ngay cạnh file source code.
  - *Ví dụ*: `start-session.use-case.ts` → `start-session.use-case.spec.ts`
- **E2E Test**: Trong thư mục `test/` của từng service.
  - *Ví dụ*: `apps/exam-service/test/app.e2e-spec.ts`

Tham khảo `notification-service` hoặc `exam-service` để nắm pattern Inject Dependency và Mocking chuẩn.

---

## 4. Performance Testing với K6 (Enterprise Setup)

Bộ test hiệu năng được đặt tại `packages/performance-tests`, là một package TypeScript chính thức trong Monorepo.

### 4.1. Kiến trúc tổng quan

```
packages/performance-tests/
├── package.json          # @repo/performance-tests, devDeps: @types/k6, esbuild
├── tsconfig.json         # Target ES2020, types: @types/k6
├── build.js              # esbuild bundler — compile TS → dist/
├── src/
│   ├── config.ts         # SLO thresholds, service registry, shared enums (mirror từ backend)
│   ├── helpers/
│   │   ├── http.ts       # HTTP wrapper tự động gắn X-K6-Trace-Id & X-K6-Scenario
│   │   ├── auth.ts       # login(), loginAsAdmin(), refreshToken()
│   │   └── data.ts       # Typed data generators (RegistrationData, ExamSubmission, TelemetryEvent...)
│   ├── services/         # API wrappers cho từng Core Service
│   │   ├── health.ts
│   │   ├── identity.ts
│   │   ├── exam.ts
│   │   ├── course.ts
│   │   ├── user.ts       
│   │   ├── question.ts   
│   │   └── simulation.ts # telemetry flood
│   └── scenarios/        # 4 kịch bản chạy K6
│       ├── smoke.ts      # PR Gate: 3 VUs / 30s
│       ├── load.ts       # Nightly: 50 VUs / 15 phút
│       ├── soak.ts       # Pre-release: 30 VUs / 2 giờ
│       └── security.ts   # Rate-limit & anti-spam
└── dist/                 # Output sau khi build (gitignore)
```

### 4.2. Yêu cầu

- **K6** đã được cài đặt: [https://k6.io/docs/get-started/installation/](https://k6.io/docs/get-started/installation/)
- **Docker** đang chạy (để spin-up Observability Stack)
- Hệ thống backend đang chạy (hybrid local hoặc full Docker)

### 4.3. Quy trình chạy chuẩn

**Bước 1: Build TypeScript thành JS**
```bash
# Từ root của monorepo:
pnpm perf:build

# Hoặc trực tiếp từ package:
cd packages/performance-tests
node build.js
# Output: dist/smoke.js, dist/load.js, dist/soak.js, dist/security.js
```

**Bước 2: Khởi động Observability Stack (InfluxDB + Grafana)**
```bash
pnpm observability:up
# Grafana: http://localhost:3001 (user: admin / pass: admin)
# InfluxDB: http://localhost:8086
```

**Bước 3: Chạy scenario**
```bash
# Smoke Test (kiểm tra nhanh, dùng trước mỗi lần chạy nặng)
pnpm perf:smoke

# Hoặc thủ công với output vào InfluxDB:
k6 run packages/performance-tests/dist/smoke.js --out influxdb=http://localhost:8086/k6

# Load Test (chạy nightly hoặc khi cần benchmark)
pnpm perf:load

# Soak Test (chạy trước release, cần vài tiếng)
pnpm perf:soak
# Override duration để test nhanh (10 phút thay vì 2 giờ):
k6 run packages/performance-tests/dist/soak.js -e SOAK_DURATION=10m --out influxdb=http://localhost:8086/k6

# Security Test
pnpm perf:security
```

**Bước 4: Xem Dashboard Grafana**
- Mở `http://localhost:3001`
- Dashboard **"K6 Load Testing — luyen-thi-lai-xe"** đã được auto-provision.
- Import thêm dashboard community ID `2587` (K6 Official) nếu muốn view chi tiết hơn.

### 4.4. Biến môi trường cho K6

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `BASE_URL` | `http://localhost:8000` | Kong Gateway URL |
| `TEST_USERNAME` | `testuser@example.com` | User test mặc định |
| `TEST_USER_PASSWORD` | `Test@123456` | Mật khẩu user test |
| `ADMIN_USERNAME` | `admin@example.com` | Tài khoản admin |
| `ADMIN_PASSWORD` | `Admin@123456` | Mật khẩu admin |
| `TEST_EXAM_ID` | `1` | ID đề thi để test |
| `TEST_COURSE_ID` | `1` | ID khóa học để test |
| `TEST_MAP_ID` | `map-default` | ID bản đồ sa hình |
| `SOAK_DURATION` | `2h` | Thời gian ngâm soak test |
| `K6_SCENARIO` | `unknown-scenario` | Tên kịch bản (cho trace header) |

Ví dụ chạy với môi trường staging:
```bash
k6 run packages/performance-tests/dist/load.js \
  -e BASE_URL=https://staging.example.com \
  -e TEST_USERNAME=k6_tester@example.com \
  -e TEST_USER_PASSWORD=SecurePass@2024 \
  -e K6_SCENARIO=load-staging \
  --out influxdb=http://localhost:8086/k6
```

### 4.5. SLO Thresholds (Ngưỡng chết)

Các ngưỡng được định nghĩa cứng tại `src/config.ts`. Test sẽ **TỰ ĐỘNG FAIL** nếu vi phạm:

| Scenario | p(95) | p(99) | Error Rate |
|----------|-------|-------|------------|
| **Smoke** | `< 300ms` | `< 600ms` | `< 0.1%` |
| **Load** | `< 500ms` | `< 1000ms` | `< 0.1%` |
| **Soak** | `< 1000ms` | `< 3000ms` | `< 0.1%` |
| **Stress** | `< 2000ms` | `< 5000ms` | `< 5%` |
| **Security** | `< 2000ms` | *(n/a)* | *(intentionally high)* |

Ngưỡng per-endpoint ví dụ trong load test:
```
identity_login:   p(95) < 800ms
exam_start:       p(95) < 1500ms
exam_submit:      p(95) < 2000ms
simulation_telemetry: p(95) < 200ms
```

### 4.6. Observability — X-K6-Trace-Id

Mọi request K6 đều được tự động gắn 2 headers đặc biệt bởi `src/helpers/http.ts`:
- `X-K6-Trace-Id`: UUID ngẫu nhiên, duy nhất cho mỗi request.
- `X-K6-Scenario`: Tên kịch bản đang chạy.

NestJS middleware (`@repo/common`) tự động hứng và lan truyền 2 headers này qua `AsyncLocalStorage`, đảm bảo mọi log line đều có thể được trace ngược về K6 request gốc:

```bash
# Tìm tất cả log liên quan đến một request K6 cụ thể:
grep "x-k6-trace-id:abc123" logs/*.log
```

### 4.7. Chiến lược CI/CD

| Kịch bản | Khi nào chạy | Mục tiêu |
|----------|-------------|----------|
| `smoke.ts` | Mỗi Pull Request | Không để API sập ngay giây đầu |
| `load.ts` | Nightly Build (nhánh `main`) | Tìm bottleneck mới phát sinh |
| `soak.ts` | Trước mỗi Release | Phát hiện Memory Leak, Connection Pool Exhaustion |
| `security.ts` | Weekly | Kiểm tra Rate Limiter và cơ chế anti-spam vẫn hoạt động |

### 4.8. Grafana Dashboard

Dashboard được auto-provision tại `docker/grafana/provisioning/dashboards/k6-dashboard.json`.

Các panel chính:
- **Overview**: p(95), p(99), Error Rate, Throughput (req/s), VUs, Total Requests.
- **Response Time**: Biểu đồ p50/p95/p99 theo thời gian.
- **VUs & Throughput**: VUs ramp up/down, req/s thực tế.
- **Errors**: Error rate, HTTP status codes (2xx/4xx/5xx).
- **Per-Endpoint SLO**: p(95) từng endpoint Core Service.
- **Security**: Rate-limited (429), Unauthorized (401), Blocked requests.
- **Soak Stability**: Response time trend - đường PHẲNG = hệ thống ổn định, đường DỐC LÊN = Memory Leak.

---

## 5. Tóm tắt lệnh nhanh

```bash
# ===== UNIT & E2E =====
pnpm test:all              # Tất cả unit test (10 services)
pnpm test:e2e:all          # Tất cả E2E test
pnpm test:core             # Unit test Core Services (Identity, Exam, Course)

# ===== K6 PERFORMANCE =====
pnpm perf:build            # Build TS -> JS
pnpm observability:up      # Khởi động InfluxDB + Grafana
pnpm perf:smoke            # Smoke test (30s)
pnpm perf:load             # Load test (17 phút)
pnpm perf:soak             # Soak test (10 phút) -> dev
pnpm perf:soak:full        # Soak test (2 giờ)
pnpm perf:security         # Security / Rate-limit test
pnpm observability:down    # Tắt stack

# ===== THỦ CÔNG =====
k6 run packages/performance-tests/dist/smoke.js -e BASE_URL=http://localhost:8000
k6 run packages/performance-tests/dist/load.js --out influxdb=http://localhost:8086/k6
k6 run packages/performance-tests/dist/soak.js -e SOAK_DURATION=10m
```
