---
trigger: always_on
---

# Luyện Thi Lái Xe Microservices - AI Coding Rules & Guidelines

Tài liệu này định nghĩa các quy tắc, quy chuẩn kiến trúc, quy trình phát triển và kiểm thử bắt buộc dành cho AI Agent và nhà phát triển khi làm việc trên repo `luyen-thi-lai-xe-microservices`.

---

## 1. TỔNG QUAN HỆ THỐNG & CÔNG NGHỆ

- **Kiến trúc:** Monorepo quản lý bằng `pnpm workspace` và `Turbo`.
- **Framework:** NestJS (Backend Services), Prisma ORM (Database Management).
- **Hạ tầng local/dev:**
  - **Kong API Gateway:** Đầu mối tiếp nhận duy nhất của Frontend (`http://localhost:8000`).
  - **Keycloak:** Quản lý Identity & Authentication (`http://localhost:8080`).
  - **Consul:** Quản lý cấu hình tập trung (`http://localhost:8500`).
  - **RabbitMQ:** Giao tiếp bất đồng bộ qua Event-Driven Architecture (`http://localhost:15672`).
  - **Mailpit:** Mock SMTP server để nhận mail testing (`http://localhost:8025`).
  - **Observability:** Prometheus, Grafana, Jaeger, ELK Stack.

---

## 2. QUY TẮC KIẾN TRÚC (DDD & CLEAN ARCHITECTURE)

Dự án tuân thủ nghiêm ngặt mô hình **Domain-Driven Design (DDD)** kết hợp **Clean Architecture**. Hướng phụ thuộc duy nhất từ ngoài vào trong:

$$\text{presentation} \longrightarrow \text{application} \longleftarrow \text{infrastructure} \longrightarrow \text{domain}$$

### 2.1 Cấu Trúc Thư Mục Service Chuẩn (`apps/<service-name>/`)

```text
apps/<service-name>/
├── prisma/
│   ├── schema.prisma           # Prisma schema (models của service)
│   └── migrations/             # Migrations tự động tạo
├── src/
│   ├── domain/                 # Layer trong cùng: Aggregate, Entity, Value Object, Event, Exception, Repository Interface. ZERO dependencies ngoài @repo/common.
│   │   ├── aggregates/         # Aggregate roots & child entities
│   │   ├── value-objects/      # Value objects bảo vệ tính toàn vẹn thuộc tính
│   │   ├── events/             # Domain events phát sinh trong domain nghiệp vụ
│   │   ├── exceptions/         # Domain exceptions kế thừa từ DomainException
│   │   └── repositories/       # Abstract repository interfaces (contract)
│   ├── application/            # Layer điều phối: Use Case, Command, Query, Result, Output Ports
│   │   ├── ports/              # Output ports (ví dụ EventPublisher port)
│   │   └── use-cases/          # Các nghiệp vụ được tổ chức theo Use Case riêng biệt
│   ├── infrastructure/         # Layer hạ tầng: Implement ports, Prisma client, DB repositories, RabbitMQ publishers
│   │   ├── persistence/        # Prisma service, Prisma repository implementation, Mappers
│   │   ├── messaging/          # RabbitMQ publishers/adapters
│   │   └── filters/            # DomainExceptionFilter ánh xạ lỗi sang HTTP status
│   ├── presentation/           # Layer giao tiếp: Controllers, DTOs, Event Subscribing
│   │   ├── http/               # Controllers xử lý HTTP request/response
│   │   ├── messaging/          # Controllers xử lý RabbitMQ event/message pattern
│   │   └── dtos/               # Request & Response DTOs với class-validator & Swagger decorators
│   ├── <service-name>.module.ts # Module nghiệp vụ chính của service
│   ├── app.module.ts           # Root module (wiring cấu hình, Consul, Database)
│   └── main.ts                 # Điểm khởi chạy (bootstrap) NestJS service
```

