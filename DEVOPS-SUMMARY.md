# Tổng kết hạ tầng DevOps - Luyện Thi Lái Xe Microservices

**Cập nhật lần cuối**: Tháng 05/2026
**Phạm vi đã kiểm tra**: Docker local/hybrid, Docker Compose full stack, Docker Compose deploy legacy, CI/CD, Kubernetes baseline cho GCP/GKE, observability, business metrics, resilience, backup và runbook.

## Tóm tắt điều hành

Repo hiện tại đã đủ tốt cho **MVP/demo trên local hoặc GCP**, đồng thời đã có baseline cho **CI/CD tách luồng, DevSecOps cơ bản, Kubernetes/GKE deployment, observability đủ 3 trụ cột metrics/logs/traces và business metrics**. Nếu đối chiếu theo checklist DevOps trong `DEVOPS (2).docx`, trạng thái tổng quan là:

- **Mức sẵn sàng DevOps cho MVP**: khoảng **90%**.
- **Mức sẵn sàng production day-2 operations**: khoảng **75-80%**.
- **Chưa đạt mức production enterprise hoàn chỉnh**: còn thiếu secret manager chính thức, offsite/PITR backup, load test, HPA và Terraform. SBOM/signing và rollback workflow đã có baseline trên GitHub Actions.

Kết quả kiểm tra tĩnh trước đó:

- `docker compose -f docker-compose.infra.yml config --quiet`: pass.
- `docker compose -f docker-compose.yaml config --quiet`: pass.
- `docker compose -f docker-compose.deploy.yml --env-file deploy/production.env.example config --quiet`: pass.

Ghi chú: `DEVOPS-ASSESSMENT.md` là bản đánh giá baseline chi tiết từ nhánh DevOps mới trên `main`. File này là bản tổng kết ngắn gọn bằng tiếng Việt có dấu để phục vụ README/báo cáo.

## Mốc cơ sở service

Luồng production/staging hiện chốt **10 application services**:

- `identity-service`
- `user-service`
- `exam-service`
- `course-service`
- `question-service`
- `notification-service`
- `analytics-service`
- `simulation-service`
- `media-service`
- `audit-service`

`docs-service` dùng cho Swagger/docs aggregation ở môi trường dev hoặc nội bộ. Service này **không nằm trong luồng staging/production deploy** hiện tại.

## Phần đã hoàn thành

### Containerization & Docker

- Mỗi app service production có Dockerfile riêng trong `apps/*/Dockerfile`.
- Full stack có `docker-compose.yaml`.
- Hybrid local có `docker-compose.infra.yml`.
- Docker Compose deploy legacy có `docker-compose.deploy.yml` cho trường hợp cần chạy trên VM/Compute Engine.
- Runtime images đã được harden thêm:
  - prune dev dependencies.
  - loại `npm`, `npx`, `corepack`, `yarn` khỏi runtime image để giảm CVE surface.
- Có `Dockerfile.migration-runner` để chạy Prisma migration ngoài application runtime container.

### Infrastructure Foundation

- Database-per-service bằng PostgreSQL.
- RabbitMQ 3 management + Prometheus plugin.
- Redis cho token blacklist/cache.
- Consul dùng làm KV config store và service config seed.
- Keycloak có realm import/export.
- Kong chạy DB-less gateway, có cấu hình riêng cho hybrid dev và Docker/deploy.

### Configuration & Environment

- Root env templates:
  - `.env.example`
  - `.env.vps.example` (legacy cho luồng VM/SSH cũ)
  - `deploy/staging.env.example`
  - `deploy/production.env.example`
- Consul seed files theo môi trường:
  - `consul-seed-development-local.json`
  - `consul-seed-development.json`
  - `consul-seed-staging.json`
  - `consul-seed-production.json`
- `scripts/consul-seed.ts` hỗ trợ env interpolation.
- `docker/consul/init.sh` không crash khi thiếu media storage optional.
- Thứ tự ưu tiên config trong code: env > Consul > default.
- `.gitignore` đã chặn `.env`, `*.env`, `backups/`.

