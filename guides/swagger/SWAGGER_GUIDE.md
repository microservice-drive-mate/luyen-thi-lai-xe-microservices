# Centralized Swagger UI — Hướng dẫn sử dụng

Dự án sử dụng **docs-service** làm điểm tập trung tài liệu API cho toàn bộ microservices.  
Swagger UI tại `http://localhost:3009/docs` tự động tổng hợp spec từ các service.

---

## Kiến trúc tổng quan

```
Browser
  │
  ├─► http://localhost:3009/docs       (Swagger UI — docs-service)
  │     │
  │     └─► Swagger UI JS fetch spec từng service:
  │
  │   [Local dev — bypass Kong]        [Docker/Kong]
  │   http://localhost:3000/docs-json  http://localhost:8000/user-service/docs-json
  │                                          │
  │                                    Kong strips /user-service
  │                                          │
  │                                    http://user-service:3000/docs-json
```

**Điểm quan trọng**: `/docs-json` là path của service, không có prefix service-name.  
Prefix `/user-service/` chỉ tồn tại ở Kong routing layer, không phải ở service.

---

## Ba chế độ discovery của docs-service

docs-service tìm service theo thứ tự ưu tiên:

| Ưu tiên | Env var                            | URL tạo ra                                     | Dùng khi                              |
| ------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------- |
| 1       | `LOCAL_SERVICES=user-service:3000` | `http://localhost:3000/docs-json`              | Local dev, bypass Kong                |
| 2       | Consul catalog                     | `http://localhost:8000/user-service/docs-json` | Full Docker, service tự register      |
| 3       | `KNOWN_SERVICES=user-service`      | `http://localhost:8000/user-service/docs-json` | Docker infra + service local qua Kong |

---

## Chế độ 1 — Local Dev (Infra Docker + Services local) ← Workflow hiện tại

### Bước 1: Khởi động infrastructure Docker

```bash
docker compose up -d consul consul-init kong rabbitmq \
  db-user db-exam db-question db-course db-notification db-analytics db-simulation
```

Kiểm tra Consul healthy:

```bash
curl http://localhost:8500/v1/status/leader
```

### Bước 2: Chạy service local

Mỗi service chạy trong một terminal riêng. **Lưu ý cú pháp đúng** — phải set env var và npm trong cùng 1 lệnh (không dùng `&&`):

```bash
# Terminal 1 — User Service
cd apps/user-service
npm run start:dev
```

User Service mặc định chạy ở port lấy từ Consul config. Nếu chưa có config, default là 3000.

### Bước 3: Chạy docs-service với LOCAL_SERVICES

```bash
# Terminal 2 — Docs Service
cd apps/docs-service
LOCAL_SERVICES=user-service:3000 PORT=3009 npm run start:dev
```

> **Tại sao dùng `LOCAL_SERVICES` thay vì `KNOWN_SERVICES`?**
>
> - `LOCAL_SERVICES=user-service:3000` → tạo URL `http://localhost:3000/docs-json` (đúng ✓)
> - `KNOWN_SERVICES=user-service` → tạo URL `http://localhost:8000/user-service/docs-json` (qua Kong, Kong không reach được service local ✗)

### Bước 4: Mở Swagger UI

```
http://localhost:3009/docs
```

Dropdown phía trên sẽ hiện "User Service". Chọn vào để xem API docs.

---

### Multi-service local

Nếu chạy nhiều service cùng lúc, cần set port khác nhau tránh conflict:

```bash
# Terminal 1
cd apps/user-service
PORT=3000 npm run start:dev

# Terminal 2
cd apps/exam-service
PORT=3001 npm run start:dev

# Terminal 3 — docs-service
cd apps/docs-service
LOCAL_SERVICES=user-service:3000,exam-service:3001 PORT=3009 npm run start:dev
```

Port mặc định cho từng service (đề xuất):

| Service              | Port local |
| -------------------- | ---------- |
| user-service         | 3000       |
| exam-service         | 3001       |
| question-service     | 3002       |
| course-service       | 3003       |
| notification-service | 3004       |
| analytics-service    | 3005       |
| simulation-service   | 3006       |
| **docs-service**     | **3009**   |

---

## Chế độ 2 — Full Docker

Tất cả services đều chạy trong Docker container. Kong giao tiếp nội bộ với từng service.

```bash
docker compose up -d --build
```

Truy cập Swagger UI:

```
http://localhost:3009/docs
```

Hoặc qua Kong (có basic-auth):

```
http://localhost:8000/docs
```

---

## Tại sao `GATEWAY_URL=http://localhost:3000` sai?

Đây là lỗi phổ biến khi mới setup:

```
GATEWAY_URL=http://localhost:3000  ← SAI cho local dev
```

`GATEWAY_URL` được dùng cho mode Consul/KNOWN_SERVICES, tạo URL format:

```
{GATEWAY_URL}/{service-name}/docs-json
= http://localhost:3000/user-service/docs-json   ← endpoint này không tồn tại!
```

