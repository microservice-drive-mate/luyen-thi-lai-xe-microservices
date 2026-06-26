# Hướng Dẫn Demo Observability

Tài liệu này dùng để chuẩn bị demo phần **Logging, Metrics, Tracing và Correlation ID** cho hệ thống Luyện Thi Lái Xe Microservices. Mục tiêu là vừa chạy được lệnh, vừa có lời giải thích ngắn gọn để trình bày với thầy.

## 1. Mục Tiêu Demo

Observability trả lời ba câu hỏi vận hành quan trọng:

- **Logs:** request này đã đi qua service nào, lỗi nằm ở đâu?
- **Metrics:** hệ thống có đang khỏe không, service nào tăng lỗi hoặc tăng latency?
- **Traces:** một request mất thời gian ở đoạn nào khi đi qua gateway/service/database/service khác?

Trong codebase hiện tại:

- Mỗi service có `/metrics` qua `packages/common/src/metrics`.
- Mỗi request có `x-correlation-id` qua middleware/interceptor trong `packages/common/src/http`.
- Winston logger tự gắn `correlationId` vào log nếu đang nằm trong request context.
- OpenTelemetry được bật khi có `OTEL_TRACING_ENABLED=true` hoặc có OTLP endpoint.
- Local Docker Compose có ELK, Prometheus, Grafana, Jaeger.
- AKS staging/prod mặc định tắt Prometheus/Grafana/Jaeger để tiết kiệm tài nguyên; có thể bật thủ công bằng Helm values khi cần demo.

## 2. Bản Đồ Thành Phần

| Thành phần | Chạy local | Chạy AKS | Vai trò demo |
|---|---:|---:|---|
| Service `/metrics` | Có | Có | Xuất metric runtime/business/HTTP |
| Prometheus | Có trong Compose | Optional Helm | Scrape `/metrics` |
| Grafana | Có trong Compose | Optional Helm | Dashboard trực quan |
| Jaeger | Có trong Compose | Optional Helm | Xem distributed trace |
| ELK/Kibana | Có trong Compose | Không bật trên AKS Student | Tìm log tập trung |
| Lens/k9s | Không bắt buộc | Có | Xem pod, log, resource realtime |
| Azure Monitor/Log Analytics | Không | Optional Terraform | Logs/metrics cloud-native |

Điểm cần nói rõ với thầy:

> Local là môi trường lab đầy đủ để minh họa toàn bộ stack observability. AKS Student là môi trường production-lite, chỉ bật các thành phần nặng như Prometheus/Grafana/Jaeger khi cần demo để tránh tốn credit.

## 3. Chuẩn Bị Local Demo

### 3.1 Start infrastructure

Nếu bạn muốn demo toàn bộ UI local gồm Kong, ELK, Prometheus, Grafana, Jaeger:

```powershell
docker compose -f docker-compose.infra.yml up -d
```

Kiểm tra container:

```powershell
docker compose -f docker-compose.infra.yml ps
```

Các UI thường dùng:

| UI | URL | Demo gì |
|---|---|---|
| Kong Gateway | `http://localhost:8000` | Gọi API qua gateway |
| RabbitMQ | `http://localhost:15672` | Queue, message, DLQ |
| Consul | `http://localhost:8500` | Centralized config KV |
| Kibana | `http://localhost:5601` | Search log |
| Prometheus | `http://localhost:9090` | Targets, PromQL |
| Grafana | `http://localhost:30000` | Dashboard |
| Jaeger | `http://localhost:16686` | Tracing |

Nếu service chạy bằng terminal thay vì Compose full stack, nhớ bật các biến tracing/logging trước khi start service:

```powershell
$env:OTEL_TRACING_ENABLED="true"
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
$env:OTEL_PROPAGATORS="tracecontext,baggage"
$env:LOGSTASH_ENABLED="true"
$env:LOGSTASH_HOST="127.0.0.1"
$env:LOGSTASH_PORT="5044"
```

