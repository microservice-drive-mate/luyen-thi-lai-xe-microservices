# Kong Và Frontend Integration

Tài liệu này mô tả cách frontend gọi backend qua Kong trong môi trường local/dev.

## Nguyên Tắc Chính

Frontend không nên gọi trực tiếp từng service port như `3001`, `3002`, `3005` trong flow bình thường. Base URL duy nhất cho frontend là:

```text
http://localhost:8000
```

Kong nhận request, route tới service phù hợp, sau đó service tự validate JWT/RBAC bằng Keycloak guard.

Frontend gửi token bằng header:

```http
Authorization: Bearer <access_token>
```

Không tự gửi `x-user-id` hoặc `x-user-role`. Các service đọc user từ JWT claim, chủ yếu là `sub`; các header debug chỉ còn dùng cho script hoặc tình huống local đặc biệt.

## Cấu Hình Frontend

Ví dụ `.env.local` cho Vite/React:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=luyen-thi-lai-xe-realm
VITE_KEYCLOAK_CLIENT_ID=frontend
```

Ví dụ cho Next.js:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=luyen-thi-lai-xe-realm
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=frontend
```

## Mapping Route Qua Kong

| Service | Business API path | Swagger path |
| --- | --- | --- |
| `identity-service` | `/auth/*`, `/admin/*` | `/identity-service/docs` |
| `user-service` | `/users/*`, `/admin/users/*` | `/user-service/docs` |
| `exam-service` | `/exams/*`, `/admin/exams/*` | `/exam-service/docs` |
| `course-service` | `/courses/*`, `/enrollments/*`, `/admin/courses/*` | `/course-service/docs` |
| `question-service` | `/admin/questions/*` | `/question-service/docs` |
| `notification-service` | `/notifications/*`, `/admin/academic-warnings/*` | `/notification-service/docs` |
| `analytics-service` | `/analytics/*`, `/admin/analytics/*` | `/analytics-service/docs` |
| `simulation-service` | `/simulation/*` | `/simulation-service/docs` |
| `media-service` | `/media/*`, `/admin/media/*` | `/media-service/docs` |
| `audit-service` | `/admin/audit-logs/*` | `/audit-service/docs` |

Swagger JSON tương ứng dùng `/docs-json`, ví dụ:

```text
http://localhost:8000/question-service/docs-json
```

## Chạy Local Cho Frontend

Từ root backend repo:

```powershell
pnpm install
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:deploy
pnpm run db:seed
pnpm run dev
```

Kiểm tra Kong:

```powershell
curl http://localhost:8000/question-service/docs-json
pnpm run smoke
```

Các URL thường dùng:

- Kong/API Gateway: `http://localhost:8000`
- Docs service/Scalar: `http://localhost:3009/docs`
- Keycloak: `http://localhost:8080`
- Mailpit: `http://localhost:8025`

## Auth Flow

### Login

Identity service có direct path `POST /login`. Qua Kong, frontend gọi:

```http
POST http://localhost:8000/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin@test.com",
  "password": "123456"
}
```

Response được bọc bởi shared response envelope:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-06-09T00:00:00.000Z",
  "path": "/auth/login",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer"
  }
}
```

Frontend lưu `accessToken` và `refreshToken` theo cơ chế auth store của ứng dụng. Với app web, ưu tiên lưu cẩn thận, hạn chế expose token không cần thiết.

### Refresh Token

```http
POST http://localhost:8000/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh_token>"
}
```

Nếu refresh thành công, response trả token mới cùng shape với login. Nếu refresh token hết hạn hoặc bị revoke, service trả `401`; frontend nên clear auth state và điều hướng về màn login.

### Logout

```http
POST http://localhost:8000/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh_token>"
}
```

Sau logout thành công, frontend xóa token local và điều hướng về login.

### Forgot Password

```http
POST http://localhost:8000/auth/forgot-password
Content-Type: application/json
```

```json
{
  "email": "student.b1@test.com"
}
```

Local mặc định dùng Mailpit. Mở email tại:

```text
http://localhost:8025
```

Chi tiết cấu hình SMTP nằm ở [Forgot Password Email Summary](../requirements/forgot-password-email-summary.md).

## Axios Interceptor Gợi Ý

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = authStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = authStore.getRefreshToken();
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
          { refreshToken },
        );

        const tokens = refreshResponse.data.data;
        authStore.setTokens(tokens.accessToken, tokens.refreshToken);
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch {
        authStore.clear();
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);
```

## Response Envelope

Response thành công:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-06-09T00:00:00.000Z",
  "path": "/admin/questions",
  "data": {}
}
```

Response lỗi:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "timestamp": "2026-06-09T00:00:00.000Z",
  "path": "/admin/questions"
}
```

Frontend nên xử lý theo:

- `success`: request thành công hay thất bại theo chuẩn API.
- `code`: mã lỗi ổn định để map UI.
- `data`: payload nghiệp vụ.
- HTTP status: xử lý auth/session/network.

Không nên parse `message` để quyết định logic nghiệp vụ.

## Swagger Qua Kong

Mở Swagger service qua Kong:

```text
http://localhost:8000/question-service/docs
```

Khi test endpoint cần auth:

1. Login qua `POST /auth/login`.
2. Copy `accessToken`.
3. Mở Swagger service.
4. Bấm `Authorize`.
5. Nhập token dạng `Bearer eyJ...`.

Nếu cần test direct local khi service chạy hybrid:

```text
http://localhost:3005/docs
```

Tuy nhiên frontend nên ưu tiên test qua Kong để khớp path thật.

## Ví Dụ Question Flow

Lấy token:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin@test.com","password":"123456"}'

$token = $login.data.accessToken
```

Tạo topic:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/admin/questions/topics" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"name":"Biển báo","description":"Câu hỏi về biển báo"}'
```

## CORS

`kong/kong.dev.yaml` và `kong/kong.yaml` đã bật CORS global cho các origin local thường dùng:

```text
http://localhost:3000
http://localhost:3001
http://localhost:3009
http://localhost:4173
http://localhost:5173
http://localhost:5174
http://localhost:4200
http://127.0.0.1:3000
http://127.0.0.1:3001
http://127.0.0.1:3009
http://127.0.0.1:4173
http://127.0.0.1:5173
http://127.0.0.1:5174
http://127.0.0.1:4200
```

Nếu frontend chạy port khác, thêm origin vào plugin `cors` trong Kong config rồi restart Kong:

```powershell
docker compose -f docker-compose.infra.yml restart kong-dev
```

## Troubleshooting

| Lỗi | Cách kiểm tra |
| --- | --- |
| `401 Unauthorized` | Kiểm tra header `Authorization: Bearer <token>`, token còn hạn và đúng realm/client |
| `403 Forbidden` | Token hợp lệ nhưng role không đủ, ví dụ `STUDENT` gọi API admin |
| `502 Bad Gateway` | Service upstream chưa chạy hoặc sai port; kiểm tra `pnpm run dev` và log Kong |
| CORS error | Kiểm tra frontend origin có trong `kong/kong.dev.yaml` |
| Swagger qua Kong không load | Gọi thử `http://localhost:8000/<service-name>/docs-json` |
| Refresh loop | Đảm bảo interceptor chỉ retry một lần và logout khi `/auth/refresh` trả `401` |

## Ghi Nhớ

- Gọi API qua Kong: `http://localhost:8000`.
- Auth gửi bằng `Authorization: Bearer <access_token>`.
- Không tự gửi `x-user-id`.
- Swagger qua Kong dùng `/<service-name>/docs`.
- Forgot password local xem mail ở Mailpit: `http://localhost:8025`.
