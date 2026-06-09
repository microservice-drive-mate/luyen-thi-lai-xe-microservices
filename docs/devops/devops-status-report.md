
<!-- Merged from docs/devops/devops-status-report.md -->
# Tá»•ng káº¿t háº¡ táº§ng DevOps - Luyá»‡n Thi LÃ¡i Xe Microservices

**Cáº­p nháº­t láº§n cuá»‘i**: ThÃ¡ng 05/2026
**Pháº¡m vi Ä‘Ã£ kiá»ƒm tra**: Docker local/hybrid, Docker Compose full stack, Docker Compose deploy legacy, CI/CD, Kubernetes baseline cho GCP/GKE, observability, business metrics, resilience, backup vÃ  runbook.

## TÃ³m táº¯t Ä‘iá»u hÃ nh

Repo hiá»‡n táº¡i Ä‘Ã£ Ä‘á»§ tá»‘t cho **MVP/demo trÃªn local hoáº·c GCP**, Ä‘á»“ng thá»i Ä‘Ã£ cÃ³ baseline cho **CI/CD tÃ¡ch luá»“ng, DevSecOps cÆ¡ báº£n, Kubernetes/GKE deployment, observability Ä‘á»§ 3 trá»¥ cá»™t metrics/logs/traces vÃ  business metrics**. Náº¿u Ä‘á»‘i chiáº¿u theo checklist DevOps trong `DEVOPS (2).docx`, tráº¡ng thÃ¡i tá»•ng quan lÃ :

- **Má»©c sáºµn sÃ ng DevOps cho MVP**: khoáº£ng **90%**.
- **Má»©c sáºµn sÃ ng production day-2 operations**: khoáº£ng **75-80%**.
- **ChÆ°a Ä‘áº¡t má»©c production enterprise hoÃ n chá»‰nh**: cÃ²n thiáº¿u secret manager chÃ­nh thá»©c, offsite/PITR backup, load test, HPA vÃ  Terraform. SBOM/signing vÃ  rollback workflow Ä‘Ã£ cÃ³ baseline trÃªn GitHub Actions.

Káº¿t quáº£ kiá»ƒm tra tÄ©nh trÆ°á»›c Ä‘Ã³:

- `docker compose -f docker-compose.infra.yml config --quiet`: pass.
- `docker compose -f docker-compose.yaml config --quiet`: pass.
- `docker compose -f docker-compose.deploy.yml --env-file deploy/production.env.example config --quiet`: pass.

Ghi chÃº: `DEVOPS-ASSESSMENT.md` lÃ  báº£n Ä‘Ã¡nh giÃ¡ baseline chi tiáº¿t tá»« nhÃ¡nh DevOps má»›i trÃªn `main`. File nÃ y lÃ  báº£n tá»•ng káº¿t ngáº¯n gá»n báº±ng tiáº¿ng Viá»‡t cÃ³ dáº¥u Ä‘á»ƒ phá»¥c vá»¥ README/bÃ¡o cÃ¡o.

## Má»‘c cÆ¡ sá»Ÿ service

Luá»“ng production/staging hiá»‡n chá»‘t **10 application services**:

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

`docs-service` dÃ¹ng cho Swagger/docs aggregation á»Ÿ mÃ´i trÆ°á»ng dev hoáº·c ná»™i bá»™. Service nÃ y **khÃ´ng náº±m trong luá»“ng staging/production deploy** hiá»‡n táº¡i.

## Pháº§n Ä‘Ã£ hoÃ n thÃ nh

### Containerization & Docker

- Má»—i app service production cÃ³ Dockerfile riÃªng trong `apps/*/Dockerfile`.
- Full stack cÃ³ `docker-compose.yaml`.
- Hybrid local cÃ³ `docker-compose.infra.yml`.
- Docker Compose deploy legacy cÃ³ `docker-compose.deploy.yml` cho trÆ°á»ng há»£p cáº§n cháº¡y trÃªn VM/Compute Engine.
- Runtime images Ä‘Ã£ Ä‘Æ°á»£c harden thÃªm:
  - prune dev dependencies.
  - loáº¡i `npm`, `npx`, `corepack`, `yarn` khá»i runtime image Ä‘á»ƒ giáº£m CVE surface.
- CÃ³ `Dockerfile.migration-runner` Ä‘á»ƒ cháº¡y Prisma migration ngoÃ i application runtime container.

### Infrastructure Foundation

