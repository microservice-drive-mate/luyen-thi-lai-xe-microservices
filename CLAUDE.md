# CLAUDE.md — Luyện Thi Lái Xe Microservices

Monorepo NestJS gồm 9 microservices cho hệ thống luyện thi lái xe, dùng **DDD + Clean Architecture**.
`user-service` là **reference implementation** — mọi service khác follow cùng pattern.

---

## Key Commands

```bash
# Start infrastructure (DB, RabbitMQ, Consul)
docker-compose up -d db-user rabbitmq consul consul-init

# Seed Consul config cho local dev
npm run consul:seed:local

# Start một service cụ thể ở watch mode
npm run dev --filter=user-service

# Build toàn bộ (Turbo parallel)
npm run build

# Lint + format
npm run lint
npx biome check .

# Type check
npm run check-types

# Prisma — chạy từ thư mục service
cd apps/user-service
npx prisma migrate dev
npx prisma generate
npx prisma studio    # GUI xem DB tại localhost:5555

# Seed Consul và list keys
npm run consul:seed:local
npm run consul:list
```

---

## Architecture

```
apps/
├── identity-service   → Keycloak (auth, JWT issuance)
├── user-service       → User profiles, student details, license tiers  ← REFERENCE IMPL
├── exam-service       → Exam sessions, results
├── question-service   → Question bank
├── course-service     → Courses, lessons, progress
├── simulation-service → Driving scenarios
├── notification-service → Email/SMS/push notifications
├── analytics-service  → CQRS read models, statistics
└── docs-service       → Aggregated Swagger UI

packages/
├── common/            → DDD base classes, Consul factory, shared interceptors/filters
├── eslint-config/
└── typescript-config/
```

**Request flow:**

```
Client → Kong (JWT validation, inject x-user-id/x-user-role) → Service
                                                                   ↓
                                                    Presentation (Controller/DTO)
                                                                   ↓
                                                    Application (Use Cases)
                                                                   ↓
                                                    Domain (Aggregate, Events)
                                                                   ↓
                                                    Infrastructure (Prisma, RabbitMQ)
```

**Event flow (eventual consistency):**

```
Keycloak → identity.user.created → user-service (create UserProfile)
                                 → notification-service (welcome email)

user-service → user.student.license-assigned → notification-service
                                             → analytics-service

exam-service → exam.session.completed → notification-service
                                      → analytics-service
```

---

## DDD Building Blocks (từ `@repo/common`)

| Class                       | Dùng khi                                             | Ví dụ                         |
| --------------------------- | ---------------------------------------------------- | ----------------------------- |
| `AggregateRoot<string>`     | Root của cluster entities, quản lý domain events     | `UserProfile`, `ExamSession`  |
| `Entity<string>`            | Object có ID, mutable, owned bởi aggregate           | `StudentDetail`, `ExamAnswer` |
| `ValueObject<T>`            | Immutable, equality by value, validation             | `PhoneNumber`, `Score`        |
| `DomainEvent`               | Sự kiện đã xảy ra trong domain                       | `LicenseTierAssignedEvent`    |
| `DomainException`           | Business rule violation (không phải technical error) | `UserNotFoundException`       |
| `IUseCase<TInput, TOutput>` | Contract chuẩn cho use cases                         | Tất cả use cases              |

---

## Local Ports (development-local)

| Service              | Port              |
| -------------------- | ----------------- |
| identity-service     | 3001              |
| user-service         | 3002              |
| exam-service         | 3003              |
| course-service       | 3004              |
| question-service     | 3005              |
| notification-service | 3006              |
| analytics-service    | 3007              |
| simulation-service   | 3008              |
| Kong (proxy)         | 8000              |
| Kong (admin)         | 8001              |
| Consul UI            | 8500              |
| RabbitMQ             | 5672 / 15672 (UI) |
| user_db              | 5433              |

---

## Response Format (toàn hệ thống)

```json
// Success (từ ApiResponseInterceptor)
{ "success": true, "code": "SUCCESS", "message": "OK", "timestamp": "...", "path": "...", "data": {...} }

// Error HTTP (từ ApiExceptionFilter)
{ "success": false, "code": "NOT_FOUND", "message": "...", "timestamp": "...", "path": "..." }

// Error Domain (từ DomainExceptionFilter)
{ "success": false, "code": "USER_PROFILE_NOT_FOUND", "message": "...", "timestamp": "...", "path": "..." }
```