Lời dẫn:

> Em đang bật hạ tầng quan sát cục bộ. Các service vẫn chạy như bình thường, nhưng log, metric và trace sẽ được thu thập để kiểm tra sức khỏe hệ thống.

## 4. Demo 1: Correlation ID Và Log Theo Request

### 4.1 Gửi request có correlation ID

```powershell
$CorrelationId = "demo-observability-001"

$res = curl.exe -i "http://localhost:8000/auth/public" `
  -H "x-correlation-id: $CorrelationId"
```

Hoặc nếu muốn lấy header response bằng PowerShell:

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8000/auth/public" `
  -Headers @{ "x-correlation-id" = $CorrelationId }

$response.Headers["x-correlation-id"]
```

Kết quả kỳ vọng:

- Response có header `x-correlation-id`.
- Nếu client gửi sẵn correlation ID, hệ thống giữ lại ID đó.
- Nếu client không gửi, middleware sẽ tự sinh ID mới.

Lời dẫn:

> Correlation ID là mã định danh cho một request. Khi request đi qua gateway và microservice, toàn bộ log liên quan sẽ có cùng mã này. Nhờ vậy khi có lỗi, mình không phải dò log theo thời gian một cách thủ công.

### 4.2 Xem log bằng terminal

Với service chạy local bằng terminal, quan sát console log và tìm:

```text
correlationId=demo-observability-001
```

Với container:

```powershell
docker compose logs identity-service --tail=100
```

### 4.3 Xem log trên Kibana

1. Mở `http://localhost:5601`.
2. Vào **Discover**.
3. Tạo data view nếu Kibana hỏi, ví dụ `logstash-*`.
4. Search:

```text
correlationId : "demo-observability-001"
```

Lời dẫn:

> Đây là centralized logging. Thay vì SSH vào từng container hoặc từng pod, mình search tập trung theo correlation ID để thấy request đã đi qua service nào.

Nếu Kibana chưa có log:

- Chờ Logstash/Elasticsearch khởi động hoàn tất.
- Kiểm tra `LOGSTASH_ENABLED=true`.
- Xem log Logstash:

```powershell
docker compose -f docker-compose.infra.yml logs logstash --tail=100
```

## 5. Demo 2: Metrics Và Prometheus

### 5.1 Xem raw metrics trực tiếp từ service

Gọi qua gateway:

```powershell
curl.exe "http://localhost:8000/auth/metrics"
```

Hoặc gọi thẳng service nếu service đang expose port local:

```powershell
curl.exe "http://localhost:3001/metrics"
```

Kết quả kỳ vọng:

- Trả về text format của Prometheus.
- Có các metric dạng counter/histogram/gauge.

Lời dẫn:

> Mỗi service tự expose endpoint `/metrics`. Prometheus không cần service push dữ liệu, mà định kỳ scrape endpoint này. Đây là mô hình pull model của Prometheus.

### 5.2 Mở Prometheus Targets

1. Mở `http://localhost:9090`.
2. Vào **Status -> Targets**.
3. Quan sát các target:
   - `microservices`
   - `rabbitmq`
   - `prometheus`
   - `dora`

Lời dẫn:

> Trang Targets cho biết Prometheus có scrape được service hay không. Nếu một service down hoặc `/metrics` lỗi, target sẽ chuyển sang DOWN và alert rule có thể kích hoạt.

### 5.3 Chạy PromQL đơn giản

Trong Prometheus, vào tab **Graph** và thử:

```promql
up
```

Ý nghĩa:

- `1`: target scrape thành công.
- `0`: target đang down hoặc không scrape được.

Thử request rate:

```promql
rate(http_requests_total[1m])
```

Thử p95 latency nếu có traffic:

```promql
histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket[5m])))
```

Lời dẫn:

> Metrics giúp mình nhìn hệ thống theo số liệu: request rate, error rate, latency. Đây là nền tảng để thiết lập SLO và cảnh báo.

