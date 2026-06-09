
<!-- Merged from docs/devops/dora-metrics-guide.md -->
# Äo lÆ°á»ng DevOps báº±ng DORA Metrics

TÃ i liá»‡u nÃ y bá»• sung pháº§n **Ä‘o lÆ°á»ng vÃ  Ä‘Ã¡nh giÃ¡ DevOps** theo ná»™i dung trong file `DevOps_Do_Luong_Danh_Gia.pdf`.

Dá»± Ã¡n Ä‘Ã£ cÃ³ CI/CD, GHCR, GCP/GKE, Jenkins, Prometheus, Grafana, ELK, backup vÃ  runbook. Pháº§n nÃ y thÃªm lá»›p Ä‘o lÆ°á»ng Ä‘á»ƒ tráº£ lá»i cÃ¡c cÃ¢u há»i:

- Má»—i tuáº§n deploy bao nhiÃªu láº§n?
- Tá»« lÃºc code Ä‘Æ°á»£c commit Ä‘áº¿n lÃºc deploy xong máº¥t bao lÃ¢u?
- Khi há»‡ thá»‘ng gáº·p sá»± cá»‘, máº¥t bao lÃ¢u Ä‘á»ƒ khÃ´i phá»¥c?
- Bao nhiÃªu deploy gÃ¢y lá»—i hoáº·c pháº£i rollback?

## 1. Bá»‘n chá»‰ sá»‘ DORA

| Chá»‰ sá»‘ | Ã nghÄ©a | CÃ´ng thá»©c trong dá»± Ã¡n |
| --- | --- | --- |
| Deployment Frequency | Táº§n suáº¥t triá»ƒn khai | Sá»‘ workflow deploy thÃ nh cÃ´ng trong khoáº£ng thá»i gian Ä‘o |
| Lead Time for Changes | Thá»i gian tá»« code Ä‘áº¿n deploy | Thá»i gian tá»« commit timestamp Ä‘áº¿n lÃºc workflow deploy hoÃ n táº¥t |
| Mean Time To Recovery | Thá»i gian khÃ´i phá»¥c sá»± cá»‘ | Thá»i gian tá»« lÃºc issue `incident` Ä‘Æ°á»£c táº¡o Ä‘áº¿n khi issue Ä‘Æ°á»£c Ä‘Ã³ng |
| Change Failure Rate | Tá»· lá»‡ thay Ä‘á»•i gÃ¢y lá»—i | Proxy = deploy workflow fail + incident cÃ³ label `change-failure`, `deploy-failure` hoáº·c `rollback` / tá»•ng sá»‘ deploy |

## 2. Nguá»“n dá»¯ liá»‡u

### GitHub Actions

Script Æ°u tiÃªn Ä‘á»c deployment event JSON Ä‘Æ°á»£c sinh sau má»—i láº§n deploy. Náº¿u chÆ°a cÃ³ event, script fallback sang GitHub Actions API Ä‘á»ƒ Ä‘á»c cÃ¡c workflow deploy:

- `Main Image Release`
- `Production Release`
- `Rollback Release`
- `Legacy SSH Compose Deploy`

CÃ¡c workflow nÃ y cho biáº¿t:

- deploy cháº¡y lÃºc nÃ o
- branch/Git SHA nÃ o
- káº¿t quáº£ thÃ nh cÃ´ng hay tháº¥t báº¡i
- link workflow run
- thá»i gian hoÃ n táº¥t deploy

Chi tiáº¿t event store náº±m á»Ÿ `docs/devops/deployment-event-store.md`.

### Jenkins

Jenkins cÅ©ng ghi deployment event cÃ¹ng schema sau cÃ¡c stage deploy:

- `Deploy Staging`
- `Deploy Production`

Event Jenkins Ä‘Æ°á»£c archive dÆ°á»›i dáº¡ng build artifact:

```text
reports/deployments/events/*.json
```

Khi cáº§n Ä‘Æ°a Jenkins data vÃ o DORA report, táº£i artifact tá»« Jenkins vÃ  Ä‘áº·t vÃ o `reports/deployments/events/`, sau Ä‘Ã³ cháº¡y `npm run dora:report`.

Chi tiáº¿t náº±m á»Ÿ `docs/devops/dora-metrics-guide.md`.

