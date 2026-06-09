# Luyện Thi Lái Xe Microservices

Repo này là hệ thống backend dạng microservices cho nền tảng luyện thi lái xe. Monorepo dùng `pnpm workspace` và `Turbo`, các service chính viết bằng `NestJS`, dữ liệu quản lý bằng `Prisma`, cấu hình tập trung qua `Consul`, giao tiếp bất đồng bộ qua `RabbitMQ`, xác thực qua `Keycloak`, gateway qua `Kong`.

Tài liệu chính nằm trong [docs](./docs/README.md). Nếu bạn mới vào repo, hãy đọc README này trước, sau đó đọc [Kong + Frontend Integration](./docs/api/kong-frontend-integration.md) nếu làm frontend hoặc [Development Guidelines](./docs/development-guidelines.md) nếu sửa backend.

## Tổng Quan Kiến Trúc

- `apps/*`: các NestJS microservice.
- `packages/*`: package dùng chung, gồm `@repo/common`, cấu hình ESLint và TypeScript.
- `docker-compose.infra.yml`: hạ tầng local cho chế độ hybrid.
- `docker-compose.yaml`: full stack Docker.
- `kong/kong.dev.yaml`: Kong cho hybrid local, route tới service chạy trên máy qua `host.docker.internal`.
- `kong/kong.yaml`: Kong cho full Docker, route qua Docker DNS.
- `charts/luyen-thi-lai-xe`: Helm chart cho Kubernetes/GCP.
- `scripts/*`: script seed Consul, Prisma migration/seed, smoke test, backup và DevOps metrics.

## Service Hiện Có

Production scope hiện gồm 10 service:

| Service | Cổng local/hybrid | Trách nhiệm chính |
| --- | ---: | --- |
| `identity-service` | `3001` | Đăng nhập, đăng xuất, refresh token, quên mật khẩu, quản lý identity/Keycloak |
| `user-service` | `3002` | Hồ sơ người dùng, thông tin học viên, hạng giấy phép |
| `exam-service` | `3003` | Đề thi, phiên thi, lịch sử làm bài, câu sai |
| `course-service` | `3004` | Khóa học, bài học, ghi danh, tiến độ học |
| `question-service` | `3005` | Ngân hàng câu hỏi, chủ đề câu hỏi |
| `notification-service` | `3006` | Thông báo và cảnh báo học tập |
| `analytics-service` | `3007` | Tiến độ học tập, thống kê nghiệp vụ |
| `simulation-service` | `3008` | Mô phỏng/practice 2D |
| `media-service` | `3010` | Metadata file, media, tích hợp storage |
| `audit-service` | `3011` | Nhật ký audit bảo mật |

`docs-service` chạy cổng `3009` trong local/dev để tổng hợp tài liệu API. Service này không thuộc production scope chính.

Trong full Docker, mỗi service listen cổng `3000` bên trong container và được publish ra host theo các cổng ở bảng trên.

## Yêu Cầu Môi Trường

- Docker Desktop đang chạy.
- Node.js `>=18`.
- Corepack bật sẵn `pnpm@10.34.1`:

```powershell
corepack enable
corepack prepare pnpm@10.34.1 --activate
```

## Chạy Hybrid Local

Chế độ khuyến nghị cho dev: Docker chạy hạ tầng, còn NestJS services chạy trực tiếp trên máy. Cách này dễ debug và khớp với `kong/kong.dev.yaml`.

