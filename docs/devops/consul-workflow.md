# Workflow Làm Việc Với Consul

## Mục tiêu

- Không cần tạo `.env` riêng cho từng service để chạy local.
- Service chạy local vẫn gọi được DB, RabbitMQ, Consul đang nằm trong Docker.
- Giữ tách bạch giữa local dev và full Docker.

## Quy ước môi trường

- `development`: dùng cho service chạy trong Docker.
- `development-local`: dùng cho service chạy local trên máy host.

Consul được seed cả hai bộ config.

## Cách chạy local, không cần `.env`

1. Bật infrastructure:

```powershell
docker compose up -d consul consul-init keycloak redis rabbitmq \
  db-identity db-user db-media db-question db-exam db-course \
  db-notification db-analytics db-simulation
```

2. Chạy service local bình thường:

```powershell
cd apps/user-service
npm run start:dev
```

```powershell
cd apps/exam-service
npm run start:dev
```

Khi chạy local, code sẽ tự chọn `development-local` nếu `CONSUL_URL` đang là `localhost`.

## Service sẽ lấy config gì

`development-local` dùng host machine:

- DB: `localhost:5432` đến `localhost:5439`
- RabbitMQ: `localhost:5672`
- Port app: `3001` đến `3008`

`development` dùng Docker network:

- DB: `db-*`
- RabbitMQ: `rabbitmq`
- Port app: `3000`

## Exam-service service discovery

`exam-service` cần các key bổ sung:

- `services.question.baseUrl`: `http://localhost:3005` trong `development-local`, `http://question-service:3000` trong `development`
- `services.user.baseUrl`: `http://localhost:3002` trong `development-local`, `http://user-service:3000` trong `development`
- `keycloak.*`: JWT guard và client-credentials token để gọi `question-service`

## Course-service cache config

`course-service` uses Redis cache-aside for course list/detail reads:

- `redis.url`: `redis://localhost:6379` trong `development-local`
- `redis.url`: `redis://redis:6379` trong `development`

Cache TTL mac dinh la 600 giay. Khi Redis loi hoac chua chay, service fallback ve PostgreSQL va khong doi response shape.

## Analytics/simulation cache config

`analytics-service` uses Redis cache-aside for progress dashboard reads. Event consumers invalidate the affected student's key after projection updates.

`simulation-service` uses Redis cache-aside for maneuver error reads. When Redis is unavailable, it falls back to PostgreSQL and keeps response shape unchanged.

- `redis.url`: `redis://localhost:6379` trong `development-local`
- `redis.url`: `redis://redis:6379` trong `development`

## Demo seed data

After Consul and databases are up, run the root seed from the workspace:

```powershell
npm.cmd run db:seed
```

This applies deterministic demo data across identity, user, course, question, exam, analytics, notification, and simulation services. Identity seed also creates demo users in Keycloak when Keycloak is running; set `SKIP_KEYCLOAK_SEED=1` only when intentionally seeding DB records without touching Keycloak.

Demo account password is `123456`. Use real JWT access tokens for frontend and Swagger flows; do not send `x-user-id` from frontend code.

## Vì sao cách này tốt hơn `.env` từng service

- Team không phải tự tạo nhiều file local.
- Config local vẫn tập trung trong Consul.
- Tư duy giống production hơn: code đọc config từ config server.

## Seed Consul

`docker compose up` sẽ seed sẵn:

- `config/development/*`
- `config/development-local/*`

Nếu cần seed lại local:

```powershell
npm run consul:seed:local
```

Nếu cần seed lại Docker mode:

```powershell
npm run consul:seed development
```

## Best practice và production

Đây là hướng đúng hơn cho team:

- Local dev: dùng `development-local`
- Full Docker: dùng `development`
- Production: dùng `production`

Production vẫn nên:

- build image cho từng service
- push image lên registry
- seed config production vào Consul
- inject tối thiểu `CONSUL_URL` và biến bootstrap cần thiết từ hệ thống deploy

Không nên dùng `.env` làm nguồn config chính cho production.
