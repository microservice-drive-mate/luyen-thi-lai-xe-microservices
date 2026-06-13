# Tổng Hợp Backend & API Endpoints

> Cập nhật: 11/06/2026

Tài liệu này tổng hợp toàn bộ các tính năng, kỹ thuật đã được triển khai trong hệ thống backend cũng như danh sách chi tiết các API Endpoints hiện có.

## 🚀 Những Tính Năng Đã Triển Khai Trong Backend (Backend Features)

Trong quá trình xây dựng và phát triển, backend đã được triển khai các tính năng và kỹ thuật kiến trúc sau:

1. **Kiến Trúc Microservices & Monorepo**: Xây dựng hơn 10 services độc lập bằng NestJS, quản lý tập trung trong monorepo bằng Turborepo. Chia sẻ code dễ dàng qua thư viện nội bộ `@repo/common` (chứa các exceptions, decorators, utils chung).
2. **API Gateway (Kong)**: Triển khai Kong Gateway làm điểm chạm duy nhất (Single Point of Entry) cho mọi client. Định tuyến (Routing), tích hợp bảo vệ microservices phía sau.
3. **Quản Lý Cấu Hình Tập Trung (Consul)**: Quản lý cấu hình động (dynamic configuration) cho từng môi trường (development, staging, production) mà không cần hardcode, sử dụng HashiCorp Consul.
4. **Xác Thực & Phân Quyền (Keycloak)**: Tích hợp Keycloak quản lý Identity, cấp phát JWT token, và cung cấp hệ thống phân quyền Role-Based Access Control (RBAC) chặt chẽ.
5. **Giao Tiếp Bất Đồng Bộ (RabbitMQ)**: Gửi nhận Message/Event (AMQP) giữa các service thông qua RabbitMQ (ví dụ: tạo user profile bên User Service ngay khi Keycloak đăng ký thành công qua Identity Service, v.v.).
6. **Cơ Sở Dữ Liệu Phân Tán (PostgreSQL & Prisma)**: Mỗi service sở hữu một schema DB riêng rẽ để đảm bảo tính độc lập. Không dính líu foreign key chéo (chỉ lưu bằng UUID). Thao tác dữ liệu an toàn và type-safe qua Prisma ORM.
7. **Bảo Mật & Audit**: Tách biệt hoàn toàn tính năng lưu vết hệ thống vào Audit Service. Mọi thao tác thay đổi dữ liệu nhạy cảm (nhật ký hệ thống) đều được ghi nhận (before/after data).
8. **Observability Toàn Diện**: Đo lường sức khỏe (Health checks) và metric qua Prometheus, Grafana. Quản lý Log tập trung qua ELK (Elasticsearch, Logstash, Kibana) và dò tìm dấu vết Request (Distributed Tracing) bằng OpenTelemetry / Jaeger.
9. **DevOps & Tự Động Hóa**: Tích hợp CI/CD chuẩn mực với GitHub Actions, Jenkins. Đóng gói triển khai bằng Docker Compose (cho local hybrid) và Helm Charts (cho Kubernetes/GCP).
10. **Centralized Documentation (Docs Service)**: Tích hợp Scalar UI để tổng hợp OpenAPI (Swagger) specs từ tất cả các service về một cổng tài liệu duy nhất.

---

## 📋 Tổng Hợp API Endpoints (Chi Tiết Từng Service)

Dưới đây là danh sách chi tiết toàn bộ các RESTful API endpoints đã được lập trình trong hệ thống và mục đích sử dụng của chúng:

### 1. Identity Service (`/auth/*`, `/admin/identity-users/*`)
Quản lý vòng đời tài khoản (Identity) trên Keycloak và cung cấp xác thực JWT.
- **Auth (Public/User)**:
  - `POST /auth/login`: Đăng nhập, cấp phát JWT access token và refresh token.
  - `POST /auth/logout`: Đăng xuất, vô hiệu hóa session.
  - `POST /auth/refresh`: Sử dụng refresh token để cấp lại access token mới.
  - `POST /auth/forgot-password`: Yêu cầu gửi email khôi phục mật khẩu.
  - `GET /auth/public` & `GET /auth/private` & `GET /auth/admin-check`: Các endpoints kiểm thử cấp độ phân quyền.
