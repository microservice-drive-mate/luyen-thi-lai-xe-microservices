# Hướng dẫn Kiểm thử (Testing Guide)

Tài liệu này cung cấp toàn bộ quy chuẩn, cấu hình và lệnh chạy dành cho hệ thống kiểm thử tự động của dự án **Luyện thi lái xe Microservices**. Hệ thống bao gồm 10 services độc lập, được quản lý dưới dạng Monorepo thông qua Turborepo và pnpm.

---

## 1. Triết lý kiểm thử (Testing Philosophy)

Để đảm bảo độ ổn định của hệ thống phân tán, dự án tuân thủ chặt chẽ 2 loại hình kiểm thử chính:

1. **Unit Testing (Kiểm thử mức Đơn vị)**:
   - **Mục tiêu**: Kiểm tra logic nghiệp vụ lõi (Domain Logic) bên trong các `UseCases` và tính toàn vẹn của HTTP/Event `Controllers`.
   - **Quy tắc Vàng**: **Hoàn toàn cô lập (Isolated)**. Tuyệt đối không kết nối đến Database thật, Redis, hay RabbitMQ. Toàn bộ `Repositories`, `Clients`, `Publishers` phải được mock bằng `jest.fn()`.
   - **Tốc độ**: Cực nhanh, chạy tính bằng mili-giây.

2. **End-to-End Testing (Kiểm thử Tích hợp Toàn trình - E2E)**:
   - **Mục tiêu**: Kiểm tra sự hoạt động trơn tru của toàn bộ vòng đời Request -> Controller -> UseCase -> Database.
   - **Quy tắc**: **KHÔNG DÙNG SQLITE**. Vì dự án sử dụng PostgreSQL với Prisma (chứa các tính năng đặc thù như JSONB, Arrays, Enum, GIS), việc dùng SQLite sẽ gây sai lệch ("Mock thì pass, chạy thật thì không").
   - **Giải pháp E2E Database**: Khởi tạo Application Context đầy đủ thông qua `Test.createTestingModule` và sử dụng **Testcontainers** (tự động spin-up Docker container chứa PostgreSQL khi chạy test, và tự động dọn dẹp khi xong) hoặc trỏ biến môi trường `DATABASE_URL` tới schema `luyenthi_test` cô lập trên máy dev.
   - **Giải pháp Event Broker**: Với RabbitMQ, dùng in-memory message broker mock trong NestJS Microservices để kiểm thử luồng emit/consume sự kiện.

---

## 2. Hướng dẫn chạy test

### 2.1. Tại Cấp độ Từng Service (Local Service Level)
Khi bạn đang dev một tính năng mới trong một service cụ thể (VD: `identity-service`), bạn chỉ cần làm việc nội bộ trong service đó mà không cần quan tâm phần còn lại.

1. Di chuyển vào thư mục service:
   ```bash
   cd apps/identity-service
   ```
2. Chạy toàn bộ Unit test 1 lần:
   ```bash
   pnpm run test
   ```
3. **Chạy Unit Test ở chế độ Watch** (Khuyên dùng khi đang code):
   ```bash
   pnpm run test:watch
   ```
   *Lưu ý: Jest sẽ theo dõi thay đổi file và chỉ chạy lại các test liên quan.*
4. Chạy Coverage (Kiểm tra độ phủ mã):
   ```bash
   pnpm run test:cov
   ```
5. Chạy E2E Test:
   ```bash
   # Đảm bảo Docker đang bật nếu dùng Testcontainers
   pnpm run test:e2e
   ```
6. **Debug Test**:
   ```bash
   pnpm run test:debug
   ```
   *Gắn breakpoint trên IDE (VSCode/WebStorm) và attach Node debugger vào.*

### 2.2. Tại Cấp độ Toàn Hệ thống (Root/Turborepo Level)
Khi cần kiểm tra hồi quy (Regression test) trước khi commit hoặc trên CI/CD pipeline, chúng ta sử dụng `turbo` từ thư mục gốc (root).

Turborepo sẽ phân tích dependency tree, chạy test song song và tận dụng cache (những file không đổi sẽ không bị chạy lại, tiết kiệm cực nhiều thời gian).

1. Chạy **toàn bộ Unit Test** trên 10 services:
   ```bash
   pnpm test:all
   ```
   *Bên dưới, lệnh này gọi `turbo run test --concurrency=4` để chạy song song tối đa 4 luồng, bảo vệ CPU/RAM không bị quá tải.*

2. Chạy **toàn bộ E2E Test** trên 10 services:
   ```bash
   pnpm test:e2e:all
   ```
   *Do E2E khá nặng (spin up NestApp + DB pool), lệnh này bị giới hạn `concurrency=2` để an toàn cho máy Dev và CI.*

3. Chạy Unit Test chỉ cho các **Core Services** (Identity, Exam, Course):
   ```bash
   pnpm test:core
   ```

4. Chạy thủ công qua Turbo:
   ```bash
   pnpm turbo run test --filter=exam-service --filter=user-service
   ```

---

## 3. Cấu trúc File Test Chuẩn mực

- **Unit Test**: Đặt ngay cạnh file source code. 
  - *Ví dụ*: File code là `start-session.use-case.ts`, file test sẽ là `start-session.use-case.spec.ts`.
- **E2E Test**: Được tổ chức trong thư mục `test/` của từng service.
  - *Ví dụ*: `apps/exam-service/test/app.e2e-spec.ts`. Cấu hình nằm trong `jest-e2e.json`.

Hãy luôn tham khảo các file test mẫu trong `notification-service` hoặc `exam-service` để nắm rõ pattern Inject Dependency và Mocking chuẩn của dự án.