## 6. Demo 3: Grafana Dashboard

### 6.1 Mở Grafana

Mở:

```text
http://localhost:30000
```

Thông thường tài khoản mặc định của Grafana image là:

```text
admin / admin
```

Nếu Grafana yêu cầu đổi password, có thể skip hoặc đặt password demo.

### 6.2 Mở dashboard

Vào **Dashboards** và chọn các dashboard đã provision trong `docker/grafana/dashboards`:

- Microservices Observability
- Business Metrics
- DORA Metrics

Lời dẫn:

> Grafana không tự thu thập dữ liệu. Nó đọc từ Prometheus và biến số liệu thành dashboard trực quan. Đây là màn hình phù hợp nhất để demo với thầy vì dễ nhìn hơn PromQL raw.

### 6.3 Tạo traffic để dashboard có dữ liệu

Chạy vài request:

```powershell
1..20 | ForEach-Object {
  curl.exe -s "http://localhost:8000/auth/public" | Out-Null
}
```

Sau đó refresh dashboard.

Lời dẫn:

> Khi có traffic, dashboard bắt đầu hiện request rate và latency. Trong production thật, các biểu đồ này giúp phát hiện bất thường sớm.

## 7. Demo 4: Jaeger Tracing

### 7.1 Bật tracing local

Nếu chạy bằng Docker Compose full stack, các service đã có cấu hình OTLP endpoint trong `docker-compose.yaml`.

Nếu chạy service bằng terminal, set biến trước khi start service:

```powershell
$env:OTEL_TRACING_ENABLED="true"
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
$env:OTEL_PROPAGATORS="tracecontext,baggage"
```

Start lại service sau khi set biến.

### 7.2 Gửi request tạo trace

```powershell
curl.exe "http://localhost:8000/auth/public" `
  -H "x-correlation-id: demo-trace-001"
```

Với request cần đăng nhập:

```powershell
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin@test.com","password":"123456"}'

$token = $login.data.accessToken

Invoke-RestMethod -Uri "http://localhost:8000/users/me" -Method GET `
  -Headers @{
    Authorization = "Bearer $token"
    "x-correlation-id" = "demo-trace-users-me"
  }
```

### 7.3 Demo trace liên service bằng Exam flow

Các request như `/auth/public`, `/auth/login`, `/users/me` thường chỉ đi vào một service chính, nên Jaeger chỉ hiện một service là đúng. Để demo distributed tracing qua nhiều service, dùng flow của `exam-service` vì service này có HTTP call nội bộ sang `user-service` và `question-service`.

Flow kỳ vọng:

```text
Kong
 -> exam-service
    -> user-service: GET /users/me
    -> question-service: POST /admin/questions/pool
    -> exam-service: save exam session
```

Đăng nhập bằng student demo:

```powershell
$login = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"student.b1@test.com","password":"123456"}'

$token = $login.data.accessToken

if (-not $token) {
  $login | ConvertTo-Json -Depth 8
  throw "Login response does not contain data.accessToken"
}
```

Gọi API lấy danh sách đề thi khả dụng. API này đã đủ để tạo trace `exam-service -> user-service`:

```powershell
$available = Invoke-RestMethod -Uri "http://localhost:8000/exams/available" -Method GET `
  -Headers @{
    Authorization = "Bearer $token"
    "x-correlation-id" = "demo-trace-exam-available"
  }

