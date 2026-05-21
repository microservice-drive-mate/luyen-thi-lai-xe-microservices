# Kong + Frontend Integration Guide

## Mục Tiêu

Frontend không nên gọi từng service port như `3001`, `3002`, `3005` trong flow bình thường. Ở local dev, frontend gọi một gateway duy nhất:

```text
http://localhost:8000
```

Kong route request vào service phù hợp, sau đó service tự validate JWT/RBAC bằng Keycloak guard.

## Path Convention

Tách rõ 2 loại path:

| Loại path         | Mục đích                            | Ví dụ question-service        |
| ----------------- | ----------------------------------- | ----------------------------- |
| Business API path | Frontend gọi API nghiệp vụ          | `/admin/questions/*`                |
| Swagger/docs path | Dev mở Swagger của service qua Kong | `/question-service/docs`      |
| OpenAPI JSON path | Docs-service/tooling lấy spec       | `/question-service/docs-json` |

Mapping hiện tại:

| Service          | Business API path qua Kong     | Swagger/docs path qua Kong |
| ---------------- | ------------------------------ | -------------------------- |
| identity-service | `/auth/*`, `/admin/identity-users/*` | `/identity-service/docs`   |
| user-service     | `/users/*`, `/admin/users/*`         | `/user-service/docs`       |
| exam-service     | `/exams/*`, `/admin/exams/*`         | `/exam-service/docs`       |
| course-service   | `/courses/*`, `/enrollments/*`, `/admin/courses/*` | `/course-service/docs`     |
| question-service | `/admin/questions/*`                 | `/question-service/docs`   |
| media-service    | `/media/*`, `/admin/media/*`         | `/media-service/docs`      |

Naming convention cho frontend:

- `identity-service /admin/identity-users/*` = account/Keycloak identity lifecycle: create account, role, lock, delete.
- `user-service /users/*` = self profile domain; `/admin/users/*` = admin dashboard profile management.
- Student exam flow dùng `GET /exams/available` để chọn đề, sau đó `POST /exams/sessions` để bắt đầu.

Ví dụ tạo câu hỏi:

```http
POST http://localhost:8000/admin/questions
Authorization: Bearer <access_token>
Content-Type: application/json
```

Ví dụ mở Swagger của question-service:

```text
http://localhost:8000/question-service/docs
```

## Setup Local

1. Chạy infra:

```bash
npm run infra:up
```

2. Seed Consul nếu config chưa có:

```bash
npm run consul:seed:local
```

3. Chạy services bằng Turbo:

```bash
npm run dev
```

4. Kiểm tra Kong:

```bash
curl http://localhost:8001/services
curl http://localhost:8000/question-service/docs-json
```

## Auth Model

Hiện tại repo đang dùng mô hình:

1. Kong OSS làm API Gateway: routing, CORS, rate limit.
2. Frontend gửi `Authorization: Bearer <access_token>` đến Kong.
3. Kong forward header đó vào upstream service.
4. Service validate JWT bằng Keycloak guard.
5. Service đọc user hiện tại từ claim `sub` trong JWT.

Không cần tự gửi `x-user-id` từ frontend. Các service đã ưu tiên `sub` trong JWT; `x-user-id` chỉ còn là fallback cho debug/local script cũ.

Lưu ý: image `kong:latest` OSS không có OIDC plugin mặc định. Vì vậy auth enforcement hiện tại nằm ở service. Nếu production muốn auth tại gateway, dùng Kong Enterprise OIDC plugin hoặc custom Kong image có OIDC plugin phù hợp Keycloak/JWKS.

## Frontend Environment

Ví dụ `.env.local` cho Vite/React:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=luyen-thi-lai-xe-realm
VITE_KEYCLOAK_CLIENT_ID=frontend
```

Nếu frontend đang dùng Next.js:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=luyen-thi-lai-xe-realm
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=frontend
```

## Response Structure

Tất cả service HTTP response được bọc bởi shared response envelope.

