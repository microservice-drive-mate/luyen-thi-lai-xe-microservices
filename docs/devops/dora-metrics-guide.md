
<!-- Merged from docs/devops/dora-metrics-guide.md -->
# Đo lường DevOps bằng DORA Metrics

Tài liệu này bổ sung phần **đo lường và đánh giá DevOps** theo nội dung trong file `DevOps_Do_Luong_Danh_Gia.pdf`.

Dự án đã có CI/CD, GHCR, GCP/GKE, Jenkins, Prometheus, Grafana, ELK, backup và runbook. Phần này thêm lớp đo lường để trả lời các câu hỏi:

- Mỗi tuần deploy bao nhiêu lần?
- Từ lúc code được commit đến lúc deploy xong mất bao lâu?
- Khi hệ thống gặp sự cố, mất bao lâu để khôi phục?
- Bao nhiêu deploy gây lỗi hoặc phải rollback?

## 1. Bốn chỉ số DORA

| Chỉ số | Ý nghĩa | Công thức trong dự án |
| --- | --- | --- |
| Deployment Frequency | Tần suất triển khai | Số workflow deploy thành công trong khoảng thời gian đo |
| Lead Time for Changes | Thời gian từ code đến deploy | Thời gian từ commit timestamp đến lúc workflow deploy hoàn tất |
| Mean Time To Recovery | Thời gian khôi phục sự cố | Thời gian từ lúc issue `incident` được tạo đến khi issue được đóng |
| Change Failure Rate | Tỷ lệ thay đổi gây lỗi | Proxy = deploy workflow fail + incident có label `change-failure`, `deploy-failure` hoặc `rollback` / tổng số deploy |

## 2. Nguồn dữ liệu

### GitHub Actions

Script ưu tiên đọc deployment event JSON được sinh sau mỗi lần deploy. Nếu chưa có event, script fallback sang GitHub Actions API để đọc các workflow deploy:

- `Main Image Release`
- `Production Release`
- `Rollback Release`
- `Legacy SSH Compose Deploy`

Các workflow này cho biết:

- deploy chạy lúc nào
- branch/Git SHA nào
- kết quả thành công hay thất bại
- link workflow run
- thời gian hoàn tất deploy

Chi tiết event store nằm ở `docs/devops/deployment-event-store.md`.

### Jenkins

Jenkins cũng ghi deployment event cùng schema sau các stage deploy:

- `Deploy Staging`
- `Deploy Production`

Event Jenkins được archive dưới dạng build artifact:

```text
reports/deployments/events/*.json
```

Khi cần đưa Jenkins data vào DORA report, tải artifact từ Jenkins và đặt vào `reports/deployments/events/`, sau đó chạy `npm run dora:report`.

Chi tiết nằm ở `docs/devops/dora-metrics-guide.md`.

### GitHub Issues

MTTR cần dữ liệu incident. Dự án dùng GitHub issue template:

- `.github/ISSUE_TEMPLATE/incident_report.yml`
- `.github/ISSUE_TEMPLATE/postmortem.yml`

Quy ước:

- Khi có sự cố, tạo issue bằng template `Incident report`.
- Issue incident phải có label `incident`.
- Workflow `Incident Labeler` tự gắn label môi trường, severity và change-failure/rollback dựa trên issue form.
- Đóng issue khi hệ thống đã khôi phục.
- Nếu sự cố do deploy gây ra, thêm label `change-failure`, `deploy-failure` hoặc `rollback`.
- Sau incident lớn, tạo thêm issue `Postmortem`.
- Quy trình chi tiết nằm ở `docs/devops/incident-management-process.md`.

### Monitoring và logs

Prometheus, Grafana, Alertmanager và ELK không trực tiếp thay thế DORA, nhưng là nguồn bằng chứng để phát hiện incident:

- Prometheus alert phát hiện service down, 5xx cao, latency cao, RabbitMQ DLQ/retry backlog.
- Grafana dùng để nhìn xu hướng runtime.
- ELK/Kibana dùng để truy log theo `correlationId`.
- Smoke test xác nhận deploy có chạy được qua Kong hay không.