User-service chỉ expose `/docs-json`, không có `/user-service/docs-json`.  
Prefix `/user-service/` là Kong routing prefix — Kong nhận request, strip prefix, rồi mới gọi service.

**Kết luận**: Để bypass Kong khi local dev → dùng `LOCAL_SERVICES=name:port`.

---

## Tại sao cú pháp `VAR=x cd dir && npm run` không hoạt động?

```bash
# SAI — env vars chỉ apply cho lệnh "cd", không apply cho npm
KNOWN_SERVICES=user-service PORT=3009 \
  cd apps/docs-service && npm run start:dev
```

Trong bash, `KEY=value command` chỉ set env var cho command đó (ở đây là `cd`).  
Sau `&&`, `npm run start:dev` chạy trong shell hiện tại KHÔNG có những env vars đó.

```bash
# ĐÚNG — cd trước, rồi set env var + command trong 1 lệnh
cd apps/docs-service
LOCAL_SERVICES=user-service:3000 PORT=3009 npm run start:dev

# Hoặc từ root workspace (không cần cd)
LOCAL_SERVICES=user-service:3000 PORT=3009 npm run start:dev -w apps/docs-service
```

---

## Cách Kong định tuyến swagger specs

Khi Swagger UI (browser) fetch `http://localhost:8000/user-service/docs-json`:

```
Browser
  GET /user-service/docs-json
       │
    Kong (port 8000)
    route: user-swagger-route
    path:  /user-service  ← strip này
    strip_path: true
       │
    upstream: http://user-service:3000
       │
    GET /docs-json  ← path sau khi strip
```

> **Lưu ý về strip_path**: path trong Kong route phải là `/user-service` (không phải `/user-service/docs-json`).  
> Nếu path là `/user-service/docs-json` với `strip_path: true` → Kong strip toàn bộ → upstream nhận `GET /` → 404.

---

## Biến môi trường docs-service

| Biến             | Mặc định                | Mô tả                                                                |
| ---------------- | ----------------------- | -------------------------------------------------------------------- |
| `PORT`           | `3009`                  | Port của docs-service                                                |
| `LOCAL_SERVICES` | _(không set)_           | Local dev: `name:port,...` → URL `http://localhost:{port}/docs-json` |
| `CONSUL_URL`     | `http://localhost:8500` | Consul URL để auto-discovery                                         |
| `GATEWAY_URL`    | `http://localhost:8000` | Base URL cho Consul/KNOWN_SERVICES mode (qua Kong)                   |
| `KNOWN_SERVICES` | _(không set)_           | Fallback: `name,...` → URL `{GATEWAY_URL}/{name}/docs-json`          |

---

## Troubleshooting

### Dropdown rỗng / "No operations defined in spec"

docs-service không tìm thấy service nào. Kiểm tra log của docs-service, sẽ có warning:

```
⚠ Không tìm thấy service API nào.
  Local dev (bypass Kong): LOCAL_SERVICES=user-service:3000
  Qua Kong:                KNOWN_SERVICES=user-service
```

**Fix**: Set `LOCAL_SERVICES=user-service:3000` khi chạy docs-service.

---

### "Parser error: end of the stream or a document separator is expected"

Swagger UI đang fetch một URL trả về HTML thay vì JSON spec.  
Thường xảy ra khi URL là rỗng hoặc trỏ đến trang web thay vì endpoint JSON.

**Fix**: Đảm bảo `LOCAL_SERVICES` hoặc `KNOWN_SERVICES` được set đúng.

---

### CORS error trong DevTools (blocked by CORS policy)

User-service không cho phép cross-origin request từ docs-service.

**Fix**: `setupMicroserviceSwagger()` trong `@repo/common` đã gọi `app.enableCors()`.  
Rebuild `@repo/common` nếu cần:

```bash
npm run build -w packages/common
```

---

### Kong 404 khi fetch spec (KNOWN_SERVICES mode)

Kiểm tra Kong config:

```bash
curl http://localhost:8001/routes | python -m json.tool
```

Đảm bảo route có `paths: ["/user-service"]` (không phải `/user-service/docs-json`).

---

### Service chạy nhưng spec trả về "No operations defined"

Service không có controller nào annotated với `@ApiTags`. Thêm vào controller:

```typescript
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Get all users' })
  @Get()
  findAll() { ... }
}
```

---

## Checklist khi thêm service mới

- [ ] Gọi `setupMicroserviceSwagger(app, { title: '...' })` trong `main.ts`
- [ ] Thêm `@nestjs/swagger` vào `package.json` của service
- [ ] Annotate controllers với `@ApiTags`, `@ApiOperation`, `@ApiResponse`
- [ ] Thêm swagger route vào `kong/kong.yaml` theo pattern `/{service-name}` + `strip_path: true`
- [ ] Thêm service name vào `LOCAL_SERVICES` khi chạy local dev