---

## Conventions cốt lõi

**Layer dependency rule** (bất khả vi phạm):

```
domain ← không import gì ngoài @repo/common
application ← chỉ import domain
infrastructure ← import domain + application
presentation ← chỉ import application (use cases, commands, results)
```

**Aggregate pattern:**

- Constructor `private` — chỉ tạo qua `static create()` hoặc `static reconstitute()`
- Business logic nằm trong domain method của aggregate, KHÔNG trong use case
- `addDomainEvent()` được gọi trong domain method khi business event xảy ra
- Repository `save()` thực hiện trong Prisma `$transaction` — tất cả children cùng một transaction
- Use case publish events SAU KHI `save()` thành công, rồi `clearDomainEvents()`

**Controller rules:**

- `@ApiHeader` chỉ đặt ở method cụ thể dùng header, KHÔNG ở class level
- Update endpoints trả về full object (use case trả result trực tiếp, không double-query)
- Return type là DTO class, KHÔNG dùng anonymous type `{ id: string; name: string }`
- `DomainExceptionFilter` và `ApiExceptionFilter` phải cùng response format

**Kong headers** (inject sau JWT validation):

- `x-user-id` = Keycloak `sub` claim (UUID của user)
- `x-user-role` = role của user

---

## Key Files để nắm nhanh

| File                                                                                        | Vai trò                                                     |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/common/src/ddd/`                                                                  | Tất cả DDD base classes                                     |
| `packages/common/src/http-api.ts`                                                           | `ApiResponseInterceptor`, `ApiExceptionFilter`              |
| `packages/common/src/consul/`                                                               | Config loading từ Consul (priority: env > consul > default) |
| `apps/user-service/src/domain/aggregates/user-profile/user-profile.aggregate.ts`            | Reference aggregate impl                                    |
| `apps/user-service/src/infrastructure/persistence/prisma/prisma-user-profile.repository.ts` | Reference repository impl                                   |
| `apps/user-service/src/infrastructure/filters/domain-exception.filter.ts`                   | DomainException → HTTP response                             |
| `apps/user-service/src/user.module.ts`                                                      | Reference module wiring (DI bindings)                       |
| `apps/user-service/src/main.ts`                                                             | Bootstrap pattern (RabbitMQ + Swagger + pipes/filters)      |
| `kong/kong.yaml`                                                                            | API gateway routing + JWT plugin per route                  |
| `consul-seed-development-local.json`                                                        | Local config values (ports, DB URLs, RabbitMQ)              |
| `guides/ddd+clean/CONVENTIONS.md`                                                           | Code templates + naming conventions + checklist             |
| `guides/api/api-spec-user.md`                                                               | User service API spec (template cho các service khác)       |
| `guides/testing/user-service-test-guide.md`                                                 | Step-by-step testing guide                                  |

---

## Khi implement service mới

1. Đọc `guides/ddd+clean/CONVENTIONS.md` — có đầy đủ code template cho từng layer
2. Đọc `guides/ddd+clean/DATABASE_DESIGN.md` — có schema design cho từng service
3. Copy structure từ `user-service` và điều chỉnh theo bounded context mới
4. Follow checklist "Tạo service mới" ở cuối `CONVENTIONS.md`

---

## Những thứ Claude KHÔNG nên làm

- Thêm `@nestjs/*` import vào `domain/` layer
- Thêm `@prisma/*` import vào `domain/` hoặc `application/` layer
- Publish domain events TRƯỚC KHI save vào DB
- Đặt `@ApiHeader` ở class level controller (phải đặt ở method cụ thể)
- Double-query trong update endpoints (use case nên trả result trực tiếp)
- Dùng anonymous return type trong controller method
- Viết business logic trong repository hoặc mapper
- Tạo FK cross-service trong Prisma schema (chỉ lưu UUID reference)
- Tạo `DomainExceptionFilter` với format khác với `ApiExceptionFilter`
- Bỏ `noAck: false` trong RabbitMQ consumer config (cần acknowledgment)