## 3. Cách chạy báo cáo DORA

Chạy local:

```bash
npm run dora:report
```

Mặc định script đo 30 ngày gần nhất và xuất file:

```text
reports/dora/dora-report.md
reports/dora/dora-report.json
```

Thư mục `reports/dora/` được ignore vì đây là artifact sinh ra sau mỗi lần chạy.

Chạy với cấu hình riêng:

```bash
DORA_DAYS=90 npm run dora:report
```

Trên PowerShell:

```powershell
$env:DORA_DAYS = "90"
npm run dora:report
```

Nếu chạy ngoài GitHub Actions và repo private, cần token có quyền đọc Actions/Issues:

```powershell
$env:GITHUB_TOKEN = "<github-token>"
$env:GITHUB_REPOSITORY = "owner/repo"
npm run dora:report
```

## 4. Workflow tạo báo cáo tự động

Workflow:

```text
.github/workflows/dora-report.yml
```

Workflow này có thể chạy theo 2 cách:

- chạy thủ công bằng `workflow_dispatch`
- chạy định kỳ mỗi thứ hai hằng tuần

Kết quả được upload thành artifact:

```text
dora-report-<run_number>
```

Trong artifact có:

- `dora-report.md`
- `dora-report.json`
- `dora.prom`

## 5. Grafana dashboard cho DORA

DORA Grafana dashboard đã đưa DORA report lên Prometheus/Grafana:

```bash
npm run dora:report
npm run dora:export-prometheus
```

File Prometheus textfile được tạo tại:

```text
reports/dora/dora.prom
```

Prometheus scrape metrics qua job `dora`, rồi Grafana hiển thị dashboard provision sẵn:

```text
Microservices / DORA Metrics
```

Tài liệu chi tiết nằm ở `docs/devops/dora-metrics-guide.md`.

## 6. Cách đọc báo cáo

### Deployment Frequency

Nếu trong 30 ngày có 8 workflow deploy thành công:

```text
Deployment Frequency = 8 / 30 ngày = 1.87 deploy/tuần
```

Theo bảng trong PDF:

- nhiều lần mỗi ngày: Elite
- từ 1 lần/ngày đến 1 lần/tuần: High
- từ 1 lần/tuần đến 1 lần/tháng: Medium
- thấp hơn: Low

### Lead Time for Changes

Script lấy commit timestamp của `head_sha`, sau đó so với thời gian workflow deploy hoàn tất.

Ví dụ:

```text
Commit lúc 09:00
Deploy xong lúc 09:45
Lead Time = 45 phút
```

Lưu ý: đây là proxy ở mức MVP. Nếu muốn chính xác hơn, có thể đo từ lúc PR được mở/merge đến production deploy.

### MTTR

MTTR được tính từ issue incident:

```text
MTTR = closed_at - created_at
```

Ví dụ:

```text
Incident tạo lúc 20:30
Issue đóng lúc 21:05
MTTR = 35 phút
```

Để dữ liệu đúng, team cần đóng issue ngay khi hệ thống đã khôi phục.

### Change Failure Rate

Trong MVP, dự án dùng proxy:

```text
CFR = (deploy workflow fail + incident có label change-failure/deploy-failure/rollback) / tổng số deploy workflow
```

Ví dụ:

```text
Tháng này có 20 deploy
Có 2 deploy fail và 1 incident do rollback
CFR = 3 / 20 = 15%
```

Khi production hóa sâu hơn, nên tách rõ:

- deploy fail trong pipeline
- deploy thành công nhưng gây lỗi runtime
- deploy phải rollback

## 7. Quy trình vận hành khi có sự cố

