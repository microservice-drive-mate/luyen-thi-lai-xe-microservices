# Hướng dẫn Quản lý Cấu hình Tập trung & Secrets

Tài liệu này trình bày giải pháp **Quản lý cấu hình tập trung** (dùng Consul KV, ConfigMap) và **Quản lý thông tin bảo mật (Secrets)** (dùng Kubernetes Secret, Azure Key Vault / HashiCorp Vault) được áp dụng trong dự án Luyện Thi Lái Xe Microservices.

---

## 1. So sánh các giải pháp Quản lý Cấu hình Tập trung

Trong kiến trúc Microservices, việc quản lý file cấu hình `.env` hoặc `.properties` riêng lẻ trên từng dịch vụ là rất khó khăn khi số lượng dịch vụ tăng lên. Hai giải pháp phổ biến nhất là:

### 1.1 Spring Cloud Config (Git Backend)
* **Cơ chế:** Cấu hình được lưu trữ tập trung trong một kho chứa Git (Git Repository). Một Config Server trung gian sẽ đọc từ Git và cung cấp qua HTTP API cho các microservice client.
* **Runtime Refresh:** Hỗ trợ tính năng `@RefreshScope`. Khi thay đổi cấu hình trên Git, ta gửi request POST tới `/actuator/refresh` của client để cập nhật tham số mà không cần restart service.
* **Đặc điểm:** Tích hợp sâu và tối ưu nhất cho hệ sinh thái Spring Boot/Java.

