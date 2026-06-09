# Runbook Observability

Tài liệu này dùng khi hệ thống phát cảnh báo từ Prometheus/Alertmanager hoặc khi cần kiểm tra nhanh stack quan sát.

## Thành phần

| Thành phần | URL local | Vai trò |
| --- | --- | --- |
| Prometheus | `http://localhost:9090` | Thu thập metrics và evaluate alert rules |
| Alertmanager | `http://localhost:9093` | Gom nhóm, chống trùng lặp và route cảnh báo |
| Grafana | `http://localhost:30000` | Dashboard service health, request rate, lỗi, latency, CPU/RAM |
| Elasticsearch | `http://localhost:9200` | Lưu log tập trung |
| Kibana | `http://localhost:5601` | Tra cứu log theo `correlationId` |

## Smoke test nhanh

Chạy sau khi `npm run infra:up` hoặc deploy xong:

```powershell
npm.cmd run observability:smoke
```

Nếu muốn kiểm tra thêm `/metrics` của service local:

```powershell
$env:OBS_SERVICE_METRICS_URLS = "http://localhost:3002/metrics,http://localhost:3004/metrics"
npm.cmd run observability:smoke
```

Các biến có thể override:

- `OBS_PROMETHEUS_URL`, mặc định `http://localhost:9090`.
- `OBS_ALERTMANAGER_URL`, mặc định `http://localhost:9093`.
- `OBS_GRAFANA_URL`, mặc định `http://localhost:30000`.
- `OBS_ELASTICSEARCH_URL`, mặc định `http://localhost:9200`.
- `OBS_KIBANA_URL`, mặc định `http://localhost:5601`.
- `OBS_SERVICE_METRICS_URLS`, danh sách URL `/metrics` phân tách bằng dấu phẩy.

## Khi service down

Alert thường gặp:

```text
ServiceMetricsEndpointDown
```

Kiểm tra:

```powershell
docker compose ps
docker compose logs --tail=100 <service-name>
curl.exe http://localhost:9090/targets
```

Hướng xử lý:

- Nếu service container/local process không chạy, khởi động lại service.
- Nếu service chạy nhưng target `DOWN`, kiểm tra port và network target trong `docker/prometheus/prometheus*.yml`.
- Nếu `/health/ready` fail, kiểm tra DB/RabbitMQ/Consul dependency trước khi restart service.

## Khi tỷ lệ lỗi 5xx cao

Alert thường gặp:

```text
HighHttp5xxRate
```

Kiểm tra Grafana panel `5xx Error Ratio`, sau đó tra log theo service:

```text
logType: "access" and statusCode >= 500 and serviceName: "<service-name>"
```

Nếu có `correlationId`, query tiếp trong Kibana:

```text
correlationId: "<correlation-id>"
```

Hướng xử lý:

- Xác định endpoint lỗi từ metric label `route`.
- Mở log cùng `correlationId` để tìm exception gốc.
- Kiểm tra dependency bên dưới như DB, RabbitMQ, Consul, Keycloak.

## Khi latency cao

Alert thường gặp:

```text
HighHttpLatencyP95
```

Kiểm tra:

- Grafana panel `HTTP Latency p95`.
- Prometheus query:

```promql
histogram_quantile(0.95, sum by (service, route, le) (rate(http_request_duration_seconds_bucket[5m])))
```

Hướng xử lý:

- Xác định `route` có latency cao.
- Kiểm tra query DB, call HTTP nội bộ, RabbitMQ hoặc cache Redis.
- Nếu chỉ tăng ở một service, ưu tiên log service đó theo cùng khoảng thời gian.

## Khi CPU/RAM cao

Alert thường gặp:

```text
HighNodeCpuUsage
HighNodeMemoryUsage
```

Kiểm tra:

```powershell
docker stats
docker compose logs --tail=200 <service-name>
```

Hướng xử lý:

- Kiểm tra traffic tăng đột biến qua panel `Request Rate`.
- Kiểm tra lỗi lặp hoặc retry loop trong log.
- Nếu RAM tăng liên tục, restart tạm service và tạo issue điều tra memory leak.

## Routing cảnh báo

Prometheus gửi alert sang Alertmanager:

```text
Prometheus -> Alertmanager -> local webhook placeholder
```

File cấu hình:

- `docker/prometheus/alerts.yml`
- `docker/alertmanager/alertmanager.yml`

Mặc định Alertmanager route cảnh báo tới webhook local:

```text
http://host.docker.internal:9099/alertmanager
```

Khi triển khai thật, thay webhook này bằng endpoint của Slack, Discord, Microsoft Teams hoặc service nhận cảnh báo nội bộ.