1. Alert hoặc smoke test phát hiện lỗi.
2. Tạo GitHub issue bằng template `Incident report`.
3. Chọn đúng môi trường và severity trong form.
4. Nếu lỗi do deploy, tick các checkbox change-failure/rollback/deploy-failure.
5. Xử lý theo runbook.
6. Khi hệ thống khôi phục, đóng issue.
7. Với incident `sev1` hoặc `sev2`, tạo thêm issue `Postmortem`.
8. Chạy lại `npm run dora:report` hoặc workflow `DORA Metrics Report`.

## 8. Kịch bản demo với giảng viên

Lời thoại gợi ý:

> Dự án không chỉ có CI/CD và monitoring, mà còn có cơ chế đo lường DevOps theo DORA. GitHub Actions và Jenkins tạo ra deployment data, GitHub Issues ghi nhận incident, còn script `dora:report` tổng hợp thành báo cáo Deployment Frequency, Lead Time for Changes, MTTR và Change Failure Rate.

Demo nhanh:

```bash
npm run dora:report
```

Sau đó mở:

```text
reports/dora/dora-report.md
```

Nếu chạy trên GitHub:

1. Mở tab Actions.
2. Chạy workflow `DORA Metrics Report`.
3. Tải artifact `dora-report-<run_number>`.
4. Chỉ vào bảng tổng quan 4 chỉ số DORA.

## 9. Việc nên làm tiếp

- Ghi deployment event vào database hoặc object storage để không phụ thuộc hoàn toàn vào GitHub Actions history.
- Kết nối sâu Jenkins build history nếu Jenkins là pipeline chính lâu dài.
- Tối ưu sampling/retention cho OpenTelemetry hoặc Jaeger khi chạy production lâu dài.
- Bổ sung business metrics như số lượt làm bài thi, tỷ lệ pass/fail, notification delivery success.
- Tự động kiểm tra postmortem còn mở quá deadline và nhắc owner xử lý.



<!-- Merged from docs/devops/dora-metrics-guide.md -->
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



<!-- Merged from docs/devops/dora-metrics-guide.md -->
# Jenkins DORA Integration

Jenkins DORA integration kết nối Jenkins vào cùng cơ chế đo DORA của dự án.

Sau khi GitHub Actions deploy đã ghi `deployment event` JSON, Jenkins cũng ghi dữ liệu deploy từ self-hosted CI về cùng schema.

## 1. Mục tiêu

- Jenkins deploy staging/production cũng tạo deployment event.
- Event Jenkins có cùng schema với GitHub Actions event.
- Jenkins archive event JSON sau mỗi deploy.
- DORA report có thể đọc event Jenkins nếu event được tải/copy vào `reports/deployments/`.

Điểm quan trọng: Jenkins không cần một hệ thống DORA riêng. Jenkins chỉ cần ghi đúng event JSON, còn `scripts/devops-dora-report.ts` đọc chung.

## 2. File liên quan

- `Jenkinsfile`
- `scripts/devops-record-deployment.js`
- `scripts/devops-dora-report.ts`
- `docs/devops/deployment-event-store.md`
- `docs/devops/jenkins-docker-compose.md`

## 3. Jenkinsfile đã ghi event như thế nào

Trong stage `Deploy Staging` và `Deploy Production`, Jenkins ghi lại thời điểm bắt đầu deploy:

```groovy
script {
  env.DEPLOYMENT_STARTED_AT = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", TimeZone.getTimeZone('UTC'))
}
```

Sau stage deploy, block `post { always { ... } }` luôn chạy để ghi event, kể cả khi deploy fail:

```groovy
post {
  always {
    script {
      withEnv([
        'DEPLOYMENT_SOURCE=jenkins',
        'DEPLOYMENT_PROVIDER=jenkins',
        'DEPLOYMENT_ENVIRONMENT=staging',
        'DEPLOYMENT_TYPE=docker-compose',
        'DEPLOYMENT_TARGET=ssh-vm',
        "DEPLOYMENT_IMAGE_TAG=${env.IMAGE_TAG ?: ''}",
        "DEPLOYMENT_GIT_SHA=${env.GIT_COMMIT ?: env.IMAGE_TAG ?: ''}",
        "DEPLOYMENT_STATUS=${currentBuild.currentResult?.toLowerCase() ?: 'unknown'}",
      ]) {
        sh 'npm run deployment:record || true'
      }
    }
    archiveArtifacts artifacts: 'reports/deployments/events/*.json', allowEmptyArchive: true
  }
}
```

