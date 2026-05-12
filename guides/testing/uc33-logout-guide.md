# UC33: Logout - Implementation & Testing Guide

## Overview

UC33 Logout đã được triển khai tại `identity-service` với các thành phần:
- Endpoint: `POST /auth/logout`
- Yêu cầu: JWT token hợp lệ từ Authorization header
- Response: Thông báo logout thành công với hướng dẫn xóa token
- Backend: In-memory blacklist (sẵn sàng upgrade sang Redis)

## Architecture

```
Client → POST /auth/logout (header: Authorization: Bearer <token>)
           ↓
         Kong Gateway (truyền token qua)
           ↓
         identity-service: AppController.logout()
           ↓
         AppService.logout(token)
           • Decode JWT → lấy exp claim
           • Validate token chưa hết hạn
           • Thêm vào blacklist với TTL
           ↓
         TokenBlacklistService
           • Lưu token vào in-memory Map
           • Set timeout tự động cleanup
           ↓
         LogoutResponseDto (MSG130)
           ↓
         Client: Xóa token từ LocalStorage/Cookie
```

## Files Changed

### Core Implementation
- `apps/identity-service/src/logout.response.dto.ts` — Response DTO
- `apps/identity-service/src/logout.request.dto.ts` — Request DTO (cho documentation)
- `apps/identity-service/src/infrastructure/token-blacklist/token-blacklist.service.ts` — Blacklist service
- `apps/identity-service/src/app.service.ts` — Logout business logic + JWT decode
- `apps/identity-service/src/app.controller.ts` — Logout endpoint
- `apps/identity-service/src/app.module.ts` — DI wiring

### Infrastructure
- `docker-compose.infra.yml` — Thêm Redis service
- `docker-compose.yaml` — Thêm Redis service
- `consul-seed-development-local.json` — Thêm redis.url config
- `consul-seed-development.json` — Thêm redis.url config

## Behavior

### Success Case: 200 OK
```http
POST /auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...
```

Response:
```json
{
  "success": true,
  "message": "You have been logged out successfully. (MSG130)",
  "instruction": "Please delete your token from LocalStorage or Cookie"
}
```

### Error Cases

#### 1. Token Missing (401)
```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "statusCode": 401
}
```

#### 2. Token Invalid/Malformed (401)
```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "statusCode": 401
}
```

#### 3. Token Expired (401)
```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication token is missing or invalid. (MSG129)",
  "statusCode": 401
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
  -d "client_secret=FkUamLTRQOOAcRyLN4qaiPceoM5g8dwJ" \
  -d "grant_type=password" \
  -d "username=demo" \
  -d "password=demo"

# Hoặc qua identity-service login endpoint
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo"}'

# Lưu lại accessToken từ response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Test Logout — Success Case
```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Expected response: 200 OK
# {
#   "success": true,
#   "message": "You have been logged out successfully. (MSG130)",
#   "instruction": "Please delete your token from LocalStorage or Cookie"
# }
```

### 5. Test Logout — Missing Token
```bash
curl -X POST http://localhost:3001/auth/logout
# Expected: 401 Unauthorized
```

### 6. Test Logout — Invalid Token
```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer invalid.token.here"
# Expected: 401 Unauthorized
```

### 7. Test Blacklist Enforcement (After Logout)
```bash
# Logout thành công → Token vào blacklist
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Lúc này, token vẫn hợp lệ về cấu trúc, nhưng đã bị blacklist
# Khi gọi API private endpoint, gateway sẽ check blacklist
# (Hiện tại chỉ có in-memory blacklist ở identity-service)
# TODO: Khi integrate Kong + Redis, sẽ enforce ở gateway level
```

## Integration Points

### Kong Gateway (Chưa implement)
Khi Kong được cấu hình đầy đủ:
1. Kong JWT plugin sẽ validate JWT trên mọi request
2. Kong Redis plugin sẽ check token blacklist O(1)
3. Nếu token bị blacklist → Kong trả 401, không forward tới backend

**Files to update khi integrate Kong**:
- `kong/kong.dev.yaml` — Thêm Redis plugin config
- `kong/kong.yaml` — Thêm Redis plugin config
- `identity-service` → Publish logout event tới Redis (global blacklist)

### Redis Integration (In Progress)
Hiện tại: In-memory Map trong TokenBlacklistService
Tiếp theo: Thay bằng Redis ioredis client

**Files to create**:
- `apps/identity-service/src/infrastructure/redis/redis.module.ts`
- `apps/identity-service/src/infrastructure/redis/redis.service.ts`

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
|--|--|--|
| BR01 | JWT Validation: Extract từ header, validate | ✅ Implemented |
| BR02 | Token Blacklisting: Add to blacklist với TTL | ✅ Implemented (in-memory) |
| BR03 | Client-Side Cleanup: Return instruction | ✅ Implemented |
| BR04 | Post-Logout Verification: Check blacklist O(1) | 🟡 In-memory only |
| BR05 | Success Response: Return MSG130 | ✅ Implemented |

| Message | Use Case | Status |
|--|--|--|
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
- Endpoint: `POST /auth/logout`
- Auth: JWT Bearer token trong Authorization header

## Troubleshooting

### Token TTL not working
- Check system clock is synchronized
- Verify `exp` claim is present in JWT
- Check TTL calculation: `exp - now` should be positive

### Blacklist not persisting across restarts
- Current: In-memory only (by design, services restart often)
- Fix: Migrate to Redis for persistence

### CORS issues with logout
- Ensure Kong/Gateway allows POST requests to /auth/logout
- Check CORS headers in response
- Verify client sends Authorization header correctly

## References

- SRS UC33: guides/docs/SRS.docx.md (lines 1050-1082)
- DDD Conventions: guides/ddd+clean/CONVENTIONS.md
- CLAUDE.md: Architecture overview