- **Admin**:
  - `POST /admin/identity-users`: Admin chủ động tạo một tài khoản Identity mới.
  - `GET /admin/identity-users`: Liệt kê danh sách tất cả các tài khoản trên hệ thống (từ Keycloak).
  - `GET /admin/identity-users/:id`: Lấy thông tin tài khoản cụ thể.
  - `PATCH /admin/identity-users/:id`: Cập nhật thông tin cơ bản.
  - `PATCH /admin/identity-users/:id/role`: Gán role (Admin, User, Instructor) cho tài khoản.
  - `PATCH /admin/identity-users/:id/lock`: Khóa hoặc mở khóa tài khoản (Ban/Unban).
  - `DELETE /admin/identity-users/:id`: Xóa tài khoản Identity vĩnh viễn.

### 2. User Service (`/users/*`, `/admin/users/*`)
Quản lý hồ sơ người dùng (User Profile), hạng giấy phép mục tiêu.
- **User**:
  - `GET /users/me`: Lấy thông tin hồ sơ của người dùng đang đăng nhập (dựa vào JWT token).
  - `PATCH /users/me`: Cập nhật hồ sơ cá nhân (tên, số điện thoại, ngày sinh...).
- **Admin**:
  - `POST /admin/users`: Admin chủ động tạo hồ sơ người dùng (có thể bypass Keycloak event).
  - `GET /admin/users`: Trích xuất danh sách tất cả người dùng trong hệ thống (phục vụ quản lý).
  - `GET /admin/users/:id`: Xem hồ sơ chi tiết của một người dùng.
  - `PATCH /admin/users/:id`: Chỉnh sửa dữ liệu hồ sơ người dùng đó.
  - `PATCH /admin/users/:id/lock`: Khóa hồ sơ người dùng nội bộ (khác với khóa đăng nhập Identity).
  - `PATCH /admin/users/:id/license-tier`: Cập nhật hạng giấy phép lái xe mục tiêu (vd: B1, B2, C) cho học viên.

### 3. Exam Service (`/exams/*`, `/admin/exams/*`)
Hệ thống thi thử lý thuyết, quản lý đề thi, phiên làm bài (session) và tự động chấm điểm.
- **Exam Session (Phiên làm bài)**:
  - `POST /exams/sessions`: Bắt đầu một phiên làm bài thi thử mới.
  - `GET /exams/sessions`: Xem lịch sử các phiên thi mà học viên từng làm.
  - `GET /exams/sessions/:id/questions`: Tải bộ câu hỏi cho một bài thi.
  - `PATCH /exams/sessions/:id/answers`: Gửi câu trả lời cho một câu hỏi trong khi thi (hỗ trợ autosave).
  - `POST /exams/sessions/:id/submit`: Nộp bài, kết thúc phiên thi và tự động chấm điểm đậu/rớt.
  - `GET /exams/sessions/:id/result`: Xem chi tiết kết quả (tổng điểm, thời gian, câu nào sai/đúng).
- **Exam Details & Reviews**:
  - `GET /exams/available`: Liệt kê các đề thi mẫu đang có sẵn để học viên chọn.
  - `GET /exams/review/missed-questions`: Trích xuất bộ sưu tập các câu hỏi lý thuyết mà người dùng từng trả lời sai để ôn lại.
- **Admin**:
  - `GET /admin/exams/sessions`: Admin giám sát lịch sử thi thử của toàn bộ hệ thống.
  - `POST /admin/exams/templates`: Tạo mẫu đề thi mới.
  - `GET /admin/exams/templates`: Danh sách các mẫu đề thi do ban quản trị tạo.
  - `GET /admin/exams/templates/:id`: Xem chi tiết nội dung mẫu đề thi.
  - `PATCH /admin/exams/templates/:id`: Sửa thông tin mẫu đề thi.
  - `DELETE /admin/exams/templates/:id`: Xóa mẫu đề thi.

### 4. Course Service (`/courses/*`, `/enrollments/*`, `/admin/courses/*`)
Hệ thống học tập, quản lý khóa học, bài giảng và tiến trình của học viên.
- **Course & Enrollment (Ghi danh)**:
  - `GET /courses`: Danh sách các khóa học public dành cho học viên.
  - `GET /courses/:id`: Lấy chi tiết nội dung mô tả của khóa học.
  - `POST /courses/:id/enroll`: Ghi danh đăng ký học một khóa.
  - `GET /enrollments`: Danh sách các khóa học mà người dùng đã đăng ký.
  - `GET /enrollments/:id`: Chi tiết tiến trình (phần trăm hoàn thành) trong một khóa.
  - `POST /enrollments/:id/lessons/:lessonId/complete`: Checkmark (đánh dấu) bài học đã xem xong.
  - `POST /enrollments/:id/reset-progress`: Xóa dữ liệu tiến độ để học lại từ đầu.
