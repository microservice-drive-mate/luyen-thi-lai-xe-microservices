
<!-- Merged from docs/devops/devops-status-report.md -->
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
  - `pnpm run db:generate`
  - `pnpm run db:deploy`
  - `pnpm run db:seed`
  - `pnpm run db:backup:local`
  - `pnpm run db:restore:test`
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
  - `docs/devops/incident-management-process.md`: quy trình cho incident severity, label chuẩn và postmortem bắt buộc với SEV1/SEV2.
  - `docs/devops/deployment-event-store.md`: quy trình để lưu deployment events và giảm phụ thuộc vào GitHub Actions history.
  - `docs/devops/dora-metrics-guide.md`: quy trình để gom Jenkins deploy vào cùng DORA event schema.
  - `docs/devops/dora-metrics-guide.md`: quy trình đưa DORA metrics lên Prometheus/Grafana.
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
- Hướng dẫn chi tiết: `docs/devops/kubernetes-gcp-deployment.md`.

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
  - Hướng dẫn: `docs/devops/business-metrics.md`.
- Hướng dẫn tracing nằm ở `docs/devops/opentelemetry-jaeger-tracing.md`.
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
  - `pnpm run rabbitmq:smoke`.

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
  - `pnpm run db:restore:test`.
- Tài liệu:
  - `docs/devops/backup-strategy.md`
  - `docs/devops/incident-management-process.md`
  - `docs/devops/observability-runbook.md`
  - `docs/devops/system-resilience-guide.md`
  - `docs/devops/system-resilience-guide.md`
  - `docs/devops/jenkins-docker-compose.md`
  - `docs/devops/kubernetes-gcp-deployment.md`
  - `docs/devops/gcp-setup.md`
  - `docs/devops/business-metrics.md`
  - `docs/devops/github-actions-release-safety.md`
  - `docs/devops/devops-demo-script.md`

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
5. Làm theo checklist GCP trong `docs/devops/gcp-setup.md` trước khi mở public DNS/TLS.

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
pnpm run infra:up
pnpm run consul:seed:local
pnpm run db:generate
pnpm run db:deploy
pnpm run db:seed
pnpm run dev

# Full Docker
pnpm run docker:build
pnpm run docker:up

# Quality
pnpm run lint
pnpm run check-types
pnpm run build

# DevOps smoke
pnpm run smoke
pnpm run observability:smoke
pnpm run rabbitmq:smoke
pnpm run db:restore:test

# Backup one-shot
pnpm run db:backup:once
pnpm run keycloak:backup:once

