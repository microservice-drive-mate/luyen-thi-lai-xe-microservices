# Demo Script - Chương 7: Bảo Mật Và Cấu Hình Hệ Thống

Tài liệu này là kịch bản demo trực quan cho phần **Bảo mật và cấu hình hệ thống**. Mục tiêu là cho giảng viên nhìn thấy hệ thống không chỉ có code, mà có đủ các lớp cloud-native security: Identity Provider, API Gateway, CORS, token revocation, centralized config, secrets management, NetworkPolicy và DevSecOps gate.

> Lưu ý khi demo: không mở raw value của Kubernetes Secret, GitHub Secret hoặc Azure Key Vault secret. Chỉ show tên key, cách mapping và cơ chế nạp vào Pod.

## 0. Chuẩn bị trước buổi demo

Bạn có thể demo theo hai chế độ:

- **Local hybrid demo**: Docker Compose chỉ chạy infra; các NestJS services chạy bằng terminal. Phù hợp khi AKS đang tắt để tiết kiệm credit, hoặc khi cần demo đầy đủ UI local như RabbitMQ, Consul, Grafana, Kibana, Jaeger.
- **AKS cloud demo**: chạy trên Azure AKS staging/production. Phù hợp để show Kubernetes runtime, Ingress, GitHub Deployments, Helm release và môi trường cloud thật.

Khuyến nghị khi báo cáo với thầy: chuẩn bị cả hai. Mở đầu bằng local nếu cần demo nhanh, sau đó bật AKS để show phần cloud deployment.

### Màn hình nên mở sẵn

- GitHub repository:
  - `Actions` -> workflow `Main Image Release`.
  - `Settings` -> `Secrets and variables` nếu bạn có quyền xem.
  - `Packages` -> một image service bất kỳ.
- Lens hoặc k9s:
  - context `aks-lttl-staging` hoặc `aks-lttl-production`.
  - namespace `staging` hoặc `production`.
- Browser:
  - Frontend admin: `https://drive-mate-admin.vercel.app`
  - API docs: `https://<api-host>/identity-service/docs`
  - Keycloak: `https://<auth-host>/admin`
- Terminal PowerShell.
- VS Code:
  - `charts/luyen-thi-lai-xe/templates/configmap.yaml`
  - `charts/luyen-thi-lai-xe/templates/secret.yaml`
- `charts/luyen-thi-lai-xe/templates/networkpolicy.yaml`
- `kong/kong.yaml`
- `apps/identity-service/src/infrastructure/token-blacklist/token-blacklist.service.ts`

## 0.1. Chạy demo local: Docker infra + services bằng terminal

### Khi nào dùng local mode?

Dùng local mode khi:

- AKS đang tắt để tiết kiệm Azure credit.
- Muốn demo nhiều UI cùng lúc: Keycloak, RabbitMQ, Consul, Grafana, Kibana, Jaeger.
- Muốn tránh rủi ro mạng/cloud trong buổi trình bày.

Local mode trong repo là **hybrid dev mode**:

```text
Docker Compose infra:
  PostgreSQL per service, RabbitMQ, Redis, Consul, Keycloak, Kong,
  Mailpit, ELK, Prometheus, Grafana, Jaeger

Terminal:
  10 NestJS microservices chạy bằng pnpm dev
```

### Bước 1: bật Docker infra

```powershell
pnpm install
docker compose -f docker-compose.infra.yml up -d
```

Kiểm tra container:

```powershell
docker compose -f docker-compose.infra.yml ps
```

Chờ các container chính healthy/running:

```powershell
docker compose -f docker-compose.infra.yml ps consul keycloak rabbitmq redis kong-dev prometheus grafana
```

### Bước 2: seed Consul và database

`consul-init` trong Docker Compose sẽ tự seed cấu hình vào Consul. Nếu cần chạy lại thủ công:

```powershell
pnpm consul:seed:local
```

Chạy migration cho toàn bộ service:

```powershell
pnpm db:migrate
```

Seed dữ liệu demo nếu cần:

```powershell
pnpm db:seed
```

Nếu chỉ cần câu hỏi:

```powershell
pnpm db:seed:question
```

### Bước 3: chạy services bằng terminal

Mở một PowerShell riêng:

```powershell
pnpm dev
```

Script này chạy `turbo run start:dev --filter=./apps/*`, đọc config từ Consul local và set:

```text
NODE_ENV=development-local
CONSUL_URL=http://127.0.0.1:8500
REDIS_URL=redis://localhost:6379
```

### Bước 4: mở các UI local

| Thành phần   | URL                        | Dùng để demo                                 |
| -------------- | -------------------------- | ----------------------------------------------- |
| Kong Gateway   | `http://localhost:8000`  | Public API entrypoint                           |
| Kong Admin API | `http://localhost:8001`  | Xem route/plugin nếu cần                      |
| Keycloak       | `http://localhost:8080`  | Realm, users, clients, roles                    |
| RabbitMQ UI    | `http://localhost:15672` | Queues, retry, DLQ                              |
| Consul UI      | `http://localhost:8500`  | Centralized config KV                           |
| Mailpit        | `http://localhost:8025`  | Email local                                     |
| Prometheus     | `http://localhost:9090`  | Metrics targets                                 |
| Grafana        | `http://localhost:30000` | Dashboard, user/pass mặc định`admin/admin` |
| Kibana         | `http://localhost:5601`  | ELK logs                                        |
| Jaeger         | `http://localhost:16686` | Distributed tracing nếu bật OTEL              |

### Bước 5: test local API qua Kong

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8000/auth/public" |
  Select-Object -ExpandProperty Content
```

CORS preflight local:

```powershell
curl.exe -i -X OPTIONS "http://localhost:8000/auth/login" `
  -H "Origin: http://localhost:5173" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization"
```

