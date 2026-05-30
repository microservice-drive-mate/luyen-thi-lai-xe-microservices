# Tổng kết hạ tầng DevOps - Luyện Thi Lái Xe Microservices

**Cập nhật lần cuối**: Tháng 05/2026
**Phạm vi đã kiểm tra**: Docker local/hybrid, Docker Compose full stack, VPS Compose deploy, CI/CD, observability, resilience, backup và runbook.

## Tóm tắt điều hành

Repo hiện tại đã đủ tốt cho **MVP/demo trên local hoặc VPS bằng Docker Compose**. Nếu đối chiếu theo checklist DevOps trong `DEVOPS (2).docx`, trạng thái tổng quan là:

- **Mức sẵn sàng DevOps cho MVP**: khoảng **85-90%**.
- **Mức sẵn sàng production day-2 operations**: khoảng **70-75%**.
- **Chưa đạt mức production enterprise/Kubernetes**: còn thiếu DevSecOps scan, secret manager, IaC, load test và autoscaling.

Kết quả kiểm tra tĩnh:

- `docker compose -f docker-compose.infra.yml config --quiet`: pass.
- `docker compose -f docker-compose.yaml config --quiet`: pass.
- `docker compose -f docker-compose.deploy.yml --env-file deploy/production.env.example config --quiet`: pass.

Docker có cảnh báo quyền đọc `~/.docker/config.json` trên máy local, nhưng cấu hình Compose vẫn hợp lệ.

## Mốc cơ sở service

Luồng production/VPS deploy hiện chốt **10 application services**:

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

`docs-service` dùng cho Swagger/docs aggregation ở môi trường dev hoặc nội bộ. Service này **không nằm trong luồng VPS production deploy** hiện tại.

## Phần đã hoàn thành

### Containerization & Docker

- Mỗi app service production có Dockerfile riêng trong `apps/*/Dockerfile`.
- Full stack có `docker-compose.yaml`.
- Hybrid local có `docker-compose.infra.yml`.
- VPS/staging/production có `docker-compose.deploy.yml`.
- Compose files có healthcheck cho PostgreSQL, Redis, Consul, Keycloak/Kong/app services theo mức độ cần thiết.

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
  - `.env.vps.example`
  - `deploy/staging.env.example`
  - `deploy/production.env.example`
- Consul seed files theo môi trường:
  - `consul-seed-development-local.json`
  - `consul-seed-development.json`
  - `consul-seed-staging.json`
  - `consul-seed-production.json`
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
- Deploy script chạy `prisma migrate deploy` cho 10 service production.

### CI/CD

- GitHub Actions:
  - `.github/workflows/ci.yml`: quality gate, service change detection, matrix Docker build, GHCR push trên `main`.
  - `.github/workflows/deploy-vps.yml`: deploy VPS bằng Docker Compose sau CI success hoặc manual dispatch.
  - `.github/workflows/devops-smoke.yml`: smoke suites cho observability, RabbitMQ resilience và restore test.
- Jenkins:
  - `Jenkinsfile` có lint, typecheck, test, build, image push, staging deploy và production manual approval.
- Registry:
  - GHCR image naming: `ghcr.io/<owner>/luyen-thi-lai-xe-<service>:<tag>`.

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

## Phần còn thiếu

### P0 - Security/DevSecOps

Còn thiếu để đạt yêu cầu Phase 3 trong tài liệu DevOps:

- Chưa có Trivy image scan trong GitHub Actions/Jenkins.
- Chưa có secret scanning như Gitleaks/TruffleHog.
- Chưa có dependency audit gate bắt buộc.
- Chưa generate SBOM bằng Syft/CycloneDX.
- Chưa sign image/release bằng Cosign hoặc có provenance policy.
- Chưa có Vault/AWS Secrets Manager/Azure Key Vault integration.

Ghi chú: local Compose vẫn còn default credentials (`password`, `guest`, `admin`) để dễ chạy dev. `docker-compose.deploy.yml` đã dùng env interpolation cho production, nhưng secret manager thực thụ vẫn chưa có.

### P1 - Release Hardening

