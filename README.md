# Luyện Thi Lái Xe Microservices

Tài liệu này gom phần quan trọng nhất để team dev chạy local, verify code và nắm nhanh các luồng DevOps hiện có trong repo.

File roadmap việc tiếp theo: [README.NEXT-STEPS.md](./README.NEXT-STEPS.md)

## 1. Tổng quan

- Monorepo dùng `npm workspaces` + `turbo`
- Backend chính là các NestJS services trong `apps/*`
- Gateway:
  - `kong/kong.dev.yaml` cho hybrid local
  - `kong/kong.yaml` cho full Docker / deploy
- Config tập trung qua Consul
- Message broker qua RabbitMQ
- Logging có thể đẩy sang ELK qua Logstash

## 2. Services hiện có

- Production services (10):
  - `identity-service`
  - `user-service`
  - `exam-service`
  - `course-service`
  - `question-service`
  - `notification-service`
  - `analytics-service`
  - `simulation-service`
  - `audit-service`
  - `media-service`
- Dev-only supporting service:
  - `docs-service` dùng cho tài liệu / Swagger tổng hợp khi cần, không đưa vào Production

## 3. First Run Cho Dev/Frontend Clone Repo Lần Đầu

Khuyến nghị cho frontend/dev mới kéo repo: chạy backend ở hybrid mode. Infra chạy bằng Docker, service NestJS chạy local. Cách này dễ debug hơn full Docker và ít gặp lỗi build image.

Yêu cầu:

- Docker Desktop đang chạy
- Node.js >= 18
- npm. Trên Windows nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd`

Từ root repo, chạy theo đúng thứ tự:

```powershell
npm.cmd install
npm.cmd run infra:up
npm.cmd run consul:seed:local
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:seed
npm.cmd run dev
```

Sau khi chạy xong:

- Kong/API Gateway: http://localhost:8000
- Swagger tổng hợp: http://localhost:3009/docs
- Keycloak: http://localhost:8080
- Consul: http://localhost:8500
- RabbitMQ UI: http://localhost:15672
- Mailpit: http://localhost:8025
- Kibana: http://localhost:5601

Demo accounts được seed vào Keycloak, password chung:

```text
123456
```

Ví dụ login frontend:

- `admin@test.com`
- `manager@test.com`
- `instructor.b1@test.com`
- `student.b1@test.com`
- `student.b2@test.com`

Frontend chỉ gửi:

```http
Authorization: Bearer <access_token>
```

Không tự gửi `x-user-id`.

Nếu muốn reset sạch môi trường local:

```powershell
npm.cmd run infra:down
docker compose -f docker-compose.infra.yml down -v
```

Sau đó chạy lại từ bước `infra:up`.

## 4. Chạy full stack bằng Docker

Yêu cầu:

- Docker Desktop

Khởi động:

```bash
npm run docker:up
```

Tắt:

```bash
npm run docker:down
docker compose down
```

URL quan trọng:

- Kong Proxy: http://localhost:8000
- Kong Admin API: http://localhost:8001
- RabbitMQ UI: http://localhost:15672
- Consul UI: http://localhost:8500
- Keycloak: http://localhost:8080
- Kibana: http://localhost:5601

## 5. Chạy local để code/debug

Yêu cầu:

- Node.js >= 18
- npm
- Docker Desktop

Các bước cơ bản:

```bash
npm install
npm run infra:up
npm run consul:seed:local
npm run dev
```

Nếu cần generate Prisma client trước khi build hoặc check:

```bash
npm run prisma:generate
# hoặc
npm run db:generate
```

Nếu cần apply migration + seed:

```bash
npm run db:deploy
npm run db:seed
```

Smoke test health qua Kong:

```bash
npm run smoke
```

## 6. Root Scripts hữu ích

```bash
npm run build
npm run check-types
npm run lint
npm run format
npm run prisma:generate
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:seed:question-images
npm run db:backup:local
npm run smoke
```

## 7. Consul Configuration Management

Tất cả microservices sử dụng Consul để quản lý configuration tập trung. Repo vẫn hỗ trợ seed cấu hình local qua JSON, và trong Docker thì `consul-init` sẽ seed tự động khi stack lên.

Các command hữu ích:

```bash
npm run consul:seed
npm run consul:seed:local
npm run consul:list
npm run consul:get
```

Hướng dẫn chi tiết: [guides/consul/WORKFLOW.md](./guides/consul/WORKFLOW.md)

## 8. Gateway Routes

- `/auth` -> `identity-service`
- `/users` -> `user-service`
- `/exams` -> `exam-service`
- `/questions` -> `question-service`
- `/courses` -> `course-service`
- `/notifications` -> `notification-service`
- `/analytics` -> `analytics-service`
- `/simulation` -> `simulation-service`
- `/media` -> `media-service`
- `/admin/audit-logs` -> `audit-service`

## 9. Seed demo data khi chạy bằng Docker

```bash
docker compose up -d consul consul-init keycloak redis rabbitmq \
  db-identity db-user db-media db-question db-exam db-course \
  db-notification db-analytics db-simulation db-audit