- Database-per-service báº±ng PostgreSQL.
- RabbitMQ 3 management + Prometheus plugin.
- Redis cho token blacklist/cache.
- Consul dÃ¹ng lÃ m KV config store vÃ  service config seed.
- Keycloak cÃ³ realm import/export.
- Kong cháº¡y DB-less gateway, cÃ³ cáº¥u hÃ¬nh riÃªng cho hybrid dev vÃ  Docker/deploy.

### Configuration & Environment

- Root env templates:
  - `.env.example`
  - `.env.vps.example` (legacy cho luá»“ng VM/SSH cÅ©)
  - `deploy/staging.env.example`
  - `deploy/production.env.example`
- Consul seed files theo mÃ´i trÆ°á»ng:
  - `consul-seed-development-local.json`
  - `consul-seed-development.json`
  - `consul-seed-staging.json`
  - `consul-seed-production.json`
- `scripts/consul-seed.ts` há»— trá»£ env interpolation.
- `docker/consul/init.sh` khÃ´ng crash khi thiáº¿u media storage optional.
- Thá»© tá»± Æ°u tiÃªn config trong code: env > Consul > default.
- `.gitignore` Ä‘Ã£ cháº·n `.env`, `*.env`, `backups/`.

### Database Lifecycle

- Root scripts Ä‘Ã£ cÃ³:
  - `pnpm run db:generate`
  - `pnpm run db:deploy`
  - `pnpm run db:seed`
  - `pnpm run db:backup:local`
  - `pnpm run db:restore:test`
- CI cÃ³ staging migration job trÃªn branch `staging`.
- Docker Compose deploy dÃ¹ng `migration-runner` Ä‘á»ƒ cháº¡y `prisma migrate deploy`.
- Kubernetes baseline cÃ³ Prisma migration Job riÃªng trong Helm chart.

### CI/CD & DevSecOps

- GitHub Actions Ä‘Ã£ tÃ¡ch luá»“ng:
  - `.github/workflows/pr-validation.yml`: validate PR vÃ o `main`, cháº¡y quality gate, detect changed services, build image vÃ  Trivy scan, khÃ´ng push image.
  - `.github/workflows/ci.yml`: main image release, quality gate, build + Trivy scan Ä‘á»§ 10 production services, push GHCR vá»›i `${github.sha}` vÃ  `latest`, rá»“i auto deploy GCP staging báº±ng Helm. CÃ³ thá»ƒ táº¯t auto deploy báº±ng repository variable `GCP_AUTO_DEPLOY_ENABLED=false`.
  - `.github/workflows/production-release.yml`: production release thá»§ cÃ´ng báº±ng immutable `image_tag`, gáº¯n GitHub Environment `production`.
  - `.github/workflows/rollback-release.yml`: rollback Helm release thá»§ cÃ´ng theo revision cho `staging` hoáº·c `production`, cÃ³ smoke test vÃ  deployment event.
  - `.github/workflows/devops-smoke.yml`: smoke suites cho observability, RabbitMQ resilience vÃ  restore test.
- Jenkins:
  - `Jenkinsfile` cÃ³ lint, typecheck, test, build, image push, staging deploy vÃ  production manual approval.
  - Vai trÃ² hiá»‡n táº¡i lÃ  pipeline tá»± host/legacy cho Docker Compose deploy qua SSH/VM hoáº·c Compute Engine; GitHub Actions váº«n lÃ  Ä‘Æ°á»ng chÃ­nh cho GCP/GKE báº±ng Helm.
