# UC33: Logout - Implementation & Testing Guide

## Overview

UC33 Logout đã được triển khai tại `identity-service` với các thành phần:

- Endpoint: `POST /logout`
- Yêu cầu: JWT access token (Authorization header) + refresh token (request body)
- Response: Thông báo logout thành công với hướng dẫn xóa token
- Backend: Revoke session trên Keycloak + Redis blacklist theo `jti`/token TTL

## Architecture

```
Client → POST /logout
           Authorization: Bearer <access_token>
           Body: { "refreshToken": "<refresh_token>" }
           ↓
         Kong Gateway (truyền token qua)
           ↓
         identity-service: AuthController.logout()
           ↓
         AppService.logout(token, refreshToken)
           • Decode JWT → lấy exp claim
           • Revoke session trên Keycloak (dùng refreshToken)
           • Thêm access token vào blacklist với TTL
           ↓
         TokenBlacklistService
           • Lưu key `bl:<jti>` vào Redis
           • TTL theo `exp` của access token
           ↓
         LogoutResponseDto (MSG130)
           ↓
         Client: Xóa token từ LocalStorage/Cookie
```

## Files Changed

### Core Implementation

- `apps/identity-service/src/presentation/dtos/logout.response.dto.ts` — Response DTO
- `apps/identity-service/src/presentation/dtos/logout.request.dto.ts` — Request DTO
- `apps/identity-service/src/infrastructure/token-blacklist/token-blacklist.service.ts` — Blacklist service
- `apps/identity-service/src/app.service.ts` — Logout business logic + JWT decode
- `apps/identity-service/src/presentation/http/auth.controller.ts` — Logout endpoint
- `apps/identity-service/src/app.module.ts` — DI wiring

### Infrastructure

- `docker-compose.infra.yml` — Thêm Redis service
- `docker-compose.yaml` — Thêm Redis service
- `consul-seed-development-local.json` — Thêm redis.url config
- `consul-seed-development.json` — Thêm redis.url config

## Behavior

### Success Case: 200 OK

```http
POST /logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Response:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "path": "/logout",
  "data": {
    "success": true,
    "message": "You have been logged out successfully. (MSG130)",
    "instruction": "Please delete your token from LocalStorage or Cookie"
  }
}
```

### Error Cases

#### 1. Token Missing (401)

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "timestamp": "...",
  "path": "/logout"
}
```

#### 2. Token Invalid/Malformed (401)

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "timestamp": "...",
  "path": "/logout"
}
```

#### 3. Token Expired (401)

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "timestamp": "...",
  "path": "/logout"
}
```

## Manual Testing Steps

### 1. Khởi động Infrastructure

```bash
# Terminal 1: Khởi động infra (PostgreSQL, RabbitMQ, Consul, Keycloak, Redis)
npm run infra:up

# Chờ khoảng 30 giây để tất cả services healthy
```

### 2. Khởi động Services

```bash
# Terminal 2: Khởi động identity-service local
npm run dev --filter=identity-service
```

### 3. Test Login

```bash
# Lấy access token từ Keycloak
curl -X POST http://localhost:8080/realms/luyen-thi-lai-xe-realm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=nestjs-backend" \
  -d "client_secret=${KEYCLOAK_CLIENT_SECRET}" \
  -d "grant_type=password" \
  -d "username=demo" \
  -d "password=demo"

# Hoặc qua identity-service login endpoint
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo"}'

# Lưu lại accessToken và refreshToken từ response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Test Logout — Success Case

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# Expected response: 200 OK
# {
#   "success": true,
#   "code": "SUCCESS",
#   "message": "OK",
#   "timestamp": "...",
#   "path": "/logout",
#   "data": {
#     "success": true,
#     "message": "You have been logged out successfully. (MSG130)",
#     "instruction": "Please delete your token from LocalStorage or Cookie"
#   }
# }
```

### 5. Test Logout — Missing Token

```bash
curl -X POST http://localhost:3001/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "any-value"}'
# Expected: 401 Unauthorized
```

### 6. Test Logout — Invalid Token

```bash
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "any-value"}'
# Expected: 401 Unauthorized
```

### 7. Test Blacklist Enforcement (After Logout)

```bash
# Logout thành công → Token vào blacklist
curl -X POST http://localhost:3001/logout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"