docker compose run --rm identity-service npm run db:deploy -w identity-service
docker compose run --rm identity-service npm run db:seed -w identity-service
```

Demo accounts được seed vào Keycloak và các service DB dùng chung password `123456`.

## 10. Ghi chú DevOps

- Production scope đã chốt: 10 services; `docs-service` chỉ dùng cho Dev.
- CI/CD Phase 4:
  - Pull Request Validation: quality gate, build image, Trivy scan, không push image.
  - Main Image Release: build image, Trivy scan, push GHCR bằng tag `${git_sha}` và `latest`.
  - Production Release: chạy thủ công bằng immutable image tag, gắn GitHub Environment `production`.
- Health endpoints chuẩn:
  - `/health`
  - `/health/live`
  - `/health/ready`
- Smoke test cấp root ở [scripts/smoke.ts](./scripts/smoke.ts)
- Bộ điều phối migration cấp root ở [scripts/prisma-migrate-all.ts](./scripts/prisma-migrate-all.ts)
- Bộ điều phối seed cấp root ở [scripts/prisma-seed-all.ts](./scripts/prisma-seed-all.ts)
- Script sao lưu DB local ở [scripts/db-backup-local.ts](./scripts/db-backup-local.ts)
  - Backup đủ các DB local: `identity`, `user`, `exam`, `course`, `question`, `notification`, `analytics`, `simulation`, `media`, `audit`, `keycloak`
- Scaffold Jenkins / GHCR / Docker Compose deploy ở:
  - [Jenkinsfile](./Jenkinsfile)
  - [docker-compose.deploy.yml](./docker-compose.deploy.yml)
  - [guides/devops/JENKINS-DOCKER-COMPOSE.md](./guides/devops/JENKINS-DOCKER-COMPOSE.md)
- Phase 6.1-6.5 Logging + ELK + Correlation ID + Metrics + Alerting ở [guides/devops/OBSERVABILITY-ELK.md](./guides/devops/OBSERVABILITY-ELK.md)
- Runbook Observability ở [guides/devops/OBSERVABILITY-RUNBOOK.md](./guides/devops/OBSERVABILITY-RUNBOOK.md)

## 11. Quy trình làm việc

1. Tạo branch từ `main`
2. Code và commit theo từng scope nhỏ
3. Chạy `npm run check-types` và `npm run build` trước khi push
4. Nếu có thay đổi API hoặc infra, chạy thêm `npm run smoke`
5. Mở PR và chỉ merge khi CI pass

## 12. Chiến thuật Availability: Health Check + Restart

Tactic đang áp dụng:

- Phát hiện lỗi: Ping/Echo qua `/health/live`, sanity checking qua `/health/ready`, monitor nhanh bằng `npm run smoke`.
- Khôi phục sau lỗi: Docker Compose dùng `restart: unless-stopped` để tự chạy lại service khi process/container chết.
- Docker healthcheck đánh dấu service `healthy/unhealthy` trong `docker compose ps`; Docker Compose không tự restart container chỉ vì healthcheck bị `unhealthy` nếu process vẫn đang chạy.

Kiểm tra health qua Kong:

```powershell
docker compose up -d --build kong identity-service user-service exam-service course-service question-service notification-service analytics-service simulation-service media-service
npm.cmd run smoke
```

`npm run smoke` mặc định chờ 300ms giữa mỗi request để không chạm rate-limit của Kong khi demo. Nếu cần chạy nhanh hơn trong môi trường đã tắt hoặc nâng rate-limit:

```powershell
$env:SMOKE_DELAY_MS=0
npm.cmd run smoke
```

Kiểm tra trực tiếp service:

```powershell
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3010/health/ready
```

Demo lỗi dependency:

```powershell
docker compose stop db-user
curl http://localhost:3002/health/ready
docker compose start db-user
curl http://localhost:3002/health/ready
```

Demo restart:

```powershell
docker compose exec user-service sh -c "kill -9 1"
docker compose ps user-service
```
