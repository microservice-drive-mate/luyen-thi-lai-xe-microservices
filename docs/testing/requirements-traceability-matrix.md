# Requirements Traceability Matrix (RTM) — Ma Trận Truy Vết Yêu Cầu

Tài liệu này đóng vai trò là **Ma trận truy vết yêu cầu (Requirements Traceability Matrix - RTM)** cho hệ thống **DriveMate**. RTM giúp đối chiếu trực tiếp các **Yêu cầu Nghiệp vụ (SRS Use Cases)**, các **Kịch bản Thuộc tính Chất lượng (ASR)** sang các **Mã ca kiểm thử (Test Case ID)** và vị trí **File kiểm thử thực tế** tương ứng trong mã nguồn.

---

## 🗺️ Ma Trận Truy Vết Tổng Hợp (SRS ➔ ASR ➔ Test Case)

| Use Case (SRS) | Thuộc Tính Chất Lượng (ASR) | Mã Test Case (ID) | Kịch Bản Kiểm Thử (Test Scenario) | Vị Trí File Code Test Tương Ứng | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **UC01: Đăng Nhập** | **ASR-SEC-01** (Stateless Auth & Lockout) | `TC-SEC-01-01` | Kiểm tra đăng nhập với thông tin hợp lệ trả về JWT TokenSet (Access, Refresh token). | [auth.controller.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/presentation/http/auth.controller.spec.ts) | `PASSED` |
| | | `TC-SEC-01-02` | Xác thực hành vi khóa tài khoản tạm thời khi đăng nhập sai quá 5 lần liên tiếp. | [login.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/login/login.use-case.spec.ts) | `PASSED` |
| **UC02: Quên Mật Khẩu** | **ASR-SEC-02** (Password Reset Security) | `TC-SEC-02-01` | Đảm bảo token reset mật khẩu hết hạn sau 15 phút hoặc bị vô hiệu hóa ngay sau lần dùng đầu tiên. | [forgot-password.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/forgot-password/forgot-password.use-case.spec.ts) | `PASSED` |
| **UC03: Tạo Tài Khoản** | **ASR-SEC-04** (Unique Email & RBAC) | `TC-SEC-04-01` | Từ chối tạo tài khoản mới nếu email đã tồn tại trong hệ thống (Keycloak & DB). | [create-identity-user.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/create-identity-user/create-identity-user.use-case.spec.ts) | `PASSED` |
| | **ASR-AV-05** (Outbox Consistency) | `TC-AV-05-01` | Xác thực sự kiện `identity.user.created` được bắn lên RabbitMQ để đồng bộ bất đồng bộ sang `user-service`. | [identity-event-publisher.service.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/infrastructure/messaging/identity-event-publisher.service.spec.ts) | `PASSED` |
| **UC05: Khóa Tài Khoản** | **ASR-SEC-01** (Lockout Policy) | `TC-SEC-01-03` | Xác nhận tài khoản sau khi bị khóa (`locked = true`) không thể thực hiện đăng nhập để lấy token. | [lock-user.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/lock-user/lock-user.use-case.spec.ts) | `PASSED` |
| **UC06: Gán Hạng Bằng Lái**| **ASR-DI-05** (One Active License) | `TC-DI-05-01` | Xác thực hành vi gán hạng bằng lái mới sẽ tự động hủy kích hoạt hạng cũ, cập nhật đồng bộ. | [assign-license-tier.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/user-service/src/application/use-cases/assign-license-tier/assign-license-tier.use-case.spec.ts) | `PASSED` |
| **UC08: Tạo Khóa Học** | **ASR-PERF-05** (Course Cache) | `TC-PERF-05-01` | Kiểm tra Cache-Aside ghi đệm danh sách khóa học mới và tự động invalidate khi có cập nhật. | [redis-cache.service.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/packages/common/src/cache/redis-cache.service.spec.ts) | `PASSED` |
| **UC10: Xóa Khóa Học** | **ASR-DI-10** (Referential Integrity) | `TC-DI-10-01` | Từ chối xóa cứng (hard-delete) khóa học đã có học viên đăng ký hoặc học lịch sử. | [delete-course.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/course-service/src/application/use-cases/delete-course/delete-course.use-case.spec.ts) | `PASSED` |
| **UC12: Quản Lý Phiên Thi**| **ASR-REL-03** (Idempotent Autosave) | `TC-REL-03-01` | Gửi đáp án tự động (autosave) nhiều lần cho cùng một câu hỏi không làm tăng bản ghi trùng lặp. | [save-answer.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/exam-service/src/application/use-cases/save-answer/save-answer.use-case.spec.ts) | `PASSED` |
| **UC13: Nộp Bài Thi** | **ASR-REL-04** (Atomic Submit & Rollback) | `TC-REL-04-01` | Việc lưu bài thi, tính toán điểm số và đổi trạng thái session diễn ra nguyên tử (Transactional Unit of Work). | [submit-session.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.spec.ts) | `PASSED` |
| **UC14: Chấm Điểm Thi** | **ASR-DI-02** (Kill-Question Scoring) | `TC-DI-02-01` | Học viên làm sai câu hỏi điểm liệt (`isCritical = true`) sẽ bị đánh trượt ngay lập tức dù điểm tổng đạt yêu cầu. | [submit-session.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.spec.ts) | `PASSED` |
| **UC26: Theo Dõi Tiến Độ** | **ASR-PERF-04** (Pre-aggregated Read Mode) | `TC-PERF-04-01` | Đọc dữ liệu báo cáo thống kê từ bảng pre-aggregated thay vì thực hiện tính toán sum/avg trực tiếp trên bảng raw logs. | [get-progress.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/analytics-service/src/application/use-cases/get-progress/get-progress.use-case.spec.ts) | `PASSED` |
| **UC33: Đăng Xuất** | **ASR-SEC-03** (Session Revocation) | `TC-SEC-03-01` | Lưu JWT JTI vào Redis Blacklist sau khi gọi API đăng xuất và set TTL tương ứng thời hạn còn lại của token. | [logout.use-case.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/application/use-cases/logout/logout.use-case.spec.ts) | `PASSED` |
| | | `TC-SEC-03-02` | Từ chối truy cập tài nguyên bảo mật khi request mang JWT nằm trong Redis Blacklist thông qua Global Guard. | [token-blacklist.guard.spec.ts](file:///C:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/src/infrastructure/guards/token-blacklist.guard.spec.ts) | `PASSED` |

---

## 🏗️ Tổ Chức Thư Mục Kiểm Thử (Testing Architecture)

Mô hình thiết lập kiểm thử chuẩn doanh nghiệp cho dự án microservices kết hợp **DDD (Domain-Driven Design)** và **Clean Architecture (Hexagonal)**:

```text
luyen-thi-lai-xe-microservices/
├── apps/
│   ├── identity-service/
│   │   ├── src/
│   │   │   ├── domain/                  <── [1] UNIT TESTS (Co-located)
│   │   │   │   └── aggregates/
│   │   │   │       ├── user.aggregate.ts
│   │   │   │       └── user.aggregate.spec.ts
│   │   │   └── application/
│   │   │       └── use-cases/
│   │   │           ├── login.use-case.ts
│   │   │           └── login.use-case.spec.ts
│   │   └── test/                        <── [2] SERVICE-LEVEL E2E TESTS
│   │       ├── app.e2e-spec.ts
│   │       └── jest-e2e.json
│   └── ...
├── packages/
│   ├── common/                          <── [3] SHARED LIB UNIT & INTEGRATION TESTS
│   │   └── src/
│   │       └── health/
│   │           ├── health.service.ts
│   │           └── health.service.spec.ts
├── tests/                               <── [4] SYSTEM-LEVEL INTEGRATION & MULTI-SERVICE TESTS
│   ├── event-propagation/               <── Kiểm thử đồng bộ Event qua RabbitMQ
│   │   └── identity-user-sync.e2e.ts
│   └── api-gateway/                     <── Kiểm thử định tuyến & bảo mật của Kong Gateway
│       └── gateway-routing.e2e.ts
├── scripts/                             <── [5] LIGHTWEIGHT SMOKE TESTING
│   └── smoke.ts
```

### 1. Phân Lớp Kiểm Thử (Clean Architecture Mapping)

1. **Unit Testing (Domain & Application Logic):**
   * *Vị trí:* Đặt trực tiếp cùng thư mục với file code nguồn (co-located) với đuôi `.spec.ts`.
   * *Nhiệm vụ:* Đảm bảo kiểm thử biệt lập các Entity, Value Object của Domain và các Use Cases của Application Layer. Không khởi tạo NestJS IoC container, không kết nối Database thật, sử dụng Mocking (Jest mocks) cho các Outbound Ports.
   
2. **Service-Level E2E Testing (API & Adapter Logic):**
   * *Vị trí:* Thư mục `test/` tại gốc của từng service.
   * *Nhiệm vụ:* Khởi tạo NestJS IoC container cục bộ (sử dụng `@nestjs/testing`), kiểm thử đầy đủ luồng từ HTTP Controller qua Application Use Case xuống Database Adapter (sử dụng PostgreSQL test database).

3. **System-Level / Integration Testing (Cross-service & Gateway):**
   * *Vị trí:* Thư mục **`tests/`** độc lập ở gốc dự án (thư mục monorepo root).
   * *Nhiệm vụ:* Kiểm thử các hành vi liên quan đến tương tác của nhiều microservices. Ví dụ: kiểm tra xem khi gửi API POST tạo user đến `identity-service`, Event Broker (RabbitMQ) có chuyển tiếp đúng bản tin `identity.user.created` và `user-service` có tự động tạo ra một `UserProfile` trống tương ứng hay không.

4. **Smoke Testing (Sanity & Readiness Checking):**
   * *Vị trí:* Thư mục `scripts/` (như file `smoke.ts`).
   * *Nhiệm vụ:* Ping nhanh các API Gateway công khai và các endpoint `/health/ready` của từng dịch vụ sau khi deploy hoặc khởi động môi trường dev để đảm bảo toàn bộ hệ thống đã trực tuyến và kết nối thông suốt.