Thành công:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions",
  "data": {}
}
```

Lỗi:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/admin/questions"
}
```

Frontend nên xử lý theo `success` và `code`, không parse message text để ra logic nghiệp vụ.

## Token Flow

### Login

Identity-service direct local path là `POST /login`. Qua Kong, frontend gọi:

```http
POST http://localhost:8000/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin@example.com",
  "password": "Pass@123"
}
```

Response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 300,
    "refreshExpiresIn": 1800,
    "tokenType": "Bearer"
  }
}
```

### Refresh Token

Identity-service expose direct local path `POST /refresh`. Do Kong route `/auth/*` strip prefix `/auth`, public path qua Kong là:

```http
POST http://localhost:8000/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh_token>"
}
```

Response trả về cặp token mới cùng shape với login. Nếu refresh token hết hạn/bị revoke, service trả `401`, frontend nên logout local và điều hướng về màn login.

Gợi ý interceptor:

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = authStore.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  },
);
```

### Logout

Qua Kong:

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

Sau khi logout thành công, frontend xóa token local storage/memory và điều hướng về login.

Auto logout nên xảy ra khi:

| Trường hợp                           | Frontend behavior                            |
| ------------------------------------ | -------------------------------------------- |
| Refresh token bị từ chối `401`       | Clear token và redirect `/login`             |
| Access token bị blacklist sau logout | Clear token và redirect `/login`             |
| User không đủ role `403`             | Hiện màn hình forbidden, không refresh token |

## Swagger Testing

1. Mở Swagger qua Kong, ví dụ:

```text
http://localhost:8000/question-service/docs
```

2. Bấm `Authorize`.
3. Điền access token theo dạng:

```text
Bearer eyJ...
```

4. Test endpoint như `POST /admin/questions`.

Nếu test direct local, vẫn dùng:

```text
http://localhost:3005/docs
```

Nhưng nên ưu tiên Swagger qua Kong để gắn với frontend path thực tế.

## Example Flow Cho Question

Đăng nhập qua identity-service:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"Pass@123"}' | jq -r '.data.accessToken')
```

Tạo topic:

```bash
curl -X POST http://localhost:8000/admin/questions/topics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Biển báo","description":"Câu hỏi về biển báo"}'
```

Tạo question:

```bash
curl -X POST http://localhost:8000/admin/questions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Gặp biển STOP, người lái xe phải làm gì?",
    "type": "THEORY",
    "licenseCategories": ["B2"],
    "difficulty": "EASY",
    "explanation": "Biển STOP yêu cầu dừng hẳn.",
    "topicId": "<topic-id>",
    "options": [
      { "content": "Dừng lại", "isCorrect": true, "displayOrder": 1 },
      { "content": "Tăng tốc đi qua", "isCorrect": false, "displayOrder": 2 }
    ]
  }'
```

## CORS

`kong/kong.dev.yaml` và `kong/kong.yaml` đã bật CORS global cho:

```text
http://localhost:3000
http://localhost:5173
http://127.0.0.1:3000
http://127.0.0.1:5173
```

Nếu frontend chạy port khác, thêm origin vào plugin `cors`, sau đó restart Kong:

```bash
docker compose -f docker-compose.infra.yml restart kong-dev
```

## Troubleshooting

| Lỗi                         | Cách check                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- |
| `401 Unauthorized`          | Kiểm tra header `Authorization: Bearer <token>` và token còn hạn                |
| `403 Forbidden`             | Token hợp lệ nhưng role không đúng, ví dụ `STUDENT` gọi API admin               |
| `502 Bad Gateway`           | Service upstream chưa chạy, check `npm run dev` và port service                 |
| CORS error trên browser     | Kiểm tra origin frontend đã nằm trong `kong/kong.dev.yaml`                      |
| Swagger qua Kong không load | Gọi `http://localhost:8000/<service-name>/docs-json` để xem route có đúng không |
