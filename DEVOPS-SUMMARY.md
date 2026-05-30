# Tổng kết hạ tầng DevOps - Luyện Thi Lái Xe Microservices

**Cập nhật lần cuối**: Tháng 05/2026
**Phạm vi đã kiểm tra**: Docker local/hybrid, Docker Compose full stack, Docker Compose deploy legacy, CI/CD, Kubernetes baseline cho GCP/GKE, observability, resilience, backup và runbook.

## Tóm tắt điều hành

Repo hiện tại đã đủ tốt cho **MVP/demo trên local hoặc GCP**, đồng thời đã có baseline cho **CI/CD tách luồng, DevSecOps cơ bản và Kubernetes/GKE deployment**. Nếu đối chiếu theo checklist DevOps trong `DEVOPS (2).docx`, trạng thái tổng quan là:

- **Mức sẵn sàng DevOps cho MVP**: khoảng **90%**.
- **Mức sẵn sàng production day-2 operations**: khoảng **75-80%**.
- **Chưa đạt mức production enterprise hoàn chỉnh**: còn thiếu secret manager chính thức, SBOM/signing, offsite/PITR backup, load test, HPA và Terraform.

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
  - `.github/workflows/devops-smoke.yml`: smoke suites cho observability, RabbitMQ resilience và restore test.
- Jenkins:
  - `Jenkinsfile` có lint, typecheck, test, build, image push, staging deploy và production manual approval.
  - Vai trò hiện tại là pipeline tự host/legacy cho Docker Compose deploy qua SSH/VM hoặc Compute Engine; GitHub Actions vẫn là đường chính cho GCP/GKE bằng Helm.
- DevSecOps baseline:
  - Trivy image scan với `severity: CRITICAL,HIGH`, `exit-code: 1`.
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
- Kubernetes Phase 5 baseline:
  - Helm chart tại `charts/luyen-thi-lai-xe`.
  - Target hiện tại: GCP/GKE.
  - K3s chỉ còn là lựa chọn lab/fallback nếu cần thử nhanh ngoài GCP.
  - Deploy 10 production services, Kong, Keycloak, PostgreSQL, RabbitMQ, Redis và Consul.
  - Kubernetes `Secret` dùng cho password/token/storage.
  - Consul seed Job chỉ seed non-secret config.
  - App Deployments có `resources.requests`, `resources.limits`, `/health/live` và `/health/ready` probes.
  - GitHub Actions deploy staging/production bằng Helm và kubeconfig base64.
  - `scripts/k8s-smoke.sh` verify health endpoints qua Kong.
- Hướng dẫn chi tiết: `guides/devops/PHASE5-KUBERNETES.md`.

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
- Prometheus scrape config:
  - `docker/prometheus/prometheus.yml`
  - `docker/prometheus/prometheus.local.yml`
- Alert rules:
  - service metrics endpoint down.
  - high 5xx rate.
  - high p95 latency.
  - high Node memory/CPU.
  - RabbitMQ DLQ/retry backlog.
- Grafana provisioning:
  - datasource Prometheus.
  - dashboard `microservices-observability.json`.
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
  - `guides/devops/PHASE5-KUBERNETES.md`
  - `guides/devops/GCP-SETUP.md`
  - `guides/devops/DEVOPS-DEMO-SCRIPT.md`

## Phần còn thiếu

### P0/P1 - Security hardening còn lại

- Chưa có secret manager chính thức như Google Secret Manager hoặc Vault.
- Chưa có SBOM bằng Syft/CycloneDX.
- Chưa sign image/release bằng Cosign hoặc có provenance policy đầy đủ.
- Nếu secret thật từng bị paste/push, cần rotate ngoài repo.

### P1 - Release hardening còn lại

- Main workflow vẫn push cả `${github.sha}` và `latest`; production release đã dùng immutable `image_tag`, nhưng cần policy vận hành rõ ràng: production chỉ chọn SHA/release tag đã pass.
- Production approval trên GitHub phụ thuộc Environment protection rule ngoài repo; cần cấu hình reviewer trong GitHub Environments.
- Rollback đã có hướng dẫn và Helm rollback path, nhưng nên bổ sung workflow/job riêng cho rollback có tham số.

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
| CI/CD | Đã làm nền | 85% | PR validation, main image release, production manual release đã có; rollback job riêng còn thiếu. |
| DevSecOps baseline | Đã làm nền | 75% | Trivy HIGH/CRITICAL gate có; SBOM/signing/secret manager còn thiếu. |
| Compose deployment legacy | Đã làm | 85% | Compose deploy + migrations + health smoke; dùng cho VM/Compute Engine nếu cần fallback. |
| Kubernetes baseline | Đã làm nền | 70% | Helm/GKE scaffold có; HPA/load test/Terraform còn thiếu. |
| Observability | Đã làm | 85% | Prometheus/Grafana/ELK/alerts có; cần verify runtime và bổ sung business metrics. |
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

1. Thêm rollback GitHub Action/Jenkins parameterized job.
2. Generate SBOM cho image bằng Syft/CycloneDX và upload artifact.
3. Thêm Cosign signing/provenance nếu cần hardening sâu hơn.
4. Đẩy backup offsite lên S3/Azure Blob và document restore từ offsite.
5. Thêm k6 smoke/load script cho các luồng chính: login, làm bài thi, nộp bài, upload media.
6. Thêm business metrics: exam completion rate, pass/fail count, notification delivery outcome.

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