- Äo lÆ°á»ng DevOps theo DORA:
  - `.github/workflows/dora-report.yml`: cháº¡y thá»§ cÃ´ng hoáº·c Ä‘á»‹nh ká»³ háº±ng tuáº§n Ä‘á»ƒ táº¡o DORA report artifact.
  - `.github/workflows/incident-labeler.yml`: tá»± gáº¯n label mÃ´i trÆ°á»ng, severity vÃ  change-failure/rollback cho incident issues.
  - `scripts/devops-record-deployment.js`: ghi deployment event JSON sau má»—i láº§n deploy.
  - `scripts/devops-dora-report.ts`: tá»•ng há»£p Deployment Frequency, Lead Time for Changes, MTTR vÃ  Change Failure Rate tá»« GitHub Actions vÃ  incident issues.
  - `scripts/devops-dora-prometheus-export.ts`: export DORA JSON sang Prometheus textfile metrics Ä‘á»ƒ Grafana hiá»ƒn thá»‹.
  - `Jenkinsfile`: ghi Jenkins deployment event sau `Deploy Staging` vÃ  `Deploy Production`, rá»“i archive artifact cho DORA.
  - `.github/ISSUE_TEMPLATE/incident_report.yml` vÃ  `.github/ISSUE_TEMPLATE/postmortem.yml`: chuáº©n hÃ³a dá»¯ liá»‡u incident/postmortem Ä‘á»ƒ tÃ­nh MTTR/CFR.
  - `docs/devops/incident-management-process.md`: quy trÃ¬nh cho incident severity, label chuáº©n vÃ  postmortem báº¯t buá»™c vá»›i SEV1/SEV2.
  - `docs/devops/deployment-event-store.md`: quy trÃ¬nh Ä‘á»ƒ lÆ°u deployment events vÃ  giáº£m phá»¥ thuá»™c vÃ o GitHub Actions history.
  - `docs/devops/dora-metrics-guide.md`: quy trÃ¬nh Ä‘á»ƒ gom Jenkins deploy vÃ o cÃ¹ng DORA event schema.
  - `docs/devops/dora-metrics-guide.md`: quy trÃ¬nh Ä‘Æ°a DORA metrics lÃªn Prometheus/Grafana.
- DevSecOps baseline:
  - Trivy image scan vá»›i `severity: CRITICAL,HIGH`, `exit-code: 1`.
  - GitHub Actions sinh SBOM SPDX JSON cho image vÃ  upload artifact.
  - GitHub Actions kÃ½ immutable image tag `${github.sha}` báº±ng Cosign keyless signing, gáº¯n SBOM attestation vÃ  verify chá»¯ kÃ½.
  - PR thay Ä‘á»•i DevOps/shared files sáº½ build/scan Ä‘á»§ 10 production services.
  - Hardcoded secrets trong Compose/Consul seed Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn dáº§n sang env variable hoáº·c placeholder.
- Registry:
  - GHCR image naming: `ghcr.io/<owner>/luyen-thi-lai-xe-<service>:<tag>`.
  - GCP/GKE chá»‰ pull image Ä‘Ã£ cÃ³ tá»« GHCR khi deploy; source code khÃ´ng build trÃªn GCP.

### Deployment Runtime

- Docker Compose runtime:
  - local/hybrid.
  - full Docker stack.
  - Docker Compose deploy legacy qua SSH/VM.
- Kubernetes baseline:
  - Helm chart táº¡i `charts/luyen-thi-lai-xe`.
  - Target hiá»‡n táº¡i: GCP/GKE.
  - K3s chá»‰ cÃ²n lÃ  lá»±a chá»n lab/fallback náº¿u cáº§n thá»­ nhanh ngoÃ i GCP.
  - Deploy 10 production services, Kong, Keycloak, PostgreSQL, RabbitMQ, Redis vÃ  Consul.
  - Kubernetes `Secret` dÃ¹ng cho password/token/storage.
  - Consul seed Job chá»‰ seed non-secret config.
  - App Deployments cÃ³ `resources.requests`, `resources.limits`, `/health/live` vÃ  `/health/ready` probes.
  - GitHub Actions deploy staging/production báº±ng Helm vÃ  kubeconfig base64.
  - `scripts/k8s-smoke.sh` verify health endpoints qua Kong.
- HÆ°á»›ng dáº«n chi tiáº¿t: `docs/devops/kubernetes-gcp-deployment.md`.

### Observability

- App-level health endpoints Ä‘Ã£ Ä‘Æ°á»£c Ä‘á»“ng bá»™ qua `HealthModule`:
  - `/health`
  - `/health/live`
  - `/health/ready`
- App metrics expose qua `MetricsModule`:
  - `/metrics`
  - HTTP request count/latency/status class.
  - Node/process metrics tá»« `prom-client`.
  - RabbitMQ retry/DLQ metrics.
- Distributed tracing:
  - `packages/common/src/tracing/`: khá»Ÿi Ä‘á»™ng OpenTelemetry SDK, HTTP tracing middleware vÃ  Nest/RabbitMQ tracing interceptor.
  - Kong báº­t plugin `zipkin` trong `kong/kong.yaml`, `kong/kong.dev.yaml` vÃ  Helm ConfigMap Ä‘á»ƒ gá»­i span gateway vÃ o Jaeger.
  - Jaeger Ä‘Æ°á»£c thÃªm vÃ o Docker Compose vÃ  Helm chart Ä‘á»ƒ xem trace end-to-end.
  - `resilientFetch`/Axios resilience tá»± inject `traceparent` cho outbound HTTP.