### Database Lifecycle

- Root scripts đã có:
  - `npm run db:generate`
  - `npm run db:deploy`
  - `npm run db:seed`
  - `npm run db:backup:local`
  - `npm run db:restore:test`
- CI có staging migration job trên branch `staging`.
- Docker Compose deploy dùng `migration-runner` để chạy `prisma migrate deploy`.
- Kubernetes baseline có Prisma migration Job riêng trong Helm chart.

### CI/CD & DevSecOps

- GitHub Actions đã tách luồng:
  - `.github/workflows/pr-validation.yml`: validate PR vào `main`, chạy quality gate, detect changed services, build image và Trivy scan, không push image.
  - `.github/workflows/ci.yml`: main image release, quality gate, build + Trivy scan đủ 10 production services, push GHCR với `${github.sha}` và `latest`, rồi auto deploy GCP staging bằng Helm. Có thể tắt auto deploy bằng repository variable `GCP_AUTO_DEPLOY_ENABLED=false`.
  - `.github/workflows/production-release.yml`: production release thủ công bằng immutable `image_tag`, gắn GitHub Environment `production`.
  - `.github/workflows/rollback-release.yml`: rollback Helm release thủ công theo revision cho `staging` hoặc `production`, có smoke test và deployment event.
  - `.github/workflows/devops-smoke.yml`: smoke suites cho observability, RabbitMQ resilience và restore test.
- Jenkins:
  - `Jenkinsfile` có lint, typecheck, test, build, image push, staging deploy và production manual approval.
  - Vai trò hiện tại là pipeline tự host/legacy cho Docker Compose deploy qua SSH/VM hoặc Compute Engine; GitHub Actions vẫn là đường chính cho GCP/GKE bằng Helm.
- Đo lường DevOps theo DORA:
  - `.github/workflows/dora-report.yml`: chạy thủ công hoặc định kỳ hằng tuần để tạo DORA report artifact.
  - `.github/workflows/incident-labeler.yml`: tự gắn label môi trường, severity và change-failure/rollback cho incident issues.
  - `scripts/devops-record-deployment.js`: ghi deployment event JSON sau mỗi lần deploy.
  - `scripts/devops-dora-report.ts`: tổng hợp Deployment Frequency, Lead Time for Changes, MTTR và Change Failure Rate từ GitHub Actions và incident issues.
  - `scripts/devops-dora-prometheus-export.ts`: export DORA JSON sang Prometheus textfile metrics để Grafana hiển thị.
  - `Jenkinsfile`: ghi Jenkins deployment event sau `Deploy Staging` và `Deploy Production`, rồi archive artifact cho DORA.
  - `.github/ISSUE_TEMPLATE/incident_report.yml` và `.github/ISSUE_TEMPLATE/postmortem.yml`: chuẩn hóa dữ liệu incident/postmortem để tính MTTR/CFR.
  - `guides/devops/INCIDENT-POSTMORTEM-PROCESS.md`: quy trình cho incident severity, label chuẩn và postmortem bắt buộc với SEV1/SEV2.
  - `guides/devops/DEPLOYMENT-EVENT-STORE.md`: quy trình để lưu deployment events và giảm phụ thuộc vào GitHub Actions history.
  - `guides/devops/JENKINS-DORA-INTEGRATION.md`: quy trình để gom Jenkins deploy vào cùng DORA event schema.
  - `guides/devops/DORA-GRAFANA-DASHBOARD.md`: quy trình đưa DORA metrics lên Prometheus/Grafana.
- DevSecOps baseline:
  - Trivy image scan với `severity: CRITICAL,HIGH`, `exit-code: 1`.
  - GitHub Actions sinh SBOM SPDX JSON cho image và upload artifact.
  - GitHub Actions ký immutable image tag `${github.sha}` bằng Cosign keyless signing, gắn SBOM attestation và verify chữ ký.
  - PR thay đổi DevOps/shared files sẽ build/scan đủ 10 production services.
  - Hardcoded secrets trong Compose/Consul seed đã được chuyển dần sang env variable hoặc placeholder.
