# DORA Grafana Dashboard

DORA Grafana dashboard đưa DORA report từ file Markdown/JSON lên Grafana để demo trực quan hơn.

Luồng dữ liệu:

```text
GitHub Actions/Jenkins deploy
  -> deployment event JSON
  -> npm run dora:report
  -> reports/dora/dora-report.json
  -> npm run dora:export-prometheus
  -> reports/dora/dora.prom
  -> dora-metrics-exporter
  -> Prometheus
  -> Grafana dashboard DORA Metrics
```

## 1. Thành phần đã thêm

- `scripts/devops-dora-prometheus-export.ts`: chuyển `dora-report.json` sang Prometheus textfile metrics.
- `npm run dora:export-prometheus`: chạy exporter.
- `docker/grafana/dashboards/dora-metrics.json`: dashboard Grafana provision sẵn.
- `docker/prometheus/prometheus.yml` và `docker/prometheus/prometheus.local.yml`: thêm scrape job `dora`.
- `docker-compose.yaml`, `docker-compose.infra.yml`, `docker-compose.deploy.yml`: thêm service `dora-metrics-exporter`.
- `.github/workflows/dora-report.yml`: upload thêm file `.prom` trong artifact DORA.

## 2. Cách chạy local để demo nhanh

Chạy DORA report:

```bash
npm run dora:report
```

Xuất metrics cho Prometheus:

```bash
npm run dora:export-prometheus
```

Kết quả chính:

```text
reports/dora/dora-report.md
reports/dora/dora-report.json
reports/dora/dora.prom
```

Khởi động infra observability:

```bash
npm run infra:up
```

Mở Grafana:

```text
http://localhost:30000
```

Tài khoản mặc định khi chạy local:

```text
admin / admin
```

Vào dashboard:

```text
Microservices / DORA Metrics
```

## 3. Kiểm tra Prometheus đã scrape DORA chưa

Mở Prometheus:

```text
http://localhost:9090
```

Chạy thử các query:

```promql
dora_deployments_per_week
dora_average_lead_time_seconds
dora_change_failure_rate
dora_average_mttr_seconds
dora_deployment_status_total
```

Nếu các query có dữ liệu, Grafana dashboard sẽ hiển thị được.

## 4. Metrics đang export

Nhóm tổng quan:

- `dora_deployments_total`: tổng số lần deploy trong khoảng đo.
- `dora_successful_deployments_total`: tổng số deploy thành công.
- `dora_failed_deployments_total`: tổng số deploy thất bại.
- `dora_deployments_per_day`: số deploy thành công trung bình mỗi ngày.
- `dora_deployments_per_week`: số deploy thành công trung bình mỗi tuần.
- `dora_average_lead_time_seconds`: Lead Time for Changes trung bình.
- `dora_incidents_total`: tổng số incident.
- `dora_resolved_incidents_total`: tổng số incident đã resolve.
- `dora_average_mttr_seconds`: MTTR trung bình.
- `dora_change_failure_rate`: Change Failure Rate, dạng số từ `0` đến `1`.

Nhóm phân tích:

- `dora_deployment_status_total{environment,status,source}`: số deploy theo môi trường, trạng thái và nguồn.
- `dora_latest_deployment_timestamp_seconds{environment,status,source}`: thời điểm deploy gần nhất theo nhóm.
- `dora_incident_severity_total{environment,severity}`: số incident theo severity và môi trường.
- `dora_report_generated_timestamp_seconds`: thời điểm report gần nhất được tạo.

## 5. Cách dùng trên GitHub Actions

Workflow `DORA Metrics Report` hiện chạy:

```bash
npm run dora:report
npm run dora:export-prometheus
```

Artifact `dora-report-<run_number>` sẽ có:

```text
dora-report.md
dora-report.json
dora.prom
```

Nếu muốn đưa artifact này vào Grafana trên máy GCP/Compute Engine, tải artifact về thư mục:

```text
reports/dora/
```

Sau đó restart hoặc để Prometheus scrape lại `dora-metrics-exporter`.

## 6. Cách dùng trên Docker Compose deploy

Trên máy chạy Docker Compose:

```bash
npm run dora:report
npm run dora:export-prometheus
docker compose -f docker-compose.deploy.yml up -d dora-metrics-exporter prometheus grafana
```

Nếu dashboard chưa thấy dữ liệu ngay, chờ 15-30 giây vì Prometheus scrape theo interval.

## 7. Khi demo với giảng viên

Kịch bản nói ngắn gọn:

> Sau khi pipeline deploy xong, dự án ghi deployment event từ GitHub Actions hoặc Jenkins. DORA report tổng hợp thành JSON/Markdown. Nhóm export report đó sang Prometheus metrics, Prometheus scrape qua textfile collector, và Grafana hiển thị bốn chỉ số DORA chính: Deployment Frequency, Lead Time for Changes, Change Failure Rate và MTTR. Nhờ vậy nhóm không chỉ nói pipeline chạy được, mà còn đo được tốc độ và độ ổn định của quy trình delivery.

Các điểm nên chỉ trên màn hình:

1. File `reports/dora/dora.prom` có metrics.
2. Prometheus query `dora_deployments_per_week`.
3. Grafana dashboard `DORA Metrics`.
4. Bốn ô đầu dashboard là bốn chỉ số DORA chính.
5. Panel phía dưới cho biết deploy lỗi, deploy thành công và incident theo severity.

## 8. Lưu ý vận hành

- `reports/dora/` là thư mục runtime, không commit lên Git.
- Dashboard chỉ hiện dữ liệu mới nhất theo file `.prom` hiện có.
- Nếu muốn có lịch sử dài theo thời gian, cần chạy `dora:report` và `dora:export-prometheus` định kỳ để Prometheus scrape các mẫu mới.
- Nếu chạy GitHub Actions là pipeline chính, dùng workflow DORA định kỳ hằng tuần.
- Nếu Jenkins là pipeline chính, tải Jenkins deployment artifacts về trước khi chạy `dora:report`.
