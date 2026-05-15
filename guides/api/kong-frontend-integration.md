# Kong + Frontend Integration Guide

## Muc Tieu

Frontend khong nen goi tung service port nhu `3001`, `3002`, `3005` trong flow binh thuong. O local dev, frontend goi mot gateway duy nhat:

```text
http://localhost:8000
```

Kong route request vao service phu hop, sau do service tu validate JWT/RBAC bang Keycloak guard.

## Path Convention

Tach ro 2 loai path:

| Loai path         | Muc dich                            | Vi du question-service        |
| ----------------- | ----------------------------------- | ----------------------------- |
| Business API path | Frontend goi API nghiep vu          | `/questions/*`                |
| Swagger/docs path | Dev mo Swagger cua service qua Kong | `/question-service/docs`      |
| OpenAPI JSON path | Docs-service/tooling lay spec       | `/question-service/docs-json` |

Mapping hien tai:

| Service          | Business API path qua Kong     | Swagger/docs path qua Kong |
| ---------------- | ------------------------------ | -------------------------- |
| identity-service | `/auth/*`, `/admin/*`          | `/identity-service/docs`   |
| user-service     | `/users/*`                     | `/user-service/docs`       |
| course-service   | `/courses/*`, `/enrollments/*` | `/course-service/docs`     |
| question-service | `/questions/*`                 | `/question-service/docs`   |
| media-service    | `/media/*`                     | `/media-service/docs`      |

Vi du tao cau hoi:

```http
POST http://localhost:8000/questions
Authorization: Bearer <access_token>
Content-Type: application/json
```

Vi du mo Swagger cua question-service:

```text
http://localhost:8000/question-service/docs
```

## Setup Local

1. Chay infra:

```bash
npm run infra:up
```

2. Seed Consul neu config chua co:

```bash
npm run consul:seed:local
```

3. Chay services bang Turbo:

```bash
npm run dev
```

4. Kiem tra Kong:

```bash
curl http://localhost:8001/services
curl http://localhost:8000/question-service/docs-json
```

## Auth Model

Hien tai repo dang dung mo hinh:

1. Kong OSS lam API Gateway: routing, CORS, rate limit.
2. Frontend gui `Authorization: Bearer <access_token>` den Kong.
3. Kong forward header do vao upstream service.
4. Service validate JWT bang Keycloak guard.
5. Service doc user hien tai tu claim `sub` trong JWT.

Khong can tu gui `x-user-id` tu frontend. Cac service da uu tien `sub` trong JWT; `x-user-id` chi con la fallback cho debug/local script cu.

Luu y: image `kong:latest` OSS khong co OIDC plugin mac dinh. Vi vay auth enforcement hien tai nam o service. Neu production muon auth tai gateway, dung Kong Enterprise OIDC plugin hoac custom Kong image co OIDC plugin phu hop Keycloak/JWKS.

## Frontend Environment

Vi du `.env.local` cho Vite/React:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=luyen-thi-lai-xe-realm
VITE_KEYCLOAK_CLIENT_ID=frontend
```

Neu frontend dang dung Next.js:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=luyen-thi-lai-xe-realm
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=frontend
```

## Response Structure

Tat ca service HTTP response duoc boc boi shared response envelope.

Thanh cong:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/questions",
  "data": {}
}
```

Loi:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/questions"
}
```

Frontend nen xu ly theo `success` va `code`, khong parse message text de ra logic nghiep vu.

## Token Flow

### Login

Identity-service direct local path la `POST /login`. Qua Kong, frontend goi:

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

Identity-service expose direct local path `POST /refresh`. Do Kong route `/auth/*` strip prefix `/auth`, public path qua Kong la:

```http
POST http://localhost:8000/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh_token>"
}
```

Response tra ve cap token moi cung shape voi login. Neu refresh token het han/bi revoke, service tra `401`, frontend nen logout local va dieu huong ve man login.

Goi y interceptor:

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

Sau khi logout thanh cong, frontend xoa token local storage/memory va dieu huong ve login.

Auto logout nen xay ra khi:

| Truong hop                           | Frontend behavior                            |
| ------------------------------------ | -------------------------------------------- |
| Refresh token bi tu choi `401`       | Clear token va redirect `/login`             |
| Access token bi blacklist sau logout | Clear token va redirect `/login`             |
| User khong du role `403`             | Hien man hinh forbidden, khong refresh token |

## Swagger Testing

1. Mo Swagger qua Kong, vi du:

```text
http://localhost:8000/question-service/docs
```

2. Bam `Authorize`.
3. Dien access token theo dang:

```text
Bearer eyJ...
```

4. Test endpoint nhu `POST /questions`.

Neu test direct local, van dung:

```text
http://localhost:3005/docs
```

Nhung nen uu tien Swagger qua Kong de gan voi frontend path thuc te.

## Example Flow Cho Question

Dang nhap qua identity-service:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"Pass@123"}' | jq -r '.data.accessToken')
```

Tao topic:

```bash
curl -X POST http://localhost:8000/questions/topics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bien bao","description":"Cau hoi ve bien bao"}'
```

Tao question:

```bash
curl -X POST http://localhost:8000/questions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Gap bien STOP, nguoi lai xe phai lam gi?",
    "type": "THEORY",
    "licenseCategories": ["B2"],
    "difficulty": "EASY",
    "explanation": "Bien STOP yeu cau dung han.",
    "topicId": "<topic-id>",
    "options": [
      { "content": "Dung lai", "isCorrect": true, "displayOrder": 1 },
      { "content": "Tang toc di qua", "isCorrect": false, "displayOrder": 2 }
    ]
  }'
```

## CORS

`kong/kong.dev.yaml` va `kong/kong.yaml` da bat CORS global cho:

```text
http://localhost:3000
http://localhost:5173
http://127.0.0.1:3000
http://127.0.0.1:5173
```

Neu frontend chay port khac, them origin vao plugin `cors`, sau do restart Kong:

```bash
docker compose -f docker-compose.infra.yml restart kong-dev
```

## Troubleshooting

| Loi                         | Cach check                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- |
| `401 Unauthorized`          | Kiem tra header `Authorization: Bearer <token>` va token con han                |
| `403 Forbidden`             | Token hop le nhung role khong dung, vi du `STUDENT` goi API admin               |
| `502 Bad Gateway`           | Service upstream chua chay, check `npm run dev` va port service                 |
| CORS error tren browser     | Kiem tra origin frontend da nam trong `kong/kong.dev.yaml`                      |
| Swagger qua Kong khong load | Goi `http://localhost:8000/<service-name>/docs-json` de xem route co dung khong |