- Registry:
  - GHCR image naming: `ghcr.io/<owner>/luyen-thi-lai-xe-<service>:<tag>`.
  - GCP/GKE chỉ pull image đã có từ GHCR khi deploy; source code không build trên GCP.

### Deployment Runtime

- Docker Compose runtime:
  - local/hybrid.
  - full Docker stack.
  - Docker Compose deploy legacy qua SSH/VM.
- Kubernetes baseline:
  - Helm chart tại `charts/luyen-thi-lai-xe`.
  - Target hiện tại: GCP/GKE.
  - K3s chỉ còn là lựa chọn lab/fallback nếu cần thử nhanh ngoài GCP.
  - Deploy 10 production services, Kong, Keycloak, PostgreSQL, RabbitMQ, Redis và Consul.
  - Kubernetes `Secret` dùng cho password/token/storage.
  - Consul seed Job chỉ seed non-secret config.
  - App Deployments có `resources.requests`, `resources.limits`, `/health/live` và `/health/ready` probes.
  - GitHub Actions deploy staging/production bằng Helm và kubeconfig base64.
  - `scripts/k8s-smoke.sh` verify health endpoints qua Kong.
- Hướng dẫn chi tiết: `guides/devops/KUBERNETES-GCP-DEPLOYMENT.md`.

### Observability

- App-level health endpoints đã được đồng bộ qua `HealthModule`:
  - `/health`
  - `/health/live`
  - `/health/ready`
- App metrics expose qua `MetricsModule`:
  - `/metrics`
  - HTTP request count/latency/status class.
  - Node/process metrics từ `prom-client`.
  - RabbitMQ retry/DLQ metrics.
- Distributed tracing:
  - `packages/common/src/tracing/`: khởi động OpenTelemetry SDK, HTTP tracing middleware và Nest/RabbitMQ tracing interceptor.
  - Kong bật plugin `zipkin` trong `kong/kong.yaml`, `kong/kong.dev.yaml` và Helm ConfigMap để gửi span gateway vào Jaeger.
  - Jaeger được thêm vào Docker Compose và Helm chart để xem trace end-to-end.
  - `resilientFetch`/Axios resilience tự inject `traceparent` cho outbound HTTP.
- Prometheus scrape config:
  - `docker/prometheus/prometheus.yml`
  - `docker/prometheus/prometheus.local.yml`
- DORA dashboard:
  - `docker/grafana/dashboards/dora-metrics.json`
  - `dora-metrics-exporter` đọc `reports/dora/dora.prom` qua textfile collector.
- Business metrics:
  - `users_created_total`: số user profile mới theo role và nguồn tạo.
  - `exam_sessions_started_total`: số lượt học viên bắt đầu bài thi theo hạng bằng.
  - `exam_sessions_completed_total`: số lượt nộp bài theo pass/fail, trạng thái và lỗi câu điểm liệt.
  - `course_lessons_completed_total` và `course_enrollments_completed_total`: tiến độ hoàn tất bài học/khóa học.
  - `notifications_delivery_total`: kết quả gửi notification theo kênh, event và trạng thái.
  - `media_upload_total`: kết quả upload media theo mode, MIME type và trạng thái.
  - Dashboard Grafana: `docker/grafana/dashboards/business-metrics.json`.
  - Hướng dẫn: `guides/devops/BUSINESS-METRICS.md`.
- Hướng dẫn tracing nằm ở `guides/devops/OPENTELEMETRY-JAEGER-TRACING.md`.
- Alert rules:
  - service metrics endpoint down.
  - high 5xx rate.
  - high p95 latency.
  - high Node memory/CPU.
  - RabbitMQ DLQ/retry backlog.
- Grafana provisioning:
  - datasource Prometheus.
  - dashboard `microservices-observability.json`.
  - dashboard `dora-metrics.json`.
  - dashboard `business-metrics.json`.