- Prometheus scrape config:
  - `docker/prometheus/prometheus.yml`
  - `docker/prometheus/prometheus.local.yml`
- DORA dashboard:
  - `docker/grafana/dashboards/dora-metrics.json`
  - `dora-metrics-exporter` Ä‘á»c `reports/dora/dora.prom` qua textfile collector.
- Business metrics:
  - `users_created_total`: sá»‘ user profile má»›i theo role vÃ  nguá»“n táº¡o.
  - `exam_sessions_started_total`: sá»‘ lÆ°á»£t há»c viÃªn báº¯t Ä‘áº§u bÃ i thi theo háº¡ng báº±ng.
  - `exam_sessions_completed_total`: sá»‘ lÆ°á»£t ná»™p bÃ i theo pass/fail, tráº¡ng thÃ¡i vÃ  lá»—i cÃ¢u Ä‘iá»ƒm liá»‡t.
  - `course_lessons_completed_total` vÃ  `course_enrollments_completed_total`: tiáº¿n Ä‘á»™ hoÃ n táº¥t bÃ i há»c/khÃ³a há»c.
  - `notifications_delivery_total`: káº¿t quáº£ gá»­i notification theo kÃªnh, event vÃ  tráº¡ng thÃ¡i.
  - `media_upload_total`: káº¿t quáº£ upload media theo mode, MIME type vÃ  tráº¡ng thÃ¡i.
  - Dashboard Grafana: `docker/grafana/dashboards/business-metrics.json`.
  - HÆ°á»›ng dáº«n: `docs/devops/business-metrics.md`.
- HÆ°á»›ng dáº«n tracing náº±m á»Ÿ `docs/devops/opentelemetry-jaeger-tracing.md`.
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
  - `AppLoggerModule` dÃ¹ng Winston + optional HTTP transport tá»›i Logstash.
  - `AccessLogInterceptor` vÃ  correlation id Ä‘Ã£ gáº¯n vÃ o service bootstrap.

### Resilience

- HTTP resilience helper trong `packages/common/src/http/resilient-http-client.ts`:
  - timeout.
  - retry cÃ³ giá»›i háº¡n.
  - circuit breaker cÃ³ open window.
- RabbitMQ resilience trong `packages/common/src/messaging/rabbitmq-resilience.ts`:
  - durable queue.
  - `noAck: false`.
  - retry queues vá»›i TTL backoff.
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
- TÃ i liá»‡u:
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

## Pháº§n cÃ²n thiáº¿u

### P0/P1 - Security hardening cÃ²n láº¡i

- ChÆ°a cÃ³ secret manager chÃ­nh thá»©c nhÆ° Google Secret Manager hoáº·c Vault.
- SBOM vÃ  Cosign signing Ä‘Ã£ cÃ³ baseline trong GitHub Actions; chÆ°a cÃ³ admission policy báº¯t buá»™c verify signature á»Ÿ Kubernetes.
- ChÆ°a cÃ³ provenance policy Ä‘áº§y Ä‘á»§ á»Ÿ runtime.
- Náº¿u secret tháº­t tá»«ng bá»‹ paste/push, cáº§n rotate ngoÃ i repo.

### P1 - Release hardening cÃ²n láº¡i

- Main workflow váº«n push cáº£ `${github.sha}` vÃ  `latest`; production release Ä‘Ã£ dÃ¹ng immutable `image_tag`, nhÆ°ng cáº§n policy váº­n hÃ nh rÃµ rÃ ng: production chá»‰ chá»n SHA/release tag Ä‘Ã£ pass.
- Production approval trÃªn GitHub phá»¥ thuá»™c Environment protection rule ngoÃ i repo; cáº§n cáº¥u hÃ¬nh reviewer trong GitHub Environments.
- Rollback Ä‘Ã£ cÃ³ workflow GitHub Actions theo Helm revision; cáº§n cháº¡y thá»­ trÃªn staging tháº­t vÃ  lÆ°u báº±ng chá»©ng rollback pass.

### P1 - Runtime verification