### GitHub Issues

MTTR cáº§n dá»¯ liá»‡u incident. Dá»± Ã¡n dÃ¹ng GitHub issue template:

- `.github/ISSUE_TEMPLATE/incident_report.yml`
- `.github/ISSUE_TEMPLATE/postmortem.yml`

Quy Æ°á»›c:

- Khi cÃ³ sá»± cá»‘, táº¡o issue báº±ng template `Incident report`.
- Issue incident pháº£i cÃ³ label `incident`.
- Workflow `Incident Labeler` tá»± gáº¯n label mÃ´i trÆ°á»ng, severity vÃ  change-failure/rollback dá»±a trÃªn issue form.
- ÄÃ³ng issue khi há»‡ thá»‘ng Ä‘Ã£ khÃ´i phá»¥c.
- Náº¿u sá»± cá»‘ do deploy gÃ¢y ra, thÃªm label `change-failure`, `deploy-failure` hoáº·c `rollback`.
- Sau incident lá»›n, táº¡o thÃªm issue `Postmortem`.
- Quy trÃ¬nh chi tiáº¿t náº±m á»Ÿ `docs/devops/incident-management-process.md`.

### Monitoring vÃ  logs

Prometheus, Grafana, Alertmanager vÃ  ELK khÃ´ng trá»±c tiáº¿p thay tháº¿ DORA, nhÆ°ng lÃ  nguá»“n báº±ng chá»©ng Ä‘á»ƒ phÃ¡t hiá»‡n incident:

- Prometheus alert phÃ¡t hiá»‡n service down, 5xx cao, latency cao, RabbitMQ DLQ/retry backlog.
- Grafana dÃ¹ng Ä‘á»ƒ nhÃ¬n xu hÆ°á»›ng runtime.
- ELK/Kibana dÃ¹ng Ä‘á»ƒ truy log theo `correlationId`.
- Smoke test xÃ¡c nháº­n deploy cÃ³ cháº¡y Ä‘Æ°á»£c qua Kong hay khÃ´ng.

## 3. CÃ¡ch cháº¡y bÃ¡o cÃ¡o DORA

Cháº¡y local:

```bash
npm run dora:report
```

Máº·c Ä‘á»‹nh script Ä‘o 30 ngÃ y gáº§n nháº¥t vÃ  xuáº¥t file:

```text
reports/dora/dora-report.md
reports/dora/dora-report.json
```

ThÆ° má»¥c `reports/dora/` Ä‘Æ°á»£c ignore vÃ¬ Ä‘Ã¢y lÃ  artifact sinh ra sau má»—i láº§n cháº¡y.

Cháº¡y vá»›i cáº¥u hÃ¬nh riÃªng:

```bash
DORA_DAYS=90 npm run dora:report
```

TrÃªn PowerShell:

```powershell
$env:DORA_DAYS = "90"
npm run dora:report
```

Náº¿u cháº¡y ngoÃ i GitHub Actions vÃ  repo private, cáº§n token cÃ³ quyá»n Ä‘á»c Actions/Issues:

```powershell
$env:GITHUB_TOKEN = "<github-token>"
$env:GITHUB_REPOSITORY = "owner/repo"
npm run dora:report
```

## 4. Workflow táº¡o bÃ¡o cÃ¡o tá»± Ä‘á»™ng

Workflow:

```text
.github/workflows/dora-report.yml
```

Workflow nÃ y cÃ³ thá»ƒ cháº¡y theo 2 cÃ¡ch:

- cháº¡y thá»§ cÃ´ng báº±ng `workflow_dispatch`
- cháº¡y Ä‘á»‹nh ká»³ má»—i thá»© hai háº±ng tuáº§n

Káº¿t quáº£ Ä‘Æ°á»£c upload thÃ nh artifact:

```text
dora-report-<run_number>
```

Trong artifact cÃ³:

- `dora-report.md`
- `dora-report.json`
- `dora.prom`

## 5. Grafana dashboard cho DORA

DORA Grafana dashboard Ä‘Ã£ Ä‘Æ°a DORA report lÃªn Prometheus/Grafana:

```bash
npm run dora:report
npm run dora:export-prometheus
```