# Kubernetes baseline
helm lint charts/luyen-thi-lai-xe
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml
```



<!-- Merged from DEVOPS-ASSESSMENT.md -->
# Đánh giá DevOps - Luyện Thi Lái Xe Microservices

**Ngày cập nhật**: 2026-05-27
**Branch gốc**: `devops/baseline-local-stability`
**Commit CI đã xác minh trước đó**: `2265ae813da9294db4bd7276c693b7d0db7748de`
**Ghi chú**: `docs/devops/devops-status-report.md` là bản tổng kết ngắn gọn/lạc quan hơn. File này ghi lại baseline chi tiết hơn để tiếp tục các phase DevOps.

## 1. Kết luận nhanh

Dự án đã chốt baseline:

- Production scope: **10 services**.
- `docs-service`: **chỉ dùng cho dev**, không đưa vào staging/production.
- Development có thể chạy 11 services nếu cần `docs-service`.
- Staging/production Consul seed và deploy chỉ gồm 10 production services.

Trạng thái hiện tại:

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Phase 0 Baseline | Đã xong | README đã mô tả local/full-stack, production 10 services, `docs-service` dev-only. |
| Phase 1 Local/Dev | Gần xong | `.env.example`, deploy env examples, Consul seed optional media storage, health endpoints và AppLogger đã có trên services. Runtime smoke cần chạy lại khi Docker Desktop/DNS ổn định. |
| Phase 3 DevSecOps | Đã đủ baseline | CI run #154 pass trên commit `2265ae8`; 10 production images build + Trivy HIGH/CRITICAL scan success. |
| Phase 4 CI/CD | Đang hoàn thiện | Đã tách PR validation, main image release, auto deploy GCP staging và production release manual; cần GitHub Actions verify sau khi merge. |
| Phase 5 Deployment Runtime | Đang hoàn thiện | Kubernetes Helm path đã scaffold và target chính đã đổi sang GCP/GKE: app services, in-cluster dependencies, Ingress, probes, resources, Consul seed và Prisma migration Job. K3s/VPS chỉ còn là lab/fallback legacy. |
| Phase 9 IaC/Scaling | Chưa làm | Chưa có `terraform`, HPA hoặc load test; các phần này tách khỏi Phase 5. |

## 2. Production Service Map

Production services:

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

Dev-only:

- `docs-service`

## 3. Chốt Phase 3 DevSecOps

Phase 3 DevSecOps có thể chốt baseline vì các mục cần thiết đã qua:

- Hardcoded secrets trong Compose/Consul seed đã chuyển sang env variable hoặc placeholder.
- `.env.example`, `deploy/staging.env.example`, `deploy/production.env.example` đã chuẩn hóa.
- `scripts/consul-seed.ts` hỗ trợ env interpolation.
- `docker/consul/init.sh` không crash khi thiếu media storage optional.
- Docker runtime image đã prune dev dependencies.
- Runtime image đã xóa `npm`, `npx`, `corepack`, `yarn` để giảm CVE surface.
- GitHub Actions đã có Trivy image scan với `severity: CRITICAL,HIGH`, `exit-code: 1`.
- PR thay đổi DevOps/shared files sẽ build/scan đủ 10 production services.
- `media-service` đã nâng `multer` lên `^2.1.1`.
- CI run #154 trên commit `2265ae813da9294db4bd7276c693b7d0db7748de` pass:
  - Code Quality & Testing: success.
  - Detect Changed Services: success.
  - Build Services cho 10 production services: success.
  - Trivy scan cho từng image: success.
  - Push image: skipped đúng kỳ vọng vì run trên PR.

Rủi ro còn lại:

- Nếu secret thật từng bị paste/push, cần rotate ngoài repo.
- Chưa có SBOM/signing/CodeQL như lớp hardening bổ sung.
- Production secret store chưa được chọn chính thức; với GCP nên ưu tiên Google Secret Manager hoặc Vault.

## 4. Baseline Phase 4 CI/CD

Working tree hiện đang định hướng Phase 4 như sau:

- `.github/workflows/pr-validation.yml`
  - Trigger: pull request vào `main`.
  - Chạy quality gate: `pnpm install --frozen-lockfile`, Prisma generate, Biome, typecheck, test.
  - Detect changed services.
  - Build Docker image và scan Trivy.
  - Không login GHCR, không push image.
  - Tự động label PR theo service bị ảnh hưởng.

- `.github/workflows/ci.yml`
  - Trigger: push vào `main`.
  - Chạy quality gate.
  - Trên push vào `main`, build đủ 10 production services để đảm bảo cùng một immutable tag `${github.sha}` tồn tại cho toàn bộ Helm release.
  - Build và Trivy scan toàn bộ required services.
  - Push GHCR với 2 tag: `${github.sha}` và `latest`.
  - Auto deploy GCP staging bằng Helm sau khi build image và migration-runner thành công.
  - Có thể tạm tắt auto deploy bằng repository variable `GCP_AUTO_DEPLOY_ENABLED=false`.
  - Staging job gắn GitHub Environment `staging`.

- `.github/workflows/production-release.yml`
  - Trigger: `workflow_dispatch`.
  - Input: immutable `image_tag`, thường là Git SHA đã pass Main Image Release.
  - Job gắn GitHub Environment `production`.
  - Cần cấu hình manual approval/reviewer trong GitHub Environments.

Deployment secrets/vars cần cấu hình:

Kubernetes/GCP/GKE path:

- Repository variable optional: `GCP_AUTO_DEPLOY_ENABLED=false` nếu cần tạm tắt auto deploy GCP staging. Mặc định workflow sẽ deploy sau mỗi push vào `main`.
- Staging environment/repo variables:
  - `STAGING_API_SCHEME`
  - `STAGING_API_HOST`
  - `STAGING_AUTH_HOST`
  - `STAGING_FRONTEND_ORIGIN`
- Production environment/repo variables:
  - `PRODUCTION_API_SCHEME`
  - `PRODUCTION_API_HOST`
  - `PRODUCTION_AUTH_HOST`
  - `PRODUCTION_FRONTEND_ORIGIN`
- Shared secrets:
  - `GHCR_PULL_USERNAME`
  - `GHCR_PULL_TOKEN`
- Staging/production kubeconfig secrets:
  - `STAGING_KUBE_CONFIG_B64`
  - `PRODUCTION_KUBE_CONFIG_B64`

Legacy SSH/Compose path, chỉ dùng nếu deploy lên VM/Compute Engine bằng Docker Compose:

- Staging environment/repo secrets:
  - `STAGING_DEPLOY_HOST`
  - `STAGING_DEPLOY_USER`
  - `STAGING_DEPLOY_PATH`
  - `STAGING_SSH_PRIVATE_KEY`
- Production environment/repo secrets:
  - `PRODUCTION_DEPLOY_HOST`
  - `PRODUCTION_DEPLOY_USER`
  - `PRODUCTION_DEPLOY_PATH`
  - `PRODUCTION_SSH_PRIVATE_KEY`

## 5. Ghi chú Deploy/Migration

Runtime images cố ý xóa `npm/npx`, nên deploy không được chạy migrations trực tiếp trong application runtime containers.

Working tree hiện xử lý việc này bằng cách:

- Thêm `migration-runner` service trong `docker-compose.deploy.yml` dựa trên `node:20-alpine`.
- Upload từng thư mục `prisma/` của production service lên remote deploy path.
- Chạy `prisma migrate deploy` từ `migration-runner` với `DATABASE_URL` inject theo từng service.

Cách này giữ application runtime images nhỏ/hardened, đồng thời vẫn có deploy-time migration path.

## 6. Thứ tự ưu tiên còn lại

Thứ tự khuyến nghị tiếp theo:

1. Validate workflow YAML và Compose deploy config locally.
2. Merge/push Phase 4 changes và verify PR Validation/Main Image Release behavior.
3. Cấu hình GitHub Environments:
   - `staging` cho automatic deploy.
   - `production` với required reviewers/manual approval.
4. Cấu hình Phase 5 Kubernetes runtime:
   - GCP/GKE cluster là target chính.
   - Ingress controller/load balancer, DNS records và optional static IP trên GCP.
   - GitHub variables: `STAGING_API_HOST`, `STAGING_AUTH_HOST`, `STAGING_FRONTEND_ORIGIN`, và production equivalents.
   - GitHub secrets: `STAGING_KUBE_CONFIG_B64`, `PRODUCTION_KUBE_CONFIG_B64`, `GHCR_PULL_USERNAME`, `GHCR_PULL_TOKEN`, DB/RabbitMQ/Keycloak/storage secrets.
5. Verify Helm deployment:
   - `helm lint charts/luyen-thi-lai-xe`.
   - `helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml`.
   - Staging deploy qua main workflow và smoke test qua Kong.
   - Production manual release với `workflow_dispatch` và Helm rollback test.
6. Thêm SBOM/signing/CodeQL sau khi Phase 5 deploy path ổn định.

## 7. Baseline Phase 5 Kubernetes

Phase 5 target đã đổi sang Kubernetes Helm trên GCP/GKE, self-contained trong cluster cho giai đoạn MVP. K3s/VPS chỉ còn là lab/fallback legacy.

Baseline đã implement:

- Helm chart `charts/luyen-thi-lai-xe` deploy 10 production services, Kong, Keycloak, Postgres, RabbitMQ, Redis và Consul.
- Kubernetes `Secret` dùng cho password/token/storage; Consul seed Job chỉ seed non-secret config.
- App Deployments có `resources.requests`, `resources.limits`, `/health/live` và `/health/ready` probes.
- `Dockerfile.migration-runner` build image riêng cho Prisma migration Job.
- GitHub Actions deploy staging/production bằng Helm và kubeconfig base64.
- `scripts/k8s-smoke.sh` verify health endpoints qua Kong.

Không nằm trong Phase 5:

- Terraform, HPA, k6/JMeter.
- Full ELK/Prometheus/Grafana trên Kubernetes.
- Vault/External Secrets.