- GitHub Actions build có tag SHA và `latest`, nhưng production flow cần chốt policy: deploy production bằng immutable SHA/tag release, hạn chế dùng `latest`.
- Production approval trên GitHub phụ thuộc environment protection rule ngoài repo; Jenkins đã có `input` manual approval.
- Rollback đã có hướng dẫn trong Jenkins guide, nhưng chưa có workflow riêng cho rollback.

### P1 - Runtime Verification

- Đã có smoke tests, nhưng nên chạy thực tế sau deploy và lưu bằng chứng pass/fail theo mỗi lần release.
- `media-service` chưa có script `test` trong `package.json`, trong khi CI chạy `npx turbo run test`; nên bổ sung script test placeholder hoặc test thật để tránh build matrix/quality gate lệch service.

### P2 - Cloud Runtime / Kubernetes

Chưa có:

- Kubernetes manifests hoặc Helm/Kustomize.
- resource requests/limits cho K8s.
- HPA.
- Ingress/TLS cho K8s.

Với MVP, VPS Docker Compose là đủ. K8s nên để sau khi có nhu cầu scale thật.

### P2 - IaC & Load Test

Chưa có:

- Terraform modules.
- Ansible playbooks.
- k6/JMeter/Locust load test.
- nightly performance regression gate.

### P3 - Advanced DR / Multi-region

Chưa có:

- backup offsite lên S3/Azure Blob.
- PITR managed database.
- multi-region deploy/failover.
- cross-region RabbitMQ/Consul strategy.

## Ma trận hoàn thành

| Hạng mục | Trạng thái | Mức hoàn thành | Ghi chú |
| --- | --- | ---: | --- |
| Docker & Compose | Đã làm | 95% | `docs-service` không deploy production; 10 app services deploy đủ. |
| Local/dev bootstrap | Đã làm | 90% | README có first-run flow. |
| Database migration/seed | Đã làm | 90% | CI có staging migration; deploy script chạy migration. |
| CI/CD | Một phần | 80% | Build/push/deploy có; scan/SBOM/rollback workflow còn thiếu. |
| VPS deployment | Đã làm | 85% | Compose deploy + migrations + health smoke. |
| Observability | Đã làm | 85% | Prometheus/Grafana/ELK/alerts có; cần verify runtime và bổ sung business metrics. |
| Health/metrics/logging | Đã làm | 90% | Đã đồng bộ common modules. |
| HTTP/RabbitMQ resilience | Đã làm | 85% | Retry/DLQ/circuit breaker có; idempotency durable còn là follow-up. |
| Backup/restore/runbook | Đã làm | 80% | Daily backup + restore test có; offsite/PITR còn thiếu. |
| Secrets management | Một phần | 45% | Env templates có; secret manager chưa có. |
| DevSecOps supply chain | Còn thiếu | 25% | Chưa có Trivy/secret scan/SBOM gate. |
| IaC | Còn thiếu | 15% | Docker Compose là IaC mức app-runtime; Terraform chưa có. |
| Load test/autoscaling | Còn thiếu | 0% | Chưa có k6/JMeter/HPA. |
| Multi-region | Còn thiếu | 0% | Post-MVP. |

## Việc nên làm tiếp

### Làm ngay

1. Thêm Trivy scan vào `.github/workflows/ci.yml` sau Docker build.
2. Thêm Gitleaks/TruffleHog secret scan vào PR quality gate.
3. Thêm `npm audit --audit-level=high` hoặc `audit-ci`.
4. Generate SBOM cho image bằng Syft/CycloneDX và upload artifact.
5. Bổ sung `test` script cho `media-service`.
6. Chốt production deploy chỉ dùng immutable image tag (`github.sha` hoặc release tag), không dùng `latest`.

### Gần hạn

1. Đẩy backup offsite lên S3/Azure Blob và document restore từ offsite.
2. Thêm rollback GitHub Action/Jenkins parameterized job.
3. Thêm k6 smoke/load script cho các luồng chính: login, làm bài thi, nộp bài, upload media.
4. Thêm business metrics: exam completion rate, pass/fail count, notification delivery outcome.

### Sau MVP

1. Terraform cho VPS/cloud resources.
2. Helm/Kustomize nếu chuyển sang Kubernetes.
3. HPA và resource limits.
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
```