File Prometheus textfile Ä‘Æ°á»£c táº¡o táº¡i:

```text
reports/dora/dora.prom
```

Prometheus scrape metrics qua job `dora`, rá»“i Grafana hiá»ƒn thá»‹ dashboard provision sáºµn:

```text
Microservices / DORA Metrics
```

TÃ i liá»‡u chi tiáº¿t náº±m á»Ÿ `docs/devops/dora-metrics-guide.md`.

## 6. CÃ¡ch Ä‘á»c bÃ¡o cÃ¡o

### Deployment Frequency

Náº¿u trong 30 ngÃ y cÃ³ 8 workflow deploy thÃ nh cÃ´ng:

```text
Deployment Frequency = 8 / 30 ngÃ y = 1.87 deploy/tuáº§n
```

Theo báº£ng trong PDF:

- nhiá»u láº§n má»—i ngÃ y: Elite
- tá»« 1 láº§n/ngÃ y Ä‘áº¿n 1 láº§n/tuáº§n: High
- tá»« 1 láº§n/tuáº§n Ä‘áº¿n 1 láº§n/thÃ¡ng: Medium
- tháº¥p hÆ¡n: Low

### Lead Time for Changes

Script láº¥y commit timestamp cá»§a `head_sha`, sau Ä‘Ã³ so vá»›i thá»i gian workflow deploy hoÃ n táº¥t.

VÃ­ dá»¥:

```text
Commit lÃºc 09:00
Deploy xong lÃºc 09:45
Lead Time = 45 phÃºt
```

LÆ°u Ã½: Ä‘Ã¢y lÃ  proxy á»Ÿ má»©c MVP. Náº¿u muá»‘n chÃ­nh xÃ¡c hÆ¡n, cÃ³ thá»ƒ Ä‘o tá»« lÃºc PR Ä‘Æ°á»£c má»Ÿ/merge Ä‘áº¿n production deploy.

### MTTR

MTTR Ä‘Æ°á»£c tÃ­nh tá»« issue incident:

```text
MTTR = closed_at - created_at
```

VÃ­ dá»¥:

```text
Incident táº¡o lÃºc 20:30
Issue Ä‘Ã³ng lÃºc 21:05
MTTR = 35 phÃºt
```

Äá»ƒ dá»¯ liá»‡u Ä‘Ãºng, team cáº§n Ä‘Ã³ng issue ngay khi há»‡ thá»‘ng Ä‘Ã£ khÃ´i phá»¥c.

### Change Failure Rate

Trong MVP, dá»± Ã¡n dÃ¹ng proxy:

```text
CFR = (deploy workflow fail + incident cÃ³ label change-failure/deploy-failure/rollback) / tá»•ng sá»‘ deploy workflow
```

VÃ­ dá»¥:

```text
ThÃ¡ng nÃ y cÃ³ 20 deploy
CÃ³ 2 deploy fail vÃ  1 incident do rollback
CFR = 3 / 20 = 15%
```

Khi production hÃ³a sÃ¢u hÆ¡n, nÃªn tÃ¡ch rÃµ:

- deploy fail trong pipeline
- deploy thÃ nh cÃ´ng nhÆ°ng gÃ¢y lá»—i runtime
- deploy pháº£i rollback

## 7. Quy trÃ¬nh váº­n hÃ nh khi cÃ³ sá»± cá»‘

1. Alert hoáº·c smoke test phÃ¡t hiá»‡n lá»—i.
2. Táº¡o GitHub issue báº±ng template `Incident report`.
3. Chá»n Ä‘Ãºng mÃ´i trÆ°á»ng vÃ  severity trong form.
4. Náº¿u lá»—i do deploy, tick cÃ¡c checkbox change-failure/rollback/deploy-failure.
5. Xá»­ lÃ½ theo runbook.
6. Khi há»‡ thá»‘ng khÃ´i phá»¥c, Ä‘Ã³ng issue.
7. Vá»›i incident `sev1` hoáº·c `sev2`, táº¡o thÃªm issue `Postmortem`.
8. Cháº¡y láº¡i `npm run dora:report` hoáº·c workflow `DORA Metrics Report`.

## 8. Ká»‹ch báº£n demo vá»›i giáº£ng viÃªn

