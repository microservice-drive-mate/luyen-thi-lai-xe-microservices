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
docker compose up -d consul consul-init rabbitmq db-user db-exam
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