- **Admin**:
  - `POST /admin/courses`: Khởi tạo một khóa học mới.
  - `GET /admin/courses`: Quản lý toàn bộ danh sách khóa học (kể cả khóa bị ẩn/draft).
  - `GET /admin/courses/:id`: Lấy chi tiết khóa học.
  - `PATCH /admin/courses/:id`: Cập nhật metadata của khóa học.
  - `PATCH /admin/courses/:id/activate`: Bật/Tắt khóa học hiển thị ra ngoài.
  - `POST /admin/courses/:id/lessons`: Thêm bài học mới vào lộ trình khóa học.
  - `DELETE /admin/courses/:id/lessons/:lessonId`: Xóa bài học.
  - `POST /admin/courses/:id/materials`: Đính kèm file tài liệu cho khóa học.
  - `DELETE /admin/courses/:id`: Xóa hoàn toàn một khóa học.

### 5. Question Service (`/admin/questions/*`, nội bộ)
Dịch vụ cung cấp Ngân hàng câu hỏi trắc nghiệm (phục vụ thi và ôn lý thuyết).
- **Topic (Bộ đề/Chủ đề)**:
  - `POST /admin/questions/topics`: Tạo một chủ đề câu hỏi (Ví dụ: Biển báo, Sa hình, Tình huống).
  - `GET /admin/questions/topics`: Lấy danh sách các chủ đề.
  - `GET /admin/questions/topics/:id`: Chi tiết chủ đề.
  - `PATCH /admin/questions/topics/:id`: Cập nhật thông tin chủ đề.
- **Question (Câu hỏi)**:
  - `POST /admin/questions/pool`: (Tiện ích) Nạp dữ liệu câu hỏi hàng loạt (seed data).
  - `POST /admin/questions`: Tạo một câu hỏi mới.
  - `GET /admin/questions`: Truy vấn ngân hàng câu hỏi.
  - `GET /admin/questions/:id`: Xem chi tiết câu hỏi, đáp án, và giải thích.
  - `PATCH /admin/questions/:id`: Sửa nội dung câu hỏi hoặc thay đổi đáp án đúng.
  - `DELETE /admin/questions/:id`: Loại bỏ một câu hỏi khỏi ngân hàng.

### 6. Notification Service (`/notifications/*`, `/admin/academic-warnings/*`)
Quản lý thông báo In-app và Push Notification tới thiết bị.
- `POST /notifications/devices`: (Client gửi) Đăng ký Token thiết bị (FCM/APNS) để có thể nhận Push Notification.
- `DELETE /notifications/devices/:token`: Gỡ bỏ Device Token khi đăng xuất.
- `GET /notifications/me`: Đọc hộp thư In-app notification của user hiện tại.
- `PATCH /notifications/:id/read`: Đánh dấu "Đã đọc" cho một thông báo.
- `POST /admin/academic-warnings`: Admin (hoặc trigger tự động) phát đi Cảnh báo học tập (ví dụ: nghỉ quá nhiều, chưa nộp bằng...).

### 7. Analytics Service (`/analytics/*`, `/admin/analytics/*`)
Phân tích dữ liệu học tập và tổng hợp báo cáo.
- `GET /analytics/me/progress`: Xuất dashboard tiến trình ôn luyện cho cá nhân (tỷ lệ giải đúng câu, số chuyên đề còn yếu).
- `GET /admin/analytics/students/:studentId/progress`: Công cụ cho Giáo viên/Admin để giám sát độ siêng năng và năng lực thực tế của một học viên bất kỳ.
- `GET /admin/analytics/dashboard`: Dashboard thống kê tổng cho Admin/CENTER_MANAGER: tổng học viên, khóa học, giảng viên, bài thi hoàn thành, trend theo tháng, phân bổ hạng GPLX, pass rate và recent activities.

### 8. Simulation Service (`/simulation/*`, `/practice2d/*`)
Hệ thống ôn luyện thực hành và sa hình 2D/3D.
- **Maneuver (Sa Hình tĩnh)**:
  - `GET /simulation/maneuvers`: Liệt kê các bài sa hình chuẩn (dừng xe ngang dốc, ghép ngang...).
  - `GET /simulation/maneuvers/:id`: Chi tiết một bài sa hình.
  - `GET /simulation/maneuver-errors`: Bảng tra cứu các lỗi bị trừ điểm tiêu chuẩn.