- ELK:
  - Elasticsearch, Logstash, Kibana trong Compose.
  - `AppLoggerModule` dùng Winston + optional HTTP transport tới Logstash.
  - `AccessLogInterceptor` và correlation id đã gắn vào service bootstrap.

### Resilience

- HTTP resilience helper trong `packages/common/src/http/resilient-http-client.ts`:
  - timeout.
  - retry có giới hạn.
  - circuit breaker có open window.
- RabbitMQ resilience trong `packages/common/src/messaging/rabbitmq-resilience.ts`:
  - durable queue.
  - `noAck: false`.
  - retry queues với TTL backoff.
  - DLQ.
  - idempotency memory TTL.
  - metrics cho success/retry/DLQ.
- Smoke script:
  - `npm run rabbitmq:smoke`.

### Backup, Restore & Runbooks

- PostgreSQL daily backup service:
  - `docker/backup/postgres-daily-backup.sh`.
  - `postgres-backup` trong infra/deploy compose.
- Keycloak export backup service:
  - `docker/keycloak/keycloak-daily-export.sh`.
  - `keycloak-backup` trong infra/deploy compose.
- Retention:
  - daily retention qua `BACKUP_RETENTION_DAYS`.
  - weekly snapshot qua `BACKUP_WEEKLY_RETENTION_WEEKS`.
- Restore rehearsal:
  - `npm run db:restore:test`.
- Tài liệu:
  - `guides/devops/BACKUP-STRATEGY.md`
  - `guides/devops/INCIDENT-RUNBOOK.md`
  - `guides/devops/OBSERVABILITY-RUNBOOK.md`
  - `guides/devops/RABBITMQ-RESILIENCE.md`
  - `guides/devops/HTTP-RESILIENCE.md`
  - `guides/devops/JENKINS-DOCKER-COMPOSE.md`
  - `guides/devops/KUBERNETES-GCP-DEPLOYMENT.md`
  - `guides/devops/GCP-SETUP.md`
  - `guides/devops/BUSINESS-METRICS.md`
  - `guides/devops/GITHUB-ACTIONS-RELEASE-SAFETY.md`
  - `guides/devops/DEVOPS-DEMO-SCRIPT.md`

## Phần còn thiếu

### P0/P1 - Security hardening còn lại

- Chưa có secret manager chính thức như Google Secret Manager hoặc Vault.
- SBOM và Cosign signing đã có baseline trong GitHub Actions; chưa có admission policy bắt buộc verify signature ở Kubernetes.
- Chưa có provenance policy đầy đủ ở runtime.
- Nếu secret thật từng bị paste/push, cần rotate ngoài repo.

### P1 - Release hardening còn lại

- Main workflow vẫn push cả `${github.sha}` và `latest`; production release đã dùng immutable `image_tag`, nhưng cần policy vận hành rõ ràng: production chỉ chọn SHA/release tag đã pass.
- Production approval trên GitHub phụ thuộc Environment protection rule ngoài repo; cần cấu hình reviewer trong GitHub Environments.
- Rollback đã có workflow GitHub Actions theo Helm revision; cần chạy thử trên staging thật và lưu bằng chứng rollback pass.

### P1 - Runtime verification

- Đã có smoke tests, nhưng nên chạy thực tế sau deploy và lưu bằng chứng pass/fail theo mỗi lần release.
- Cần chạy lại smoke trên môi trường GKE/staging thật sau khi merge để xác nhận DNS, ingress và health endpoint ổn định.

### P2 - Scaling & IaC

Chưa có:

- Terraform modules.
- HPA.
- k6/JMeter/Locust load test.
- nightly performance regression gate.

### P3 - Advanced DR / Multi-region

Chưa có:

- backup offsite lên Google Cloud Storage.
- PITR managed database.
- multi-region deploy/failover.
- cross-region RabbitMQ/Consul strategy.

## Ma trận hoàn thành

