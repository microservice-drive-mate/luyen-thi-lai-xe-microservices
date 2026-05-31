# OpenTelemetry và Jaeger tracing end-to-end

Distributed tracing bổ sung OpenTelemetry/Jaeger để nhìn được một request đi qua **Kong Gateway** và các NestJS microservices như thế nào.

Mục tiêu demo:

- Kong tạo span gateway đầu tiên và gửi vào Jaeger qua Zipkin endpoint.
- App services tạo span xử lý HTTP/RabbitMQ.
- Outbound HTTP tự inject `traceparent` để nối trace giữa các service.
- Jaeger hiển thị toàn bộ trace theo cùng trace id.

## 1. Luồng tracing

```text
Client
  -> Kong Gateway
  -> identity/user/exam/course/... service
  -> service gọi HTTP hoặc publish/consume RabbitMQ
  -> OpenTelemetry OTLP HTTP hoặc Zipkin v2
  -> Jaeger
```

## 2. Thành phần đã thêm

- `packages/common/src/tracing/opentelemetry.ts`: khởi động OpenTelemetry SDK.
- `packages/common/src/tracing/tracing.middleware.ts`: tạo HTTP server span và extract `traceparent`.
- `packages/common/src/tracing/tracing.interceptor.ts`: tạo span cho Nest handler và RabbitMQ consumer.
- `packages/common/src/http/resilient-http-client.ts`: inject trace context vào outbound `fetch`/Axios.
- `kong/kong.yaml` và `kong/kong.dev.yaml`: bật plugin `zipkin` cho Kong để gửi span gateway vào Jaeger.
- `docker-compose.yaml`, `docker-compose.infra.yml`, `docker-compose.deploy.yml`: thêm Jaeger và cấu hình `OTEL_*`.
- `charts/luyen-thi-lai-xe`: thêm Jaeger, cấu hình app pods và Kong trên GKE.

## 3. Cách chạy local bằng Docker Compose full stack

```bash
npm run docker:up
```

Mở Jaeger UI:

```text
http://localhost:16686
```

Gửi request qua Kong:

```bash
curl http://localhost:8000/user-service/health
```

Trong Jaeger:

1. Chọn service `kong`.
2. Bấm `Find Traces`.
3. Mở trace mới nhất.
4. Kiểm tra span của Kong và app service nằm trong cùng trace.

## 4. Cách chạy hybrid local

Khởi động infra:

```bash
npm run infra:up
```

Bật tracing cho services chạy local:

```powershell
$env:OTEL_TRACING_ENABLED = "true"
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "http://localhost:4318/v1/traces"
npm run dev
```

Trên Bash:

```bash
OTEL_TRACING_ENABLED=true \
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces \
npm run dev
```

Kong trong `docker-compose.infra.yml` gửi trace đến Jaeger bằng Zipkin endpoint nội bộ:

```text
http://jaeger:9411/api/v2/spans
```

Services chạy local gửi trace đến:

```text
http://localhost:4318/v1/traces
```

## 5. Cách chạy trên Docker Compose deploy

```bash
docker compose -f docker-compose.deploy.yml --env-file deploy/production.env up -d
```

Jaeger UI mặc định bind private:

```text
http://127.0.0.1:16686
```

Nếu chạy trên Compute Engine/GCP VM, nên truy cập qua SSH tunnel:

```bash
ssh -L 16686:127.0.0.1:16686 deploy@<vm-ip>
```

Sau đó mở:

```text
http://localhost:16686
```

## 6. Cách chạy trên GKE bằng Helm

Chart đã có Jaeger nội bộ khi `tracing.enabled=true`.

Giá trị mặc định:

```yaml
tracing:
  enabled: true
  otlpTracesEndpoint: ""
  kongZipkinEndpoint: ""
  propagators: tracecontext,baggage
  kongSamplingRate: "1.0"
```

Khi `otlpTracesEndpoint` để rỗng, app services tự dùng:

```text
http://<release-name>-jaeger:4318/v1/traces
```

Khi `kongZipkinEndpoint` để rỗng, Kong tự dùng:

```text
http://<release-name>-jaeger:9411/api/v2/spans
```

Port-forward Jaeger UI:

```bash
kubectl port-forward svc/luyen-thi-lai-xe-jaeger 16686:16686 -n staging
```

Mở:

```text
http://localhost:16686
```

## 7. Biến môi trường quan trọng

App services:

```text
OTEL_TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://jaeger:4318/v1/traces
OTEL_PROPAGATORS=tracecontext,baggage
```

Kong:

```text
Kong dùng plugin zipkin trong declarative config.
```

Kong plugin:

```yaml
- name: zipkin
  config:
    http_endpoint: http://jaeger:9411/api/v2/spans
    sample_ratio: 1
```

## 8. Cách kiểm tra nhanh

Kiểm tra container/pod Jaeger:

```bash
docker compose ps jaeger
```

Hoặc trên Kubernetes:

```bash
kubectl get pods -n staging | grep jaeger
kubectl get svc -n staging | grep jaeger
```

Kiểm tra Kong có bật tracing:

```bash
curl http://localhost:8001/status
```

Tạo traffic:

```bash
curl -H "x-correlation-id: demo-trace-001" http://localhost:8000/user-service/health
curl -H "x-correlation-id: demo-trace-002" http://localhost:8000/course-service/health
```

Trong Jaeger, tìm service:

- `kong`
- `user-service`
- `course-service`

## 9. Lời thoại demo với giảng viên

> Ở các phase trước, dự án đã có metrics bằng Prometheus/Grafana và logs bằng ELK. Distributed tracing bổ sung trụ cột thứ ba của observability là traces. Khi client gọi API qua Kong, Kong tạo span gateway và gửi span vào Jaeger qua Zipkin v2 endpoint. Service NestJS tiếp tục tạo span xử lý request, span handler và span message consumer rồi export qua OTLP HTTP về Jaeger, nên nhóm có thể nhìn một request đang chậm ở gateway, service hay dependency nào.

Điểm nên chỉ trên màn hình:

1. `kong/kong.yaml` có plugin `zipkin`.
2. Compose/Helm có Jaeger.
3. Service có biến `OTEL_TRACING_ENABLED=true`.
4. Gửi request qua `localhost:8000`.
5. Mở Jaeger, chọn `kong`, xem trace có span của Kong và service.

## 10. Lưu ý vận hành

- Local mặc định `npm run dev` không bật tracing để tránh log/export lỗi khi chưa chạy Jaeger.
- Muốn bật local tracing thì set `OTEL_TRACING_ENABLED=true`.
- Full Docker, deploy Compose và Helm bật tracing mặc định.
- Sampling hiện đặt `1.0` để demo thấy đủ trace. Production thật nên giảm sampling rate hoặc dùng tail sampling qua OpenTelemetry Collector.
- Jaeger all-in-one phù hợp MVP/demo. Production nên dùng backend tracing bền hơn như Tempo, Jaeger production deployment hoặc managed tracing.