- ÄÃ£ cÃ³ smoke tests, nhÆ°ng nÃªn cháº¡y thá»±c táº¿ sau deploy vÃ  lÆ°u báº±ng chá»©ng pass/fail theo má»—i láº§n release.
- Cáº§n cháº¡y láº¡i smoke trÃªn mÃ´i trÆ°á»ng GKE/staging tháº­t sau khi merge Ä‘á»ƒ xÃ¡c nháº­n DNS, ingress vÃ  health endpoint á»•n Ä‘á»‹nh.

### P2 - Scaling & IaC

ChÆ°a cÃ³:

- Terraform modules.
- HPA.
- k6/JMeter/Locust load test.
- nightly performance regression gate.

### P3 - Advanced DR / Multi-region

ChÆ°a cÃ³:

- backup offsite lÃªn Google Cloud Storage.
- PITR managed database.
- multi-region deploy/failover.
- cross-region RabbitMQ/Consul strategy.

## Ma tráº­n hoÃ n thÃ nh

| Háº¡ng má»¥c | Tráº¡ng thÃ¡i | Má»©c hoÃ n thÃ nh | Ghi chÃº |
| --- | --- | ---: | --- |
| Docker & Compose | ÄÃ£ lÃ m | 95% | 10 app services deploy Ä‘á»§; `docs-service` dev-only. |
| Local/dev bootstrap | ÄÃ£ lÃ m | 90% | README cÃ³ first-run flow. |
| Database migration/seed | ÄÃ£ lÃ m | 90% | CI/deploy cÃ³ migration path; Kubernetes cÃ³ migration Job. |
| CI/CD | ÄÃ£ lÃ m ná»n | 90% | PR validation, main image release, production manual release vÃ  rollback workflow Ä‘Ã£ cÃ³. |
| DevSecOps baseline | ÄÃ£ lÃ m ná»n | 82% | Trivy HIGH/CRITICAL gate, SBOM artifact vÃ  Cosign signing cÃ³; secret manager/admission policy cÃ²n thiáº¿u. |
| Compose deployment legacy | ÄÃ£ lÃ m | 85% | Compose deploy + migrations + health smoke; dÃ¹ng cho VM/Compute Engine náº¿u cáº§n fallback. |
| Kubernetes baseline | ÄÃ£ lÃ m ná»n | 70% | Helm/GKE scaffold cÃ³; HPA/load test/Terraform cÃ²n thiáº¿u. |
| Observability | ÄÃ£ lÃ m | 90% | Prometheus/Grafana/ELK/alerts/tracing/DORA/business metrics cÃ³; cáº§n verify runtime trÃªn GKE tháº­t. |
| Health/metrics/logging | ÄÃ£ lÃ m | 90% | ÄÃ£ Ä‘á»“ng bá»™ common modules. |
| HTTP/RabbitMQ resilience | ÄÃ£ lÃ m | 85% | Retry/DLQ/circuit breaker cÃ³; idempotency durable cÃ²n lÃ  follow-up. |
| Backup/restore/runbook | ÄÃ£ lÃ m | 80% | Daily backup + restore test cÃ³; offsite/PITR cÃ²n thiáº¿u. |
| Secrets management | Má»™t pháº§n | 50% | Env templates/K8s secrets cÃ³; external secret manager chÆ°a cÃ³. |
| IaC | CÃ²n thiáº¿u | 20% | Docker Compose/Helm lÃ  IaC má»©c app-runtime; Terraform chÆ°a cÃ³. |
| Load test/autoscaling | CÃ²n thiáº¿u | 10% | Probes/resources cÃ³; chÆ°a cÃ³ k6/JMeter/HPA. |
| Multi-region | CÃ²n thiáº¿u | 0% | Post-MVP. |

## Viá»‡c nÃªn lÃ m tiáº¿p

### LÃ m ngay

1. Cáº¥u hÃ¬nh GitHub Environments:
   - `staging` cho deploy tá»± Ä‘á»™ng náº¿u báº­t.
   - `production` vá»›i required reviewers/manual approval.
2. Verify workflow YAML sau merge:
   - PR Validation.
   - Main Image Release.
   - Production Release.
3. Cháº¡y `helm lint` vÃ  `helm template` cho chart `charts/luyen-thi-lai-xe`.
4. Cháº¡y smoke test trÃªn mÃ´i trÆ°á»ng staging/GKE tháº­t qua Kong.
5. LÃ m theo checklist GCP trong `docs/devops/gcp-setup.md` trÆ°á»›c khi má»Ÿ public DNS/TLS.

### Gáº§n háº¡n