- **Mô Phỏng Tình Huống (Sessions)**:
  - `POST /simulation/sessions`: Bắt đầu phiên làm bài tình huống nguy hiểm.
  - `PATCH /simulation/sessions/:id/answers`: Ghi nhận khoảng thời gian/thao tác cờ phím của học viên.
  - `POST /simulation/sessions/:id/submit`: Chốt phiên, dịch vụ sẽ chấm dải điểm (5đ, 4đ, ...).
- **Thực Hành 2D (Telemetry Practice)**:
  - `POST /simulation/practice2d/sessions`: Khởi tạo chuyến tập lái ảo 2D trên Web.
  - `POST /simulation/practice2d/sessions/:id/telemetry`: Bắn dữ liệu telemetry liên tục từ Client (tốc độ, tọa độ, tín hiệu đèn).
  - `POST /simulation/practice2d/sessions/:id/end`: Báo cáo kết thúc buổi tập, máy chủ lưu log hành trình.
  - `GET /simulation/practice2d/sessions/:id`: Render lại hành trình cũ để xem phân tích.

### 9. Media Service (`/media/*`, `/admin/media/*`)
Xử lý lưu trữ, tối ưu hóa và xuất URL các file định dạng ảnh/video.
- `POST /media/files`: Tải trực tiếp file ảnh (dưới giới hạn dung lượng) thông qua formData.
- `POST /media/files/init`: Khởi tạo direct upload, trả về Azure Blob SAS `uploadUrl`, `mediaFileId` và stable blob `publicUrl`.
- `GET /media/files/:id`: Đọc metadata chuẩn của một tập tin.
- `GET /media/files/:id/url`: Xin cấp SAS read URL có thời hạn để hiển thị/stream ảnh/video khi Azure container private.
- `GET /admin/media/files`: Admin kiểm kê tất cả file có trong kho lưu trữ (Storage).
- `DELETE /admin/media/files/:id`: Admin chủ động xóa file rác (Orphan files).

### 10. Audit Service (`/admin/audit-logs/*`)
Kiểm tra chéo và an ninh (Compliance & Security logs).
- `GET /admin/audit-logs`: Admin lướt tìm và filter danh sách lịch sử truy cập, các sửa đổi đặc biệt (Role thay đổi, xóa dữ liệu quan trọng).
- `GET /admin/audit-logs/:id`: Xem tận gốc Before-Change và After-Change JSON schema của thay đổi đó.

### 11. Docs Service (`/docs/*`)
Tài liệu OpenAPI tập trung (Môi trường Dev/Local).
- `GET /docs-config`: Cấu hình cho UI Scalar.
- `GET /docs-services`: Lấy danh sách các service.
- `GET /docs-json` & `GET /docs-proxy`: Cung cấp JSON specs.
- `GET /docs`: Render giao diện Scalar API document chính.

### 12. Common Endpoints (Toàn bộ các Services)
Tích hợp sẵn từ thư viện `@repo/common` cho Kubernetes probes và Prometheus metrics.
- `GET /health` & `GET /health/live` & `GET /health/ready`: Liveness/Readiness checks.
- `GET /metrics`: Metric export cho Prometheus.

---

## 🐇 Tổng Hợp Async Event Endpoints (RabbitMQ)
Ngoài các HTTP REST API, hệ thống microservices còn giao tiếp thông qua cơ chế bất đồng bộ (Message Broker) với các Event Controllers sau:

- **Analytics Service**: Lắng nghe `identity.user.created`, `exam.session.completed`, `course.enrollment.*`, `course.lesson.completed` để cập nhật tiến độ học tập.
- **Audit Service**: Lắng nghe `security.audit.recorded` để lưu log an ninh.
- **Course Service**: Lắng nghe `user.student.license-assigned` và `media.file.deleted` để cập nhật/xóa tài nguyên tương ứng.
- **Media Service**: Lắng nghe các event xác nhận file đã được sử dụng (`user.avatar.linked`, `course.material.linked`, `question.image.linked`) để chuyển trạng thái file thành `LINKED`.
- **Notification Service**: Lắng nghe `identity.user.created`, `identity.user.password-reset-requested`, `exam.session.passed/.failed`, `course.updated`, `notification.academic-warning.queued` để bắn email/push notification.
- **User Service**: Lắng nghe `identity.user.*` (created, updated, role-changed, locked, deleted) từ Keycloak webhook để đồng bộ hồ sơ, và `media.file.deleted` để gỡ ảnh đại diện nếu file bị xóa.