### 1.2 Consul KV Store (Lựa chọn của dự án)
* **Cơ chế:** Lưu cấu hình dưới dạng Key-Value (KV) trực tiếp trên Consul. Đây là giải pháp cực kỳ **nhẹ (lightweight)**, chạy độc lập và hỗ trợ giao diện quản trị GUI trực quan.
* **Cách dự án áp dụng:**
  * Toàn bộ 10 NestJS services sử dụng `@repo/common` chứa [ConsulConfigService](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/packages/common/src/consul/consul-config.service.ts) để kéo cấu hình động khi khởi động.
  * Tùy thuộc vào biến môi trường `NODE_ENV` (`development-local`, `staging`, `production`), service sẽ kéo đúng thư mục tiền tố tương ứng (ví dụ: `config/staging/exam-service/`).
  * Có cơ chế tự động Seed cấu hình vào Consul khi chạy local (`consul-init` chạy script shell [init.sh](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/docker/consul/init.sh)) và trên Kubernetes (qua K8s Job chạy script [seed.sh](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/configmap.yaml#L66)).

---

## 2. Quản lý Secrets nâng cao (Vault & Azure Key Vault)

Mặc dù lưu cấu hình tập trung rất tiện lợi, nhưng các dữ liệu nhạy cảm (như Mật khẩu DB, Private key, Client secret của Keycloak, Storage key) **không được phép** lưu dưới dạng plain-text trên Git hay Consul thông thường.

### 2.1 Giải pháp với HashiCorp Vault / Azure Key Vault
* **Vai trò:** Cung cấp kho lưu trữ an toàn mã hóa phần cứng (HSM), quản lý truy cập bằng chính sách (Policies), hỗ trợ ghi nhật ký kiểm tra (Audit logs) và tự động xoay vòng khóa (Key rotation).
* **Cơ chế hoạt động của Vault:** Ứng dụng xác thực với Vault bằng Token/Kubernetes Auth Method, lấy secrets dựa trên Policy được phân quyền tối thiểu (Least Privilege).

### 2.2 Tích hợp Secrets Store CSI Driver trong cụm AKS Staging
Trường hợp cụm staging chạy trên cloud Azure AKS, dự án sử dụng **Azure Key Vault** (tương đương HashiCorp Vault) tích hợp trực tiếp thông qua **Secrets Store CSI Driver**:

* File cấu hình: [secret-provider.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/secret-provider.yaml)
* **Luồng bảo mật:**
  ```
  [Azure Key Vault] (Lưu secrets bảo mật trên cloud)
         ▲
         │ (Truy xuất an toàn bằng Pod Identity / ClientID)
  [Secrets Store CSI Driver]
         │ (Mount secrets thành volume ảo vào Pod)
         ▼
  [Kubernetes Secret] (Tự sinh trong RAM của Node)
         │ (Inject vào ứng dụng qua Environment Variables)
         ▼
  [NestJS Microservice Pods]
  ```
* Cách hoạt động: Thiết lập đối tượng `SecretProviderClass` kết nối tới Key Vault, tự động lấy các secret như `postgres-password`, `rabbitmq-password`, `redis-password`, `storage-account-key` để ánh xạ thành một Kubernetes Secret dạng Opaque để các pod ứng dụng tiêu thụ an toàn.

---

## 3. Khai báo ConfigMap và Secret trong Kubernetes

Trong Kubernetes, cấu hình phi bảo mật và bảo mật được tách bạch rõ ràng qua hai đối tượng: `ConfigMap` và `Secret`.

```yaml
# Sơ đồ biểu diễn cách inject cấu hình vào Pod
[Deployment Spec]
   ├── envFrom:
   │     └── configMapRef -> [ConfigMap (NODE_ENV, GATEWAY_URL...)]
   └── env:
         └── valueFrom:
               └── secretKeyRef -> [Secret (POSTGRES_PASSWORD, KEYCLOAK_SECRET...)]
```

### 3.1 Cấu hình ConfigMap
Dự án định nghĩa các ConfigMap chính tại [configmap.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/configmap.yaml):
1. **ConfigMap ứng dụng (`luyen-thi-lai-xe-config`):** Chứa các tham số môi trường tĩnh không nhạy cảm: `NODE_ENV`, `CONSUL_URL`, `KEYCLOAK_AUTH_SERVER_URL`, `CORS_ALLOWED_ORIGINS`, log levels.
2. **ConfigMap Database Init (`luyen-thi-lai-xe-postgres-init`):** Chứa script shell tạo các database logic độc lập cho 10 dịch vụ và Keycloak DB khi khởi chạy PostgreSQL StatefulSet.
3. **ConfigMap Consul Seed (`luyen-thi-lai-xe-consul-seed`):** Chứa script curl tự động kết nối và nạp cấu hình KV vào Consul ngay khi cụm K8s khởi chạy thành công.
4. **ConfigMap Kong Gateway Configuration:** Chứa cấu hình khai báo dịch vụ, rewrite path và kích hoạt các plugin của Kong Gateway.

### 3.2 Cấu hình Secret
Mục [secret.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/charts/luyen-thi-lai-xe/templates/secret.yaml) chứa các Secret lưu trữ dưới dạng Base64 mã hóa:
* **Ứng dụng:** Lưu trữ `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_DEFAULT_PASS`, `KEYCLOAK_CLIENT_SECRET`, `STORAGE_ACCOUNT_KEY`.
* **Cấu hình kéo Image (imagePullSecret):** Chứa thông tin tài khoản registry (.dockerconfigjson) để Kubernetes tải ảnh docker bảo mật từ GitHub Container Registry (GHCR) về.

---

## 4. Thực hành Demo & Thuyết trình

Bạn có thể hướng dẫn người nghe quan sát cách cấu hình và secret hoạt động trực quan bằng **k9s** hoặc **Lens**:

### 4.1 Demo 1: Xem ConfigMap và Inject biến môi trường vào Pod

* **Trên k9s:**
  1. Gõ `:cm` để xem danh sách ConfigMaps. Chọn `luyen-thi-lai-xe-config` và bấm `v` để xem dữ liệu lưu trữ bên trong.
  2. Bấm `:pods` di chuyển đến một pod bất kỳ (ví dụ `user-service`), bấm `d` (Describe).
  3. Cuộn xuống phần **Environment**, bạn sẽ thấy các biến như `CONSUL_URL`, `NODE_ENV` được tham chiếu trực tiếp từ ConfigMap (`Source: luyen-thi-lai-xe-config`).
* **Trên Lens:**
  1. Chọn **Config -> ConfigMaps** để duyệt xem cấu hình.
  2. Chọn **Workloads -> Pods**, bấm vào một pod và cuộn xem danh sách Environment Variables hiển thị rõ nguồn tham chiếu.

### 4.2 Demo 2: Tính bảo mật của Secret trong Kubernetes

Chứng minh rằng Secrets được mã hóa Base64 và không hiển thị thô trong cấu hình thông thường:

* **Trên k9s:**
  1. Gõ `:secrets` để xem danh sách Secrets.
  2. Di chuyển đến `luyen-thi-lai-xe-secret` và nhấn `v` (View). Mặc định k9s sẽ giải mã tạm thời cho bạn xem, nhưng nếu lấy qua command line thông thường thì dữ liệu sẽ bị mã hóa:
  ```powershell
  # Lấy dữ liệu thô (đã bị mã hóa Base64)
  kubectl get secret luyen-thi-lai-xe-secret -n staging -o yaml
  
  # Giải mã thử một Key nhạy cảm
  $secret = kubectl get secret luyen-thi-lai-xe-secret -n staging -o jsonpath="{.data.POSTGRES_PASSWORD}"
  [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($secret))
  ```

### 4.3 Demo 3: Seed cấu hình Consul KV động
1. Truy cập vào Consul UI, chọn mục **Key/Value**.
2. Thử thay đổi giá trị của một biến (ví dụ: đổi `config/staging/shared/log.level` từ `info` thành `debug`).
3. Restart lại pod ứng dụng:
   ```powershell
   kubectl rollout restart deploy/luyen-thi-lai-xe-user-service -n staging
   ```
4. Kiểm tra log của Pod mới tạo, bạn sẽ thấy nó tự động áp dụng cấu hình log level mới kéo từ Consul KV mà không cần thay đổi code hay build lại image container.
*Đây là minh chứng cho việc **tách biệt hoàn toàn giữa Code (Docker image đóng gói) và Config (Consul KV/ConfigMap)** theo đúng nguyên lý 12-Factor App.*