1. Cháº¡y thá»­ `Rollback Release` trÃªn staging tháº­t vÃ  lÆ°u báº±ng chá»©ng smoke pass.
2. ThÃªm admission policy hoáº·c Kyverno/Gatekeeper rule Ä‘á»ƒ chá»‰ cho cháº¡y image Ä‘Ã£ kÃ½ Cosign náº¿u harden sÃ¢u hÆ¡n.
3. Äáº©y backup offsite lÃªn S3/Azure Blob vÃ  document restore tá»« offsite.
4. ThÃªm k6 smoke/load script cho cÃ¡c luá»“ng chÃ­nh: login, lÃ m bÃ i thi, ná»™p bÃ i, upload media.
5. ThÃªm alert hoáº·c dashboard panel nÃ¢ng cao cho business metrics, vÃ­ dá»¥ pass rate giáº£m máº¡nh, notification failure tÄƒng hoáº·c upload media lá»—i báº¥t thÆ°á»ng.

### Sau MVP

1. Terraform cho GCP resources: GKE, Artifact/GHCR access, DNS, static IP, service accounts vÃ  secret wiring.
2. HPA vÃ  autoscaling policy.
3. Managed database/PITR, Æ°u tiÃªn Cloud SQL náº¿u deploy production tháº­t.
4. Multi-region/failover náº¿u cÃ³ nhu cáº§u production lá»›n.

## Lá»‡nh nhanh

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
# ÄÃ¡nh giÃ¡ DevOps - Luyá»‡n Thi LÃ¡i Xe Microservices

**NgÃ y cáº­p nháº­t**: 2026-05-27
**Branch gá»‘c**: `devops/baseline-local-stability`
**Commit CI Ä‘Ã£ xÃ¡c minh trÆ°á»›c Ä‘Ã³**: `2265ae813da9294db4bd7276c693b7d0db7748de`
**Ghi chÃº**: `docs/devops/devops-status-report.md` lÃ  báº£n tá»•ng káº¿t ngáº¯n gá»n/láº¡c quan hÆ¡n. File nÃ y ghi láº¡i baseline chi tiáº¿t hÆ¡n Ä‘á»ƒ tiáº¿p tá»¥c cÃ¡c phase DevOps.

## 1. Káº¿t luáº­n nhanh

Dá»± Ã¡n Ä‘Ã£ chá»‘t baseline:

- Production scope: **10 services**.
- `docs-service`: **chá»‰ dÃ¹ng cho dev**, khÃ´ng Ä‘Æ°a vÃ o staging/production.
- Development cÃ³ thá»ƒ cháº¡y 11 services náº¿u cáº§n `docs-service`.
- Staging/production Consul seed vÃ  deploy chá»‰ gá»“m 10 production services.

Tráº¡ng thÃ¡i hiá»‡n táº¡i:

| Háº¡ng má»¥c | Tráº¡ng thÃ¡i | Ghi chÃº |
| --- | --- | --- |
| Phase 0 Baseline | ÄÃ£ xong | README Ä‘Ã£ mÃ´ táº£ local/full-stack, production 10 services, `docs-service` dev-only. |
| Phase 1 Local/Dev | Gáº§n xong | `.env.example`, deploy env examples, Consul seed optional media storage, health endpoints vÃ  AppLogger Ä‘Ã£ cÃ³ trÃªn services. Runtime smoke cáº§n cháº¡y láº¡i khi Docker Desktop/DNS á»•n Ä‘á»‹nh. |
| Phase 3 DevSecOps | ÄÃ£ Ä‘á»§ baseline | CI run #154 pass trÃªn commit `2265ae8`; 10 production images build + Trivy HIGH/CRITICAL scan success. |
| Phase 4 CI/CD | Äang hoÃ n thiá»‡n | ÄÃ£ tÃ¡ch PR validation, main image release, auto deploy GCP staging vÃ  production release manual; cáº§n GitHub Actions verify sau khi merge. |
| Phase 5 Deployment Runtime | Äang hoÃ n thiá»‡n | Kubernetes Helm path Ä‘Ã£ scaffold vÃ  target chÃ­nh Ä‘Ã£ Ä‘á»•i sang GCP/GKE: app services, in-cluster dependencies, Ingress, probes, resources, Consul seed vÃ  Prisma migration Job. K3s/VPS chá»‰ cÃ²n lÃ  lab/fallback legacy. |
| Phase 9 IaC/Scaling | ChÆ°a lÃ m | ChÆ°a cÃ³ `terraform`, HPA hoáº·c load test; cÃ¡c pháº§n nÃ y tÃ¡ch khá»i Phase 5. |

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

