# Hướng dẫn Thiết kế Hệ thống Bền vững (Resilience & Design Patterns)

Tài liệu này giải thích chi tiết các cơ chế **Tự phòng vệ (Resilience)** và các **Mẫu thiết kế (Design Patterns)** được áp dụng trong dự án Luyện Thi Lái Xe Microservices nhằm tối ưu hóa tính sẵn sàng, khả năng chịu tải và chống lỗi lan truyền.

---

## 1. Cơ chế Resilience trong giao tiếp giữa các dịch vụ (HTTP Client)

Khi các dịch vụ gọi nhau trực tiếp qua REST API (ví dụ: `exam-service` gọi `question-service`), bất kỳ sự chậm trễ hoặc lỗi mạng nào cũng có thể gây ra hiệu ứng lỗi dây chuyền (Cascading Failure). Dự án giải quyết vấn đề này bằng cách tự phát triển một client HTTP chống lỗi đặt tại [resilient-http-client.ts](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/packages/common/src/http/resilient-http-client.ts).

```
[exam-service]
      │
      ├──> [Resilient Client] (Timeout: 3s)
      │          │
      │          ├──> [Circuit Breaker] (Nếu fail 5 lần liên tiếp -> Mở mạch 30s)
      │          │
      │          └──> [Retry với Exponential Backoff] (Thử lại tối đa 2 lần, trễ lũy thừa)
      ▼
[question-service] (Đang quá tải / Lỗi)
```

Các mẫu thiết kế phòng thủ được cấu hình tự động:

1. **Timeout (Giới hạn thời gian phản hồi):**

   * Mặc định là **3000ms (3 giây)**. Nếu dịch vụ đích không phản hồi trong 3 giây, client tự động hủy kết nối (`AbortController.abort()`) để tránh việc giải phóng luồng bị treo lâu làm cạn kiệt tài nguyên của service gọi.
2. **Retry với Exponential Backoff (Thử lại với độ trễ lũy thừa):**

   * Khi gặp lỗi mạng hoặc các mã trạng thái HTTP có thể phục hồi: `408 Request Timeout`, `429 Too Many Requests`, hoặc lỗi server `>= 500`.
   * **Cơ chế:** Client sẽ thử lại tối đa **2 lần** (`retries: 2`). Khoảng cách giữa các lần thử lại được nhân lên theo cấp số nhân (hệ số lũy thừa: 2, mặc định delay ban đầu là 200ms -> lần sau là 400ms -> 800ms) để cho dịch vụ đích có thời gian phục hồi.
3. **Circuit Breaker (Ngắt mạch tự động):**

   * **Failure Threshold:** 5 lần lỗi liên tiếp.
   * **Open State Duration (Mở mạch):** 30 giây.
   * **Cách hoạt động:** Khi số lần gọi lỗi liên tiếp từ một dịch vụ đến dịch vụ đích vượt quá 5 lần, bộ ngắt mạch sẽ chuyển sang trạng thái **Mở (Open)**. Trong 30 giây tiếp theo, mọi cuộc gọi đến dịch vụ đó sẽ bị chặn ngay lập tức và ném ra lỗi `CircuitBreakerOpenError` mà không cần gửi request qua mạng. Điều này giúp bảo vệ dịch vụ đích đang quá tải không bị sập hoàn toàn (Request Storm) và giải phóng tài nguyên hệ thống gọi nhanh chóng.

---

## 2. Kỹ thuật Fallback, Degrade và Rate Limiting

Để đảm bảo tính ổn định và khả năng tự phòng vệ, hệ thống áp dụng các kỹ thuật sau:

1. **Fallback (Phương án dự phòng):**

   * Ví dụ tại [course-service](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/docs/devops/consul-workflow.md#L64): Hệ thống sử dụng bộ nhớ đệm Redis để cache danh sách bài học. Khi Redis gặp sự cố, hệ thống tự động fallback truy vấn trực tiếp từ cơ sở dữ liệu PostgreSQL mà không làm gián đoạn response gửi tới người dùng.
2. **Degrade (Hạ cấp tính năng):**

   * Trường hợp dịch vụ phân tích học tập (`analytics-service`) bị quá tải hoặc sập, người dùng vẫn có thể thực hiện bài thi bình thường trên `exam-service`. Kết quả thi được lưu lại và gửi bất đồng bộ qua **RabbitMQ Queue**. Khi `analytics-service` hồi sinh, nó sẽ tiêu thụ tin nhắn và cập nhật dữ liệu sau. Hệ thống tạm thời hạ cấp tính năng thống kê thời gian thực nhưng không làm chết luồng nghiệp vụ cốt lõi.
3. **Rate Limiting (Giới hạn tốc độ gọi):**

   * Được kích hoạt tập trung tại Kong API Gateway giúp kiểm soát tải đầu vào ở mức **100 req/s** và **1000 req/h** cho mỗi địa chỉ IP nguồn.

---

## 3. Nhận biết và Tránh các Anti-Patterns trong Microservices

Dự án tuân thủ nghiêm ngặt các nguyên tắc thiết kế microservices tiêu chuẩn nhằm tránh các lỗi thiết kế phổ biến:

* **Shared Database Anti-Pattern (Chung cơ sở dữ liệu):**
  * *Tác hại:* Làm mất tính độc lập của dịch vụ, gây khóa bảng chéo và cản trở việc scale-up độc lập.
  * *Giải pháp của dự án:* Mỗi microservice sở hữu một database PostgreSQL riêng biệt (ví dụ: `db-identity`, `db-user`, `db-exam`). Các service chỉ trao đổi dữ liệu qua API hoặc Event Message Broker, tuyệt đối không truy cập trực tiếp vào DB của nhau.
* **Hardcoded Endpoints Anti-Pattern (Cố định cứng địa chỉ):**
  * *Tác hại:* Khi thay đổi IP/Port của pod hoặc khi deploy lên cloud sẽ làm sập kết nối liên kết.
  * *Giải pháp của dự án:* Dùng **Consul KV** làm nơi cấu hình tập trung. Địa chỉ các service đích được biểu diễn dưới dạng biến môi trường hoặc DNS K8s nội bộ (ví dụ: `http://user-service:3000`), được phân giải tự động bởi Docker DNS hoặc K8s CoreDNS.
* **Tight Coupling Anti-Pattern (Liên kết chặt chẽ):**
  * *Tác hại:* Dịch vụ A sập kéo theo dịch vụ B sập theo (giao tiếp đồng bộ liên chuỗi).
  * *Giải pháp của dự án:* Áp dụng **Event-Driven Architecture (Kiến trúc hướng sự kiện)** với **RabbitMQ**. Các tác vụ không cần phản hồi ngay (như gửi email thông báo, tính toán thống kê sau khi thi xong) được chuyển thành Event Message đẩy vào Queue, đảm bảo tính bất đồng bộ và lỏng lẻo (Loose Coupling).

---

## 4. Khả năng tự phục hồi và Quản lý vòng đời trong Kubernetes

Kubernetes cung cấp nền tảng vững chắc để thực thi các cơ chế tự phòng vệ ở tầng hạ tầng:

1. **Self-Healing (Tự hồi phục):**

   * **Liveness Probe (`/health/live`):** Kiểm tra xem container ứng dụng còn sống hay không. Nếu ứng dụng bị deadlock hoặc crash, K8s tự động hủy container và khởi tạo lại container mới thay thế.
   * **Readiness Probe (`/health/ready`):** Kiểm tra xem ứng dụng đã sẵn sàng nhận traffic chưa (ví dụ: kết nối DB thành công). Nếu probe báo fail, K8s tạm thời ngắt pod ra khỏi Service Load Balancer để tránh gửi request của người dùng vào pod lỗi.
2. **Auto-Scaling (Tự động mở rộng):**

   * Horizontal Pod Autoscaler (HPA) tự động tăng giảm số lượng replicas dựa trên CPU (> 70%) và Memory (> 80%) đã cấu hình trong cụm.
3. **Rolling Update (Cập nhật không downtime):**

   * Sử dụng cấu hình `maxSurge: 25%` và `maxUnavailable: 25%` để đảm bảo luôn duy trì tối thiểu **75%** số lượng Pod hoạt động bình thường trong quá trình triển khai phiên bản mới, loại bỏ hoàn toàn downtime hệ thống.

---

## 5. Thực hành Demo Resilience & Design Patterns

### 5.1 Demo 1: Kiểm thử cơ chế Tự Phục Hồi (Self-Healing)

1. Mở k9s hoặc Lens và chọn Pod của `exam-service`.
2. Kill (xóa) Pod hiện tại.
3. Quan sát: Kubernetes lập tức khởi tạo Pod mới thay thế trong vài giây và điều phối traffic về Pod mới mà không gây mất kết nối API cho người dùng.

### 5.2 Demo 2: Kiểm thử tính độc lập và Phân rã liên kết (Decoupling)

1. Thực hiện tắt (Stop) dịch vụ `notification-service` hoặc `analytics-service` trên Docker hoặc K8s.
2. Đăng nhập tài khoản học viên và thực hiện submit một bài thi thử trên `exam-service`.
3. **Quan sát:** Bài thi vẫn được submit thành công, hệ thống không báo lỗi. Tin nhắn cập nhật tiến độ học tập và thông báo kết quả thi được lưu trữ an toàn trong RabbitMQ queue.
4. Bật (Start) lại dịch vụ `notification-service`/`analytics-service`.
5. **Quan sát:** Các service tiêu thụ các message tồn đọng trong queue và thực hiện gửi email, cập nhật bảng thống kê đầy đủ. Chứng minh hệ thống kháng lỗi bất đồng bộ hoàn hảo.