`always()` rất quan trọng vì deploy thất bại cũng là dữ liệu để tính Change Failure Rate.

## 4. Event Jenkins trông như thế nào

Ví dụ event Jenkins:

```json
{
  "schemaVersion": 1,
  "source": "jenkins",
  "provider": "jenkins",
  "workflow": "luyen-thi-lai-xe/main",
  "workflowRunId": "152",
  "workflowRunAttempt": "152",
  "job": "Deploy Staging",
  "environment": "staging",
  "deploymentType": "docker-compose",
  "deploymentTarget": "ssh-vm",
  "gitSha": "df2af3a8eb40...",
  "imageTag": "df2af3a",
  "branch": "main",
  "status": "success",
  "startedAt": "2026-05-31T10:30:00Z",
  "finishedAt": "2026-05-31T10:57:00Z",
  "deployUrl": "https://jenkins.example.com/job/luyen-thi-lai-xe/152/"
}
```

Các giá trị như `BUILD_URL`, `BUILD_NUMBER`, `JOB_NAME`, `BRANCH_NAME`, `GIT_COMMIT` được `scripts/devops-record-deployment.js` tự nhận từ Jenkins nếu có.

## 5. Cách dùng Jenkins artifact trong DORA report

Sau khi Jenkins job chạy xong:

1. Mở Jenkins build.
2. Tải artifact:

```text
reports/deployments/events/*.json
```

3. Đặt các file JSON vào repo local:

```text
reports/deployments/events/
```

4. Chạy:

```bash
npm run dora:report
```

DORA report sẽ đọc event Jenkins cùng với event GitHub Actions.

## 6. Khi nào cần Jenkins API

Cách hiện tại đủ cho MVP/demo vì Jenkins đã archive event JSON. Nếu Jenkins trở thành pipeline chính, nên làm thêm Jenkins API integration:

- Gọi Jenkins REST API để lấy build history.
- Tự tải artifact `reports/deployments/events/*.json`.
- Gom nhiều job Jenkins vào `reports/deployments/`.
- Sau đó chạy `npm run dora:report`.

Endpoint Jenkins thường dùng:

```text
GET /job/<job-name>/<build-number>/api/json
GET /job/<job-name>/<build-number>/artifact/reports/deployments/events/<file>.json
```

## 7. Demo với giảng viên

Lời thoại gợi ý:

> Dự án hỗ trợ cả GitHub Actions và Jenkins. Điểm hay là hai pipeline không tạo hai kiểu dữ liệu khác nhau. Sau deploy, cả hai đều ghi deployment event JSON cùng schema. DORA report chỉ cần đọc event store là có thể tính Deployment Frequency, Lead Time và Change Failure Rate, bất kể deploy đến từ managed CI hay self-hosted CI.

Demo nhanh:

1. Mở `Jenkinsfile`.
2. Chỉ stage `Deploy Staging` hoặc `Deploy Production`.
3. Chỉ block `post { always { ... npm run deployment:record ... } }`.
4. Mở Jenkins build artifact `reports/deployments/events/*.json`.
5. Copy event vào `reports/deployments/events/`.
6. Chạy:

```bash
npm run dora:report
```

## 8. Việc nên làm tiếp

- Tạo script tự tải Jenkins artifacts bằng Jenkins API.
- Thêm Jenkins credentials read-only cho DORA collector.
- Tạo rollback job Jenkins có tham số `IMAGE_TAG` và ghi `DEPLOYMENT_ROLLBACK_OF`.
- Đồng bộ Jenkins event artifacts lên Cloud Storage hoặc database.