## 3. Chá»‘t Phase 3 DevSecOps

Phase 3 DevSecOps cÃ³ thá»ƒ chá»‘t baseline vÃ¬ cÃ¡c má»¥c cáº§n thiáº¿t Ä‘Ã£ qua:

- Hardcoded secrets trong Compose/Consul seed Ä‘Ã£ chuyá»ƒn sang env variable hoáº·c placeholder.
- `.env.example`, `deploy/staging.env.example`, `deploy/production.env.example` Ä‘Ã£ chuáº©n hÃ³a.
- `scripts/consul-seed.ts` há»— trá»£ env interpolation.
- `docker/consul/init.sh` khÃ´ng crash khi thiáº¿u media storage optional.
- Docker runtime image Ä‘Ã£ prune dev dependencies.
- Runtime image Ä‘Ã£ xÃ³a `npm`, `npx`, `corepack`, `yarn` Ä‘á»ƒ giáº£m CVE surface.
- GitHub Actions Ä‘Ã£ cÃ³ Trivy image scan vá»›i `severity: CRITICAL,HIGH`, `exit-code: 1`.
- PR thay Ä‘á»•i DevOps/shared files sáº½ build/scan Ä‘á»§ 10 production services.
- `media-service` Ä‘Ã£ nÃ¢ng `multer` lÃªn `^2.1.1`.
- CI run #154 trÃªn commit `2265ae813da9294db4bd7276c693b7d0db7748de` pass:
  - Code Quality & Testing: success.
  - Detect Changed Services: success.
  - Build Services cho 10 production services: success.
  - Trivy scan cho tá»«ng image: success.
  - Push image: skipped Ä‘Ãºng ká»³ vá»ng vÃ¬ run trÃªn PR.

Rá»§i ro cÃ²n láº¡i:

- Náº¿u secret tháº­t tá»«ng bá»‹ paste/push, cáº§n rotate ngoÃ i repo.
- ChÆ°a cÃ³ SBOM/signing/CodeQL nhÆ° lá»›p hardening bá»• sung.
- Production secret store chÆ°a Ä‘Æ°á»£c chá»n chÃ­nh thá»©c; vá»›i GCP nÃªn Æ°u tiÃªn Google Secret Manager hoáº·c Vault.

## 4. Baseline Phase 4 CI/CD

Working tree hiá»‡n Ä‘ang Ä‘á»‹nh hÆ°á»›ng Phase 4 nhÆ° sau:

- `.github/workflows/pr-validation.yml`
  - Trigger: pull request vÃ o `main`.
  - Cháº¡y quality gate: `pnpm install --frozen-lockfile`, Prisma generate, Biome, typecheck, test.
  - Detect changed services.
  - Build Docker image vÃ  scan Trivy.
  - KhÃ´ng login GHCR, khÃ´ng push image.
  - Tá»± Ä‘á»™ng label PR theo service bá»‹ áº£nh hÆ°á»Ÿng.

- `.github/workflows/ci.yml`
  - Trigger: push vÃ o `main`.
  - Cháº¡y quality gate.
  - TrÃªn push vÃ o `main`, build Ä‘á»§ 10 production services Ä‘á»ƒ Ä‘áº£m báº£o cÃ¹ng má»™t immutable tag `${github.sha}` tá»“n táº¡i cho toÃ n bá»™ Helm release.
  - Build vÃ  Trivy scan toÃ n bá»™ required services.
  - Push GHCR vá»›i 2 tag: `${github.sha}` vÃ  `latest`.
  - Auto deploy GCP staging báº±ng Helm sau khi build image vÃ  migration-runner thÃ nh cÃ´ng.
  - CÃ³ thá»ƒ táº¡m táº¯t auto deploy báº±ng repository variable `GCP_AUTO_DEPLOY_ENABLED=false`.
  - Staging job gáº¯n GitHub Environment `staging`.

- `.github/workflows/production-release.yml`
  - Trigger: `workflow_dispatch`.
  - Input: immutable `image_tag`, thÆ°á»ng lÃ  Git SHA Ä‘Ã£ pass Main Image Release.
  - Job gáº¯n GitHub Environment `production`.
  - Cáº§n cáº¥u hÃ¬nh manual approval/reviewer trong GitHub Environments.