| Hạng mục | Trạng thái | Mức hoàn thành | Ghi chú |
| --- | --- | ---: | --- |
| Docker & Compose | Đã làm | 95% | 10 app services deploy đủ; `docs-service` dev-only. |
| Local/dev bootstrap | Đã làm | 90% | README có first-run flow. |
| Database migration/seed | Đã làm | 90% | CI/deploy có migration path; Kubernetes có migration Job. |
| CI/CD | Đã làm nền | 90% | PR validation, main image release, production manual release và rollback workflow đã có. |
| DevSecOps baseline | Đã làm nền | 82% | Trivy HIGH/CRITICAL gate, SBOM artifact và Cosign signing có; secret manager/admission policy còn thiếu. |
| Compose deployment legacy | Đã làm | 85% | Compose deploy + migrations + health smoke; dùng cho VM/Compute Engine nếu cần fallback. |
| Kubernetes baseline | Đã làm nền | 70% | Helm/GKE scaffold có; HPA/load test/Terraform còn thiếu. |
| Observability | Đã làm | 90% | Prometheus/Grafana/ELK/alerts/tracing/DORA/business metrics có; cần verify runtime trên GKE thật. |
| Health/metrics/logging | Đã làm | 90% | Đã đồng bộ common modules. |
| HTTP/RabbitMQ resilience | Đã làm | 85% | Retry/DLQ/circuit breaker có; idempotency durable còn là follow-up. |
| Backup/restore/runbook | Đã làm | 80% | Daily backup + restore test có; offsite/PITR còn thiếu. |
| Secrets management | Một phần | 50% | Env templates/K8s secrets có; external secret manager chưa có. |
| IaC | Còn thiếu | 20% | Docker Compose/Helm là IaC mức app-runtime; Terraform chưa có. |
| Load test/autoscaling | Còn thiếu | 10% | Probes/resources có; chưa có k6/JMeter/HPA. |
| Multi-region | Còn thiếu | 0% | Post-MVP. |

## Việc nên làm tiếp

### Làm ngay

1. Cấu hình GitHub Environments:
   - `staging` cho deploy tự động nếu bật.
   - `production` với required reviewers/manual approval.
2. Verify workflow YAML sau merge:
   - PR Validation.
   - Main Image Release.
   - Production Release.
3. Chạy `helm lint` và `helm template` cho chart `charts/luyen-thi-lai-xe`.
4. Chạy smoke test trên môi trường staging/GKE thật qua Kong.
5. Làm theo checklist GCP trong `guides/devops/GCP-SETUP.md` trước khi mở public DNS/TLS.

### Gần hạn

1. Chạy thử `Rollback Release` trên staging thật và lưu bằng chứng smoke pass.
2. Thêm admission policy hoặc Kyverno/Gatekeeper rule để chỉ cho chạy image đã ký Cosign nếu harden sâu hơn.
3. Đẩy backup offsite lên S3/Azure Blob và document restore từ offsite.
4. Thêm k6 smoke/load script cho các luồng chính: login, làm bài thi, nộp bài, upload media.
5. Thêm alert hoặc dashboard panel nâng cao cho business metrics, ví dụ pass rate giảm mạnh, notification failure tăng hoặc upload media lỗi bất thường.

### Sau MVP

1. Terraform cho GCP resources: GKE, Artifact/GHCR access, DNS, static IP, service accounts và secret wiring.
2. HPA và autoscaling policy.
3. Managed database/PITR, ưu tiên Cloud SQL nếu deploy production thật.
4. Multi-region/failover nếu có nhu cầu production lớn.

## Lệnh nhanh

```bash
# Local hybrid
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev

# Full Docker
npm run docker:build
npm run docker:up

# Quality
npm run lint
npm run check-types
npm run build

# DevOps smoke
npm run smoke
npm run observability:smoke
npm run rabbitmq:smoke
npm run db:restore:test

# Backup one-shot
npm run db:backup:once
npm run keycloak:backup:once

# Kubernetes baseline
helm lint charts/luyen-thi-lai-xe
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml
```
