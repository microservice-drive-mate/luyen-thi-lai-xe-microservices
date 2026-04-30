# Luyen Thi Lai Xe Microservices - Dev Guide

Tai lieu nay la file duy nhat de team dev hieu cach code va van hanh local cho repo.

File roadmap cac viec can lam tiep theo: [README.NEXT-STEPS.md](./README.NEXT-STEPS.md)

## 1. Tong quan kien truc

- Monorepo: npm workspaces + Turborepo
- Backend: NestJS microservices trong `apps/*`
- Gateway: Kong DB-less trong `kong/kong.yaml`
- Message broker: RabbitMQ
- Database: Postgres (database per service)

## 2. Cau truc thu muc

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
  common/              # Thu vien noi bo dung chung
  eslint-config/
  typescript-config/
kong/
  kong.yaml
docker-compose.yaml
```

## 3. Chay full stack bang Docker (khuyen nghi)

Yeu cau:

- Docker Desktop

Start:

```bash
docker compose up --build
```

URL quan trong:

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

## 6. Chay local de code/debug

Yeu cau:

- Node.js >= 18
- npm

Install dependencies:

```bash
npm install
```

Chay 1 service:

```bash
npm run start:dev -w identity-service
```

Luu y:

- Mac dinh service dung PORT=3000.
- Neu chay nhieu service local, set PORT rieng.

PowerShell example:

```powershell
$env:PORT=3001
npm run start:dev -w identity-service
```

Scripts o root:

```bash
npm run build
npm run dev
npm run lint
npm run check-types
npm run format
```

Lenh DB cho identity-service:

```bash
npm run db:generate -w identity-service
npm run db:migrate -w identity-service
npm run db:seed -w identity-service
```

Neu chay bang Docker network noi bo:

```bash
docker compose up -d db-identity
docker compose run --rm identity-service npm run db:deploy -w identity-service
docker compose run --rm identity-service npm run db:seed -w identity-service
```

## 7. Cach tao service moi

Vi du service moi: payment-service

Buoc 1 - Scaffold service

- Co the clone tu service co san de giu convention.
- Hoac tao moi:

```bash
npx @nestjs/cli new apps/payment-service --package-manager npm --skip-git
```

Buoc 2 - Cap nhat package cua service

- Sua `name` trong `apps/payment-service/package.json`
- Neu can dung thu vien noi bo, them dependency `@repo/common`

Buoc 3 - Tao Dockerfile

- Copy pattern tu `apps/identity-service/Dockerfile`
- Sua filter thanh `payment-service`

Buoc 4 - Dang ky vao docker compose

- Them `db-payment` (neu can DB)
- Them service `payment-service` trong `docker-compose.yaml`

Buoc 5 - Dang ky route Kong

- Them service + route trong `kong/kong.yaml`
- Restart Kong:

```bash
docker compose restart kong
```

Buoc 6 - Smoke test

```bash
docker compose up --build -d
curl http://localhost:8000/payments
```

## 7. Su dung thu vien noi bo packages/common

Muc tieu cua `packages/common/src`:

- Chua constants, DTO, event contract, helper dung chung.

Quy trinh dung:

1. Tao file module dung chung trong `packages/common/src/...`
2. Re-export trong `packages/common/src/index.ts`
3. Import tu service:

```ts
import { USER_CREATED_EVENT } from "@repo/common";
```

4. Dam bao service co dependency `@repo/common` trong package.json.

Quy uoc:

- Event name format: `domain.action.v1`
- Breaking change thi tao version moi, khong sua de vo tuong thich.

## 8. Quy trinh code trong team

1. Keo code moi nhat.
2. Chay lint + typecheck truoc khi push.
3. Chay test service dang sua.
4. Smoke test qua Kong neu co thay doi API/event.
5. Cap nhat tai lieu neu thay doi route, contract hoac convention.

### 8.1 Git workflow khi lam viec voi CI (bat buoc)

Nguyen tac:

- Khong code truc tiep tren `main`.
- Moi tinh nang/bugfix phai di qua nhanh rieng + Pull Request.
- Chi merge khi CI pass.
- Tuyet doi khong merge khi CI dang chay hoac co job fail.

Luong lam viec de xuat cho 1 tinh nang moi:

1. Dong bo nhanh main moi nhat:

```bash
git checkout main
git pull origin main
```

2. Tao nhanh feature tu main (dat ten ro y nghia):

```bash
git checkout -b feature/user-registration
```

3. Code + commit tung buoc nho, message ro rang:

```bash
git add .
git commit -m "feat(identity): add user registration endpoint"
```

4. Truoc khi push, chay quality gate local:

```bash
npm run lint
npm run check-types
npm run test -w identity-service
```

5. Push nhanh len remote:

```bash
git push -u origin feature/user-registration
```

6. Tao Pull Request: `feature/user-registration` -> `main`.
7. Cho CI chay xong (lint/test/build) va xu ly comment review.
8. Merge PR khi da pass CI va duoc approve.

Rule bat buoc truoc khi merge:

- Tat ca CI checks phai o trang thai `success`.
- Khong merge neu check con `pending`.

Sau khi merge xong, don dep nhanh da dung:

1. Xoa nhanh local:

```bash
git checkout main
git pull origin main
git branch -d feature/user-registration
```

2. Xoa nhanh remote:

```bash
git push origin --delete feature/user-registration
```

Luu y:

- Dung `git branch -d` de an toan (chi xoa khi nhanh da duoc merge).
- Neu can xoa nhanh chua merge (khong khuyen khich), moi dung `git branch -D <branch-name>`.
- Neu nhanh co thay doi moi trong luc dang code, hay rebase/merge tu `main` de giam conflict truoc khi mo PR.

Lenh goi y:

```bash
npm run lint
npm run check-types
npm run test -w identity-service
```

## 9. Troubleshooting nhanh

Kong route khong nhan:

- Kiem tra route trong `kong/kong.yaml`
- Restart Kong

RabbitMQ khong nhan event:

- Kiem tra ten queue/event producer-consumer trung nhau
- Kiem tra host la `rabbitmq` khi chay trong docker network

Bi trung port local:

- Set PORT rieng cho tung service

## 10. Definition of Done cho feature/service

- Co validation input
- Co unit test cho business logic chinh
- Co e2e test cho endpoint quan trong
- Da dang ky gateway route neu la API moi
- Da cap nhat tai lieu lien quan
