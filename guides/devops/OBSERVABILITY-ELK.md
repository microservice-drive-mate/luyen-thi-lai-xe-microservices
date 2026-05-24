# Observability - Logging, ELK, Correlation ID, Metrics và Alerting

Tài liệu này mô tả phần logging tập trung bằng ELK, truy vết request bằng Correlation ID, thu thập metrics bằng Prometheus/Grafana, route cảnh báo bằng Alertmanager và smoke test/runbook vận hành.

## Mục tiêu

- Các NestJS service dùng `AppLoggerModule` từ `@repo/common`.
- Log được enrich tối thiểu bằng `serviceName`, `environment`, `logType`, `timestamp`.
- Access log có thêm `correlationId`, `method`, `path`, `statusCode`, `latencyMs`, `actorId`, `ipAddress`, `userAgent`.
- Logstash nhận log qua HTTP `5044`, parse JSON và đẩy vào Elasticsearch index `microservices-logs-*`.
- Kibana dùng để tìm log theo service, level, `logType` hoặc `correlationId`.
- Kong nhận hoặc tự tạo `x-correlation-id`, forward xuống service và echo lại response.
- Correlation ID được giữ trong request context bằng `AsyncLocalStorage`, tự đi vào application log và RabbitMQ event payload.
- Mỗi service expose endpoint `/metrics` theo định dạng Prometheus.
- Prometheus scrape CPU, RAM, request rate, tỷ lệ lỗi và latency từ các service.
- Grafana tự provision datasource Prometheus và dashboard `Microservices Observability`.
- Prometheus rule cảnh báo khi service down, tỷ lệ lỗi 5xx cao, latency cao, CPU/RAM cao.
- Alertmanager nhận cảnh báo từ Prometheus, gom nhóm và route tới webhook vận hành.
- Có script `npm run observability:smoke` để kiểm tra nhanh Prometheus, Alertmanager, Grafana, Elasticsearch, Kibana và endpoint metrics.

## Thành phần

| Thành phần | Vai trò | URL local |
| --- | --- | --- |
| `AppLoggerModule` | Winston logger chung cho service | N/A |
| `Logstash` | Nhận JSON log qua HTTP và forward sang Elasticsearch | `http://localhost:5044` |
| `Elasticsearch` | Lưu log tập trung | `http://localhost:9200` |
| `Kibana` | Truy vấn và visualize log | `http://localhost:5601` |
| `Prometheus` | Thu thập metrics từ `/metrics` của service | `http://localhost:9090` |
| `Alertmanager` | Gom nhóm, chống trùng lặp và route cảnh báo | `http://localhost:9093` |
| `Grafana` | Dashboard metrics và trạng thái cảnh báo | `http://localhost:30000` |

## Luồng log

```text
NestJS service
  -> AppLoggerModule / Winston HTTP transport
  -> Logstash HTTP input :5044
  -> Elasticsearch index microservices-logs-YYYY.MM.dd
  -> Kibana Discover / Dashboard
```

## Luồng Correlation ID

```text
Client
  -> Kong correlation-id plugin
  -> x-correlation-id header
  -> CorrelationIdMiddleware / CorrelationIdInterceptor
  -> AsyncLocalStorage context
  -> application log + access log + audit event
  -> RabbitMQ event payload correlationId
  -> downstream service log cùng correlationId
```

Quy tắc:

- Nếu client gửi `x-correlation-id`, hệ thống giữ nguyên ID đó.
- Nếu client không gửi, Kong tạo ID mới và service fallback tự tạo ID nếu request không đi qua Kong.
- Response luôn có header `x-correlation-id`.
- Log trong cùng HTTP request hoặc message handler có cùng `correlationId`.
- Event publish qua RabbitMQ được enrich thêm field `correlationId` để service nhận có thể tiếp tục trace.

## Luồng metrics

```text
NestJS service
  -> MetricsModule / prom-client
  -> GET /metrics
  -> Prometheus scrape mỗi 15 giây
  -> Prometheus alert rules
  -> Alertmanager notification routing
  -> Grafana dashboard / Alertmanager UI
```

Metrics chính:

- `http_requests_total`: tổng số HTTP request theo `service`, `method`, `route`, `status_code`, `status_class`.
- `http_request_duration_seconds`: histogram latency HTTP để tính p95/p99.
- `nodejs_process_cpu_seconds_total`: CPU process Node.js.
- `nodejs_process_resident_memory_bytes`: RAM process Node.js.
- `up`: trạng thái Prometheus scrape target.

Endpoint `/metrics` không bị wrap bởi `ApiResponseInterceptor` vì Prometheus cần plain text.