Login local nếu có seed user:

```powershell
$LoginBody = @{
  username = "admin@test.com"
  password = "123456"
} | ConvertTo-Json

$LoginResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/auth/login" `
  -ContentType "application/json" `
  -Body $LoginBody

$AccessToken = $LoginResponse.data.accessToken
```

### Bước 6: tắt local sau demo

Tắt services terminal bằng `Ctrl+C`.

Tắt infra:

```powershell
docker compose -f docker-compose.infra.yml down
```

Nếu muốn xóa luôn volumes local, chỉ làm khi chắc chắn không cần dữ liệu demo:

```powershell
docker compose -f docker-compose.infra.yml down -v
```

## 0.2. Bật/tắt AKS để tiết kiệm Azure credit

### Kiểm tra cluster hiện tại

Staging:

```powershell
az aks show `
  --resource-group rg-lttl-staging-sea `
  --name aks-lttl-staging `
  --query "{name:name,powerState:powerState.code,provisioningState:provisioningState,location:location}" `
  -o table
```

Production nếu có:

```powershell
az aks show `
  --resource-group rg-lttl-production-ea `
  --name aks-lttl-production `
  --query "{name:name,powerState:powerState.code,provisioningState:provisioningState,location:location}" `
  -o table
```

Nếu resource group production của bạn khác, thay đúng tên trong GitHub Environment variable `AZURE_AKS_RESOURCE_GROUP`.

### Bật AKS trước khi demo/deploy

Staging:

```powershell
az aks start `
  --resource-group rg-lttl-staging-sea `
  --name aks-lttl-staging
```

Production:

```powershell
az aks start `
  --resource-group rg-lttl-production-ea `
  --name aks-lttl-production
```

Sau khi start, lấy credentials:

```powershell
az aks get-credentials `
  --resource-group rg-lttl-staging-sea `
  --name aks-lttl-staging `
  --overwrite-existing

kubectl config use-context aks-lttl-staging
kubectl get nodes
kubectl get pods -n staging
```

Production:

```powershell
az aks get-credentials `
  --resource-group rg-lttl-production-ea `
  --name aks-lttl-production `
  --overwrite-existing

kubectl config use-context aks-lttl-production
kubectl get nodes
kubectl get pods -n production
```

### Tắt AKS sau demo

Trước khi tắt, nếu observability đang bật thủ công, nên tắt trước để giảm tài nguyên khi bật lại:

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  --reuse-values `
  --set observability.enabled=false `
  --set observability.prometheus.enabled=false `
  --set observability.grafana.enabled=false `
  --set tracing.enabled=false
```

Tắt staging:

```powershell
az aks stop `
  --resource-group rg-lttl-staging-sea `
  --name aks-lttl-staging
```

Tắt production:

```powershell
az aks stop `
  --resource-group rg-lttl-production-ea `
  --name aks-lttl-production
```

Kiểm tra lại:

```powershell
az aks show `
  --resource-group rg-lttl-staging-sea `
  --name aks-lttl-staging `
  --query "powerState.code" `
  -o tsv
```

### Lưu ý quan trọng

- Khi AKS đang `Stopped`, workflow auto deploy staging sẽ fail ở bước lấy credentials hoặc deploy Helm. Vì vậy trước khi merge vào `main`, hãy bật staging nếu muốn auto deploy xanh.
- `az aks stop` dừng control plane/node để giảm chi phí compute, nhưng các tài nguyên khác như Public IP, disk/PVC, storage, Log Analytics/ingestion nếu có vẫn có thể phát sinh chi phí nhỏ.
- Nếu chỉ cần demo code/security flow, dùng local mode để không cần bật AKS.
- Nếu cần show GitHub Deployments/Kubernetes runtime thật, bật AKS trước buổi demo khoảng 10-15 phút.

### Biến dùng trong terminal

Chọn đúng môi trường trước khi demo.

```powershell
# Staging
$Namespace = "staging"
$ApiHost = "api.52.139.233.166.nip.io"
$AuthHost = "auth.52.139.233.166.nip.io"
$Scheme = "https"

# Production nếu cần demo production
# $Namespace = "production"
# $ApiHost = "api-prod.4.144.64.133.nip.io"
# $AuthHost = "auth-prod.4.144.64.133.nip.io"
# $Scheme = "https"
```

Kiểm tra context:

```powershell
kubectl config current-context
kubectl get deploy,pod,svc,ingress -n $Namespace
```

Lời thoại:

> "Trước khi đi vào từng cơ chế bảo mật, em kiểm tra nhanh runtime trên Kubernetes. Toàn bộ backend không expose từng service riêng lẻ ra Internet, mà chạy trong namespace Kubernetes và public traffic đi qua Ingress + Kong Gateway."

## 1. Tổng quan kiến trúc bảo mật nhiều lớp

### Mục tiêu demo

Cho thầy thấy traffic đi theo nhiều lớp:

```text
Frontend / Browser
  -> Ingress-nginx / Azure Load Balancer
  -> Kong API Gateway
  -> Microservices nội bộ
  -> Redis / RabbitMQ / Consul / Keycloak / Neon PostgreSQL