```powershell
pnpm install
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

URL quan trọng:

| Thành phần | URL |
| --- | --- |
| Kong API Gateway | `http://localhost:8000` |
| Docs service / Scalar | `http://localhost:3009/docs` |
| Keycloak | `http://localhost:8080` |
| Consul | `http://localhost:8500` |
| RabbitMQ UI | `http://localhost:15672` |
| Mailpit | `http://localhost:8025` |
| Kibana | `http://localhost:5601` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:30000` |

Kiểm tra nhanh qua Kong:

```powershell
pnpm run smoke
```

Tắt hạ tầng hybrid:

```powershell
pnpm run infra:down
```

Reset sạch volume hạ tầng local khi cần:

```powershell
docker compose -f docker-compose.infra.yml down -v
```

## Chạy Full Docker

Chế độ này build/chạy toàn bộ stack bằng Docker Compose.

```powershell
pnpm run docker:up
pnpm run docker:migrate
pnpm run db:seed
```

Tắt full Docker:

```powershell
pnpm run docker:down
```

Nếu cần build lại image:

```powershell
pnpm run docker:build
pnpm run docker:up
```

## Tài Khoản Demo

Seed data tạo các tài khoản demo trong Keycloak và service DB. Mật khẩu chung:

```text
123456
```

Một số tài khoản thường dùng:

- `admin@test.com`
- `manager@test.com`
- `instructor.b1@test.com`
- `student.b1@test.com`
- `student.b2@test.com`

Frontend chỉ cần gửi:

```http
Authorization: Bearer <access_token>
```

Không tự gửi `x-user-id` hoặc `x-user-role` từ frontend. Các service đọc user từ JWT/Keycloak; các header debug chỉ dùng cho tình huống đặc biệt.

## Gateway Và API

Frontend nên gọi một base URL duy nhất:

```text
http://localhost:8000
```

Mapping chính qua Kong:

| Service | Business path |
| --- | --- |
| `identity-service` | `/auth/*`, `/admin/*` |
| `user-service` | `/users/*`, `/admin/users/*` |
| `exam-service` | `/exams/*`, `/admin/exams/*` |
| `course-service` | `/courses/*`, `/enrollments/*`, `/admin/courses/*` |
| `question-service` | `/admin/questions/*` |
| `notification-service` | `/notifications/*`, `/admin/academic-warnings/*` |
| `analytics-service` | `/analytics/*` |
| `simulation-service` | `/simulation/*` |
| `media-service` | `/media/*`, `/admin/media/*` |
| `audit-service` | `/admin/audit-logs/*` |

Swagger của từng service qua Kong:

```text
http://localhost:8000/identity-service/docs
http://localhost:8000/user-service/docs
http://localhost:8000/exam-service/docs
http://localhost:8000/course-service/docs
http://localhost:8000/question-service/docs
http://localhost:8000/notification-service/docs
http://localhost:8000/analytics-service/docs
http://localhost:8000/simulation-service/docs
http://localhost:8000/media-service/docs
http://localhost:8000/audit-service/docs
```

Tài liệu frontend chi tiết nằm ở [docs/api/kong-frontend-integration.md](./docs/api/kong-frontend-integration.md).

## Script Hay Dùng

```powershell
# Build, typecheck, lint/format
pnpm run build
pnpm run check-types
pnpm run lint
pnpm run check
pnpm run format

# Prisma
pnpm run prisma:generate
pnpm run db:generate
pnpm run db:migrate
pnpm run db:deploy
pnpm run db:seed
pnpm run db:seed:question
pnpm run db:seed:question-images

# Hạ tầng và Docker
pnpm run infra:up
pnpm run infra:down
pnpm run infra:logs
pnpm run docker:up
pnpm run docker:down
pnpm run docker:build
pnpm run docker:migrate

# Consul
pnpm run consul:seed
pnpm run consul:seed:local
pnpm run consul:list
pnpm run consul:get

# Kiểm tra và vận hành
pnpm run smoke
pnpm run test
pnpm run test:cov
pnpm run test:integration
pnpm run observability:smoke
pnpm run rabbitmq:smoke
pnpm run db:backup:local
pnpm run db:backup:once
pnpm run keycloak:backup:once
pnpm run db:restore:test
pnpm run dora:report
```

## Cấu Hình Consul

Service đọc cấu hình theo thứ tự ưu tiên:

```text
biến môi trường -> Consul -> giá trị mặc định
```

Key Consul dùng format:

```text
config/<environment>/<service-name>/<path>
config/development-local/question-service/database.url
config/development/media-service/storage.accountName
```

Môi trường chính:

- `development-local`: service chạy trên máy, hạ tầng chạy trong Docker.
- `development`: service và hạ tầng cùng chạy trong Docker network.
- `staging` và `production`: dùng cho deploy.

Xem thêm [Consul Workflow](./docs/devops/consul-workflow.md).

## Database, Migration Và Seed

Mỗi service có Prisma schema riêng trong `apps/<service>/prisma`. Các service không tạo foreign key chéo service; chỉ lưu UUID reference.

Generate Prisma client:

```powershell
pnpm run db:generate
```

Tạo migration khi dev local:

```powershell
pnpm run db:migrate
```

Apply migration kiểu deploy:

```powershell
pnpm run db:deploy
```

Seed toàn bộ demo data:

```powershell
pnpm run db:seed
```

## Health, Metrics Và Observability

Các service dùng endpoint health chuẩn:

```text
/health
/health/live
/health/ready
/metrics
```

Kiểm tra health qua Kong:

```powershell
pnpm run smoke
```

Kiểm tra trực tiếp một service khi chạy hybrid:

```powershell
curl http://localhost:3001/health/ready
curl http://localhost:3002/health/ready
curl http://localhost:3011/health/ready
```

Tài liệu liên quan:

- [Health & Metrics API](./docs/api/api-spec-health-metrics.md)
- [ELK Logging Guide](./docs/devops/elk-logging-guide.md)
- [Observability Runbook](./docs/devops/observability-runbook.md)
- [OpenTelemetry và Jaeger](./docs/devops/opentelemetry-jaeger-tracing.md)
- [Business Metrics](./docs/devops/business-metrics.md)

## DevOps Và Deploy

Repo đã có baseline cho:

- Docker Compose local/full stack.
- Kong gateway.
- Consul config management.
- RabbitMQ messaging.
- Keycloak auth.
- ELK, Prometheus, Grafana, Jaeger.
- Backup PostgreSQL và Keycloak.
- GitHub Actions release safety.
- Jenkins + Docker Compose deployment flow.
- Helm chart cho Kubernetes/GCP.
- DORA metrics và deployment event store.

Tài liệu chính:

- [DevOps Status Report](./docs/devops/devops-status-report.md)
- [Jenkins + Docker Compose](./docs/devops/jenkins-docker-compose.md)
- [Kubernetes GCP Deployment](./docs/devops/kubernetes-gcp-deployment.md)
- [GCP Setup](./docs/devops/gcp-setup.md)
- [Backup Strategy](./docs/devops/backup-strategy.md)
- [DORA Metrics Guide](./docs/devops/dora-metrics-guide.md)
- [Release Safety](./docs/devops/github-actions-release-safety.md)

## Tài Liệu API Theo Service

`docs/api` là nơi chính để đọc contract của từng service: endpoint, auth/role, request, response, error code, event side effect và ghi chú frontend.

- [analytics-service](./docs/api/api-spec-analytics.md)
- [audit-service](./docs/api/api-spec-audit.md)
- [course-service](./docs/api/api-spec-course.md)
- [exam-service](./docs/api/api-spec-exam.md)
- [identity-service](./docs/api/api-spec-identity.md)
- [media-service](./docs/api/api-spec-media.md)
- [notification-service](./docs/api/api-spec-notification.md)
- [question-service](./docs/api/api-spec-question.md)
- [simulation-service](./docs/api/api-spec-simulation.md)
- [user-service](./docs/api/api-spec-user.md)

## Quy Trình Làm Việc Đề Xuất

1. Tạo branch từ `main`.
2. Đọc tài liệu liên quan trong `docs/`.
3. Sửa code đúng scope, giữ convention DDD/Clean Architecture.
4. Nếu đổi API/config/workflow, cập nhật tài liệu tương ứng.
5. Chạy check hẹp trước, ví dụ `pnpm --dir apps/<service> run check-types`.
6. Chạy check rộng hơn khi thay đổi ảnh hưởng nhiều service: `pnpm run check-types`, `pnpm run build`, `pnpm run smoke`.
7. Mở PR khi các check cần thiết đã pass.

## Ghi Chú Quan Trọng

- Không commit secret thật. Dùng `.env` local và `.env.example` cho placeholder.
- Không import Prisma/NestJS/RabbitMQ/Keycloak vào `domain/`.
- Không tạo quan hệ DB chéo service.
- Frontend gọi API qua Kong, không gọi trực tiếp cổng service trong flow bình thường.
- Khi gặp tài liệu legacy, hãy ưu tiên file tương ứng trong `docs/`.
