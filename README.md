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

- Core services:
  - `identity-service`
  - `user-service`
  - `exam-service`
  - `course-service`
  - `question-service`
  - `notification-service`
  - `analytics-service`
  - `simulation-service`
- Supporting services:
  - `media-service`
  - `docs-service` dùng cho tài liệu / Swagger tổng hợp khi cần

## 3. Chạy full stack bằng Docker

Yêu cầu:

- Docker Desktop

Khởi động:

```bash
npm run docker:up
```

Tắt:

```bash
npm run docker:down
```

URL quan trọng:

- Kong Proxy: http://localhost:8000
- Kong Admin API: http://localhost:8001
- RabbitMQ UI: http://localhost:15672
- Consul UI: http://localhost:8500
- Keycloak: http://localhost:8080
- Kibana: http://localhost:5601

## 4. Hybrid Dev Mode

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

## 5. Root Scripts hữu ích

```bash
npm run build
npm run check-types
npm run lint
npm run format
npm run prisma:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:backup:local
npm run smoke
```

## 6. Consul

Repo vẫn hỗ trợ seed cấu hình local qua JSON:

```bash
npm run consul:seed:local
npm run consul:list
```

Trong Docker, `consul-init` cũng sẽ seed cấu hình tự động khi stack lên.

## 7. Gateway Routes

- `/auth` -> `identity-service`
- `/users` -> `user-service`
- `/exams` -> `exam-service`
- `/questions` -> `question-service`
- `/courses` -> `course-service`
- `/notifications` -> `notification-service`
- `/analytics` -> `analytics-service`
- `/simulations` -> `simulation-service`
- `/media` -> `media-service`

## 8. DevOps Notes

- Health endpoints chuẩn:
  - `/health`
  - `/health/live`
  - `/health/ready`
- Root smoke test ở [scripts/smoke.ts](./scripts/smoke.ts)
- Local DB backup script ở [scripts/db-backup-local.ts](./scripts/db-backup-local.ts)
- Jenkins / GHCR / deploy compose scaffold ở:
  - [Jenkinsfile](./Jenkinsfile)
  - [docker-compose.deploy.yml](./docker-compose.deploy.yml)
  - [guides/devops/JENKINS-DOCKER-COMPOSE.md](./guides/devops/JENKINS-DOCKER-COMPOSE.md)

## 9. Quy trình làm việc

1. Tạo branch từ `main`
2. Code và commit theo từng scope nhỏ
3. Chạy `npm run check-types` và `npm run build` trước khi push
4. Nếu có thay đổi API hoặc infra, chạy thêm `npm run smoke`
5. Mở PR và chỉ merge khi CI pass
