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

Chi tiết event store nằm ở `guides/devops/DEPLOYMENT-EVENT-STORE.md`.

### Jenkins

Jenkins cũng ghi deployment event cùng schema sau các stage deploy:

- `Deploy Staging`
- `Deploy Production`

Event Jenkins được archive dưới dạng build artifact:

```text
reports/deployments/events/*.json
```

Khi cần đưa Jenkins data vào DORA report, tải artifact từ Jenkins và đặt vào `reports/deployments/events/`, sau đó chạy `npm run dora:report`.

Chi tiết nằm ở `guides/devops/JENKINS-DORA-INTEGRATION.md`.

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
- Quy trình chi tiết nằm ở `guides/devops/INCIDENT-POSTMORTEM-PROCESS.md`.

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

Tài liệu chi tiết nằm ở `guides/devops/DORA-GRAFANA-DASHBOARD.md`.

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