$available | ConvertTo-Json -Depth 8
```

Nếu chỉ muốn xem gọn danh sách template:

```powershell
$available.data.items | Select-Object id, name, licenseCategory, totalQuestions
```

Lấy template đầu tiên:

```powershell
$templateId = $available.data.items[0].id
$templateId
```

Nếu `$available.data.items` rỗng, kiểm tra lại seed data hoặc login bằng student có license tier khớp với exam template, ví dụ `student.b1@test.com`.

Start exam session. API này là flow đẹp nhất để demo vì `exam-service` vừa gọi `user-service`, vừa gọi `question-service` để lấy pool câu hỏi:

```powershell
$session = Invoke-RestMethod -Uri "http://localhost:8000/exams/sessions" -Method POST `
  -ContentType "application/json" `
  -Headers @{
    Authorization = "Bearer $token"
    "x-correlation-id" = "demo-trace-start-exam"
  } `
  -Body (@{ templateId = $templateId } | ConvertTo-Json)

$session | ConvertTo-Json -Depth 8
```

Sau đó mở Jaeger và chọn service `exam-service`. Nếu tracing được bật ở đủ `exam-service`, `user-service`, `question-service`, trace có thể hiện nhiều service/span trong cùng một request.

Lời dẫn:

> Đây là ví dụ tốt hơn `/auth/login` vì request không dừng ở một service. `exam-service` phải gọi sang `user-service` để xác thực hồ sơ học viên, sau đó gọi sang `question-service` để lấy pool câu hỏi. OpenTelemetry truyền `traceparent` qua HTTP headers nên Jaeger có thể nối các span lại thành một trace.

Nếu Jaeger vẫn chỉ hiện `exam-service`, kiểm tra log start của các service downstream có dòng tracing enabled không:

```text
[opentelemetry] tracing enabled for user-service
[opentelemetry] tracing enabled for question-service
```

Nếu không có dòng này, nghĩa là service đó chưa bật `OTEL_TRACING_ENABLED=true` hoặc chưa nhận OTLP endpoint, cần set env rồi restart service.

### 7.4 Mở Jaeger UI

1. Mở `http://localhost:16686`.
2. Ở **Service**, chọn service vừa gọi, ví dụ:
   - `identity-service`
   - `user-service`
   - `kong` nếu Kong Zipkin tracing đang bật
3. Click **Find Traces**.
4. Mở một trace để xem timeline.

Lời dẫn:

> Trace cho biết request mất thời gian ở đâu. Log cho biết chuyện gì xảy ra, metrics cho biết hệ thống có bất thường hay không, còn trace cho biết đường đi và độ trễ của từng đoạn xử lý.

### 7.5 Khi không thấy trace trong Jaeger

Kiểm tra:

```powershell
docker compose -f docker-compose.infra.yml ps jaeger
docker compose -f docker-compose.infra.yml logs jaeger --tail=100
```

Kiểm tra service đã bật tracing chưa:

```powershell
$env:OTEL_TRACING_ENABLED
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
```

Nếu chạy bằng terminal, phải restart service sau khi set env.

## 8. Tracing Có Theo Dõi Được Request Và Event Liên Service Không?

Câu trả lời ngắn:

> HTTP inter-service tracing: có thể trace tốt nếu service gọi nhau qua HTTP client đã inject OpenTelemetry context. RabbitMQ event tracing: hiện có correlation ID và consumer span, nhưng chưa nên khẳng định luôn có một distributed trace duy nhất xuyên suốt từ HTTP request sang async event consumer cho mọi event.

Chi tiết:

### 8.1 HTTP request từ service này sang service khác

Codebase có `packages/common/src/http/resilient-http-client.ts`, trong đó OpenTelemetry inject trace context vào HTTP headers:

```typescript
propagation.inject(context.active(), config.headers, traceHeaderSetter);
```

Điều này nghĩa là nếu `exam-service` gọi `question-service` bằng HTTP client này, trace context có thể được truyền sang service tiếp theo. Trên Jaeger, ta có thể thấy các span liên quan nằm chung một trace.

Lời giải thích khi demo:

> Với synchronous HTTP call, OpenTelemetry truyền `traceparent` qua header. Service nhận request sẽ extract header này và nối span mới vào trace cũ.

### 8.2 Event qua RabbitMQ

Codebase hiện có:

- `CorrelationIdInterceptor` đọc correlation ID từ message payload/header.
- Các event publisher dùng `withCorrelationId(event)` để gắn `correlationId` vào payload.
- `TracingInterceptor` tạo span dạng `rabbitmq Class.handler` cho consumer khi tracing bật.
- RabbitMQ retry/DLQ logic giữ lại correlation ID khi retry/dead-letter.

Điều này giúp demo được:

- Event consumer có log cùng `correlationId`.
- Khi message lỗi/retry/DLQ, correlation ID vẫn đi theo message.
- Jaeger có thể thấy span xử lý consumer nếu tracing bật ở consumer service.

Nhưng cần nói cẩn thận:

> Hiện tại hệ thống đã propagation correlation ID rất tốt cho event-driven flow. Với distributed trace xuyên qua RabbitMQ, hệ thống đã có consumer span, nhưng để nối chắc chắn producer span và consumer span vào cùng một trace, bước nâng cấp tiếp theo là inject/extract chuẩn W3C `traceparent` vào RabbitMQ message headers ở producer và consumer.

Đây là câu trả lời senior hơn vì phân biệt rõ:

- **Correlation ID:** dùng để nối log theo request/event.
- **Trace context:** dùng để nối span trong Jaeger thành một trace tree.

## 9. Demo Observability Trên AKS

AKS mặc định có thể đang tắt observability stack để tiết kiệm credit. Trước khi bật, kiểm tra tài nguyên:

```powershell
kubectl config current-context
kubectl top nodes
kubectl top pods -n staging
kubectl get pods -n staging
```

Nếu cluster đang căng CPU/RAM, chỉ demo logs/k9s/Lens và `/metrics`, không bật Prometheus/Grafana.

### 9.1 Demo logs và pods bằng k9s/Lens

```powershell
kubectl get deploy,pod,svc,ingress -n staging
kubectl logs -n staging deploy/luyen-thi-lai-xe-identity-service --tail=100
```

Trong k9s:

- Gõ `:ns`, chọn `staging`.
- Gõ `:pods`.
- Chọn pod rồi nhấn `l` để xem log.
- Nhấn `d` để describe pod nếu pod lỗi.

Lời dẫn:

> Trên Kubernetes, log chuẩn nhất là stdout/stderr của container. k9s và Lens giúp xem realtime nhanh; production thật có thể đẩy tiếp về Azure Monitor hoặc ELK.

### 9.2 Demo `/metrics` trên AKS không cần bật Prometheus

Port-forward một service:

```powershell
kubectl port-forward -n staging svc/luyen-thi-lai-xe-identity-service 3001:3000
```

Mở terminal khác:

```powershell
curl.exe "http://localhost:3001/metrics"
```

Lời dẫn:

> Ngay cả khi chưa bật Prometheus, service vẫn expose `/metrics`. Prometheus chỉ là thành phần scrape và lưu trữ các metric này.

### 9.3 Bật Prometheus/Grafana trên AKS khi cần demo

Chỉ chạy khi cluster còn đủ tài nguyên.

Nếu bạn đang có file values render từ workflow, dùng file đó. Nếu chỉ demo thủ công từ repo:

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  -f charts/luyen-thi-lai-xe/values-azure.example.yaml `
  --reuse-values `
  --set observability.enabled=true `
  --set observability.prometheus.enabled=true `
  --set observability.grafana.enabled=true `
  --timeout 10m
```

Kiểm tra pod:

```powershell
kubectl get pods -n staging | Select-String "prometheus|grafana"
```

Port-forward:

```powershell
kubectl port-forward -n staging svc/luyen-thi-lai-xe-prometheus 9090:9090
kubectl port-forward -n staging svc/luyen-thi-lai-xe-grafana 30000:3000
```

Mở:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:30000`

### 9.4 Bật Jaeger tracing trên AKS khi cần demo

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  -f charts/luyen-thi-lai-xe/values-azure.example.yaml `
  --reuse-values `
  --set tracing.enabled=true `
  --timeout 10m