```

### UI nên show

Trong Lens:

- `Workloads -> Deployments`: show 10 service, Kong, Keycloak.
- `Network -> Services`: show service type `ClusterIP` cho các backend.
- `Network -> Ingresses`: show public host API/Auth.

Hoặc dùng k9s:

```text
:ns
:pods
:svc
:ing
```

Command phụ:

```powershell
kubectl get deploy,pod,svc,ingress -n $Namespace -o wide
kubectl get svc -n $Namespace
kubectl get ingress -n $Namespace
```

Lời thoại:

> "Ở đây thầy có thể thấy các microservice chỉ có Service nội bộ dạng ClusterIP. Client không gọi trực tiếp từng service, mà đi qua Ingress và Kong. Đây là cách giảm bề mặt tấn công và tập trung hóa các policy public như CORS, route và rate limit."

## 2. Centralized Identity với Keycloak

### Mục tiêu demo

Chứng minh hệ thống không tự lưu/xử lý password rải rác trong từng service. Keycloak là Identity Provider trung tâm, cấp JWT token và quản lý realm/client/role.

### UI nên show

Mở:

```text
https://<auth-host>/admin
```

Trong Keycloak Admin Console:

- Chọn realm của hệ thống.
- Show `Clients` -> backend client, ví dụ `nestjs-backend`.
- Show `Realm roles`: `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`.
- Show `Users`: user demo.

Không cần show secret của client.

### Command/API minh họa

Mở API docs:

```text
https://<api-host>/identity-service/docs
```

Test public/private endpoint:

```powershell
# Public endpoint, không cần token
Invoke-WebRequest -UseBasicParsing "${Scheme}://${ApiHost}/auth/public" | Select-Object -ExpandProperty Content

