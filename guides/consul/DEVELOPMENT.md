# Development Guide

Hướng dẫn setup và làm việc với monorepo microservices này.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cấu trúc dự án](#2-cấu-trúc-dự-án)
3. [Lần đầu setup](#3-lần-đầu-setup)
4. [Dev workflow hàng ngày](#4-dev-workflow-hàng-ngày)
5. [Chạy local vs Docker — chọn cái nào?](#5-chạy-local-vs-docker--chọn-cái-nào)
6. [Biến môi trường & .env](#6-biến-môi-trường--env)
7. [Config Server (Consul)](#7-config-server-consul)
8. [Database & Prisma](#8-database--prisma)
9. [Shared Package (@repo/common)](#9-shared-package-repocommon)
10. [Port map toàn hệ thống](#10-port-map-toàn-hệ-thống)
11. [Scripts tiện ích](#11-scripts-tiện-ích)
12. [Deploy production](#12-deploy-production)
13. [Câu hỏi thường gặp](#13-câu-hỏi-thường-gặp)

---

## 1. Yêu cầu hệ thống

| Tool | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Node.js | >= 18 | Khuyến nghị dùng 20 LTS |
| npm | >= 11 | `npm install -g npm@latest` |
| Docker Desktop | Latest | Bật trước khi chạy |
| Git | Any | — |

---

## 2. Cấu trúc dự án

```
luyen-thi-lai-xe-microservices/
│
├── apps/                          # 8 NestJS microservices
│   ├── identity-service/          # Quản lý tài khoản, xác thực
│   ├── user-service/              # Quản lý profile người dùng
│   ├── exam-service/              # Quản lý kỳ thi, kết quả
│   ├── course-service/            # Quản lý khóa học, bài học
│   ├── question-service/          # Ngân hàng câu hỏi
│   ├── notification-service/      # Gửi thông báo (email, push)
│   ├── analytics-service/         # Thống kê, báo cáo
│   └── simulation-service/        # Mô phỏng tình huống lái xe
│
├── packages/
│   └── common/                    # Shared code dùng chung cho mọi service
│       └── src/consul/            # Consul config client
│
├── scripts/                       # CLI tools quản lý Consul KV
│   ├── consul-seed.ts             # Seed config vào Consul
│   ├── consul-list.ts             # Xem danh sách keys
│   └── consul-get.ts              # Xem giá trị 1 key
│
├── docker/
│   └── consul/init.sh             # Auto-seed Consul khi Docker khởi động
│
├── docker-compose.yaml            # Infrastructure + services
├── consul-seed-development.json   # Config cho môi trường dev
├── consul-seed-production.json    # Template config production (gitignored)
└── DEVELOPMENT.md                 # File này
```

**Mỗi service có cấu trúc:**
```
apps/identity-service/
├── src/
│   ├── app.module.ts       # Module root, khởi tạo Consul config
│   ├── main.ts             # Entry point
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── prisma/
│       └── prisma.service.ts
├── prisma/
│   └── schema.prisma       # Database schema
├── .env.example            # Template biến môi trường
├── tsconfig.json           # TypeScript config cho dev (ts-node)
├── tsconfig.build.json     # TypeScript config cho production build
└── package.json
```

---

## 3. Lần đầu setup

### Bước 1 — Clone và cài dependencies

```bash
git clone <repo-url>
cd luyen-thi-lai-xe-microservices
npm install
```

### Bước 2 — Build shared package

`@repo/common` là package dùng chung, cần compile trước khi các service dùng được:

```bash
npm run build --workspace=@repo/common
```

> **Lưu ý:** Chỉ cần chạy lại lệnh này khi bạn sửa code trong `packages/common/src/`.

### Bước 3 — Khởi động infrastructure

```bash
# Bật Consul, tất cả DB, RabbitMQ (không bật service NestJS)
docker-compose up consul consul-init rabbitmq \
  db-identity db-user db-exam db-course \
  db-question db-notification db-analytics db-simulation -d
```

Chờ khoảng 10–15 giây rồi kiểm tra Consul đã seed chưa:

```bash
docker-compose logs consul-init
# Expected: [Consul] ✓ Configuration seeding completed!
```

Mở trình duyệt vào [http://localhost:8500](http://localhost:8500) → Key/Value → `config/development/` để xác nhận.

### Bước 4 — Tạo file .env cho service đang làm

Mỗi service cần file `.env` riêng (đã gitignore, không commit):

```bash
cp apps/identity-service/.env.example apps/identity-service/.env
```

Nội dung `.env` mặc định là đủ để chạy với Docker infrastructure.

### Bước 5 — Migrate database

```bash
cd apps/identity-service
npm run db:generate    # Tạo Prisma Client từ schema
npm run db:migrate     # Tạo bảng trong database
cd ../..
```

### Bước 6 — Chạy service

```bash
cd apps/identity-service
npm run start:dev
```

Thấy log này là thành công:
```
[ConsulConfigFactory] ✓ Configuration loaded from Consul
✓ Identity Service listening on port 3000
```

---

## 4. Dev workflow hàng ngày

### Sửa code trong một service (ví dụ identity-service)

```
Sửa file .ts trong apps/identity-service/src/
        │
        ▼
NestJS watch mode tự detect thay đổi
        │
        ▼
Compile lại & restart tự động (hot-reload)
        │
        ▼
KHÔNG cần build Docker, KHÔNG cần restart container
```

**Chỉ cần `Ctrl+S` → service tự reload trong vài giây.**

### Sửa code trong packages/common

`packages/common` cần được compile lại vì các service dùng bản `dist/`:

```bash
# Cách 1: Build một lần (nếu sửa ít)
npm run build --workspace=@repo/common

# Cách 2: Watch mode (nếu đang sửa nhiều, mở terminal riêng)
npm run build:watch --workspace=@repo/common
```

Sau khi build xong, service đang chạy sẽ tự reload (ts-node detect file dist thay đổi).

### Sửa consul-seed-development.json (thay đổi config)

```bash
# 1. Sửa file json
# 2. Seed lại vào Consul
npm run consul:seed development

# 3. Restart service để load config mới (config chỉ load lúc khởi động)
docker-compose restart identity-service
# hoặc nếu đang chạy local: Ctrl+C → npm run start:dev
```

### Thêm migration database mới

```bash
cd apps/identity-service

# 1. Sửa prisma/schema.prisma
# 2. Tạo migration
npm run db:migrate     # Đặt tên migration khi được hỏi

# 3. Commit file migration vào git
git add prisma/migrations/
```

---

## 5. Chạy local vs Docker — chọn cái nào?

### Mode A: Infrastructure Docker + Service local ⭐ (khuyến nghị khi dev)

```
[Docker]  consul + consul-init + rabbitmq + db-identity + ...
[Local]   npm run start:dev   ← service của bạn, hot-reload ngay lập tức
```

**Ưu điểm:**
- Hot-reload nhanh (không cần build Docker image)
- Debug dễ (attach debugger trực tiếp)
- Log rõ ràng trong terminal

**Khi nào dùng:** Khi bạn đang develop một service cụ thể.

**Cách chạy:**
```bash
# Terminal 1: Bật infrastructure
docker-compose up consul consul-init rabbitmq db-identity -d

# Terminal 2: Chạy service
cd apps/identity-service && npm run start:dev
```

---

### Mode B: Full Docker (tất cả trong container)

```
[Docker]  consul + rabbitmq + db-* + identity-service + user-service + ...
```

**Ưu điểm:**
- Giống môi trường production nhất
- Test integration giữa nhiều service

**Nhược điểm:**
- Phải build image mỗi lần sửa code (`docker-compose up --build`)
- Chậm hơn khi dev

**Khi nào dùng:** Test tích hợp toàn bộ hệ thống, demo, staging.

**Cách chạy:**
```bash
docker-compose up --build
```

> ⚠️ **Lưu ý:** Các service trong docker-compose.yaml chưa có Dockerfile. Phần này sẽ được thêm sau khi từng service hoàn thiện.

---

### Mode C: Hoàn toàn local (không Docker)

Cài PostgreSQL + RabbitMQ trực tiếp trên máy, tạo `.env` với URL localhost. Service sẽ không tìm thấy Consul → tự động fallback sang `.env`.

**Khi nào dùng:** Máy không đủ RAM để chạy Docker, hoặc môi trường không có Docker.

---

### So sánh nhanh

| | Mode A (khuyến nghị) | Mode B (Full Docker) | Mode C (Local) |
|---|---|---|---|
| Hot-reload | ✅ Ngay lập tức | ❌ Phải rebuild | ✅ Ngay lập tức |
| Giống production | ⚠️ Gần đúng | ✅ Đúng nhất | ❌ Khác nhiều |
| Cần Docker | ✅ Chỉ infra | ✅ Cả stack | ❌ Không cần |
| Debug | ✅ Dễ | ⚠️ Cần cấu hình | ✅ Dễ |
| RAM sử dụng | Trung bình | Cao | Thấp |

---

## 6. Biến môi trường & .env

### Quy tắc

| File | Commit git? | Mục đích |
|---|---|---|
| `.env.example` | ✅ Commit | Template cho team, không có giá trị thật |
| `.env` | ❌ Gitignored | Config thật trên máy cá nhân |
| `consul-seed-development.json` | ✅ Commit | Config dev (không có secret) |
| `consul-seed-production.json` | ❌ Gitignored | Config production (có secret) |

### Tạo .env từ template

```bash
# Mỗi người cần tự tạo .env cho service mình làm
cp apps/identity-service/.env.example apps/identity-service/.env
cp apps/user-service/.env.example     apps/user-service/.env
# ... tương tự cho các service khác
```

### Priority load config (từ cao đến thấp)

```
1. ENV vars từ shell / Docker environment   ← cao nhất
2. Consul KV Store (nếu Consul chạy)
3. File .env (fallback khi Consul không chạy)
4. Giá trị default trong code              ← thấp nhất
```

**Kết quả thực tế:**
- Chạy với Docker infra → Consul healthy → config từ Consul (`.env` bị bỏ qua)
- Chạy không có Consul → fallback xuống `.env`

---

## 7. Config Server (Consul)

Consul là nơi lưu trữ **tập trung** toàn bộ config của tất cả service.

### Cấu trúc KV

```
config/
└── development/
    ├── shared/
    │   ├── log.level   = "debug"
    │   ├── log.format  = "text"
    │   └── node_env    = "development"
    ├── identity-service/
    │   ├── port          = "3000"
    │   ├── database.url  = "postgresql://..."
    │   └── rabbitmq.url  = "amqp://..."
    ├── user-service/   ...
    └── ...
```

### Quản lý config

```bash
# Xem tất cả config của một service
npm run consul:list config/development/identity-service

# Xem giá trị một key cụ thể
npm run consul:get config/development/identity-service/database.url

# Seed lại toàn bộ config từ file json
npm run consul:seed development

# Hoặc vào UI trực tiếp
open http://localhost:8500
```

### Thay đổi config trong lúc dev

1. Sửa `consul-seed-development.json`
2. `npm run consul:seed development`
3. Restart service để áp dụng (config chỉ load lúc khởi động)

---

## 8. Database & Prisma

Mỗi service có **database riêng biệt** (Database-per-service pattern).

### Port database (khi chạy Docker)

| Service | Host port | Database |
|---|---|---|
| identity-service | `localhost:5432` | `identity_db` |
| user-service | `localhost:5433` | `user_db` |
| exam-service | `localhost:5434` | `exam_db` |
| course-service | `localhost:5435` | `course_db` |
| question-service | `localhost:5436` | `question_db` |
| notification-service | `localhost:5437` | `notification_db` |
| analytics-service | `localhost:5438` | `analytics_db` |
| simulation-service | `localhost:5439` | `simulation_db` |

Kết nối bằng bất kỳ tool nào (DBeaver, TablePlus, psql):
- Host: `localhost`
- Port: xem bảng trên
- User: `user`
- Password: `password`

### Prisma commands

```bash
cd apps/identity-service

# Sau khi sửa schema.prisma → tạo migration
npm run db:migrate

# Chỉ generate Prisma Client (không tạo migration)
npm run db:generate

# Deploy migrations đã có (dùng cho production/CI)
npm run db:deploy

# Mở Prisma Studio (GUI xem data)
npm run db:studio
```

### Quy trình thêm model mới

```bash
# 1. Sửa prisma/schema.prisma
# 2. Tạo migration
npm run db:migrate    # → nhập tên migration, ví dụ: "add_user_avatar"
# 3. Commit migration files
git add prisma/migrations/
git commit -m "feat(identity): add user avatar field"
```

---

## 9. Shared Package (@repo/common)

`packages/common` chứa code dùng chung: Consul config client, shared types, utilities.

### Khi nào cần build lại

Mỗi khi sửa file trong `packages/common/src/`, phải build lại:

```bash
# Build một lần
npm run build --workspace=@repo/common

# Hoặc watch mode (terminal riêng, tự build khi có thay đổi)
npm run build:watch --workspace=@repo/common
```

### Thêm export mới vào common

1. Tạo file trong `packages/common/src/`
2. Export từ `packages/common/src/index.ts`
3. Build: `npm run build --workspace=@repo/common`
4. Import trong service: `import { MyThing } from '@repo/common'`

---

## 10. Port map toàn hệ thống

| Service | URL local | Ghi chú |
|---|---|---|
| **Consul UI** | http://localhost:8500 | Config server, KV store |
| **RabbitMQ UI** | http://localhost:15672 | guest/guest |
| **Kong Gateway** | http://localhost:8000 | API Gateway (proxy) |
| **Kong Admin** | http://localhost:8001 | Quản lý routes |
| identity-service | http://localhost:3001 | Khi chạy local |
| user-service | http://localhost:3002 | Khi chạy local |
| exam-service | http://localhost:3003 | Khi chạy local |
| course-service | http://localhost:3004 | Khi chạy local |
| question-service | http://localhost:3005 | Khi chạy local |
| notification-service | http://localhost:3006 | Khi chạy local |
| analytics-service | http://localhost:3007 | Khi chạy local |
| simulation-service | http://localhost:3008 | Khi chạy local |

---

## 11. Scripts tiện ích

### Root level (chạy từ thư mục gốc)

```bash
npm run build               # Build tất cả packages và apps
npm run dev                 # Chạy tất cả services cùng lúc (turbo)
npm run lint                # Lint toàn bộ
npm run check-types         # Kiểm tra TypeScript

npm run consul:seed [env]   # Seed config vào Consul
npm run consul:list <prefix> # Xem keys theo prefix
npm run consul:get <key>    # Xem giá trị một key
```

### Service level (chạy từ thư mục service)

```bash
npm run start:dev           # Dev với hot-reload
npm run start:debug         # Dev với debugger (port 9229)
npm run build               # Build production
npm run test                # Unit tests
npm run test:e2e            # E2E tests

npm run db:migrate          # Tạo migration mới
npm run db:deploy           # Apply migrations (production)
npm run db:generate         # Generate Prisma Client
npm run db:studio           # Mở Prisma Studio
```

---

## 12. Deploy production

> ⚠️ **Trạng thái hiện tại:** Các Dockerfile chưa được viết. Phần này là hướng dẫn khi hoàn thiện.

### Quy trình tổng quát

```
1. CI/CD inject secrets vào environment
2. Build @repo/common: npm run build --workspace=@repo/common
3. Seed production Consul với real secrets
4. Build Docker images: docker-compose -f docker-compose.prod.yml build
5. Deploy
```

### Xử lý secrets production

File `consul-seed-production.json` đang có `${SECRET_*}` placeholder (đã gitignore). Có 2 cách:

**Cách 1 — CI/CD inject (khuyến nghị):**
```bash
# Trong GitHub Actions / GitLab CI
envsubst < consul-seed-production.json.template > consul-seed-production.json
CONSUL_URL=http://prod-consul:8500 npm run consul:seed production
```

**Cách 2 — Manual (cho môi trường nhỏ):**
```bash
cp consul-seed-production.json.example consul-seed-production.json
# Điền giá trị thật vào file (file đã gitignore, không commit)
CONSUL_URL=http://prod-consul:8500 npm run consul:seed production
```

### Environment variables cần thiết khi deploy

Mỗi service container cần:
```
NODE_ENV=production
CONSUL_URL=http://<consul-host>:8500
DATABASE_URL=<fallback nếu Consul không chạy>
```

---

## 13. Câu hỏi thường gặp

**Q: Sửa code service có cần rebuild Docker không?**
> Không, nếu đang dùng Mode A (service chạy local). Hot-reload tự động. Chỉ cần rebuild Docker khi muốn test trong container (Mode B).

**Q: Sau khi pull code mới về cần làm gì?**
```bash
npm install                                      # Nếu có thay đổi dependencies
npm run build --workspace=@repo/common           # Nếu packages/common thay đổi
cd apps/identity-service && npm run db:migrate   # Nếu có migration mới
```

**Q: Service khởi động báo lỗi config?**
1. Kiểm tra Consul có chạy không: `docker-compose ps consul`
2. Xem log seed: `docker-compose logs consul-init`
3. Xem config đã có chưa: `npm run consul:list config/development/identity-service`
4. Nếu thiếu: `npm run consul:seed development`

**Q: Service dùng config từ Consul hay .env?**
> Nếu Consul đang chạy và healthy → dùng Consul (`.env` bị bỏ qua).
> Nếu Consul không chạy → fallback xuống `.env`.
> Log khi khởi động sẽ hiển thị rõ đang dùng nguồn nào.

**Q: Thêm service mới cần làm gì?**
1. Tạo NestJS app trong `apps/new-service/`
2. Thêm config vào `consul-seed-development.json`
3. Thêm DB vào `docker-compose.yaml`
4. Tạo `.env.example`
5. `npm run consul:seed development`

**Q: packages/common thay đổi mà service không nhận?**
```bash
npm run build --workspace=@repo/common
# Sau đó restart service
```

**Q: Xem log của service đang chạy trong Docker?**
```bash
docker-compose logs -f identity-service
docker-compose logs -f consul-init
```

**Q: Reset toàn bộ database (xóa sạch data)?**
```bash
docker-compose down -v   # Xóa cả volumes
docker-compose up consul consul-init rabbitmq db-identity ... -d
cd apps/identity-service && npm run db:migrate
```
