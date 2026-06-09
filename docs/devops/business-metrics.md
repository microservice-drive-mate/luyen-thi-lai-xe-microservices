# Business Metrics

Business metrics bổ sung nhóm chỉ số nghiệp vụ để giảng viên thấy hệ thống không chỉ có CI/CD, DORA, metrics kỹ thuật và tracing, mà còn đo được hành vi thật của người dùng trong sản phẩm luyện thi.

Luồng dữ liệu:

```text
Người dùng thao tác nghiệp vụ
  -> NestJS use case/controller ghi business metric
  -> /metrics của từng service
  -> Prometheus scrape
  -> Grafana dashboard Business Metrics
```

## 1. Mục tiêu

Business metrics trả lời các câu hỏi vận hành gần với sản phẩm hơn:

- Hôm nay có bao nhiêu user profile mới được tạo?
- Học viên bắt đầu và hoàn tất bao nhiêu lượt thi?
- Tỷ lệ pass/fail bài thi đang như thế nào?
- Học viên hoàn tất bao nhiêu bài học và khóa học?
- Gửi notification thành công, bỏ qua hay lỗi bao nhiêu lần?
- Upload media trực tiếp hoặc presigned thành công/lỗi bao nhiêu lần?

## 2. Metrics đã thêm

| Metric | Service ghi nhận | Ý nghĩa | Labels |
| --- | --- | --- | --- |
| `users_created_total` | `user-service` | Số user profile được tạo từ event identity. | `role`, `source` |
| `exam_sessions_started_total` | `exam-service` | Số lượt học viên bắt đầu bài thi. | `license_category` |
| `exam_sessions_completed_total` | `exam-service` | Số lượt nộp/hoàn tất bài thi. | `license_category`, `status`, `result`, `failed_by_critical` |
| `course_lessons_completed_total` | `course-service` | Số bài học được đánh dấu hoàn tất. | `course_id`, `enrollment_status` |
| `course_enrollments_completed_total` | `course-service` | Số lượt học viên hoàn tất toàn bộ khóa học. | `course_id` |
| `notifications_delivery_total` | `notification-service` | Kết quả xử lý gửi notification. | `channel`, `event`, `status` |
| `media_upload_total` | `media-service` | Kết quả upload media direct/presigned. | `mode`, `mime_type`, `status` |

Các labels được normalize để tránh giá trị quá dài hoặc chứa ký tự khó dùng trong Prometheus.

## 3. Vị trí code chính

- `packages/common/src/metrics/metrics.service.ts`: khai báo counter và method ghi business metrics.
- `packages/common/src/metrics/metrics.module.ts`: `MetricsModule` là global module để use case có thể inject `MetricsService`.
- `apps/user-service/src/application/use-cases/create-user-profile/create-user-profile.use-case.ts`: ghi `users_created_total`.
- `apps/exam-service/src/application/use-cases/start-session/start-session.use-case.ts`: ghi `exam_sessions_started_total`.
- `apps/exam-service/src/application/use-cases/submit-session/submit-session.use-case.ts`: ghi `exam_sessions_completed_total`.
- `apps/course-service/src/application/use-cases/complete-lesson/complete-lesson.use-case.ts`: ghi lesson/course completion.
- `apps/notification-service/src/presentation/messaging/messaging.controller.ts`: ghi kết quả delivery notification.
- `apps/media-service/src/application/use-cases/upload-file/upload-file.use-case.ts`: ghi upload trực tiếp.
- `apps/media-service/src/application/use-cases/initiate-upload/initiate-upload.use-case.ts`: ghi khởi tạo presigned upload.
- `docker/grafana/dashboards/business-metrics.json`: dashboard Grafana.

## 4. Cách chạy local

Khởi động infra observability:

```bash
npm run infra:up
```

Chạy services local:

```bash
npm run consul:seed:local
npm run dev
```

Mở Grafana:

```text
http://localhost:30000
```

Tài khoản mặc định khi chạy local:

```text
admin / admin
```

Dashboard nằm tại:

```text
Microservices / Business Metrics
```

## 5. Kiểm tra Prometheus

Mở Prometheus:

```text
http://localhost:9090
```

Chạy thử các query:

```promql
sum(users_created_total)
sum(exam_sessions_started_total)
sum by (result) (exam_sessions_completed_total)
sum(course_lessons_completed_total)
sum(course_enrollments_completed_total)
sum by (status) (notifications_delivery_total)
sum by (status, mode) (media_upload_total)
```

Nếu query chưa có dữ liệu, cần thao tác nghiệp vụ tương ứng trước, ví dụ tạo user, bắt đầu bài thi, nộp bài, hoàn tất bài học, gửi notification hoặc upload media.

## 6. Cách tạo dữ liệu để demo

Kịch bản demo nhanh:

1. Login bằng tài khoản học viên đã seed.
2. Gọi API bắt đầu bài thi qua Kong.
3. Nộp bài thi để tạo `exam_sessions_completed_total`.
4. Hoàn tất một bài học trong course để tạo `course_lessons_completed_total`.
5. Trigger event notification hoặc thao tác tạo user để notification-service xử lý message.
6. Upload một file ảnh nhỏ qua media-service.
7. Mở Grafana dashboard `Business Metrics` và refresh sau 15-30 giây.

Khi trình bày, nói ngắn gọn:

> Business metrics bổ sung chỉ số nghiệp vụ. Các use case nghiệp vụ tự ghi counter vào Prometheus, Grafana hiển thị số người dùng mới, lượt làm bài thi, pass/fail, tiến độ học, kết quả gửi notification và upload media. Vì vậy nhóm có thể theo dõi sản phẩm đang được dùng ra sao, không chỉ theo dõi CPU, memory hay request latency.

## 7. Lưu ý vận hành

- Đây là counter trong memory của process và được Prometheus scrape định kỳ. Khi service restart, counter trong process reset nhưng Prometheus vẫn giữ time series cũ theo retention.
- Labels nên giữ low-cardinality. `course_id` đang dùng để demo theo khóa học; nếu production có rất nhiều khóa học, nên cân nhắc gom theo `course_type` hoặc `license_category`.
- Không đưa dữ liệu cá nhân như email, số điện thoại, user id vào label Prometheus.
- Nếu triển khai GKE, cần bảo đảm Prometheus scrape được `/metrics` của các service hoặc cấu hình ServiceMonitor tương ứng.
