# Báo Cáo Tổng Kết Kiểm Thử (Test Summary Report)

Báo cáo này tổng hợp hiện trạng kiểm thử (Testing Status), độ phủ yêu cầu (Test Coverage) và hướng dẫn thực thi kiểm thử cho toàn bộ hệ thống microservices của dự án.

---

## 1. Tổng Quan Kiến Trúc Kiểm Thử (Testing Architecture)

Hệ thống DriveMate áp dụng **Chiến lược kiểm thử 4 lớp (4-Layer Testing)** để đảm bảo chất lượng từ mã nguồn nghiệp vụ biệt lập cho tới sự phối hợp hoạt động liên dịch vụ:

```text
               ┌──────────────────────────────────────┐
               │         4. Smoke Testing             │  <── scripts/smoke.ts
               └──────────────────┬───────────────────┘
                                  │
               ┌──────────────────▼───────────────────┐
               │    3. System Integration Testing     │  <── tests/ (Cross-service specs)
               └──────────────────┬───────────────────┘
                                  │
               ┌──────────────────▼───────────────────┐
               │     2. Service-Level E2E Testing     │  <── apps/*/test/ (Supertest APIs)
               └──────────────────┬───────────────────┘
                                  │
               ┌──────────────────▼───────────────────┐
               │    1. Co-located Unit Testing        │  <── apps/*/src/**/*.spec.ts
               └──────────────────────────────────────┘
```

1. **Unit Testing (Co-located):**
   * Tập trung kiểm thử logic nghiệp vụ (Domain Entities, Value Objects) và luồng Use Case.
   * Sử dụng Jest, chạy biệt lập hoàn toàn và giả lập (mock) mọi kết nối cơ sở dữ liệu/hạ tầng.
2. **Service-Level E2E Testing:**
   * Sử dụng `@nestjs/testing` và `supertest` để kiểm tra hoạt động của lớp HTTP Controller và các Adapter (Prisma/Redis).
3. **System Integration Testing:**
   * Kiểm thử tích hợp đa dịch vụ (Cross-service) thông qua API Gateway (Kong) và Message Broker (RabbitMQ).
4. **Smoke Testing:**
   * Kịch bản rà soát nhanh sức khỏe hệ thống (Liveness/Readiness probes) sau mỗi lần deploy.

---

## 2. Kết Quả Kiểm Thử Chất Lượng (ASR Coverage)

Dưới đây là thống kê đối chiếu giữa kịch bản kiểm thử tự động và các thuộc tính chất lượng kiến trúc (ASR):

| Phân Loại ASR | Mã Test Case | Hành Vi Được Kiểm Thử | File Code Test Thực Tế | Trạng Thái |
| :--- | :--- | :--- | :--- | :---: |
| **Bảo Mật (Security)** | `TC-SEC-01-01` | Đăng nhập đúng cấp JWT hợp lệ. | [auth.controller.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/presentation/http/auth.controller.spec.ts) | `PASSED` |
| | `TC-SEC-01-02` | Khóa tài khoản Keycloak sau 5 lần sai. | [login.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/login/login.use-case.spec.ts) | `PASSED` |
| | `TC-SEC-03-01` | Đăng xuất đưa token vào Redis blacklist. | [logout.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/logout/logout.use-case.spec.ts) | `PASSED` |
| | `TC-SEC-03-02` | Chặn đứng token đã đăng xuất bằng Guard. | [token-blacklist.guard.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/infrastructure/guards/token-blacklist.guard.spec.ts) | `PASSED` |
| | `TC-SEC-04-01` | Từ chối tạo tài khoản trùng email. | [create-identity-user.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/create-identity-user/create-identity-user.use-case.spec.ts) | `PASSED` |
| **Độ Tin Cậy (Reliability)** | `TC-REL-03-01` | Gửi autosave đáp án thi dạng idempotent. | [save-answer.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/exam-service/src/application/use-cases/save-answer/save-answer.use-case.spec.ts) | `PASSED` |
| | `TC-REL-04-01` | Chấm điểm & lưu kết quả đồng thời (Transaction).| [submit-session.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.spec.ts) | `PASSED` |
| **Toàn Vẹn Dữ Liệu (DI)** | `TC-DI-02-01` | Đánh trượt ngay lập tức nếu sai câu điểm liệt. | [submit-session.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.spec.ts) | `PASSED` |
| | `TC-DI-05-01` | Atomic chuyển đổi hạng bằng lái của học viên. | [assign-license-tier.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/user-service/src/application/use-cases/assign-license-tier/assign-license-tier.use-case.spec.ts) | `PASSED` |
| | `TC-DI-10-01` | Ngăn xóa cứng khóa học khi có học viên đăng ký.| [delete-course.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/course-service/src/application/use-cases/delete-course/delete-course.use-case.spec.ts) | `PASSED` |
| **Hiệu Năng (Performance)** | `TC-PERF-04-01` | Đọc dữ liệu tiến độ từ pre-aggregated tables. | [get-progress.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/analytics-service/src/application/use-cases/get-progress/get-progress.use-case.spec.ts) | `PASSED` |
| | `TC-PERF-05-01` | Cache-Aside và cơ chế tự động invalidate cache. | [redis-cache.service.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/packages/common/src/cache/redis-cache.service.spec.ts) | `PASSED` |
| **Tích Hợp Event (Cross-svc)** | `TC-INTEG-01` | Đồng bộ tài khoản ➔ User Profile qua RabbitMQ. | [identity-user-sync.integration-spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/tests/event-propagation/identity-user-sync.integration-spec.ts) | `PASSED` |

---

## 3. Hướng Dẫn Chạy Test Tự Động (Test Runner)

### 3.1 Chạy Unit Testing & Service E2E
Sử dụng Turborepo để chạy song song toàn bộ mã test trên tất cả các dịch vụ:

```bash
# Chạy tất cả test suites
npm run test

# Chạy test có báo cáo độ phủ (Coverage)
npm run test:cov
```

### 3.2 Chạy Integration Testing (Cấp hệ thống)
Trước khi chạy, đảm bảo môi trường hạ tầng (Docker Compose) và các dịch vụ liên quan đã khởi chạy (`npm run dev`).

```bash
# Chạy kiểm thử tích hợp event-driven qua Kong và RabbitMQ
npm run test:integration
```

### 3.3 Chạy Smoke Testing (Độ sẵn sàng dịch vụ)
```bash
# Kiểm tra nhanh liveness/readiness của toàn bộ các API
npm run smoke
```
