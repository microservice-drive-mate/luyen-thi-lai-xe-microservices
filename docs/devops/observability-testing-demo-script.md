# Kịch bản Demo: Observability (Giám sát) và Kiểm thử (Testing)

Tài liệu này cung cấp hướng dẫn từng bước chi tiết (Demo Script) để trình bày tính năng **Observability** (Giám sát hệ thống) và **Testing** (Các lớp kiểm thử tự động) của đồ án DriveMate. Kịch bản bao gồm các thao tác chạy dưới Local (môi trường phát triển) và cách thức vận hành trên Cloud (môi trường deploy AKS / CI-CD).

---

## Bảng mục lục

1. [Hệ thống Kiểm thử tự động (Testing Suite)](#1-hệ-thống-kiểm-thử-tự-động-testing-suite)
2. [Thu thập &amp; Cảnh báo Chỉ số (Prometheus &amp; Alertmanager)](#2-thu-thập--cảnh-báo-chỉ-số-prometheus--alertmanager)
3. [Giao diện Giám sát Trực quan (Grafana Dashboard)](#3-giao-diện-giám-sát-trực-quan-grafana-dashboard)
4. [Quản lý Nhật ký Log tập trung (ELK Stack)](#4-quản-lý-nhật-ký-log-tập-trung-elk-stack)
5. [Truy vết giao dịch Phân tán (Distributed Tracing với OpenTelemetry &amp; Jaeger)](#5-truy-vết-giao-dịch-phân-tán-distributed-tracing-với-opentelemetry--jaeger)
   5.1. [Mô phỏng sự cố kích hoạt biểu đồ (5xx Error, Alerts, RabbitMQ DLQ)](#51-hướng-dẫn-mô-phỏng-sự-cố-để-hiển-thị-dữ-liệu-5xx-error-firing-alerts-và-rabbitmq-dlq)
6. [Checklist chuẩn bị &amp; Troubleshooting nhanh](#6-checklist-chuẩn-bị--troubleshooting-nhanh)

---

## 1. Hệ thống Kiểm thử tự động (Testing Suite)

### Mục tiêu demo

Chứng minh hệ thống áp dụng chiến lược kiểm thử đa tầng nghiêm ngặt (testing-in-depth): từ Unit test, Integration test, E2E test, Kiểm thử giao kèo (Contract test bằng Pact) để tránh đổ vỡ API, cho đến Smoke test hạ tầng và Tải hiệu năng bằng K6.

### Các file cần show trong VS Code

* [scripts/smoke.ts](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/scripts/smoke.ts) (Script kiểm tra sức khỏe của các service thông qua Gateway).
* [identity.pact.provider.ts](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/apps/identity-service/test/pact/identity.pact.provider.ts) (Provider verification contract test).
* [packages/performance-tests/src/scenarios/smoke.ts](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/packages/performance-tests/src/scenarios/smoke.ts) (Kịch bản test tải hiệu năng dạng smoke test bằng K6).

### A. Thực thi dưới Local (Môi trường Dev)

#### 1. Kiểm tra sức khỏe hệ thống (Smoke test)

Chạy lệnh kiểm tra nhanh tất cả các service thông qua gateway local:

```powershell
pnpm smoke
```

*Kỳ vọng:* Terminal in ra màn hình trạng thái `[smoke] OK {service-name} health/live` và `health/ready` của toàn bộ 10 microservices, kết thúc bằng `All health checks passed.`

#### 2. Kiểm thử tải hiệu năng bằng K6

Chạy kiểm thử tải mức nhẹ (smoke performance test) không ghi log ra InfluxDB:

```powershell
pnpm --filter @repo/performance-tests run test:smoke:no-influx
```

*Lưu ý khi demo local:* Vì local của bạn chạy đồng thời nhiều microservices, PostgreSQL, Kong Gateway và Keycloak trên cùng một phần cứng laptop nên thời gian phản hồi (latency) của thao tác đăng nhập (Keycloak hashing PBKDF2 tiêu tốn CPU) có thể tăng cao (ví dụ ~1.7 giây), dẫn đến **vi phạm các chỉ số ngưỡng SLA (Thresholds)** được định nghĩa trong file kịch bản. K6 sẽ báo đỏ (`✗`) và trả về `Exit status 99` để cảnh báo (đây là tính năng của K6, không phải lỗi chương trình).

Để chạy kịch bản hoàn tất thành công (Bypass qua kiểm tra ngưỡng SLA) khi demo local, bạn có thể truyền thêm cờ `--no-thresholds`:

```powershell
pnpm --filter @repo/performance-tests run test:smoke:no-influx -- --no-thresholds
```

*Kỳ vọng:* K6 chạy giả lập các luồng request ảo, hiển thị bảng kết quả thống kê HTTP requests, tỉ lệ lỗi (0%) và kết thúc thành công với trạng thái `checks_succeeded: 100%`.

---

### B. Vận hành trên Cloud / Pipeline CI-CD

Show luồng kiểm thử tự động tích hợp trong pipeline:

* **PR Validation Workflow (`pr-validation.yml`)**:
  - Mở file workflow [.github/workflows/pr-validation.yml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/.github/workflows/pr-validation.yml) hoặc giao diện GitHub Actions.
  - Chỉ ra step chạy Unit/Integration Test và step chạy **Smoke Test** sau khi build image tạm để validate chất lượng code trước khi merge.
* **Contract Tests Workflow (`contract-tests.yml`)**:
  - Mở file workflow [.github/workflows/contract-tests.yml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/.github/workflows/contract-tests.yml) hoặc giao diện GitHub Actions.
  - *Giải thích:* Đây là pipeline chạy **Consumer-Driven Contract Testing (Pact V4)**. Khi Frontend hoặc Admin hoàn thành build và sinh ra các file contract JSON, workflow này sẽ tự động được kích hoạt để chạy xác minh các cam kết API (contract verification) song song trên `identity-service` và `exam-service`, đảm bảo không xảy ra hiện tượng lệch pha API (API drift) giữa Frontend và Backend.

### Lời thoại gợi ý

> "Hệ thống DriveMate không chỉ được xây dựng nhanh mà còn được kiểm thử vô cùng chặt chẽ. Dưới local, chúng em có bộ script kiểm thử khói (Smoke Test) tự động quét qua API Gateway để kiểm tra tính sẵn sàng của tất cả microservices, kết hợp với công cụ K6 để giả lập tải thực tế ngay tại máy cá nhân. Trong quy trình CI/CD, chúng em tích hợp kiểm thử giao kèo (Contract Testing) thông qua framework Pact chạy tự động trong workflow `contract-tests.yml`. Việc này giúp hệ thống tự động phát hiện lỗi và ngăn chặn merge code nếu có bất kỳ sự thay đổi cấu trúc API nào ở Backend làm đổ vỡ ứng dụng Mobile hoặc Admin."

---

## 2. Thu thập & Cảnh báo Chỉ số (Prometheus & Alertmanager)

### Mục tiêu demo

Chứng minh hệ thống tự động thu thập các số liệu vận hành (Metrics) từ các Pod/Service theo chu kỳ, đồng thời định nghĩa sẵn các tập luật cảnh báo tự động phát hiện lỗi và định tuyến cảnh báo đến các kênh giám sát.

### A. Thực thi dưới Local (Môi trường Dev)

#### 1. Kiểm tra trạng thái Prometheus

Mở trình duyệt truy cập:

```text
http://localhost:9090/targets
```

*Kỳ vọng:* Bạn sẽ thấy danh sách các target (microservices local, rabbitmq, redis, kong, keycloak) đều ở trạng thái `UP` (màu xanh).

#### 2. Kiểm tra các tập luật cảnh báo (Alert Rules)

Mở tab `Alerts` trên thanh menu Prometheus hoặc truy cập trực tiếp:

```text
http://localhost:9090/alerts
```

*Kỳ vọng:* Hiển thị danh sách các rule đã được thiết lập sẵn như:

* `ServiceMetricsEndpointDown` (Phát hiện service bị tắt).
* `HighHttp5xxRate` (Phát hiện lỗi hệ thống vượt quá ngưỡng).
* `HighHttpLatencyP95` (Phát hiện dịch vụ bị phản hồi chậm).

#### 3. Hướng dẫn kích hoạt cảnh báo trực quan (Trigger Alert Live)

Để hội đồng thấy cảnh báo thực sự được kích hoạt khi có sự cố xảy ra chứ không chỉ là cấu hình tĩnh, hãy giả lập tình huống sập dịch vụ:

1. **Bước 1: Kiểm tra trạng thái bình thường**

   - Đảm bảo terminal chạy các microservices (`pnpm dev`) đang hoạt động.
   - Mở `http://localhost:9090/targets` để thấy tất cả target `microservices-local` đều có màu xanh (`UP`).
2. **Bước 2: Tắt dịch vụ (Giả lập sự cố)**

   - Nhấn `Ctrl+C` tại terminal chạy `pnpm dev` để tắt toàn bộ dịch vụ (hoặc tắt terminal đó).
3. **Bước 3: Xem trạng thái Đang quét lỗi (Pending Alert)**

   - F5 lại trang `http://localhost:9090/targets`, lúc này toàn bộ target sẽ chuyển sang màu đỏ (`DOWN`).
   - Mở tab Alerts `http://localhost:9090/alerts`. Bạn sẽ thấy alert **`ServiceMetricsEndpointDown`** lập tức chuyển sang màu vàng nhạt (**Pending**).
   - *Giải thích cho Thầy:* Hệ thống đã nhận diện được sự cố, nhưng chưa phát cảnh báo ngay lập tức để tránh hiện tượng báo động giả (alert flapping). Prometheus đang đếm ngược thời gian `for: 2m` (2 phút).
4. **Bước 4: Xem trạng thái Phát cảnh báo (Firing Alert) trong Alertmanager**

   - Sau 2 phút, rule trong Prometheus sẽ chuyển sang màu đỏ (**Firing**).
   - Truy cập giao diện Alertmanager tại `http://localhost:9093`. Lúc này các cảnh báo sập nguồn sẽ được hiển thị trực quan và gom nhóm theo từng service.

*(Sau khi demo xong, bạn có thể mở lại terminal và chạy `pnpm dev` để các service phục hồi tự động, Prometheus target sẽ xanh trở lại và alert tự động được giải phóng (Resolved)).*

---

### B. Vận hành trên Cloud (AKS/Staging)

Để kích hoạt hệ thống thu thập metrics trên cluster Kubernetes (AKS), thay đổi giá trị Helm chart:

1. Show file values cấu hình: `observability.prometheus.enabled=true`.
2. Lệnh chuyển tiếp cổng (Port-forward) để xem metrics trên AKS:
   ```powershell
   kubectl port-forward -n staging svc/luyen-thi-lai-xe-prometheus 9090:9090
   kubectl port-forward -n staging svc/luyen-thi-lai-xe-alertmanager 9093:9093
   ```

### Lời thoại gợi ý

> "Để theo dõi sức khỏe hệ thống theo thời gian thực, chúng em sử dụng Prometheus để quét (scrape) các endpoint `/metrics` của từng service. Trong Prometheus, chúng em đã định nghĩa các Alert Rules chuẩn cho microservices. Ví dụ, nếu tỷ lệ lỗi HTTP 5xx vượt quá 5% trong vòng 2 phút, hoặc một service bất kỳ bị mất kết nối, hệ thống sẽ kích hoạt Alert. Các alert này được gửi qua Alertmanager để gom nhóm, lọc trùng lặp và định tuyến thông báo nhanh chóng đến quản trị viên."

---

## 3. Giao diện Giám sát Trực quan (Grafana Dashboard)

### Mục tiêu demo

Trực quan hóa toàn bộ hoạt động của hệ thống từ hạ tầng phần cứng (CPU, RAM, Disk) cho đến các chỉ số nghiệp vụ phần mềm (Traffic Rate, Error Ratios, Latency P95, Active Users) bằng đồ thị sinh động trên Grafana.

### A. Thực thi dưới Local (Môi trường Dev)

1. Mở trình duyệt truy cập:
   ```text
   http://localhost:30000
   ```
2. Đăng nhập với tài khoản: `admin` / `admin`.
3. Mở menu **Dashboards** và chọn các Dashboard đã được import sẵn (ví dụ: dashboard giám sát dịch vụ NestJS, RabbitMQ, hoặc Kong Gateway).
4. Thực hiện gọi một số API trên Gateway local (ví dụ click học bài, thi thử) rồi chỉ ra sự thay đổi tức thì trên các biểu đồ Grafana:
   - Request Rate (Số request mỗi giây) bắt đầu tăng.
   - Latency (Độ trễ xử lý) được cập nhật.
5. **Trình diễn Business Metrics (Chỉ số nghiệp vụ thực tế)**:
   - Trong Grafana, chuyển sang dashboard **`Business Metrics`** (mặc định ban đầu sẽ trống hoặc hiển thị "No data").
   - Để vẽ dữ liệu động trước mặt Hội đồng, mở một cửa sổ PowerShell mới và chạy lệnh:
     ```powershell
     pnpm observability:seed-business
     ```

     *(Lệnh này sẽ tự động mô phỏng đầy đủ luồng nghiệp vụ: Đăng nhập admin -> Tạo người dùng mới -> Đăng nhập học viên -> Bắt đầu thi -> Nộp bài thi -> Đăng ký học -> Học & hoàn tất toàn bộ bài học của khóa học -> Upload file).*
   - Quay lại Grafana và bấm nút **Refresh** (hoặc đợi 15s). Các biểu đồ hình hộp, cột và tròn đại diện cho các hành vi học tập nghiệp vụ thực tế của học viên sẽ lập tức được vẽ đầy đủ.
   - *Giải thích cho Thầy:* Hệ thống DriveMate đã cấu hình các bộ đếm (counter) nghiệp vụ ngay trong code use case NestJS của từng service để thu thập các số liệu vận hành nghiệp vụ thực tế như số lượng tài khoản mới tạo, lượng bài thi đã nộp, tỉ lệ thi đỗ/trượt, tiến độ học tập của học viên, trạng thái gửi thông báo và upload tài liệu. Việc này giúp đội ngũ vận hành sản phẩm có cái nhìn trực quan về mức độ sử dụng thực tế của học viên mà không chỉ giới hạn ở các chỉ số kỹ thuật thô như CPU, RAM hay Network Latency.

---

### B. Vận hành trên Cloud (AKS/Staging)

1. Để bật Grafana trên AKS thông qua Helm upgrade: `--set observability.grafana.enabled=true` (Đã được bật ở bước cấu hình).
2. Thực hiện port-forward để truy cập Dashboard trên AKS:

   ```powershell
   kubectl port-forward -n staging svc/luyen-thi-lai-xe-grafana 30000:3000
   ```

   Sau đó mở `http://localhost:30000` trên trình duyệt để kiểm tra biểu đồ runtime của môi trường staging.
3. **Trình diễn Business Metrics trên Staging**:

   - Trong Grafana Staging (sau khi port-forward), chuyển sang dashboard **`Business Metrics`**.
   - Mở một cửa sổ PowerShell mới ở máy local và chạy lệnh sau để tự động thực hiện các hành động nghiệp vụ trực tiếp lên Gateway Staging:
     ```powershell
     $env:BASE_URL="http://api.52.139.233.166.nip.io"; pnpm observability:seed-business
     ```
   - Quay lại Grafana Staging và bấm nút **Refresh** (hoặc đợi 15s) để thấy dữ liệu nghiệp vụ được vẽ đầy đủ trên cloud.
4. **Đồng bộ DORA Metrics lên Staging**:

   - Dữ liệu DORA được tính toán ngoại tuyến (Offline) dựa trên lịch sử GitHub workflow và các incident issues.
   - Để đồng bộ dữ liệu DORA từ máy local (sau khi chạy `pnpm run dora:export-prometheus`) lên Grafana Staging, hãy đẩy file `dora.prom` vào Kubernetes ConfigMap:
     ```powershell
     # Đẩy file dora.prom thành ConfigMap trong k8s
     kubectl create configmap luyen-thi-lai-xe-dora-metrics --from-file=metrics=reports/dora/dora.prom -n staging --dry-run=client -o yaml | kubectl apply -f -

     # Khởi động lại pod Prometheus để nhận dữ liệu mới ngay lập tức
     kubectl delete pod luyen-thi-lai-xe-prometheus-0 -n staging
     ```
   - Quay lại Grafana Staging, mở dashboard **`DORA Metrics`** để thấy toàn bộ dữ liệu (Deployment Frequency, Lead Time, CFR, MTTR) được hiển thị đầy đủ.

   > [!TIP]
   > **Xử lý sự cố (Troubleshooting) khi seed thất bại:**
   >
   > **Trường hợp 1: Bị lỗi `UNAUTHORIZED` (do Staging chưa seed database mẫu ban đầu):**
   > Chạy lệnh Helm upgrade để kích hoạt Job Seed trên Staging:
   >
   > ```powershell
   > helm upgrade luyen-thi-lai-xe ./charts/luyen-thi-lai-xe -n staging --reuse-values --set seed.enabled=true
   > ```
   >
   > **Trường hợp 2: Bị lỗi `Keycloak createUser failed` hoặc truy cập Keycloak bị lỗi `HTTPS required`:**
   > Mặc định Keycloak yêu cầu HTTPS đối với các kết nối từ ngoài. Chúng tôi đã cấu hình `"sslRequired": "none"` trong `realm-export.json` của Helm để tắt bắt buộc SSL trên Staging, giúp kết nối HTTP thông thường chạy mượt mà.
   >
   > Nếu gặp lỗi này hoặc cần cấu hình lại bằng tay, bạn có thể thực hiện thông qua CLI của pod Keycloak cực kỳ nhanh chóng:
   >
   > 1. **Lấy thông tin đăng nhập Admin Staging:**
   >    ```powershell
   >    $admin = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String((kubectl get secret luyen-thi-lai-xe-secrets -n staging -o jsonpath='{.data.KEYCLOAK_ADMIN}')))
   >    $pass = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String((kubectl get secret luyen-thi-lai-xe-secrets -n staging -o jsonpath='{.data.KEYCLOAK_ADMIN_PASSWORD}')))
   >    Write-Host "Admin: $admin / Pass: $pass"
   >    ```
   > 2. **Tắt bắt buộc SSL trên Staging qua CLI:**
   >    ```powershell
   >    # Đăng nhập CLI bên trong pod
   >    kubectl exec -n staging deploy/luyen-thi-lai-xe-keycloak -- /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $pass
   >    # Cập nhật cấu hình sslRequired = none cho cả 2 realm
   >    kubectl exec -n staging deploy/luyen-thi-lai-xe-keycloak -- /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=none
   >    kubectl exec -n staging deploy/luyen-thi-lai-xe-keycloak -- /opt/keycloak/bin/kcadm.sh update realms/luyen-thi-lai-xe-realm -s sslRequired=none
   >    ```
   > 3. **Phân quyền Client Service Account bằng CLI (nếu gieo dữ liệu báo lỗi quyền):**
   >    ```powershell
   >    # Lấy UUID của tài khoản service-account-nestjs-backend
   >    $user_id = (kubectl exec -n staging deploy/luyen-thi-lai-xe-keycloak -- /opt/keycloak/bin/kcadm.sh get users -r luyen-thi-lai-xe-realm --fields id,username | ConvertFrom-Json | Where-Object username -eq "service-account-nestjs-backend").id
   >    # Gán các vai trò quản trị (manage-users, view-realm) trực tiếp cho service account
   >    kubectl exec -n staging deploy/luyen-thi-lai-xe-keycloak -- /opt/keycloak/bin/kcadm.sh add-roles -r luyen-thi-lai-xe-realm --uusername service-account-nestjs-backend --crolename manage-users --crolename view-realm --target-client realm-management
   >    ```
   >

### C. Hướng dẫn đổ tải lên Staging (Cloud) để thấy biến động đồ thị trực quan

Để biểu đồ Grafana trên Cloud nhảy số động và vẽ các đồ thị tải thực tế (Request Rate, Latency P95, CPU/RAM) trước mặt Hội đồng thay vì chỉ show biểu đồ trống, bạn hãy sử dụng công cụ K6 từ máy local để bắn tải lên Cloud Gateway:

1. **Bước 1: Mở sẵn Dashboard Grafana Staging**

   - Truy cập `http://localhost:30000` trên trình duyệt (sau khi chạy lệnh `port-forward` ở phần B).
   - Mở sẵn Dashboard giám sát HTTP Request và tài nguyên.
2. **Bước 2: Thực thi bắn tải K6 lên Staging**
   Mở một tab terminal PowerShell local riêng biệt, chạy kịch bản K6 giả lập 15 Virtual Users gọi liên tục lên địa chỉ API Gateway Staging trong vòng 1 phút, sử dụng cờ `--no-thresholds` để tránh báo đỏ build:

   ```powershell
   pnpm --filter @repo/performance-tests run test:smoke:no-influx -- -e BASE_URL=http://api.52.139.233.166.nip.io --vus 15 --duration 1m --no-thresholds
   ```
3. **Bước 3: Trình bày sự biến động đồ thị**

   - Quay lại giao diện Grafana, bạn sẽ thấy đồ thị **Request Rate** (số request mỗi giây) lập tức tăng vọt lên khoảng 30-50 req/s.
   - Các đồ thị **Latency P95/P99** bắt đầu vẽ các đường dữ liệu biến động thời gian thực.
   - Chỉ ra cho Hội đồng thấy CPU/RAM của các Pod trong cluster nhích lên tương ứng với lượng tải tăng.

### Lời thoại gợi ý

> "Thay vì phải đọc các con số thô từ Prometheus, Grafana cung cấp giao diện dashboard trực quan hóa toàn bộ hệ thống. Chúng em có các panel giám sát tỉ lệ lỗi HTTP 5xx, tốc độ xử lý request của API Gateway Kong, trạng thái hàng đợi trong RabbitMQ, và tải CPU/RAM của các Pod trên Kubernetes. Nhờ vậy, quản trị viên có thể ngay lập tức nhận diện được điểm nghẽn cổ chai (bottleneck) của hệ thống chỉ qua một cái nhìn."

---

## 4. Quản lý Nhật ký Log tập trung (ELK Stack)

### Mục tiêu demo

Chứng minh hệ thống tự động gom log từ tất cả các microservices đang chạy về một kho lưu trữ tập trung (Elasticsearch) và cho phép tìm kiếm, truy vấn log nhanh chóng (qua Kibana) bằng mã định danh giao dịch (`correlationId`) xuyên suốt các service.

### A. Thực thi dưới Local (Môi trường Dev)

#### 1. Mở giao diện Kibana

Mở trình duyệt truy cập:

```text
http://localhost:5601
```

#### 2. Truy vấn Log bằng Correlation ID

* Chỉ ra cách tạo **Data View** cho index `microservices-logs-*` (nếu chưa tạo).
* Chạy một request lỗi hoặc request login bình thường qua Gateway, lấy mã `correlationId` trong log terminal hoặc response header.
* Gõ vào thanh tìm kiếm Kibana để tìm log liên quan:
  ```text
  correlationId : "c31b9e46-3712-4aed-8d10-c3b68fd3942c"
  ```

*Kỳ vọng:* Kibana trả về chính xác chuỗi lịch sử log từ lúc API Gateway nhận request, chuyển qua `identity-service` xác thực, và ghi lại hành động của user.

#### 3. Lọc lỗi hệ thống

Tìm kiếm log lỗi bất kỳ:

```text
level : "error"
```

Hoặc truy vấn log truy cập có mã lỗi:

```text
statusCode >= 500
```

---

### B. Vận hành trên Cloud (AKS/Staging)

Do ELK stack tiêu tốn rất nhiều tài nguyên RAM (vượt quá hạn mức tài nguyên Azure Student giá rẻ), trên cluster AKS staging, chúng em tối giản bằng cách ghi log trực tiếp ra stdout của Container.

* Quản trị viên sử dụng Lens, k9s, hoặc câu lệnh kubectl để xem log trực tiếp:
  ```powershell
  kubectl logs -n staging deploy/luyen-thi-lai-xe-identity-service --tail=100
  ```
* Trên môi trường Production thực tế, hệ thống đã sẵn sàng cấu hình để gửi thẳng log về dịch vụ quản lý log đám mây như **Azure Monitor / Log Analytics Workspace** để quản lý chi phí tối ưu.

### Lời thoại gợi ý

> "Trong kiến trúc microservices, log bị phân tán ở khắp mọi nơi. Nếu xảy ra lỗi, việc đi vào từng pod để tìm kiếm log là bất khả thi. Chúng em đã xây dựng hệ thống ELK Stack tập trung: các service đẩy log về Logstash qua giao thức TCP, Logstash phân tích cú pháp và đẩy vào Elasticsearch. Tại giao diện Kibana, chúng em có thể truy vết toàn bộ vòng đời của một request đi qua nhiều microservices khác nhau bằng mã `correlationId`. Chỉ cần gõ mã này, toàn bộ hành trình xử lý request từ gateway đến các service nội bộ sẽ hiện ra đầy đủ, giúp giảm thời gian tìm lỗi từ vài tiếng xuống còn vài giây."

---

## 5. Truy vết giao dịch Phân tán (Distributed Tracing với OpenTelemetry & Jaeger)

### Mục tiêu demo

Chứng minh khả năng truy vết phân tán (Distributed Tracing) bằng tiêu chuẩn công nghiệp OpenTelemetry. Chỉ ra thời gian xử lý chi tiết (Span) của từng chặng trong chuỗi gọi API giữa các microservice, giúp nhanh chóng phát hiện service nào đang làm chậm hệ thống.

### File cần kiểm tra cấu hình trong VS Code

* Mở [.env](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/.env) local, đảm bảo biến bật trace đã được bật:
  ```text
  OTEL_TRACING_ENABLED=true
  ```

### A. Thực thi dưới Local (Môi trường Dev)

#### 1. Mở giao diện Jaeger

Mở trình duyệt truy cập:

```text
http://localhost:16686
```

#### 2. Tìm kiếm Trace

* Tại mục **Service**, chọn service cần trace (ví dụ `identity-service` hoặc `api-gateway`).
* Nhấp vào **Find Traces**.
* Chọn một trace bất kỳ để xem biểu đồ Gantt Chart hiển thị chuỗi gọi:
  - Gateway gọi sang `identity-service` mất bao nhiêu mili-giây.
  - Các truy vấn cơ sở dữ liệu Postgres chi tiết bên dưới.

---

### B. Vận hành trên Cloud (AKS/Staging)

Để kích hoạt OpenTelemetry Tracing và Jaeger trên Kubernetes AKS:

1. Show file values cấu hình: `tracing.enabled=true`.
2. Chạy lệnh port-forward để truy cập Jaeger UI trên cloud:
   ```powershell
   kubectl port-forward -n staging svc/luyen-thi-lai-xe-jaeger 16686:16686
   ```

### Lời thoại gợi ý

> "Đôi khi hệ thống không báo lỗi nhưng phản hồi rất chậm. Để biết chính xác chặng nào đang bị nghẽn, chúng em tích hợp OpenTelemetry để sinh ra các trace span phân tán gửi về Jaeger. Khi xem giao diện Jaeger, toàn bộ hành trình gọi chéo giữa các service được hiển thị dưới dạng biểu đồ thời gian trực quan. Chúng em có thể thấy rõ chặng gọi từ API Gateway vào Identity Service mất bao nhiêu mili-giây, chặng truy vấn database Postgres tốn bao nhiêu thời gian. Đây là công cụ tối thượng để tối ưu hóa hiệu năng hệ thống microservices."

---

## 5.1. Hướng dẫn mô phỏng sự cố để hiển thị dữ liệu "5xx Error", "Firing Alerts" và "RabbitMQ DLQ"

Mặc định khi hệ thống hoạt động bình thường và khỏe mạnh, các biểu đồ **5xx Error Ratio**, **Firing Alerts**, và **RabbitMQ Retry / DLQ** trên Grafana sẽ hiển thị **"No data"** hoặc bằng `0`. Để thuyết phục Hội đồng bằng các số liệu biến động thực tế, bạn có thể chủ động mô phỏng các lỗi sau một cách an toàn:

### 1. Mô phỏng "5xx Error Ratio" (Tỷ lệ lỗi 5xx hệ thống)

* **Giải thích nguyên nhân bước cũ không hoạt động:** Dịch vụ `/auth/login` thực chất xác thực qua **Keycloak** (sử dụng database `db-keycloak` chứ không kết nối trực tiếp đến `db-identity`). Đồng thời, việc nhập sai mật khẩu chỉ trả về lỗi **`401 Unauthorized`** (lỗi 4xx phía client), nên biểu đồ **5xx Error Ratio** trên Grafana (chỉ theo dõi lỗi 5xx phía server) sẽ không thay đổi.
* **Cách thực hiện đúng để tạo lỗi 5xx:**
  1. **Bước 1: Khởi động lại db-identity** (nếu đã lỡ stop):
     ```powershell
     docker compose -f docker-compose.infra.yml start db-identity
     ```
  2. **Bước 2: Đăng nhập với thông tin đúng** để lấy Access Token hợp lệ (mật khẩu mặc định là `123456`):
     ```powershell
     $LoginResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:8000/auth/login" -ContentType "application/json" -Body '{"username":"admin@test.com","password":"123456"}'
     $AccessToken = $LoginResponse.data.accessToken
     ```
  3. **Bước 3: Ngắt kết nối cơ sở dữ liệu của dịch vụ User**:
     ```powershell
     docker compose -f docker-compose.infra.yml stop db-user
     ```
  4. **Bước 4: Gọi API yêu cầu truy cập Database** bằng Access Token vừa lấy (gọi endpoint lấy thông tin cá nhân `/users/me`):
     ```powershell
     Invoke-RestMethod -Method Get -Uri "http://localhost:8000/users/me" -Headers @{ Authorization = "Bearer $AccessToken" }
     ```

     *Kỳ vọng:* Hệ thống trả về lỗi **`500 Internal Server Error`** do `user-service` không thể kết nối tới `db-user` để lấy thông tin.
* **Kết quả trên Grafana:** Biểu đồ **5xx Error Ratio** sẽ lập tức xuất hiện cột sóng biểu thị tỷ lệ lỗi 5xx tăng vọt.
* **Khôi phục:** Bật lại container database để dịch vụ hoạt động bình thường:
  ```powershell
  docker compose -f docker-compose.infra.yml start db-user
  ```

---

### 2. Mô phỏng "Firing Alerts" (Các cảnh báo đang hoạt động)

* **Cách thực hiện:** Tắt terminal chạy các microservices (`pnpm dev`) như hướng dẫn ở **Mục 2 - Bước 2**.
* **Kết quả trên Grafana:** Sau 2 phút, khi Prometheus chính thức chuyển trạng thái cảnh báo sang **Firing**, góc biểu đồ **Firing Alerts** trên Grafana sẽ chuyển từ "No data" sang hiển thị số lượng cảnh báo đỏ đang có hiệu lực (ví dụ: `11`).

---

### 3. Mô phỏng "RabbitMQ Retry & DLQ Rate / Queue Depth" (Cơ chế tự sửa lỗi & hàng đợi thư chết)

Theo thiết kế kiên cố của hệ thống, khi một microservice consume một message từ RabbitMQ mà gặp lỗi (ví dụ lỗi logic, thiếu trường dữ liệu bắt buộc khi ghi DB), [RabbitMqRetryInterceptor](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/packages/common/src/messaging/rabbitmq-resilience.ts#L138) sẽ tự động ném message vào chuỗi retry queue (`.retry.1`, `.retry.2`, `.retry.3`). Sau 3 lần tự động thử lại thất bại, message sẽ được đưa vào hàng đợi thư chết `.dlq` (Dead Letter Queue) để quản trị viên xử lý.

* **Cách thực hiện:**
  1. Mở giao diện quản trị RabbitMQ tại `http://localhost:15672` (Nếu trên Cloud AKS, port-forward: `kubectl port-forward -n staging svc/luyen-thi-lai-xe-rabbitmq 15672:15672`).
  2. Vào tab **Queues**, click chọn queue **`user_service_events`**.
  3. Cuộn xuống mục **Publish message**.
  4. Nhập payload sau (chúng ta cố tình bỏ trống trường `email` là trường không được phép `null` trong database của `user-service` để kích hoạt lỗi DB):
     ```json
     {
       "pattern": "identity.user.created",
       "data": {
         "userId": "uuid-gia-lap-loi-dlq-12345",
         "fullName": "Simulated DLQ User",
         "email": null,
         "role": "STUDENT"
       }
     }
     ```
  5. Nhấp nút **Publish message**.
* **Xem biến động đồ thị trên Grafana:**
  - **RabbitMQ Retry and DLQ Rate:** Đồ thị sẽ nhấp nháy biểu thị dòng thông tin đang được chuyển tiếp sang hàng đợi retry.
  - **RabbitMQ Retry and DLQ Queue Depth:** Đồ thị sẽ hiển thị số lượng message chờ trong queue `.retry.1` (sau 5s biến mất), chuyển sang `.retry.2` (sau 30s biến mất), chuyển sang `.retry.3` (sau 120s biến mất), và cuối cùng dừng lại ở **`user_service_events.dlq` với số lượng = 1**.
  - **Prometheus & Alertmanager:** Alert `RabbitMqDlqHasMessages` và `RabbitMqMessagesDeadLettered` sẽ được kích hoạt!

---

## 6. Checklist chuẩn bị & Troubleshooting nhanh

### Checklist trước khi Demo

* [ ] Bật OpenTelemetry trong file `.env` local: `OTEL_TRACING_ENABLED=true` và `LOGSTASH_ENABLED=true`.
* [ ] Kiểm tra các container infra bao gồm ELK, Jaeger, Prometheus, Grafana đã chạy:
  ```powershell
  docker compose -f docker-compose.infra.yml ps
  docker compose -f docker-compose.observability.yml ps
  ```
* [ ] Chạy lệnh khói để chắc chắn hạ tầng giám sát phản hồi tốt:
  ```powershell
  pnpm observability:smoke
  ```
* [ ] Mở sẵn các tab trình duyệt cho: Kibana (5601), Jaeger (16686), Prometheus (9090), Grafana (30000).

### Xử lý sự cố nhanh (Troubleshooting)

1. **Chạy K6 test hiệu năng báo lỗi kết nối InfluxDB:**
   * Triệu chứng: K6 báo lỗi không đẩy được metrics về port `8086`.
   * Khắc phục: Chạy bản test không ghi log: `pnpm --filter @repo/performance-tests run test:smoke:no-influx`.
2. **Kibana báo "No results found" mặc dù app đã có log:**
   * Triệu chứng: Không thấy log trong Data View.
   * Khắc phục: Đảm bảo biến `LOGSTASH_ENABLED=true` trong `.env` local và khởi động lại microservice để log bắt đầu truyền đi. Đồng thời kiểm tra khoảng thời gian (Time Filter) ở góc phải Kibana đã bao gồm thời gian hiện tại.
3. **Jaeger không thấy Span nào hiển thị:**
   * Triệu chứng: Danh sách Service trong Jaeger trống rỗng.
   * Khắc phục: Đảm bảo `OTEL_TRACING_ENABLED=true` trong `.env`. Chạy một vài request trên trình duyệt hoặc gọi cURL để kích hoạt luồng HTTP tạo trace data trước khi kiểm tra lại Jaeger.