```

Kiểm tra:

```powershell
kubectl get pods,svc -n staging | Select-String "jaeger"
```

Port-forward:

```powershell
kubectl port-forward -n staging svc/luyen-thi-lai-xe-jaeger 16686:16686
```

Mở:

```text
http://localhost:16686
```

### 9.5 Tắt observability stack sau demo

Để tiết kiệm tài nguyên:

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  -f charts/luyen-thi-lai-xe/values-azure.example.yaml `
  --reuse-values `
  --set observability.enabled=false `
  --set observability.prometheus.enabled=false `
  --set observability.grafana.enabled=false `
  --set observability.alertmanager.enabled=false `
  --set tracing.enabled=false `
  --timeout 10m
```

Kiểm tra đã tắt:

```powershell
kubectl get pods -n staging | Select-String "prometheus|grafana|alertmanager|jaeger"
```

Nếu không có output là đã tắt các pod observability optional.

## 10. Script Nói Khi Demo

Bạn có thể nói theo flow này:

1. **Mở k9s/Lens hoặc Docker ps**

   > Đây là hệ thống microservices đang chạy. Mỗi service expose health check và metrics riêng, còn gateway gom traffic public vào một entrypoint.

2. **Gọi API có correlation ID**

   > Em gắn một `x-correlation-id` vào request. ID này đi theo request để khi lỗi xảy ra có thể search toàn bộ log liên quan.

3. **Mở log/Kibana**

   > Các log được chuẩn hóa dạng JSON và có correlation ID. Đây là cách debug phù hợp với microservices vì một request có thể đi qua nhiều service.

4. **Mở Prometheus Targets**

   > Prometheus scrape `/metrics` định kỳ. Target UP nghĩa là service đang expose metric bình thường; target DOWN là tín hiệu cảnh báo sớm.

5. **Mở Grafana**

   > Grafana trực quan hóa request rate, error rate, latency và business metrics. Đây là dashboard dành cho vận hành và demo tình trạng hệ thống.

6. **Mở Jaeger**

   > Jaeger cho thấy timeline xử lý request. Với HTTP call, trace context có thể nối các service với nhau. Với RabbitMQ, hiện hệ thống đảm bảo correlation ID xuyên suốt event flow, còn trace context qua message header là hướng nâng cấp tiếp theo.

7. **Kết luận**

   > Observability giúp nhóm không chỉ biết hệ thống đang chạy hay không, mà còn biết chạy khỏe không, lỗi ở đâu, và request đi qua những thành phần nào.

## 11. Troubleshooting Nhanh

### Prometheus không thấy target

```powershell
curl.exe "http://localhost:8000/auth/metrics"
docker compose logs prometheus --tail=100
```

Nếu `/metrics` không trả về dữ liệu, kiểm tra service đã chạy chưa.

### Grafana không có dashboard

```powershell
docker compose logs grafana --tail=100
```

Kiểm tra thư mục:

```text
docker/grafana/provisioning
docker/grafana/dashboards
```

### Jaeger không có trace

- Đảm bảo Jaeger đang chạy.
- Đảm bảo service được start sau khi set `OTEL_TRACING_ENABLED=true`.
- Gửi vài request mới sau khi bật tracing.
- Chọn đúng service trong Jaeger UI.

### Kibana không thấy log

- Đợi Elasticsearch/Kibana khởi động đủ lâu.
- Kiểm tra `LOGSTASH_ENABLED=true`.
- Kiểm tra Logstash:

```powershell
docker compose -f docker-compose.infra.yml logs logstash --tail=100
```

### AKS thiếu tài nguyên sau khi bật observability

Tắt ngay optional stack:

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  --reuse-values `
  --set observability.enabled=false `
  --set tracing.enabled=false `
  --timeout 10m
```

Sau đó kiểm tra:

```powershell
kubectl get pods -n staging
kubectl top pods -n staging
```