Lá»i thoáº¡i gá»£i Ã½:

> Dá»± Ã¡n khÃ´ng chá»‰ cÃ³ CI/CD vÃ  monitoring, mÃ  cÃ²n cÃ³ cÆ¡ cháº¿ Ä‘o lÆ°á»ng DevOps theo DORA. GitHub Actions vÃ  Jenkins táº¡o ra deployment data, GitHub Issues ghi nháº­n incident, cÃ²n script `dora:report` tá»•ng há»£p thÃ nh bÃ¡o cÃ¡o Deployment Frequency, Lead Time for Changes, MTTR vÃ  Change Failure Rate.

Demo nhanh:

```bash
npm run dora:report
```

Sau Ä‘Ã³ má»Ÿ:

```text
reports/dora/dora-report.md
```

Náº¿u cháº¡y trÃªn GitHub:

1. Má»Ÿ tab Actions.
2. Cháº¡y workflow `DORA Metrics Report`.
3. Táº£i artifact `dora-report-<run_number>`.
4. Chá»‰ vÃ o báº£ng tá»•ng quan 4 chá»‰ sá»‘ DORA.

## 9. Viá»‡c nÃªn lÃ m tiáº¿p

- Ghi deployment event vÃ o database hoáº·c object storage Ä‘á»ƒ khÃ´ng phá»¥ thuá»™c hoÃ n toÃ n vÃ o GitHub Actions history.
- Káº¿t ná»‘i sÃ¢u Jenkins build history náº¿u Jenkins lÃ  pipeline chÃ­nh lÃ¢u dÃ i.
- Tá»‘i Æ°u sampling/retention cho OpenTelemetry hoáº·c Jaeger khi cháº¡y production lÃ¢u dÃ i.
- Bá»• sung business metrics nhÆ° sá»‘ lÆ°á»£t lÃ m bÃ i thi, tá»· lá»‡ pass/fail, notification delivery success.
- Tá»± Ä‘á»™ng kiá»ƒm tra postmortem cÃ²n má»Ÿ quÃ¡ deadline vÃ  nháº¯c owner xá»­ lÃ½.



<!-- Merged from docs/devops/dora-metrics-guide.md -->
# DORA Grafana Dashboard

DORA Grafana dashboard Ä‘Æ°a DORA report tá»« file Markdown/JSON lÃªn Grafana Ä‘á»ƒ demo trá»±c quan hÆ¡n.

Luá»“ng dá»¯ liá»‡u:

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

## 1. ThÃ nh pháº§n Ä‘Ã£ thÃªm

- `scripts/devops-dora-prometheus-export.ts`: chuyá»ƒn `dora-report.json` sang Prometheus textfile metrics.
- `npm run dora:export-prometheus`: cháº¡y exporter.
- `docker/grafana/dashboards/dora-metrics.json`: dashboard Grafana provision sáºµn.
- `docker/prometheus/prometheus.yml` vÃ  `docker/prometheus/prometheus.local.yml`: thÃªm scrape job `dora`.
- `docker-compose.yaml`, `docker-compose.infra.yml`, `docker-compose.deploy.yml`: thÃªm service `dora-metrics-exporter`.
- `.github/workflows/dora-report.yml`: upload thÃªm file `.prom` trong artifact DORA.

## 2. CÃ¡ch cháº¡y local Ä‘á»ƒ demo nhanh

Cháº¡y DORA report:

```bash
npm run dora:report
```

Xuáº¥t metrics cho Prometheus:

```bash
npm run dora:export-prometheus
```

Káº¿t quáº£ chÃ­nh:

```text
reports/dora/dora-report.md
reports/dora/dora-report.json
reports/dora/dora.prom
```

Khá»Ÿi Ä‘á»™ng infra observability:

```bash
npm run infra:up
```

Má»Ÿ Grafana:

```text
http://localhost:30000
```

TÃ i khoáº£n máº·c Ä‘á»‹nh khi cháº¡y local:

```text
admin / admin
```

VÃ o dashboard:

```text
Microservices / DORA Metrics
```

## 3. Kiá»ƒm tra Prometheus Ä‘Ã£ scrape DORA chÆ°a

Má»Ÿ Prometheus:

```text
http://localhost:9090
```

Cháº¡y thá»­ cÃ¡c query:

```promql
dora_deployments_per_week
dora_average_lead_time_seconds
dora_change_failure_rate
dora_average_mttr_seconds
dora_deployment_status_total
```

Náº¿u cÃ¡c query cÃ³ dá»¯ liá»‡u, Grafana dashboard sáº½ hiá»ƒn thá»‹ Ä‘Æ°á»£c.

## 4. Metrics Ä‘ang export

NhÃ³m tá»•ng quan:

- `dora_deployments_total`: tá»•ng sá»‘ láº§n deploy trong khoáº£ng Ä‘o.
- `dora_successful_deployments_total`: tá»•ng sá»‘ deploy thÃ nh cÃ´ng.
- `dora_failed_deployments_total`: tá»•ng sá»‘ deploy tháº¥t báº¡i.
- `dora_deployments_per_day`: sá»‘ deploy thÃ nh cÃ´ng trung bÃ¬nh má»—i ngÃ y.
- `dora_deployments_per_week`: sá»‘ deploy thÃ nh cÃ´ng trung bÃ¬nh má»—i tuáº§n.
- `dora_average_lead_time_seconds`: Lead Time for Changes trung bÃ¬nh.
- `dora_incidents_total`: tá»•ng sá»‘ incident.
- `dora_resolved_incidents_total`: tá»•ng sá»‘ incident Ä‘Ã£ resolve.
- `dora_average_mttr_seconds`: MTTR trung bÃ¬nh.
- `dora_change_failure_rate`: Change Failure Rate, dáº¡ng sá»‘ tá»« `0` Ä‘áº¿n `1`.

NhÃ³m phÃ¢n tÃ­ch:

- `dora_deployment_status_total{environment,status,source}`: sá»‘ deploy theo mÃ´i trÆ°á»ng, tráº¡ng thÃ¡i vÃ  nguá»“n.
- `dora_latest_deployment_timestamp_seconds{environment,status,source}`: thá»i Ä‘iá»ƒm deploy gáº§n nháº¥t theo nhÃ³m.
- `dora_incident_severity_total{environment,severity}`: sá»‘ incident theo severity vÃ  mÃ´i trÆ°á»ng.
- `dora_report_generated_timestamp_seconds`: thá»i Ä‘iá»ƒm report gáº§n nháº¥t Ä‘Æ°á»£c táº¡o.

## 5. CÃ¡ch dÃ¹ng trÃªn GitHub Actions

Workflow `DORA Metrics Report` hiá»‡n cháº¡y:

```bash
npm run dora:report
npm run dora:export-prometheus
```

Artifact `dora-report-<run_number>` sáº½ cÃ³:

```text
dora-report.md
dora-report.json
dora.prom
```

Náº¿u muá»‘n Ä‘Æ°a artifact nÃ y vÃ o Grafana trÃªn mÃ¡y GCP/Compute Engine, táº£i artifact vá» thÆ° má»¥c:

```text
reports/dora/
```

Sau Ä‘Ã³ restart hoáº·c Ä‘á»ƒ Prometheus scrape láº¡i `dora-metrics-exporter`.

## 6. CÃ¡ch dÃ¹ng trÃªn Docker Compose deploy

TrÃªn mÃ¡y cháº¡y Docker Compose:

```bash
npm run dora:report
npm run dora:export-prometheus
docker compose -f docker-compose.deploy.yml up -d dora-metrics-exporter prometheus grafana
```

Náº¿u dashboard chÆ°a tháº¥y dá»¯ liá»‡u ngay, chá» 15-30 giÃ¢y vÃ¬ Prometheus scrape theo interval.

## 7. Khi demo vá»›i giáº£ng viÃªn

Ká»‹ch báº£n nÃ³i ngáº¯n gá»n:

> Sau khi pipeline deploy xong, dá»± Ã¡n ghi deployment event tá»« GitHub Actions hoáº·c Jenkins. DORA report tá»•ng há»£p thÃ nh JSON/Markdown. NhÃ³m export report Ä‘Ã³ sang Prometheus metrics, Prometheus scrape qua textfile collector, vÃ  Grafana hiá»ƒn thá»‹ bá»‘n chá»‰ sá»‘ DORA chÃ­nh: Deployment Frequency, Lead Time for Changes, Change Failure Rate vÃ  MTTR. Nhá» váº­y nhÃ³m khÃ´ng chá»‰ nÃ³i pipeline cháº¡y Ä‘Æ°á»£c, mÃ  cÃ²n Ä‘o Ä‘Æ°á»£c tá»‘c Ä‘á»™ vÃ  Ä‘á»™ á»•n Ä‘á»‹nh cá»§a quy trÃ¬nh delivery.

CÃ¡c Ä‘iá»ƒm nÃªn chá»‰ trÃªn mÃ n hÃ¬nh:

1. File `reports/dora/dora.prom` cÃ³ metrics.
2. Prometheus query `dora_deployments_per_week`.
3. Grafana dashboard `DORA Metrics`.
4. Bá»‘n Ã´ Ä‘áº§u dashboard lÃ  bá»‘n chá»‰ sá»‘ DORA chÃ­nh.
5. Panel phÃ­a dÆ°á»›i cho biáº¿t deploy lá»—i, deploy thÃ nh cÃ´ng vÃ  incident theo severity.

## 8. LÆ°u Ã½ váº­n hÃ nh

- `reports/dora/` lÃ  thÆ° má»¥c runtime, khÃ´ng commit lÃªn Git.
- Dashboard chá»‰ hiá»‡n dá»¯ liá»‡u má»›i nháº¥t theo file `.prom` hiá»‡n cÃ³.
- Náº¿u muá»‘n cÃ³ lá»‹ch sá»­ dÃ i theo thá»i gian, cáº§n cháº¡y `dora:report` vÃ  `dora:export-prometheus` Ä‘á»‹nh ká»³ Ä‘á»ƒ Prometheus scrape cÃ¡c máº«u má»›i.
- Náº¿u cháº¡y GitHub Actions lÃ  pipeline chÃ­nh, dÃ¹ng workflow DORA Ä‘á»‹nh ká»³ háº±ng tuáº§n.
- Náº¿u Jenkins lÃ  pipeline chÃ­nh, táº£i Jenkins deployment artifacts vá» trÆ°á»›c khi cháº¡y `dora:report`.



<!-- Merged from docs/devops/dora-metrics-guide.md -->
# Jenkins DORA Integration

Jenkins DORA integration káº¿t ná»‘i Jenkins vÃ o cÃ¹ng cÆ¡ cháº¿ Ä‘o DORA cá»§a dá»± Ã¡n.

Sau khi GitHub Actions deploy Ä‘Ã£ ghi `deployment event` JSON, Jenkins cÅ©ng ghi dá»¯ liá»‡u deploy tá»« self-hosted CI vá» cÃ¹ng schema.

## 1. Má»¥c tiÃªu

- Jenkins deploy staging/production cÅ©ng táº¡o deployment event.
- Event Jenkins cÃ³ cÃ¹ng schema vá»›i GitHub Actions event.
- Jenkins archive event JSON sau má»—i deploy.
- DORA report cÃ³ thá»ƒ Ä‘á»c event Jenkins náº¿u event Ä‘Æ°á»£c táº£i/copy vÃ o `reports/deployments/`.

Äiá»ƒm quan trá»ng: Jenkins khÃ´ng cáº§n má»™t há»‡ thá»‘ng DORA riÃªng. Jenkins chá»‰ cáº§n ghi Ä‘Ãºng event JSON, cÃ²n `scripts/devops-dora-report.ts` Ä‘á»c chung.

## 2. File liÃªn quan

- `Jenkinsfile`
- `scripts/devops-record-deployment.js`
- `scripts/devops-dora-report.ts`
- `docs/devops/deployment-event-store.md`
- `docs/devops/jenkins-docker-compose.md`

## 3. Jenkinsfile Ä‘Ã£ ghi event nhÆ° tháº¿ nÃ o

Trong stage `Deploy Staging` vÃ  `Deploy Production`, Jenkins ghi láº¡i thá»i Ä‘iá»ƒm báº¯t Ä‘áº§u deploy:

```groovy
script {
  env.DEPLOYMENT_STARTED_AT = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", TimeZone.getTimeZone('UTC'))
}
```

