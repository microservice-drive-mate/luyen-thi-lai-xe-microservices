# Luyện Thi Lái Xe Microservices - Dev Guide

Tài liệu này là file duy nhất để team dev hiểu cách code và vận hành local cho repo.

File roadmap các việc cần làm tiếp theo: [README.NEXT-STEPS.md](./README.NEXT-STEPS.md)

## 1. Tổng quan kiến trúc

- Monorepo: npm workspaces + Turborepo
- Backend: NestJS microservices trong `apps/*`
- Gateway: Kong DB-less trong `kong/kong.yaml`
- Message broker: RabbitMQ
- Database: Postgres (database per service)

## 2. Cấu trúc thư mục

```text
apps/
  identity-service/
  user-service/
  exam-service/
  course-service/
  question-service/
  notification-service/
  analytics-service/
  simulation-service/
packages/
  common/              # Thư viện nội bộ dùng chung
  eslint-config/
  typescript-config/
kong/
  kong.yaml
docker-compose.yaml
```

## 3. Chạy full stack bằng Docker (khuyến nghị)

Yêu cầu:

- Docker Desktop

Start:

```bash
docker compose up --build
```

URL quan trọng:

- Kong Proxy: http://localhost:8000
- Kong Admin API: http://localhost:8001
- RabbitMQ UI: http://localhost:15672
- **Consul UI & KV Store: http://localhost:8500** (centralized configuration)

Stop:

```bash
docker compose down
```

## 4. Consul Configuration Management

Tất cả microservices sử dụng **Consul** để quản lý configuration tập trung.

### Consul là gì?

Consul cung cấp Key-Value Store (KV store) cho cấu hình của tất cả services. Khi services khởi động, chúng tự động nạp configuration từ Consul.

**Ưu điểm:**

- Configuration tập trung - dễ dàng thay đổi mà không cần rebuild container
- Fallback to .env files - nếu Consul không hoạt động, services vẫn dùng .env
- Health check tự động - Consul kiểm tra kết nối trước khi nạp config

### Truy cập Consul UI

Mở browser: **http://localhost:8500**

Có thể browse tất cả configuration keys dưới `/config/development/`

### Quản lý Configuration

Xem hướng dẫn đầy đủ: [CONFIG_CONSUL.md](./CONFIG_CONSUL.md)

Các command hữu ích:

```bash
# Seed configuration vào Consul
npm run consul:seed

# Liệt kê tất cả keys
npm run consul:list /config/development

# Xem value của 1 key
npm run consul:get /config/development/identity-service/database.url
```

## 5. Route qua gateway

- /auth -> identity-service
- /users -> user-service
- /exams -> exam-service
- /questions -> question-service
- /courses -> course-service
- /notifications -> notification-service
- /analytics -> analytics-service
- /simulations -> simulation-service

## 6. Chạy local để code/debug

Yêu cầu:

- Node.js >= 18
- npm

Install dependencies:

```bash
npm install
```

Chạy 1 service:

```bash
npm run start:dev -w identity-service
```

Lưu ý:

- Mặc định service dùng PORT=3000.
- Nếu chạy nhiều service local, set PORT riêng.

PowerShell example:

```powershell
$env:PORT=3001
npm run start:dev -w identity-service
```

Scripts ở root:

```bash
npm run build
npm run dev
npm run lint
npm run check-types
npm run format
```

Lệnh DB cho identity-service:

```bash
npm run db:generate -w identity-service
npm run db:migrate -w identity-service
npm run db:seed -w identity-service
```

Nếu chạy bằng Docker network nội bộ:

```bash
docker compose up -d db-identity
docker compose run --rm identity-service npm run db:deploy -w identity-service
docker compose run --rm identity-service npm run db:seed -w identity-service
```

## 7. Cách tạo service mới

Ví dụ service mới: payment-service

Bước 1 - Scaffold service

- Có thể clone từ service có sẵn để giữ convention.
- Hoặc tạo mới:

```bash
npx @nestjs/cli new apps/payment-service --package-manager npm --skip-git
```

Bước 2 - Cập nhật package của service

- Sửa `name` trong `apps/payment-service/package.json`
- Nếu cần dùng thư viện nội bộ, thêm dependency `@repo/common`