# Lúc này, token vẫn hợp lệ về cấu trúc, nhưng đã bị blacklist
# Khi gọi protected API của identity-service, TokenBlacklistGuard check Redis
# Expected: 401 Token has been revoked
```

## Integration Points

### Current enforcement

Hiện tại blacklist được enforce ở service layer của `identity-service` bằng global `TokenBlacklistGuard` và Redis. Kong vẫn validate/route request nhưng không tự check Redis blacklist.

1. `POST /logout` decode access token, lấy `exp`, revoke refresh token/session trên Keycloak.
2. `TokenBlacklistService` lưu key `bl:<jti>` vào Redis với TTL đến khi access token hết hạn.
3. Protected API trong `identity-service` reject token đã logout bằng `401`.

### Gateway/backlog note

Nếu muốn chặn token đã logout trước khi request tới mọi service, cần thêm blacklist guard/plugin dùng chung ở API gateway hoặc shared guard trong từng service. Đây là hardening mở rộng, không giả định frontend phải gửi header nào khác ngoài `Authorization`.

### Redis Integration

Hiện tại: `TokenBlacklistService` dùng `ioredis` client được inject từ `identity-service` app module.

**Cấu hình**:

```typescript
// In AppModule
RedisModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    url: configService.get<string>('redis.url'),
  }),
})
```

## SRS Reference

**UC33: Logout**

| BR | Mô tả | Status |
| -- | -- | -- |
| BR01 | JWT Validation: Extract từ header, validate | ✅ Implemented |
| BR02 | Token Blacklisting: Add to blacklist với TTL | ✅ Implemented (in-memory) |
| BR03 | Client-Side Cleanup: Return instruction | ✅ Implemented |
| BR04 | Post-Logout Verification: Check blacklist O(1) | 🟡 In-memory only |
| BR05 | Success Response: Return MSG130 | ✅ Implemented |

| Message | Use Case | Status |
| -- | -- | -- |
| MSG129 | Token missing/invalid | ✅ Implemented |
| MSG130 | Logout success | ✅ Implemented |

## Next Steps

1. **Integrate Redis** (optional, for production)
   - Update TokenBlacklistService to use ioredis
   - Add Redis module to AppModule
   - Verify TTL enforcement

2. **Integrate Kong** (optional, for enforce blacklist at gateway level)
   - Add Kong Redis plugin config
   - Test post-logout requests are blocked

3. **Add Unit Tests**
   - Test JWT decode
   - Test token validation
   - Test blacklist add/check
   - Test error cases

4. **Add E2E Tests**
   - Full flow: Login → Logout → Try to use old token

5. **Add Monitoring**
   - Log logout events
   - Monitor blacklist size
   - Alert if blacklist grows unexpectedly

## Swagger Documentation

Endpoint tự động được documented ở:

- Swagger UI: `http://localhost:3001/swagger`
- Endpoint: `POST /logout`
- Auth: JWT Bearer token trong Authorization header + refreshToken trong body

## Troubleshooting

### Token TTL not working

- Check system clock is synchronized
- Verify `exp` claim is present in JWT
- Check TTL calculation: `exp - now` should be positive

### Blacklist not persisting across restarts

- Current: In-memory only (by design, services restart often)
- Fix: Migrate to Redis for persistence

### CORS issues with logout

- Ensure Kong/Gateway allows POST requests to /logout
- Check CORS headers in response
- Verify client sends Authorization header correctly

## References

- SRS UC33: guides/docs/SRS.docx.md (lines 1050-1082)
- DDD Conventions: guides/ddd+clean/CONVENTIONS.md
- CLAUDE.md: Architecture overview