### 2.2 Những Điều CẤM KỴ Khi Code
- ❌ **KHÔNG** import `@nestjs/*` hoặc các thư viện framework vào `domain/`.
- ❌ **KHÔNG** import Prisma client hoặc gọi database trực tiếp từ `domain/` hay `application/`.
- ❌ **KHÔNG** đưa logic nghiệp vụ (business rules) vào controller hoặc Prisma repository.
- ❌ **KHÔNG** tạo mối quan hệ khóa ngoại (foreign key/relations) chéo cơ sở dữ liệu giữa các microservices.
- ❌ **KHÔNG** hardcode secret key, mật khẩu, URL, cổng kết nối trong code. Phải đi qua cấu hình Consul hoặc biến môi trường.
- ❌ **KHÔNG** tự ý gửi header debug (`x-user-id`, `x-user-role`) từ frontend trong môi trường production/staging (các service phải đọc từ Keycloak JWT).

---

## 3. QUY TẮC ĐẶT TÊN & FORMAT CHUẨN

### 3.1 Quy Tắc Đặt Tên File (Suffixes)
| Khái niệm | Định dạng file | Ví dụ |
| :--- | :--- | :--- |
| **Aggregate Root** | `*.aggregate.ts` | `exam-session.aggregate.ts` |
| **Child Entity** | `*.entity.ts` | `exam-answer.entity.ts` |
| **Value Object** | `*.vo.ts` | `score.vo.ts` |
| **Domain Event** | `*.event.ts` | `exam-completed.event.ts` |
| **Domain Exception** | `*.exception.ts` | `exam-not-found.exception.ts` |
| **Abstract Repository** | `*.repository.ts` | `exam-session.repository.ts` |
| **Command** | `*.command.ts` | `submit-exam.command.ts` |
| **Query** | `*.query.ts` | `get-exam-result.query.ts` |
| **Result** | `*.result.ts` | `get-exam-result.result.ts` |
| **Use Case** | `*.use-case.ts` | `submit-exam.use-case.ts` |
| **Mapper** | `*.mapper.ts` | `exam-session.mapper.ts` |
| **Request DTO** | `*.request.dto.ts` | `create-exam.request.dto.ts` |
| **Response DTO** | `*.response.dto.ts` | `exam-session.response.dto.ts` |

### 3.2 Quy Tắc Đặt Tên Class
- **Aggregate / Entity / Value Object:** CamelCase thông thường (ví dụ: `ExamSession`, `ExamAnswer`, `Score`).
- **Domain Event:** Suffix `Event` (ví dụ: `ExamCompletedEvent`).
- **Domain Exception:** Suffix `Exception` (ví dụ: `ExamNotFoundException`).
- **Use Case:** Suffix `UseCase` (ví dụ: `SubmitExamUseCase`).
- **Command / Query / Result:** Suffix tương ứng `Command`, `Query`, `Result`.
- **Repository Implementation:** Prefix `Prisma` + Suffix `Repository` (ví dụ: `PrismaExamSessionRepository`).

### 3.3 Quy Tắc Đặt Tên Domain Event (RabbitMQ/Outbox)
Format: `<service>.<aggregate>.<past-tense-verb>`
- Ví dụ: `exam.session.completed`, `course.enrollment.created`, `identity.user.created`

### 3.4 Quy Tắc Đặt Mã Lỗi Exception (Exception Codes)
Format: `SCREAMING_SNAKE_CASE` đại diện trạng thái nghiệp vụ bị sai.
- Ví dụ: `EXAM_SESSION_NOT_FOUND`, `EXAM_ALREADY_SUBMITTED`, `COURSE_NOT_ACTIVE`.
- **Lưu ý:** Tạo Exception riêng kế thừa từ `DomainException` trong domain layer. Đăng ký status code tương ứng tại `DomainExceptionFilter` thuộc infrastructure layer. Không throw trực tiếp HTTP Exceptions của NestJS từ domain/application.

---

## 4. QUY TRÌNH CẬP NHẬT TÀI LIỆU KHI SỬA CODE

Tài liệu trong thư mục `docs/` là **Nguồn Sự Thật** của dự án. Khi thay đổi mã nguồn, bắt buộc phải cập nhật tài liệu tương ứng:

1. **Thay đổi Endpoint HTTP:**
   - Cập nhật file spec tương ứng tại `docs/api/api-spec-<service>.md`.
   - Bổ sung/sửa đổi Swagger decorators (`@ApiProperty`, `@ApiPropertyOptional`, `@ApiOperation`).
   - Cập nhật route Kong tại `kong/kong.dev.yaml` & `kong/kong.yaml` (nếu cần).
   - Kiểm tra/sửa đổi `scripts/smoke.ts`.
2. **Thay đổi Cấu hình (Consul / Env):**
   - Cập nhật tài liệu [Consul Workflow](file:///d:/Desktop/luyen-thi-lai-xe-microservices/docs/devops/consul-workflow.md).
   - Đồng bộ file `.env.example`, các file cấu hình `consul-seed-*.json`, `docker/consul/init.sh`, và Helm chart `values.yaml` (nếu deploy AKS).
3. **Thay đổi RabbitMQ Event hoặc Outbox:**
   - Cập nhật API spec của service phát hành (producer) và service tiêu thụ (consumer) trong `docs/api/`.
   - Cập nhật các tài liệu kiểm thử hoặc khả năng phục hồi hệ thống tại `docs/testing/` và `docs/devops/system-resilience-guide.md`.
4. **Thay đổi Prisma Schema hoặc Database Migration:**
   - Sửa `schema.prisma` tại service tương ứng, sinh migration qua `pnpm run db:migrate` (local dev) hoặc deploy qua `pnpm run db:deploy`.
   - Cập nhật database seed trong `scripts/` hoặc `seed/` nếu có dữ liệu mẫu mới.
5. **Thay đổi Yêu Cầu / Use Case Nghiệp Vụ:**
   - Cập nhật `docs/requirements/srs-document.md` và `docs/testing/requirements-traceability-matrix.md`.

---

## 5. QUALITY GATES & CÁC LỆNH KIỂM TRA QUAN TRỌNG

Trước khi commit code hoặc hoàn thành một task, hãy chạy các lệnh kiểm tra tương ứng với phạm vi ảnh hưởng:

### 5.1 Kiểm tra cục bộ một Service
```powershell
# Chạy typecheck
pnpm --dir apps/<service-name> run check-types
# Build thử service
pnpm --dir apps/<service-name> run build
```

### 5.2 Kiểm tra toàn Monorepo
```powershell
# Thực hiện lint và format code
pnpm run lint
pnpm run format
# Typecheck toàn bộ dự án
pnpm run check-types
# Build toàn bộ hệ thống để đảm bảo tính liên kết
pnpm run build
```

### 5.3 Database & Seeding
```powershell
# Sinh Prisma Client
pnpm run db:generate
# Tạo migration mới cho DB
pnpm run db:migrate
# Seed dữ liệu demo toàn bộ
pnpm run db:seed
```

### 5.4 Integration & Smoke Testing
```powershell
# Kiểm tra nhanh qua Kong Gateway
pnpm run smoke
# Kiểm tra tổng thể các dịch vụ tích hợp
pnpm run test
pnpm run test:integration
```

---

## 6. THỨ TỰ ƯU TIÊN PHÂN TÍCH CHO AI AGENT

Khi AI nhận một task từ người dùng:
1. Đọc tệp [README.md](file:///d:/Desktop/luyen-thi-lai-xe-microservices/README.md) của repo để hiểu cấu trúc & cổng kết nối hiện tại.
2. Đọc [docs/development-guidelines.md](file:///d:/Desktop/luyen-thi-lai-xe-microservices/docs/development-guidelines.md) để biết các yêu cầu và checklist chi tiết.
3. Đọc [docs/architecture/clean-ddd-conventions.md](file:///d:/Desktop/luyen-thi-lai-xe-microservices/docs/architecture/clean-ddd-conventions.md) để tuân thủ kiến trúc Clean + DDD.
4. Kiểm tra các tệp đặc tả API tương ứng trong thư mục `docs/api/` trước khi tiến hành code.