Bước 3 - Tạo Dockerfile

- Copy pattern từ `apps/identity-service/Dockerfile`
- Sửa filter thành `payment-service`

Bước 4 - Đăng ký vào docker compose

- Thêm `db-payment` (nếu cần DB)
- Thêm service `payment-service` trong `docker-compose.yaml`

Bước 5 - Đăng ký route Kong

- Thêm service + route trong `kong/kong.yaml`
- Restart Kong:

```bash
docker compose restart kong
```

Bước 6 - Smoke test

```bash
docker compose up --build -d
curl http://localhost:8000/payments
```

## 7. Sử dụng thư viện nội bộ packages/common

Mục tiêu của `packages/common/src`:

- Chứa constants, DTO, event contract, helper dùng chung.

Quy trình dùng:

1. Tạo file module dùng chung trong `packages/common/src/...`
2. Re-export trong `packages/common/src/index.ts`
3. Import từ service:

```ts
import { USER_CREATED_EVENT } from "@repo/common";
```

4. Đảm bảo service có dependency `@repo/common` trong package.json.

Quy ước:

- Event name format: `domain.action.v1`
- Breaking change thì tạo version mới, không sửa để vỡ tương thích.

## 8. Quy trình code trong team

1. Kéo code mới nhất.
2. Chạy lint + typecheck trước khi push.
3. Chạy test service đang sửa.
4. Smoke test qua Kong nếu có thay đổi API/event.
5. Cập nhật tài liệu nếu thay đổi route, contract hoặc convention.

### 8.1 Git workflow khi làm việc với CI (bắt buộc)

Nguyên tắc:

- Không code trực tiếp trên `main`.
- Mọi tính năng/bugfix phải đi qua nhánh riêng + Pull Request.
- Chỉ merge khi CI pass.
- Tuyệt đối không merge khi CI đang chạy hoặc có job fail.

Luồng làm việc đề xuất cho 1 tính năng mới:

1. Đồng bộ nhánh main mới nhất:

```bash
git checkout main
git pull origin main
```

2. Tạo nhánh feature từ main (đặt tên rõ ý nghĩa):

```bash
git checkout -b feature/user-registration
```

3. Code + commit từng bước nhỏ, message rõ ràng:

```bash
git add .
git commit -m "feat(identity): add user registration endpoint"
```

4. Trước khi push, chạy quality gate local:

```bash
npm run lint
npm run check-types
npm run test -w identity-service
```

5. Push nhánh lên remote:

```bash
git push -u origin feature/user-registration
```

6. Tạo Pull Request: `feature/user-registration` -> `main`.
7. Chờ CI chạy xong (lint/test/build) và xử lý comment review.
8. Merge PR khi đã pass CI và được approve.

Rule bắt buộc trước khi merge:

- Tất cả CI checks phải ở trạng thái `success`.
- Không merge nếu check còn `pending`.

Sau khi merge xong, dọn dẹp nhánh đã dùng:

1. Xóa nhánh local:

```bash
git checkout main
git pull origin main
git branch -d feature/user-registration
```

2. Xóa nhánh remote:

```bash
git push origin --delete feature/user-registration
```

Lưu ý:

- Dùng `git branch -d` để an toàn (chỉ xóa khi nhánh đã được merge).
- Nếu cần xóa nhánh chưa merge (không khuyến khích), mới dùng `git branch -D <branch-name>`.
- Nếu nhánh có thay đổi mới trong lúc đang code, hãy rebase/merge từ `main` để giảm conflict trước khi mở PR.

Lệnh gợi ý:

```bash
npm run lint
npm run check-types
npm run test -w identity-service
```

## 9. Troubleshooting nhanh

Kong route không nhận:

- Kiểm tra route trong `kong/kong.yaml`
- Restart Kong

RabbitMQ không nhận event:

- Kiểm tra tên queue/event producer-consumer trùng nhau
- Kiểm tra host là `rabbitmq` khi chạy trong docker network

Bị trùng port local:

- Set PORT riêng cho từng service

## 10. Definition of Done cho feature/service

- Có validation input
- Có unit test cho business logic chính
- Có e2e test cho endpoint quan trọng
- Đã đăng ký gateway route nếu là API mới
- Đã cập nhật tài liệu liên quan