Sau stage deploy, block `post { always { ... } }` luÃ´n cháº¡y Ä‘á»ƒ ghi event, ká»ƒ cáº£ khi deploy fail:

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

`always()` ráº¥t quan trá»ng vÃ¬ deploy tháº¥t báº¡i cÅ©ng lÃ  dá»¯ liá»‡u Ä‘á»ƒ tÃ­nh Change Failure Rate.

## 4. Event Jenkins trÃ´ng nhÆ° tháº¿ nÃ o

VÃ­ dá»¥ event Jenkins:

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

CÃ¡c giÃ¡ trá»‹ nhÆ° `BUILD_URL`, `BUILD_NUMBER`, `JOB_NAME`, `BRANCH_NAME`, `GIT_COMMIT` Ä‘Æ°á»£c `scripts/devops-record-deployment.js` tá»± nháº­n tá»« Jenkins náº¿u cÃ³.

## 5. CÃ¡ch dÃ¹ng Jenkins artifact trong DORA report

Sau khi Jenkins job cháº¡y xong:

1. Má»Ÿ Jenkins build.
2. Táº£i artifact:

```text
reports/deployments/events/*.json
```

3. Äáº·t cÃ¡c file JSON vÃ o repo local:

```text
reports/deployments/events/
```

4. Cháº¡y:

```bash
npm run dora:report
```

DORA report sáº½ Ä‘á»c event Jenkins cÃ¹ng vá»›i event GitHub Actions.

## 6. Khi nÃ o cáº§n Jenkins API

CÃ¡ch hiá»‡n táº¡i Ä‘á»§ cho MVP/demo vÃ¬ Jenkins Ä‘Ã£ archive event JSON. Náº¿u Jenkins trá»Ÿ thÃ nh pipeline chÃ­nh, nÃªn lÃ m thÃªm Jenkins API integration:

- Gá»i Jenkins REST API Ä‘á»ƒ láº¥y build history.
- Tá»± táº£i artifact `reports/deployments/events/*.json`.
- Gom nhiá»u job Jenkins vÃ o `reports/deployments/`.
- Sau Ä‘Ã³ cháº¡y `npm run dora:report`.

Endpoint Jenkins thÆ°á»ng dÃ¹ng:

```text
GET /job/<job-name>/<build-number>/api/json
GET /job/<job-name>/<build-number>/artifact/reports/deployments/events/<file>.json
```

## 7. Demo vá»›i giáº£ng viÃªn

Lá»i thoáº¡i gá»£i Ã½:

> Dá»± Ã¡n há»— trá»£ cáº£ GitHub Actions vÃ  Jenkins. Äiá»ƒm hay lÃ  hai pipeline khÃ´ng táº¡o hai kiá»ƒu dá»¯ liá»‡u khÃ¡c nhau. Sau deploy, cáº£ hai Ä‘á»u ghi deployment event JSON cÃ¹ng schema. DORA report chá»‰ cáº§n Ä‘á»c event store lÃ  cÃ³ thá»ƒ tÃ­nh Deployment Frequency, Lead Time vÃ  Change Failure Rate, báº¥t ká»ƒ deploy Ä‘áº¿n tá»« managed CI hay self-hosted CI.

Demo nhanh:

1. Má»Ÿ `Jenkinsfile`.
2. Chá»‰ stage `Deploy Staging` hoáº·c `Deploy Production`.
3. Chá»‰ block `post { always { ... npm run deployment:record ... } }`.
4. Má»Ÿ Jenkins build artifact `reports/deployments/events/*.json`.
5. Copy event vÃ o `reports/deployments/events/`.
6. Cháº¡y:

```bash
npm run dora:report
```

## 8. Viá»‡c nÃªn lÃ m tiáº¿p

- Táº¡o script tá»± táº£i Jenkins artifacts báº±ng Jenkins API.
- ThÃªm Jenkins credentials read-only cho DORA collector.
- Táº¡o rollback job Jenkins cÃ³ tham sá»‘ `IMAGE_TAG` vÃ  ghi `DEPLOYMENT_ROLLBACK_OF`.
- Äá»“ng bá»™ Jenkins event artifacts lÃªn Cloud Storage hoáº·c database.