# Private endpoint, không token nên phải bị 401
try {
  Invoke-WebRequest -UseBasicParsing "${Scheme}://${ApiHost}/auth/private"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Nếu có user demo:

```powershell
$LoginBody = @{
  username = "admin@test.com"
  password = "123456"
} | ConvertTo-Json

$LoginResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "${Scheme}://${ApiHost}/auth/login" `
  -ContentType "application/json" `
  -Body $LoginBody

$AccessToken = $LoginResponse.data.accessToken
$RefreshToken = $LoginResponse.data.refreshToken

Invoke-RestMethod `
  -Headers @{ Authorization = "Bearer $AccessToken" } `
  -Uri "${Scheme}://${ApiHost}/auth/private"
```

Lời thoại:

> "Keycloak chịu trách nhiệm xác thực và cấp token. Backend service không tự lưu mật khẩu người dùng. Service chỉ verify JWT và kiểm tra role/claim để phân quyền. Ví dụ endpoint public gọi được không cần token, còn endpoint private bị từ chối nếu không có JWT hợp lệ."

## 3. Kong API Gateway, CORS và Rate Limiting

### Mục tiêu demo

Chứng minh API public được bảo vệ qua Gateway:

- Route tập trung.
- CORS allow-list.
- Correlation ID.
- Rate limiting.

### UI nên show

Mở file:

```text
kong/kong.yaml
```

Hoặc show ConfigMap Kong đang render trong cluster:

```powershell
kubectl get configmap -n $Namespace
kubectl get configmap luyen-thi-lai-xe-kong -n $Namespace -o yaml
```

Nếu release name khác, tìm tên:

```powershell
kubectl get configmap -n $Namespace | Select-String "kong"
```

Show trong output:

- `services`
- `routes`
- plugin `cors`
- plugin `correlation-id`
- plugin `rate-limiting`

### Demo CORS preflight

Origin hợp lệ:

```powershell
curl.exe -i -X OPTIONS "${Scheme}://${ApiHost}/auth/login" `
  -H "Origin: https://drive-mate-admin.vercel.app" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization"
```

Nếu môi trường demo đang dùng certificate self-signed hoặc certificate chưa được Windows tin cậy, `curl.exe` có thể báo:

```text
schannel: SEC_E_UNTRUSTED_ROOT
```

Khi đó dùng `-k` để bỏ qua kiểm tra certificate cho **mục đích demo CORS**:

```powershell
curl.exe -k -i -X OPTIONS "${Scheme}://${ApiHost}/auth/login" `
  -H "Origin: https://drive-mate-admin.vercel.app" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization"
```

Không dùng `-k` như best practice production. Production thật nên dùng certificate hợp lệ từ Let's Encrypt/cert-manager hoặc domain thật để browser và client tin cậy.

Origin không hợp lệ:

```powershell
curl.exe -k -i -X OPTIONS "${Scheme}://${ApiHost}/auth/login" `
  -H "Origin: https://evil.example.com" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization"
```

Kỳ vọng:

- Origin hợp lệ có `Access-Control-Allow-Origin`.
- Origin lạ không được allow như frontend thật.

Ghi chú quan trọng khi đọc kết quả CORS:

- Origin hợp lệ phải có `Access-Control-Allow-Origin: <origin>`.
- Origin lạ có thể vẫn trả HTTP `200 OK` cho request `OPTIONS`, nhưng nếu **không có** header `Access-Control-Allow-Origin` thì browser vẫn chặn request thật.
- Vì vậy khi demo origin xấu, đừng chỉ nhìn status code; hãy nhìn header `Access-Control-Allow-Origin`.

Lọc header cho dễ nhìn:

```powershell
curl.exe -k -i -X OPTIONS "${Scheme}://${ApiHost}/auth/login" `
  -H "Origin: https://drive-mate-admin.vercel.app" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization" |
  Select-String "HTTP/|Access-Control-Allow-Origin|Access-Control-Allow-Credentials"

curl.exe -k -i -X OPTIONS "${Scheme}://${ApiHost}/auth/login" `
  -H "Origin: https://evil.example.com" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: content-type,authorization" |
  Select-String "HTTP/|Access-Control-Allow-Origin|Access-Control-Allow-Credentials"
```

### Demo correlation id

#### Bước 1: Gửi Request kèm Correlation ID tự định nghĩa

Bạn có thể demo nhanh bằng cách gửi qua API public:

```powershell
curl.exe -k -i "http://localhost:8000/auth/public" `
  -H "x-correlation-id: demo-security-001"
```

Kỳ vọng thấy header `x-correlation-id` được echo downstream nếu Kong xử lý.

Kỳ vọng trong response:

```text
x-correlation-id: demo-security-001
X-Kong-Upstream-Latency: ...
X-Kong-Proxy-Latency: ...
Via: kong/...
```

#### Bước 2: Demo đầu-cuối (End-to-End Propagation qua RabbitMQ và Microservices)

Để thể hiện sự mạnh mẽ của hệ thống trong việc truyền mã vết (correlation-id) qua giao tiếp bất đồng bộ (RabbitMQ), bạn thực hiện demo luồng tạo tài khoản mới bởi Quản trị viên (Admin Create User):

1. **Lấy Access Token của tài khoản Admin:**

```powershell
$LoginBody = @{
  username = "admin@test.com"
  password = "123456"
} | ConvertTo-Json

$LoginResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/auth/login" `
  -ContentType "application/json" `
  -Body $LoginBody

$AdminToken = $LoginResponse.data.accessToken
```

2. **Gửi request tạo tài khoản mới kèm `x-correlation-id` tự tạo (sử dụng Token Admin vừa lấy):**

```powershell
# Tạo mã correlation-id và thông tin sinh viên ngẫu nhiên
$rand = Get-Random -Minimum 1000 -Maximum 9999
$email = "student_" + $rand + "@example.com"
$cid = "demo-trace-user-" + $rand
$body = '{"email":"' + $email + '","fullName":"Hoc Vien A","role":"STUDENT","temporaryPassword":"Password123!"}'

# Ghi JSON ra file tạm để tránh lỗi PowerShell nuốt dấu nháy kép của curl.exe
[System.IO.File]::WriteAllText("$pwd/body.json", $body)

curl.exe -k -i -X POST "http://localhost:8000/admin/identity-users" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $AdminToken" `
  -H "x-correlation-id: $cid" `
  -d "@body.json"

# Xóa file tạm sau khi gửi xong
Remove-Item body.json
```

3. **Truy vết qua log hệ thống:**

Khi request tạo user được gửi, chuỗi sự kiện sau diễn ra:
- **`identity-service`** nhận request HTTP -> Lưu vào Keycloak -> Phát sự kiện `identity.user.created` vào **RabbitMQ** kèm theo correlation-id.
- Các service tiêu thụ sự kiện này: **`user-service`** (khởi tạo profile), **`notification-service`** (gửi thông báo chào mừng), và **`analytics-service`** (ghi nhận thống kê).
- Nhờ `CorrelationIdInterceptor` và `AsyncLocalStorage`, tất cả log của các service này đều dùng chung thuộc tính `correlationId` trị giá `$cid`.

4. **Kiểm tra logs bằng lệnh Elasticsearch hoặc Kibana:**

*Lưu ý cấu hình Local:* Để dịch vụ đẩy log lên Logstash dưới local, hãy chắc chắn đã cấu hình `LOGSTASH_ENABLED=true` trong file `.env` ở thư mục gốc và khởi động lại dịch vụ bằng lệnh `pnpm dev`.

*Truy vấn trực tiếp qua Elasticsearch (nếu chạy local có ELK):*
```powershell
curl.exe "http://localhost:9200/microservices-logs-*/_search?q=correlationId:$cid&pretty"
```

*Hoặc qua giao diện Kibana (http://localhost:5601):*

1. **Tạo Data View (nếu chạy lần đầu):**
   - Vào **Stack Management** -> **Data Views** -> **Create data view**.
   - Điền Name và Index pattern là `microservices-logs-*`. (F5 tải lại trang nếu Kibana báo không match do index mới được tạo).
   - Chọn Timestamp field là `@timestamp` -> Bấm **Save data view to Kibana**.

2. **Truy vết trong Discover:**
   - Vào **Discover** -> Chọn Data View là `microservices-logs-*`.
   - **Tối ưu hiển thị:** Tại danh sách trường bên trái (Available fields), rê chuột và nhấn dấu `+` (Add as column) cho các trường: `serviceName`, `level`, `message`, `correlationId`.
   - Nhập ô tìm kiếm KQL ở trên cùng: `correlationId: "demo-trace-user-xxxx"` (với xxxx là số ngẫu nhiên ở trên).
   - Bạn sẽ thấy log đồng thời từ `identity-service`, `user-service`, `notification-service` và `analytics-service` xuất hiện liền mạch cùng nhau chia sẻ chung mã truy vết.

3. **Truy vết trực quan qua Jaeger (Distributed Tracing):**
   - *Lưu ý cấu hình Local:* Để hệ thống bật OpenTelemetry và đẩy dữ liệu vết về Jaeger, hãy chắc chắn cấu hình `OTEL_TRACING_ENABLED=true` trong file `.env` ở thư mục gốc và khởi động lại dịch vụ bằng lệnh `pnpm dev`.
   - Truy cập **Jaeger UI** tại: `http://localhost:16686`
   - Tại cột bên trái, mục **Service**, chọn `identity-service`.
   - Tại mục **Tags**, nhập `x-correlation-id=demo-trace-user-xxxx` (với xxxx là số ngẫu nhiên của request đăng ký trước đó).
   - Bấm **Find Traces** và click vào trace tìm thấy.
   - **Kết quả:** Bạn sẽ thấy biểu đồ Gantt chi tiết các span xử lý bên trong `identity-service` (từ HTTP gateway đi vào, qua các middleware, bộ định tuyến, và các truy vấn database) của request tạo user. *(Lưu ý: Jaeger sẽ chỉ hiển thị các span thuộc `identity-service` do ngữ cảnh OpenTelemetry hiện tại chưa tự động truyền qua hàng đợi RabbitMQ).*

Ý nghĩa demo:

- `x-correlation-id` do client gửi vào được Kong echo lại, giúp trace request từ browser/gateway/service/log.
- Trình bày khả năng truyền tải ngữ cảnh (Context Propagation) qua các tầng kiến trúc khác nhau (từ HTTP REST tới Message Broker RabbitMQ).
- `X-Kong-Upstream-Latency` thể hiện thời gian upstream service xử lý.
- `X-Kong-Proxy-Latency` thể hiện overhead tại gateway.
- Body response vẫn theo standard envelope của backend: `success`, `code`, `message`, `timestamp`, `path`, `data`.

Lời thoại riêng cho correlation id:

> "Ở đây em gửi correlation id `demo-security-001`. Response trả lại đúng header này, chứng tỏ request có một mã định danh xuyên suốt để join log giữa gateway và service. Ngoài ra, khi thực hiện một hành động liên service như tạo tài khoản bởi Admin, mã trace này được truyền tiếp qua RabbitMQ tới các service như User, Notification, Analytics. Khi xảy ra sự cố, kỹ sư vận hành chỉ cần tìm kiếm duy nhất ID này trên Kibana là có thể thấy toàn bộ quá trình xử lý của tất cả microservices liên quan."

### Demo Rate Limiting

Trong Kong config, plugin rate limiting đang cấu hình:

```yaml
second: 100
hour: 1000
policy: local
```

Demo nhẹ, chỉ show header rate limit:

```powershell
curl.exe -k -i "http://localhost:8000/auth/public" |
  Select-String "HTTP/|X-RateLimit|RateLimit-|Via"
```

Kỳ vọng thấy:

```text
X-RateLimit-Limit-Second: 100
X-RateLimit-Remaining-Second: ...
X-RateLimit-Limit-Hour: 1000
X-RateLimit-Remaining-Hour: ...
RateLimit-Limit: 100
RateLimit-Remaining: ...
```

Demo mạnh hơn để thấy `429 Too Many Requests`:

**Cách 1: Sử dụng công cụ load test nhanh `autocannon` (Khuyên dùng vì chạy song song hiệu quả):**

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; npx autocannon -c 100 -a 150 "http://localhost:8000/auth/public"
```

Kỳ vọng: Thấy kết quả thống kê có khoảng `100 2xx responses` và phần còn lại là `non 2xx responses` (tương ứng với mã lỗi 429 từ Kong).

**Cách 2: Sử dụng vòng lặp PowerShell (Chỉ hiệu quả khi hạ Rate Limit hoặc chạy song song trên PowerShell 7+):**

*Lưu ý: Chạy vòng lặp tuần tự dưới đây trong Windows PowerShell 5.1 có thể không kích hoạt được 429 do tốc độ khởi tạo tiến trình `curl.exe` chậm. Để thực hiện cách này, nên sửa `second: 100` thành `second: 5` trong [kong.dev.yaml](../../kong/kong.dev.yaml) và khởi động lại Kong bằng lệnh `docker compose -f docker-compose.infra.yml restart kong-dev`.*

```powershell
foreach ($i in 1..150) {
  $status = curl.exe -k -s -o NUL -w "%{http_code} " "http://localhost:8000/auth/public"
  "{0}: {1}" -f $i, $status
  if ($status -eq "429") { break }
}
```

Kỳ vọng:
- Các request đầu trả `200`.
- Khi vượt ngưỡng trong thời gian ngắn (nếu hạ rate limit hoặc bắn đủ nhanh), Kong trả `429`.
- Nếu chưa thấy `429`, có thể do request tuần tự không đủ nhanh hoặc rate limit tính theo client/IP trong cửa sổ ngắn. Khi đó dùng `autocannon` ở cách 1 hoặc show các header rate limit là đủ an toàn cho demo.

Lời thoại riêng cho rate limiting:

> "Rate limiting được áp dụng ở gateway, trước khi request vào microservice. Nếu có client spam request, Kong có thể chặn ở lớp ngoài, giảm tải cho các service phía sau."

## 4. Token Blacklist và Session Revocation bằng Redis

### Mục tiêu demo

Chứng minh JWT vẫn stateless nhưng hệ thống có lớp revoke token bằng Redis khi logout, đổi mật khẩu hoặc khóa user.

### Show code

Mở:

```text
apps/identity-service/src/infrastructure/token-blacklist/token-blacklist.service.ts
apps/identity-service/src/infrastructure/guards/token-blacklist.guard.ts
apps/identity-service/src/application/use-cases/logout/logout.use-case.ts
apps/identity-service/src/application/use-cases/change-password/change-password.use-case.ts
apps/identity-service/src/application/use-cases/lock-user/lock-user.use-case.ts
```

Nhấn mạnh:

- `bl:{jti}` hoặc fallback token key.
- TTL dựa trên thời gian còn lại của access token.
- `auth:revoked-after:{userId}` cho revoke toàn bộ token cũ của user.
- Guard kiểm tra blacklist trước khi cho request đi tiếp.

### Demo bằng API

Login:

```powershell
$LoginBody = @{
  username = "admin@test.com"
  password = "123456"
} | ConvertTo-Json

$LoginResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/auth/login" `
  -ContentType "application/json" `
  -Body $LoginBody

$AccessToken = $LoginResponse.data.accessToken
$RefreshToken = $LoginResponse.data.refreshToken
```

Gọi private thành công:

```powershell
Invoke-RestMethod `
  -Headers @{ Authorization = "Bearer $AccessToken" } `
  -Uri "http://localhost:8000/auth/private"
```

Logout:

```powershell
$LogoutBody = @{
  refreshToken = $RefreshToken
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/auth/logout" `
  -Headers @{ Authorization = "Bearer $AccessToken" } `
  -ContentType "application/json" `
  -Body $LogoutBody
```

Gọi lại private bằng token cũ:

```powershell
try {
  Invoke-RestMethod `
    -Headers @{ Authorization = "Bearer $AccessToken" } `
    -Uri "http://localhost:8000/auth/private"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

### Demo Redis key nếu muốn trực quan hơn

Để thầy thấy token thực sự đã bị đưa vào danh sách đen trong cache Redis dưới local:

```powershell
# Xem toàn bộ các key đang được lưu trong Redis local
docker compose -f docker-compose.infra.yml exec redis redis-cli KEYS "*"
```

*Kỳ vọng:* Bạn sẽ thấy một key có định dạng `bl:xxxx` (trong đó `xxxx` là định danh JTI của access token vừa logout).

```powershell
# Xem thời gian tồn tại còn lại (TTL - giây) của key blacklist đó
docker compose -f docker-compose.infra.yml exec redis redis-cli TTL "bl:xxxx"
```

*Giải thích:* TTL này tự động được tính bằng thời gian hết hạn còn lại của access token gốc, đảm bảo tự động dọn dẹp bộ nhớ đệm (garbage collection) khi token hết hạn hoàn toàn.

Lời thoại:

> "JWT thông thường hợp lệ đến khi hết hạn, nên logout không tự động làm access token cũ mất hiệu lực. Hệ thống bổ sung Redis blacklist để chặn token đã logout hoặc token phát hành trước thời điểm revoke của user. Đây là lớp cân bằng giữa stateless JWT và yêu cầu kiểm soát session."

## 5. Secrets Management bằng GitHub Secrets, Helm và Kubernetes Secret

### Mục tiêu demo

Chứng minh secrets không hard-code trong source code, mà đi theo luồng:

```text
GitHub Secrets / Environment Secrets
  -> GitHub Actions
  -> Helm values runtime
  -> Kubernetes Secret
  -> Pod env secretKeyRef
```

### Cách A: Demo trên môi trường Cloud (AKS/Staging)

#### UI nên show

GitHub:

- `Settings -> Secrets and variables -> Actions`.
- Show danh sách tên secret như:
  - `STAGING_POSTGRES_PASSWORD`
  - `STAGING_RABBITMQ_PASSWORD`
  - `STAGING_KEYCLOAK_CLIENT_SECRET`
  - `GHCR_PULL_TOKEN`
- Không click mở/không copy value.

Lens:

- `Config -> Secrets`
- Chọn secret của release, chỉ show key names nếu Lens cho phép.

#### Command minh họa an toàn

Show tên secret và key, không decode value:

```powershell
kubectl get secret -n $Namespace

kubectl get secret luyen-thi-lai-xe-secrets -n $Namespace `
  -o jsonpath="{.data}" | ConvertFrom-Json | Get-Member -MemberType NoteProperty
```

Nếu jsonpath khó đọc, dùng:

```powershell
kubectl get secret luyen-thi-lai-xe-secrets -n $Namespace -o yaml
```

Nhưng khi demo, tránh kéo xuống phần value quá lâu vì data là base64.

Show Pod dùng secret:

```powershell
kubectl get deploy luyen-thi-lai-xe-identity-service -n $Namespace -o yaml | Select-String "secretKeyRef|KEYCLOAK_CLIENT_SECRET|POSTGRES_PASSWORD|REDIS_PASSWORD" -Context 2,2
```

Show source:

```text
charts/luyen-thi-lai-xe/templates/secret.yaml
charts/luyen-thi-lai-xe/templates/apps.yaml
```

Lời thoại:

> "Các secret như database password, RabbitMQ password, Keycloak client secret và storage key không nằm trong source code. Workflow lấy chúng từ GitHub Secrets hoặc environment secrets, render thành Kubernetes Secret, sau đó pod chỉ đọc qua env var/secretKeyRef."

### Cách B: Demo tương đương dưới Local (Môi trường Dev)

Để đồng bộ với chạy local phía trên và chứng minh cơ chế quản lý secret an toàn không hard-code khi code ở máy cá nhân:

#### 1. Chứng minh các secret được đưa vào file ngoại tuyến không đẩy lên Git

Show dòng cấu hình `.env` trong file `.gitignore` để chứng minh các mật khẩu thực tế được loại trừ khỏi source control:

```powershell
Select-String -Path .gitignore -Pattern "\.env"
```

*Kỳ vọng:* Bạn sẽ thấy dòng `.env` và các biến thể liên quan.

Show file template mẫu [được commit lên Git] để lập trình viên tự cấu hình:

```text
Mở file .env.example
```

*Giải thích:* File `.env.example` chỉ chứa cấu trúc key và các giá trị mặc định của lab/dev, không chứa bất kỳ secret thật nào của môi trường production/staging.

#### 2. Chứng minh Docker Compose đọc secret từ môi trường bên ngoài

Show file [docker-compose.yaml](file:///c:/Users/Ngo%20Minh%20Tri/workspace/uit/microservices/luyen-thi-lai-xe-microservices/docker-compose.yaml) để chứng minh database không hard-code mật khẩu:

```powershell
Select-String -Path docker-compose.yaml -Pattern "POSTGRES_PASSWORD" -Context 1,1
```

*Kỳ vọng:* Bạn sẽ thấy cấu hình `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}`, tức là docker-compose sẽ đọc động từ file `.env` local của host, tương đương với cách Kubernetes Pod tham chiếu qua `secretKeyRef`.

#### 3. Chứng minh source code đọc động qua ConfigService

Mở một file cấu hình code bất kỳ, ví dụ cấu hình database hay keycloak trong `identity-service`, giải thích là code hoàn toàn đọc động qua NestJS `ConfigService` hoặc `process.env`.

Lời thoại:

> "Ở môi trường local, thay vì dùng GitHub Secrets và Kubernetes Secret, các secret được quản lý thông qua file `.env` nằm ngoài Git (đã đưa vào `.gitignore`). Khi khởi chạy, các service và database của Docker Compose sẽ lấy giá trị cấu hình runtime từ file `.env` này, đảm bảo không có thông tin nhạy cảm nào bị hard-code trong mã nguồn."

## 6. Azure Key Vault Support

### Mục tiêu demo

Trình bày hệ thống đã chuẩn bị hướng external secret manager bằng Azure Key Vault.

### Cần nói cho chính xác

- Staging workflow có support đọc secret từ Azure Key Vault nếu `STAGING_KEY_VAULT_ENABLED=true`.
- Helm chart có template `SecretProviderClass`.
- Production hiện có thể vẫn dùng GitHub Environment Secrets/Kubernetes Secrets nếu chưa bật Key Vault toàn phần.
- Không claim HashiCorp Vault.

### UI nên show

Azure Portal:

- Key Vault `kv-lttl-stg` nếu đang có.
- `Secrets`: show tên secret, không show value.

GitHub Actions workflow:

```text
.github/workflows/deploy-azure-staging.yml
```

Tìm đoạn:

```text
Load secrets from Azure Key Vault
az keyvault secret show
```

Helm:

```text
charts/luyen-thi-lai-xe/templates/secret-provider.yaml
```

Command:

```powershell
kubectl get secretproviderclass -n $Namespace
```

Nếu không có resource vì `keyVault.enabled=false`, nói:

> "Ở môi trường này Key Vault CSI resource có thể đang tắt để đơn giản hóa demo, nhưng chart và workflow đã chuẩn bị đường tích hợp. Staging workflow đã hỗ trợ lấy secret từ Azure Key Vault khi bật biến môi trường tương ứng."

## 7. Centralized Configuration bằng Consul KV

### Mục tiêu demo

Chứng minh config runtime không rải rác trong `.env`, mà được seed vào Consul KV theo environment/service.

### Cách A: Demo trên môi trường Cloud (AKS/Staging)

#### UI nên show

Port-forward Consul:

```powershell
kubectl port-forward -n $Namespace svc/luyen-thi-lai-xe-consul 8500:8500
```

Mở:

```text
http://localhost:8500
```

Trong UI:

- `Key/Value`
- `config/<environment>/shared/...`
- `config/<environment>/identity-service/...`
- `config/<environment>/exam-service/services.question.baseUrl`

#### Command

```powershell
kubectl get job -n $Namespace | Select-String "consul-seed"
kubectl logs -n $Namespace job/luyen-thi-lai-xe-consul-seed-<revision>
```

Nếu không nhớ job name:

```powershell
kubectl get job -n $Namespace -o name | Select-String "consul-seed"
```

Test Consul KV:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8500/v1/kv/config/$Namespace/shared/public.gateway.url?raw" | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing "http://localhost:8500/v1/kv/config/$Namespace/shared/cors.origins?raw" | Select-Object -ExpandProperty Content
```

Nếu `NODE_ENV` không trùng namespace, kiểm tra:

```powershell
kubectl get configmap luyen-thi-lai-xe-config -n $Namespace -o jsonpath="{.data.NODE_ENV}"
```

Sau đó thay `$Namespace` bằng giá trị NODE_ENV tương ứng.

### Cách B: Demo tương đương dưới Local (Môi trường Dev)

#### 1. UI nên show

Mở trực tiếp giao diện Consul local (được khởi chạy cùng docker compose infra):

```text
http://localhost:8500
```

Trong UI:

- Vào tab `Key/Value`
- Xem thư mục cấu hình local: `config/development-local/shared/...` hoặc `config/development-local/identity-service/...`

#### 2. Command seed dữ liệu và kiểm tra

Nếu muốn nạp lại cấu hình local (seed data):

```powershell
pnpm consul:seed:local
```

Test truy vấn API Consul trực tiếp dưới local:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8500/v1/kv/config/development-local/shared/public.gateway.url?raw" | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing "http://localhost:8500/v1/kv/config/development-local/shared/cors.origins?raw" | Select-Object -ExpandProperty Content
```

*Kỳ vọng:* Trả về giá trị cấu hình tương ứng dưới local (ví dụ: `http://localhost:8000`).

Lời thoại:

> "Consul KV dùng cho cấu hình runtime không nhạy cảm như public gateway URL, frontend origin, CORS origins, service base URL và log level. Secrets không đưa vào Consul; secrets vẫn đi qua Kubernetes Secret (hoặc file `.env` tách biệt dưới local). Việc này tách rõ config và secret."

## 8. TLS và HTTPS

### Mục tiêu demo

Chứng minh frontend HTTPS cần backend HTTPS để tránh Mixed Content, và chart/workflow hỗ trợ bật TLS ở Ingress.

### UI nên show

Browser:

- Mở frontend `https://drive-mate-admin.vercel.app`.
- DevTools -> Network.
- Gọi API qua `https://<api-host>`.

Kubernetes:

```powershell
kubectl get ingress -n $Namespace -o yaml | Select-String "tls:|secretName|host:" -Context 2,3
kubectl get secret -n $Namespace | Select-String "tls"
```

Show source:

```text
charts/luyen-thi-lai-xe/templates/ingress.yaml
.github/workflows/deploy-azure-staging.yml
.github/workflows/production-release.yml
```

Nhấn mạnh:

- Khi `API_SCHEME=https`, workflow render `ingress.tls.enabled=true`.
- TLS secret chứa certificate.
- Nếu demo hiện đang dùng HTTP/nip.io, nói đây là mode tiết kiệm/lab; khi dùng Vercel production phải dùng HTTPS backend để browser không chặn Mixed Content.

Lời thoại:

> "Frontend chạy HTTPS trên Vercel, nên backend public endpoint cũng cần HTTPS. Chart hỗ trợ TLS tại Ingress để mã hóa traffic từ browser vào cluster, còn service nội bộ vẫn giao tiếp qua ClusterIP phía sau gateway."

## 9. NetworkPolicy

### Mục tiêu demo

Chứng minh hệ thống đã chuẩn bị Kubernetes NetworkPolicy để cô lập traffic nội bộ.

### Cần nói cho chính xác

NetworkPolicy template đang có nhưng mặc định `networkPolicy.enabled=false`. Đây là lựa chọn an toàn cho demo trên Azure Student vì nếu policy sai một port, service có thể không gọi được Redis/RabbitMQ/Consul/Keycloak.

### UI/command

Show source:

```text
charts/luyen-thi-lai-xe/templates/networkpolicy.yaml
charts/luyen-thi-lai-xe/values.yaml
```

Command:

```powershell
kubectl get networkpolicy -n $Namespace
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -f charts/luyen-thi-lai-xe/values-azure.example.yaml `
  --set networkPolicy.enabled=true |
  Select-String "kind: NetworkPolicy|allow-kong|allow-redis|allow-rabbitmq|allow-consul|allow-keycloak" -Context 0,2
```

Lời thoại:

> "Template NetworkPolicy đã mô tả default-deny và allow-list cho các luồng cần thiết: Ingress vào Kong, Kong vào app, app-to-app, app vào Redis/RabbitMQ/Consul/Keycloak và Prometheus scrape metrics. Hiện default tắt để tránh rủi ro demo, nhưng đây là lớp hardening có thể bật sau khi kiểm thử traffic matrix."

## 10. DevSecOps Gate: Trivy, SBOM, Cosign, GHCR

### Mục tiêu demo

Chứng minh security không chỉ nằm trong runtime mà nằm trong pipeline release.

### UI nên show

GitHub Actions:

- Workflow `Main Image Release`.
- Step:
  - `Audit Docker Image with Trivy`
  - `Generate SBOM`
  - `Upload SBOM artifact`
  - `Sign immutable image and attach SBOM attestation`
  - `Verify image signature`

GitHub Packages:

- Show package `luyen-thi-lai-xe-identity-service`.
- Show tag theo Git SHA.

GitHub Releases/Deployments nếu có:

- Show staging/production deployment evidence.

### Source nên show

```text
.github/workflows/ci.yml
docs/devops/github-actions-release-safety.md
```

Command local kiểm tra nhanh:

```powershell
rg -n "Trivy|SBOM|Cosign|cosign|sbom|attest|Verify image signature" .github docs/devops -S
```

Lời thoại:

> "Pipeline build image theo Git SHA bất biến, scan vulnerability bằng Trivy, sinh SBOM để biết image chứa dependency nào, sau đó ký image bằng Cosign. Điều này tạo release artifact có provenance rõ ràng trước khi deploy lên Kubernetes."

## 11. Demo flow gợi ý trong 12-15 phút

### Flow ngắn gọn

1. Lens/k9s: show namespace, pods, services, ingress.
2. Browser: show API docs qua gateway.
3. Keycloak UI: show realm, client, roles, users.
4. API: gọi `/auth/public`, `/auth/private` không token, login và gọi private có token.
5. API/Kong: demo CORS preflight từ frontend origin.
6. VS Code hoặc kubectl: show Kong ConfigMap có route/CORS/rate-limiting.
7. API: logout và test token cũ bị reject nếu có data demo.
8. Lens/kubectl: show Secret names và Pod dùng `secretKeyRef`.
9. Consul UI: show `config/<env>/shared/...`.
10. VS Code: show NetworkPolicy template.
11. GitHub Actions: show Trivy/SBOM/Cosign/GHCR package.

### Lời kết

> "Như vậy, phần bảo mật của hệ thống không chỉ là một đoạn validate token trong code. Hệ thống có nhiều lớp: Keycloak quản lý danh tính, Kong kiểm soát entrypoint public, Redis hỗ trợ revoke token, Consul quản lý config runtime, Kubernetes Secret cô lập secret, NetworkPolicy chuẩn bị cô lập traffic nội bộ, và GitHub Actions bổ sung DevSecOps gate trước khi image được deploy."

## 12. Checklist trước khi demo

- [ ] Cluster đã start nếu đang demo AKS.
- [ ] `kubectl config current-context` đúng cluster.
- [ ] Namespace có pod `Running`.
- [ ] API docs mở được.
- [ ] Frontend gọi được backend HTTPS.
- [ ] Keycloak admin login được.
- [ ] Có user demo để login API.
- [ ] Consul port-forward mở được.
- [ ] GitHub Actions có một run thành công gần đây.
- [ ] Không mở secret value thật khi trình bày.

## 13. Troubleshooting nhanh

### API trả 404

Kiểm tra route qua Kong:

```powershell
kubectl get configmap luyen-thi-lai-xe-kong -n $Namespace -o yaml | Select-String "/auth|identity-service" -Context 2,4
kubectl get ingress -n $Namespace
```

### Browser báo CORS

Kiểm tra frontend origin đã nằm trong `corsOrigins`:

```powershell
kubectl get configmap luyen-thi-lai-xe-config -n $Namespace -o yaml | Select-String "KONG_CORS_ORIGINS|FRONTEND_ORIGIN"
```

### Browser báo Mixed Content

Frontend HTTPS đang gọi backend HTTP. Cần dùng `https://<api-host>` hoặc bật TLS cho Ingress.

### Pod không chạy

```powershell
kubectl get pod -n $Namespace
kubectl describe pod <pod-name> -n $Namespace
kubectl logs <pod-name> -n $Namespace --tail=100
```

### Consul KV không có key

```powershell
kubectl get job -n $Namespace | Select-String "consul-seed"
kubectl logs -n $Namespace job/<consul-seed-job-name>
```

### Secret thiếu key

```powershell
kubectl get secret luyen-thi-lai-xe-secrets -n $Namespace -o yaml
kubectl get deploy luyen-thi-lai-xe-identity-service -n $Namespace -o yaml | Select-String "secretKeyRef" -Context 2,2
```