Deployment secrets/vars cáº§n cáº¥u hÃ¬nh:

Kubernetes/GCP/GKE path:

- Repository variable optional: `GCP_AUTO_DEPLOY_ENABLED=false` náº¿u cáº§n táº¡m táº¯t auto deploy GCP staging. Máº·c Ä‘á»‹nh workflow sáº½ deploy sau má»—i push vÃ o `main`.
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

Legacy SSH/Compose path, chá»‰ dÃ¹ng náº¿u deploy lÃªn VM/Compute Engine báº±ng Docker Compose:

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

## 5. Ghi chÃº Deploy/Migration

Runtime images cá»‘ Ã½ xÃ³a `npm/npx`, nÃªn deploy khÃ´ng Ä‘Æ°á»£c cháº¡y migrations trá»±c tiáº¿p trong application runtime containers.

Working tree hiá»‡n xá»­ lÃ½ viá»‡c nÃ y báº±ng cÃ¡ch:

- ThÃªm `migration-runner` service trong `docker-compose.deploy.yml` dá»±a trÃªn `node:20-alpine`.
- Upload tá»«ng thÆ° má»¥c `prisma/` cá»§a production service lÃªn remote deploy path.
- Cháº¡y `prisma migrate deploy` tá»« `migration-runner` vá»›i `DATABASE_URL` inject theo tá»«ng service.

CÃ¡ch nÃ y giá»¯ application runtime images nhá»/hardened, Ä‘á»“ng thá»i váº«n cÃ³ deploy-time migration path.

## 6. Thá»© tá»± Æ°u tiÃªn cÃ²n láº¡i

Thá»© tá»± khuyáº¿n nghá»‹ tiáº¿p theo:

1. Validate workflow YAML vÃ  Compose deploy config locally.
2. Merge/push Phase 4 changes vÃ  verify PR Validation/Main Image Release behavior.
3. Cáº¥u hÃ¬nh GitHub Environments:
   - `staging` cho automatic deploy.
   - `production` vá»›i required reviewers/manual approval.
4. Cáº¥u hÃ¬nh Phase 5 Kubernetes runtime:
   - GCP/GKE cluster lÃ  target chÃ­nh.
   - Ingress controller/load balancer, DNS records vÃ  optional static IP trÃªn GCP.
   - GitHub variables: `STAGING_API_HOST`, `STAGING_AUTH_HOST`, `STAGING_FRONTEND_ORIGIN`, vÃ  production equivalents.
   - GitHub secrets: `STAGING_KUBE_CONFIG_B64`, `PRODUCTION_KUBE_CONFIG_B64`, `GHCR_PULL_USERNAME`, `GHCR_PULL_TOKEN`, DB/RabbitMQ/Keycloak/storage secrets.
5. Verify Helm deployment:
   - `helm lint charts/luyen-thi-lai-xe`.
   - `helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml`.
   - Staging deploy qua main workflow vÃ  smoke test qua Kong.
   - Production manual release vá»›i `workflow_dispatch` vÃ  Helm rollback test.
6. ThÃªm SBOM/signing/CodeQL sau khi Phase 5 deploy path á»•n Ä‘á»‹nh.

## 7. Baseline Phase 5 Kubernetes

Phase 5 target Ä‘Ã£ Ä‘á»•i sang Kubernetes Helm trÃªn GCP/GKE, self-contained trong cluster cho giai Ä‘oáº¡n MVP. K3s/VPS chá»‰ cÃ²n lÃ  lab/fallback legacy.

Baseline Ä‘Ã£ implement:

- Helm chart `charts/luyen-thi-lai-xe` deploy 10 production services, Kong, Keycloak, Postgres, RabbitMQ, Redis vÃ  Consul.
- Kubernetes `Secret` dÃ¹ng cho password/token/storage; Consul seed Job chá»‰ seed non-secret config.
- App Deployments cÃ³ `resources.requests`, `resources.limits`, `/health/live` vÃ  `/health/ready` probes.
- `Dockerfile.migration-runner` build image riÃªng cho Prisma migration Job.
- GitHub Actions deploy staging/production báº±ng Helm vÃ  kubeconfig base64.
- `scripts/k8s-smoke.sh` verify health endpoints qua Kong.

KhÃ´ng náº±m trong Phase 5:

- Terraform, HPA, k6/JMeter.
- Full ELK/Prometheus/Grafana trÃªn Kubernetes.
- Vault/External Secrets.