## Chạy local

Hybrid mode:

```powershell
npm.cmd run infra:up
npm.cmd run dev
```

`scripts/dev.ts` tự set:

```text
LOGSTASH_HOST=127.0.0.1
LOGSTASH_PORT=5044
NODE_ENV=development-local
```

Full Docker mode:

```powershell
npm.cmd run docker:up
```

Các service chạy trong Docker dùng `LOGSTASH_HOST=logstash`.

Prometheus/Grafana:

```text
Prometheus: http://localhost:9090
Alertmanager: http://localhost:9093
Grafana: http://localhost:30000
Grafana mặc định local: admin / admin
```

## Verify nhanh

Gửi một request qua Kong:

```powershell
$cid = "demo-observability-" + [guid]::NewGuid().ToString()
curl.exe -H "x-correlation-id: $cid" http://localhost:8000/user-service/health/live
```

Kiểm tra Elasticsearch:

```powershell
curl.exe "http://localhost:9200/microservices-logs-*/_search?q=correlationId:$cid&pretty"
```

Mở Kibana:

```text
http://localhost:5601
```

Tạo data view:

```text
microservices-logs-*
```

Trường thời gian:

```text
@timestamp
```

## Query hữu ích trong Kibana

```text
serviceName: "user-service"
```

```text
logType: "access" and statusCode >= 500
```

```text
correlationId: "demo-observability-*"
```

## Verify Correlation ID

Case 1: Client tự truyền Correlation ID.

```powershell
$cid = "correlation-" + [guid]::NewGuid().ToString()
curl.exe -i -H "x-correlation-id: $cid" http://localhost:8000/user-service/health/live
curl.exe "http://localhost:9200/microservices-logs-*/_search?q=correlationId:$cid&pretty"
```

Kỳ vọng:

- Response header có `x-correlation-id` đúng bằng `$cid`.
- Elasticsearch có access log với `correlationId=$cid`.

Case 2: Client không truyền Correlation ID.

```powershell
curl.exe -i http://localhost:8000/user-service/health/live
```

Kỳ vọng:

- Kong hoặc service tự tạo `x-correlation-id`.
- Dùng giá trị header này để query trong Kibana/Elasticsearch.

Case 3: Request tạo event RabbitMQ.

```powershell
# Gọi một API có publish domain event, ví dụ luồng identity/user/course tùy dữ liệu local.
# Sau đó query cùng correlationId trong log của service publish và service consume.
```

Kỳ vọng:

- Service publish log có `correlationId`.
- Service consume message cũng log cùng `correlationId`.

## Verify Metrics

Kiểm tra metrics endpoint của một service:

```powershell
curl.exe http://localhost:3002/metrics
```

Kỳ vọng:

- Response là Prometheus text format, không phải JSON `{ success, code, data }`.
- Có metric `http_requests_total`, `http_request_duration_seconds`, `nodejs_process_resident_memory_bytes`.

Kiểm tra Prometheus targets:

```text
http://localhost:9090/targets
```

Kỳ vọng:

- Hybrid dev mode dùng targets `host.docker.internal:3001..3011`.
- Full Docker/deploy dùng targets `identity-service:3000`, `user-service:3000`, ...
- Target của service đang chạy có trạng thái `UP`.

Kiểm tra Prometheus alert rules:

```text
http://localhost:9090/alerts
```

Các rule đã cấu hình:

- `ServiceMetricsEndpointDown`: Prometheus không scrape được service quá 2 phút.
- `HighHttp5xxRate`: tỷ lệ HTTP 5xx của service vượt 5% trong 5 phút.
- `HighHttpLatencyP95`: p95 latency vượt 1 giây trong 5 phút.
- `HighNodeMemoryUsage`: process memory vượt 80% host memory trong 5 phút.
- `HighNodeCpuUsage`: CPU process vượt 80% một core trong 5 phút.

Mở Grafana:

```text
http://localhost:30000
```

Dashboard được provision sẵn:

```text
Microservices / Microservices Observability
```

Các panel chính:

- Services Up
- Request Rate
- 5xx Error Ratio
- HTTP Latency p95
- Memory Usage
- CPU Usage
- Firing Alerts

## Verify Alerting

Kiểm tra Prometheus đã kết nối Alertmanager:

```text
http://localhost:9090/status
```

Kiểm tra Alertmanager:

```text
http://localhost:9093
```

Kỳ vọng:

- Alertmanager UI mở được.
- Prometheus có alertmanager target `alertmanager:9093`.
- Cảnh báo firing trong Prometheus được gửi sang Alertmanager.

File cấu hình:

- `docker/prometheus/alerts.yml`: rule cảnh báo.
- `docker/alertmanager/alertmanager.yml`: gom nhóm, inhibit warning khi có critical cùng service và route tới webhook.

Webhook local mặc định:

```text
http://host.docker.internal:9099/alertmanager
```

Khi triển khai thật, thay webhook này bằng Slack/Discord/Teams hoặc webhook nội bộ của team.

## Verify Smoke Test và Runbook

Chạy smoke test cho stack quan sát:

```powershell
npm.cmd run observability:smoke
```

Kiểm tra thêm metrics endpoint của service:

```powershell
$env:OBS_SERVICE_METRICS_URLS = "http://localhost:3002/metrics,http://localhost:3004/metrics"
npm.cmd run observability:smoke
```

Runbook xử lý sự cố nằm ở:

```text
guides/devops/OBSERVABILITY-RUNBOOK.md
```

## Deploy staging/production

`docker-compose.deploy.yml` đã có:

- `elasticsearch`
- `logstash`
- `kibana`
- `prometheus`
- `alertmanager`
- `grafana`
- volume `elasticsearch_data`
- volume `prometheus_data`
- volume `alertmanager_data`
- volume `grafana_data`
- biến logging dùng chung cho service: `LOGSTASH_HOST=logstash`, `LOGSTASH_PORT=5044`, `LOG_CONSOLE_FORMAT=json`

Các file env mẫu có thể chỉnh port public:

```text
ELASTICSEARCH_PORT=9200
LOGSTASH_HOST_PORT=5044
KIBANA_PORT=5601
ALERTMANAGER_PORT=9093
PROMETHEUS_PORT=9090
GRAFANA_PORT=30000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-me
ES_JAVA_OPTS=-Xms512m -Xmx512m
```

Trong production thật, nên giới hạn public access tới Elasticsearch, Logstash và Kibana bằng firewall/VPN/reverse proxy có auth.
Với Grafana/Prometheus cũng nên giới hạn public access tương tự; ít nhất đổi `GRAFANA_ADMIN_PASSWORD` trong file env thật.

## Checklist Logging và ELK

- `npm run infra:up` hoặc `npm run docker:up` khởi động được Elasticsearch, Logstash, Kibana.
- Service gửi log JSON sang Logstash.
- Elasticsearch có index `microservices-logs-*`.
- Kibana query được log theo `serviceName`.
- Access log query được theo `correlationId`.
- Deploy compose có ELK và app services có biến `LOGSTASH_HOST`.

## Checklist Correlation ID

- Kong config có `correlation-id` plugin dùng header `x-correlation-id`.
- CORS cho phép request header và expose response header `x-correlation-id`.
- `CorrelationIdMiddleware` gắn ID vào HTTP request/response.
- `CorrelationIdInterceptor` tạo context cho HTTP và RabbitMQ message handlers.
- `AppLoggerModule` tự enrich application log bằng correlation ID hiện tại.
- RabbitMQ event publisher enrich payload bằng `correlationId`.
- Audit event fallback lấy correlation ID từ request context.

## Checklist Metrics và Dashboard

- `MetricsModule` được dùng chung từ `@repo/common`.
- Tất cả service expose endpoint `/metrics`.
- `ApiResponseInterceptor` bỏ qua `/metrics` để giữ Prometheus text format.
- Prometheus scrape được service metrics ở hybrid mode và full Docker/deploy mode.
- Prometheus có alert rules cho service down, 5xx cao, latency cao, RAM cao, CPU cao.
- Grafana tự provision Prometheus datasource.
- Grafana tự provision dashboard `Microservices Observability`.
- Deploy script upload Prometheus/Grafana config lên server.

## Checklist Alerting

- Prometheus có cấu hình `alerting.alertmanagers`.
- `alertmanager` chạy trong hybrid, full Docker và deploy compose.
- Deploy script upload `docker/alertmanager/alertmanager.yml`.
- File env mẫu có `ALERTMANAGER_PORT`.
- Alertmanager có route mặc định và inhibit rule cơ bản để giảm nhiễu cảnh báo.

## Checklist Smoke Test và Runbook

- Có script `npm run observability:smoke`.
- Smoke test kiểm tra Prometheus ready, alert rules, Alertmanager ready, Grafana health, Elasticsearch health và Kibana status.
- Smoke test hỗ trợ kiểm tra thêm URL `/metrics` qua biến `OBS_SERVICE_METRICS_URLS`.
- Có runbook `guides/devops/OBSERVABILITY-RUNBOOK.md` cho service down, 5xx cao, latency cao, CPU/RAM cao.
