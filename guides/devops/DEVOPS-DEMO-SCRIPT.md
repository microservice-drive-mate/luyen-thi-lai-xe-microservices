# Kịch bản presentation và demo DevOps - GitHub Actions CI/CD

Tài liệu này dùng để quay video demo và thuyết trình phần DevOps của dự án
**Luyện Thi Lái Xe Microservices**. Narrative chính: từ một monorepo 10
microservices đến một hệ thống có quy trình DevOps bằng Docker, GitHub Actions,
GHCR, Helm/Kubernetes, health check, observability, resilience và backup/restore.

## 1. Thông điệp chính

- CI/CD chính thức của dự án là **GitHub Actions**.
- Jenkins chỉ là hướng thử nghiệm ban đầu, không đưa vào presentation/demo chính.
- Production scope gồm 10 services:
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
- `docs-service` chỉ dùng cho dev/docs, không thuộc production deploy.
- Mục tiêu không phải claim enterprise production hoàn chỉnh, mà là chứng minh
  dự án đã có DevOps baseline mạnh cho MVP/demo và roadmap hardening rõ ràng.

## 2. Thời lượng gợi ý

| Phần                                   | Thời lượng | Nội dung chính                                                                                          |
| --------------------------------------- | ------------: | --------------------------------------------------------------------------------------------------------- |
| Mở bài                                |       1 phút | Vấn đề DevOps của microservices.                                                                      |
| Architecture & tech stack               |       2 phút | Monorepo, NestJS, DDD/Clean Architecture, Kong, Keycloak, Consul, RabbitMQ, Redis, PostgreSQL.            |
| Local/dev runtime                       |       2 phút | Hybrid mode và full Docker mode.                                                                         |
| Containerization & DB lifecycle         |       2 phút | Dockerfile, hardened runtime, migration-runner, Prisma migration/seed.                                    |
| GitHub Actions CI/CD                    |       4 phút | PR validation, main image release, GHCR, Trivy, SBOM, Cosign, production release, rollback.               |
| Helm/Kubernetes + GCP/IaC               |       3 phút | Helm chart, probes, resources, migration job, Terraform GCP/K3s, HPA baseline.                            |
| Observability, DORA, resilience, backup |       5 phút | Prometheus/Grafana/ELK/Jaeger, DORA/business metrics, RabbitMQ DLQ, local + GCP/GCS backup, restore test. |
| Kết luận & Q&A                        |       1 phút | Mức đã làm và roadmap production hardening.                                                          |

Tổng thời lượng khuyến nghị: **20 phút**. Nếu chỉ có 10-12 phút, rút gọn
observability/resilience/backup thành một phần tổng hợp 2 phút và chỉ demo các
lệnh smoke chính.

## 3. Chuẩn bị trước khi quay/demo

Mở sẵn các tab:

- GitHub repository.
- GitHub Actions:
  - `Pull Request Validation`
  - `Main Image Release`
  - `Production Release`
  - `Rollback Release`
  - `DORA Metrics Report`
- GHCR packages của các service.
- Grafana dashboards nếu local stack đang chạy:
  - `Microservices Observability`
  - `DORA Metrics`
  - `Business Metrics`
- Jaeger UI nếu demo tracing.
- Swagger/docs hoặc Kong endpoint nếu môi trường đang chạy.

Mở terminal tại root repo:

```bash
git status --short --branch
```

Nếu demo local/hybrid:

```bash
npm install
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
```

Nếu có môi trường Kubernetes/staging đang chạy:

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
```

Phương án dự phòng nếu internet/GitHub/GCP gặp vấn đề:

- Dùng screenshot hoặc video quay trước của GitHub Actions pass.
- Dùng output/log đã lưu từ lần chạy trước.
- Demo local bằng Docker Compose.
- Mở file cấu hình để giải thích thay cho live deploy.

## 4. Mở bài

Lời thoại gợi ý:

> Phần DevOps của dự án tập trung giải quyết 3 vấn đề chính. Thứ nhất là làm
> sao để 10 microservices chạy nhất quán ở local, Docker và môi trường cloud.
> Thứ hai là mỗi lần merge code vào `main` đều có pipeline tự động kiểm tra,
> build, scan bảo mật và phát hành image. Thứ ba là môi trường deploy phải có
> health check, smoke test, observability, rollback và backup/restore.

Điểm nhấn:

- Đây là microservices, nên DevOps không chỉ là "chạy được Docker".
- DevOps bao gồm vòng đời: build, test, release, deploy, monitor, recover.
- CI/CD chính thức là GitHub Actions vì tích hợp trực tiếp với repo, GHCR,
  workflow dispatch, GitHub Environments, artifacts, SBOM và deployment events.

## 5. Architecture & Tech Stack

Mở file:

- `README.md`
- `package.json`
- `apps/exam-service/src`
- `packages/common/src/index.ts`

Nội dung cần trình bày:

- Monorepo dùng `npm workspaces` và `turbo`.
- Backend chính là NestJS + TypeScript.
- Service code theo Clean Architecture/DDD:
  - `presentation`: controller, DTO, messaging adapter.
  - `application`: use case, command/query, ports.
  - `domain`: aggregate, event, exception, repository interface.
  - `infrastructure`: Prisma, RabbitMQ, cache, filters, external clients.
- Platform dependencies:
  - Kong làm API Gateway.
  - Keycloak làm identity provider.
  - Consul làm config KV store.
  - RabbitMQ làm message broker.
  - Redis cho cache/token blacklist.
  - PostgreSQL per service.
  - Prisma migration cho DB lifecycle.
- `packages/common` gom logger, health, metrics, tracing, correlation id,
  resilient HTTP, RabbitMQ resilience và shared DDD base classes.

## 6. Local/Dev Environment

Mở file:

- `README.md`
- `package.json`
- `docker-compose.infra.yml`
- `docker-compose.yaml`
- `kong/kong.dev.yaml`
- `consul-seed-development-local.json`

Lời thoại gợi ý:

> Ở local, nhóm có 2 cách chạy. Hybrid mode dùng Docker cho hạ tầng như
> PostgreSQL, RabbitMQ, Consul, Keycloak, Kong, Redis; còn NestJS services chạy
> local để debug. Full Docker mode thì toàn bộ app và infra đều chạy container.
> Cách này giúp thành viên mới clone repo có thể dựng môi trường nhanh và nhất
> quán.

Lệnh demo:

```bash
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
npm run smoke
```

Điểm nhấn:

- Root scripts chuẩn hóa thao tác DevOps hằng ngày.
- Consul seed giúp config nhất quán theo môi trường.
- `npm run smoke` verify health của 10 production services qua Kong.

## 7. Containerization

Mở file:

- `apps/user-service/Dockerfile`
- `Dockerfile.service`
- `Dockerfile.migration-runner`
- `docker-compose.yaml`

Nội dung cần trình bày:

- Mỗi production service có Dockerfile riêng.
- Dockerfile dùng multi-stage build: prune/install/build/runner.
- Runtime image prune dev dependencies.
- Runtime image xóa `npm`, `npx`, `corepack`, `yarn` để giảm CVE surface.
- Prisma client được generate trước khi prune.
- Migration được tách sang `migration-runner`, không chạy trực tiếp trong app
  runtime container.

Lời thoại gợi ý:

> Điểm quan trọng là runtime container chỉ cần chạy app, không cần tool build hay
> package manager. Migration được tách riêng để vừa giữ image gọn/hardened, vừa
> vẫn có deploy-time migration path.

## 8. Configuration & Database Lifecycle

Mở file:

- `.env.example`
- `deploy/staging.env.example`
- `deploy/production.env.example`
- `consul-seed-*.json`
- `scripts/consul-seed.ts`
- `scripts/prisma-migrate-all.ts`
- `scripts/prisma-seed-all.ts`

Nội dung cần trình bày:

- Config thường được seed qua Consul.
- Secret hiện tại dùng env/Kubernetes Secret baseline.
- DB schema được quản lý bằng Prisma migration.
- Root migration script đọc DB URL từ Consul và chạy migration cho 10 services.
- Seed script tạo demo data cho local/staging.

Lệnh demo:

```bash
npm run consul:seed:local
npm run db:deploy
npm run db:seed
```

Điểm cần nói thật:

- Đã có env template và K8s Secret baseline.
- Production hardening tiếp theo là Google Secret Manager hoặc Vault.

## 9. CI/CD bằng GitHub Actions

Mở file:

- `.github/workflows/pr-validation.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/production-release.yml`
- `.github/workflows/rollback-release.yml`
- `.github/workflows/devops-smoke.yml`
- `.github/workflows/dora-report.yml`
- `.github/workflows/incident-labeler.yml`

### 9.1 Pull Request Validation

Lời thoại gợi ý:

> Khi có pull request vào `main`, pipeline PR validation chạy quality gate:
> install dependency, generate Prisma client, Biome check, TypeScript check,
> test, detect service bị ảnh hưởng, build Docker image và scan Trivy. Ở PR,
> image chỉ build và scan, không push lên registry.

Điểm nhấn:

- PR không push image để tránh registry bị rác.
- Thay đổi shared/devops files sẽ build/scan đủ 10 production services.
- Trivy fail nếu có HIGH/CRITICAL vulnerability chưa được ignore.

### 9.2 Main Image Release

Lời thoại gợi ý:

> Sau khi merge vào `main`, workflow `Main Image Release` build đủ 10 production
> images và `migration-runner`. Việc build đủ 10 images là có chủ ý, vì Helm
> release dùng cùng một `global.imageTag`, thường là Git SHA. Nếu chỉ build một
> service, các service còn lại sẽ không có image tag đó.

Nội dung cần chỉ trong workflow:

- build 10 services.
- build migration-runner.
- scan Trivy HIGH/CRITICAL.
- generate SBOM SPDX.
- push GHCR với `${github.sha}` và `latest`.
- Cosign keyless signing.
- SBOM attestation.
- deploy staging bằng Helm nếu `GCP_AUTO_DEPLOY_ENABLED` không tắt.

### 9.3 Production Release

Lời thoại gợi ý:

> Production không tự deploy mỗi lần push. Production release là manual
> workflow, yêu cầu nhập immutable `image_tag` và có GitHub Environment
> `production` để bật reviewer/manual approval.

### 9.4 Rollback Release

Lời thoại gợi ý:

> Nếu deploy lỗi, nhóm có workflow rollback. Workflow yêu cầu chọn môi trường,
> nhập Helm revision, xác nhận rollback, chạy `helm rollback`, đợi rollout,
> smoke test và ghi deployment event cho DORA.

### 9.5 DevOps smoke và DORA automation

Nội dung cần trình bày:

- `devops-smoke.yml` chạy thủ công bằng `workflow_dispatch`, có thể chọn suite:
  - `observability`
  - `rabbitmq`
  - `restore`
  - `all`
- Workflow này nhận URL Prometheus, Alertmanager, Grafana, Elasticsearch,
  Kibana, RabbitMQ Management và file backup cần restore test.
- `dora-report.yml` chạy thủ công hoặc định kỳ hằng tuần, tải deployment event
  artifacts rồi tạo DORA report và Prometheus metrics.
- `incident-labeler.yml` tự gắn label chuẩn cho incident/postmortem issues để
  dữ liệu MTTR và Change Failure Rate nhất quán hơn.

Lời thoại gợi ý:

> Ngoài pipeline release, repo còn có workflow vận hành. `devops-smoke` dùng để
> kiểm tra observability, RabbitMQ topology và restore test khi cần. `dora-report`
> tổng hợp deployment events thành DORA metrics, còn `incident-labeler` chuẩn hóa
> incident labels để tính MTTR và Change Failure Rate.

## 10. GHCR Image Registry

Mở GitHub Packages/GHCR hoặc dùng lệnh minh họa:

```bash
docker pull ghcr.io/<github-owner>/luyen-thi-lai-xe-user-service:<git-sha>
docker pull ghcr.io/<github-owner>/luyen-thi-lai-xe-migration-runner:<git-sha>
```

Lời thoại gợi ý:

> GCP/Kubernetes không build source code trực tiếp. GitHub Actions build và scan
> image, sau đó push lên GHCR. Runtime chỉ pull image theo immutable tag. Đây là
> nguyên tắc build once, deploy many.

Nếu thầy hỏi vì sao chưa dùng Google Artifact Registry:

> Hiện tại nhóm dùng GHCR vì tích hợp trực tiếp với GitHub Actions và repo. Khi
> production hóa sâu hơn trên GCP, có thể mirror/chuyển image sang Google
> Artifact Registry, nhưng nguyên tắc DevOps vẫn không đổi.

## 11. Deployment Runtime với Helm/Kubernetes

Mở file:

- `charts/luyen-thi-lai-xe/values.yaml`
- `charts/luyen-thi-lai-xe/templates/apps.yaml`
- `charts/luyen-thi-lai-xe/templates/jobs.yaml`
- `charts/luyen-thi-lai-xe/templates/hpa.yaml`
- `guides/devops/GCP-SETUP.md`
- `docs/phase-3-4-5-9-operations.md`
- `docs/phase-9-gcp-iac-load-test.md`

Nội dung cần trình bày:

- Helm chart deploy 10 production services.
- Chart deploy thêm Kong, Keycloak, PostgreSQL, RabbitMQ, Redis, Consul và
  Jaeger baseline.
- App deployment có:
  - `resources.requests`
  - `resources.limits`
  - liveness probe `/health/live`
  - readiness probe `/health/ready`
  - init containers đợi Consul seed và migration job.
- `global.imageRegistry` trỏ về GHCR.
- `global.imageTag` là immutable tag cần deploy.
- `migration-runner` chạy Prisma migration ngoài runtime container.
- Terraform đã có module GCP tạo VM Compute Engine chạy K3s, static IP,
  firewall, startup script và kubeconfig output.
- GCP/K3s guide ghi nhận staging đã deploy được, smoke qua Kong pass, k6 load
  nội bộ pass, HPA từng scale up `exam-service` và `course-service` rồi scale
  down lại.
- HPA có template trong Helm và một số service đã bật; khi demo live cần kiểm
  tra `kubectl get hpa` có CPU/memory thật thay vì `<unknown>`.

Lệnh demo nếu có cluster:

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
kubectl get hpa -n staging
kubectl top pods -n staging
```

Lệnh Terraform/GCP nên show trên slide hoặc terminal nếu không chạy live:

```powershell
terraform -chdir=terraform init
terraform -chdir=terraform validate
terraform -chdir=terraform plan -var-file=terraform.tfvars
terraform -chdir=terraform output public_ip
terraform -chdir=terraform output api_host
terraform -chdir=terraform output auth_host
```

Lệnh k6 load test đã có trong repo:

```powershell
docker run --rm `
  -v "${PWD}/load-tests:/scripts:ro" `
  -e BASE_URL="https://api.<static-ip>.nip.io" `
  grafana/k6 run --insecure-skip-tls-verify /scripts/scenarios/smoke.js

docker run --rm `
  -v "${PWD}/load-tests:/scripts:ro" `
  -e BASE_URL="https://api.<static-ip>.nip.io" `
  grafana/k6 run --insecure-skip-tls-verify /scripts/scenarios/load.js
```

Lời thoại gợi ý:

> Ngoài Helm chart, repo còn có Phase 9 baseline cho GCP: Terraform tạo VM
> Compute Engine chạy K3s, startup script cài metrics-server, Helm deploy app,
> HPA theo dõi CPU/memory và k6 dùng để smoke/load/stress/spike test. Đây chưa
> phải managed Kubernetes enterprise, nhưng là một đường deploy cloud hoàn chỉnh
> cho demo môn học.

## 12. Health Check & Smoke Test

Mở file:

- `scripts/smoke.ts`
- `scripts/k8s-smoke.sh`
- `packages/common/src/health`

Lệnh demo local:

```bash
npm run smoke
```

Lệnh demo Kubernetes:

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

Lời thoại gợi ý:

> Smoke test không kiểm tra sâu nghiệp vụ, nhưng xác nhận 10 production services
> có thể truy cập qua Kong và health endpoints phản hồi đúng. Đây là bước bắt
> buộc sau deploy để phát hiện lỗi rollout sớm.

## 13. Observability

Mở file:

- `packages/common/src/metrics`
- `packages/common/src/logger`
- `packages/common/src/tracing`
- `docker/prometheus/prometheus.yml`
- `docker/prometheus/alerts.yml`
- `docker/grafana/dashboards/microservices-observability.json`
- `guides/devops/OBSERVABILITY-ELK.md`
- `guides/devops/OBSERVABILITY-RUNBOOK.md`
- `guides/devops/OPENTELEMETRY-JAEGER-TRACING.md`

Lệnh demo:

```bash
npm run observability:smoke
```

Nếu local stack đang chạy:

```bash
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready
curl http://localhost:3002/metrics
curl -H "x-correlation-id: demo-trace-001" http://localhost:8000/user-service/health
```

Nội dung cần trình bày:

- Mỗi service expose health endpoints và `/metrics`.
- Prometheus scrape service metrics, RabbitMQ metrics và DORA metrics exporter.
- Grafana có dashboards cho microservices, DORA và business metrics.
- Alert rules gồm service down, high 5xx, high p95 latency, high CPU/memory,
  RabbitMQ retry backlog và DLQ.
- Winston logger có correlation id và optional Logstash transport.
- OpenTelemetry/Jaeger hỗ trợ trace end-to-end từ Kong đến NestJS services.

## 14. DORA & Business Metrics

Mở file:

- `.github/workflows/dora-report.yml`
- `.github/workflows/incident-labeler.yml`
- `.github/ISSUE_TEMPLATE/incident_report.yml`
- `.github/ISSUE_TEMPLATE/postmortem.yml`
- `scripts/devops-record-deployment.js`
- `scripts/devops-dora-report.ts`
- `scripts/devops-dora-prometheus-export.ts`
- `docker/grafana/dashboards/dora-metrics.json`
- `docker/grafana/dashboards/business-metrics.json`
- `guides/devops/DORA-METRICS.md`
- `guides/devops/BUSINESS-METRICS.md`

Lệnh demo:

```bash
npm run dora:report
npm run dora:export-prometheus
```

Nội dung cần trình bày:

- Deployment event được ghi sau deploy/rollback.
- Deployment events được upload artifact để DORA report không phụ thuộc hoàn
  toàn vào lịch sử workflow.
- Incident/postmortem issue templates chuẩn hóa dữ liệu sự cố.
- `incident-labeler.yml` tự gắn label như `incident`, `postmortem`, `sev1`,
  `sev2`, `change-failure`, `deploy-failure`, `rollback`, `production`,
  `staging`.
- DORA report gồm:
  - Deployment Frequency
  - Lead Time for Changes
  - MTTR
  - Change Failure Rate
- Business metrics gồm:
  - users created
  - exam sessions started/completed
  - pass/fail
  - course completion
  - notification delivery
  - media upload

Lời thoại gợi ý:

> Dự án không chỉ quan sát runtime mà còn đo hiệu quả delivery và giá trị
> nghiệp vụ. DORA metrics cho biết tốc độ/độ ổn định release, còn business
> metrics cho biết hệ thống đang tạo ra hành vi sản phẩm nào.

> Với MTTR và Change Failure Rate, repo có incident/postmortem templates và
> workflow tự gắn label. Nhờ vậy khi có sự cố thật, team có dữ liệu có cấu trúc
> để tổng hợp vào DORA report thay vì ghi chú rời rạc.

## 15. Resilience

Mở file:

- `packages/common/src/http/resilient-http-client.ts`
- `packages/common/src/messaging/rabbitmq-resilience.ts`
- `guides/devops/HTTP-RESILIENCE.md`
- `guides/devops/RABBITMQ-RESILIENCE.md`

Lệnh demo:

```bash
npm run rabbitmq:smoke
```

Nội dung cần trình bày:

- HTTP client có timeout, retry và circuit breaker.
- RabbitMQ consumer dùng durable queue, `noAck: false`, retry queue với TTL
  backoff, DLQ và metrics.
- Queue topology kỳ vọng:
  - `<queue>`
  - `<queue>.retry.1`
  - `<queue>.retry.2`
  - `<queue>.retry.3`
  - `<queue>.dlq`
- Idempotency hiện tại là memory TTL baseline; production hardening nên chuyển
  sang Redis hoặc database để durable hơn khi pod restart.

## 16. Backup, Restore & Runbook

Mở file:

- `guides/devops/BACKUP-STRATEGY.md`
- `docker/backup/postgres-daily-backup.sh`
- `docker/keycloak/keycloak-daily-export.sh`
- `scripts/db-backup-local.ts`
- `scripts/db-restore-test.ts`
- `guides/devops/INCIDENT-RUNBOOK.md`
- `guides/devops/OBSERVABILITY-RUNBOOK.md`

### 16.1 Backup local/Compose tự động

Nội dung cần trình bày:

- Phạm vi backup gồm 11 PostgreSQL databases:
  - 10 service DB: `identity_db`, `user_db`, `exam_db`, `course_db`,
    `question_db`, `notification_db`, `analytics_db`, `simulation_db`,
    `media_db`, `audit_db`.
  - `keycloak_db`.
- PostgreSQL backup dùng `pg_dump --format=custom`, tạo file `.dump`.
- Mỗi lần backup có:
  - `.dump` cho từng DB.
  - `.sha256` để kiểm tra checksum.
  - `manifest.csv` ghi service, database, host, port và file dump.
- Service `postgres-backup` đã có trong `docker-compose.infra.yml` và
  `docker-compose.deploy.yml`.
- Service backup chạy ngay khi container khởi động, sau đó lặp theo
  `BACKUP_INTERVAL_SECONDS`, mặc định 86400 giây.
- Retention:
  - daily retention qua `BACKUP_RETENTION_DAYS`, mặc định 7 ngày.
  - weekly snapshot vào Chủ nhật qua `BACKUP_WEEKLY_RETENTION_WEEKS`, mặc định
    4 tuần.

Lệnh demo local:

```bash
npm run db:backup:local
npm run db:backup:once
npm run db:restore:test
```

File/thư mục cần chỉ khi quay:

```text
backups/postgres/<env>/<timestamp>/
backups/postgres/weekly/<env>/<yyyy-Www>/
```

Lời thoại gợi ý:

> Backup không chỉ là một command thủ công. Trong Compose có service
> `postgres-backup` chạy định kỳ, backup đủ 10 service DB và `keycloak_db`, tạo
> checksum và manifest để biết bản backup gồm những gì. Khi quay demo, mình có
> thể chạy one-shot để tạo bằng chứng ngay, sau đó mở thư mục `backups/postgres`
> cho thầy thấy file `.dump`, `.sha256` và `manifest.csv`.

### 16.2 Keycloak backup 2 lớp

Nội dung cần trình bày:

- `keycloak_db` được backup bằng PostgreSQL dump giống các DB khác.
- Runtime realm config được export bằng `kcadm.sh` từ service
  `keycloak-backup`.
- Artifact Keycloak export gồm:
  - `realm.json`
  - `users.json`
  - `clients.json`
  - `roles.json`
  - `SHA256SUMS`
  - `manifest.csv`
- Keycloak export cũng có daily retention và weekly snapshot.

Lệnh demo:

```bash
npm run keycloak:backup:once
```

File/thư mục cần chỉ khi quay:

```text
backups/keycloak/<env>/<timestamp>/
backups/keycloak/weekly/<env>/<yyyy-Www>/
```

Lời thoại gợi ý:

> Với Keycloak, nhóm backup theo 2 lớp. Lớp phục hồi đầy đủ nhất là
> `keycloak_db` dump. Lớp thứ hai là export realm runtime config để review cấu
> hình, kiểm tra drift và có thể phục hồi thủ công một phần nếu cần.

### 16.3 Backup trên GCP/K3s và Google Cloud Storage

Nội dung cần trình bày:

- Khi deploy lên GCP hiện tại, hệ thống chạy theo mô hình K3s trên Compute
  Engine VM.
- PostgreSQL và Keycloak vẫn chạy trong namespace `staging`, dữ liệu nằm trên
  PVC `local-path`.
- Vì chưa dùng Cloud SQL automated backup/PITR, repo đã có hướng dẫn backup GCP
  theo hướng:
  - exec vào PostgreSQL pod để chạy `pg_dump --format=custom`.
  - tạo checksum và `manifest.csv`.
  - copy backup ra ngoài VM.
  - đẩy backup quan trọng lên Google Cloud Storage làm bản offsite.

Lệnh demo backup một DB trên GCP/K3s:

```bash
NAMESPACE=staging
POSTGRES_POD=$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/component=postgres -o jsonpath='{.items[0].metadata.name}')
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="backups/gcp/postgres/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-privileges --username "$POSTGRES_USER" --dbname user_db' \
  > "$BACKUP_DIR/user-service_staging_$TIMESTAMP.dump"

sha256sum "$BACKUP_DIR/user-service_staging_$TIMESTAMP.dump" \
  > "$BACKUP_DIR/user-service_staging_$TIMESTAMP.dump.sha256"
```

Lệnh đẩy backup lên Google Cloud Storage:

```bash
# Chỉ cần tạo bucket một lần; nếu bucket đã tồn tại thì bỏ qua bước create.
gcloud storage buckets create gs://<project-id>-luyen-thi-lai-xe-backups \
  --location=asia-southeast1 \
  --uniform-bucket-level-access

gcloud storage cp --recursive "$BACKUP_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"

gcloud storage ls "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"
```

Lệnh backup Keycloak realm trên GCP/K3s:

```bash
NAMESPACE=staging
KEYCLOAK_POD=$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/component=keycloak -o jsonpath='{.items[0].metadata.name}')
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
EXPORT_DIR="backups/gcp/keycloak/$TIMESTAMP"
mkdir -p "$EXPORT_DIR"

kubectl exec -n "$NAMESPACE" "$KEYCLOAK_POD" -- \
  /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN" \
  --password "$KEYCLOAK_ADMIN_PASSWORD"

kubectl exec -n "$NAMESPACE" "$KEYCLOAK_POD" -- \
  /opt/keycloak/bin/kcadm.sh get "realms/luyen-thi-lai-xe-realm" \
  > "$EXPORT_DIR/realm.json"

sha256sum "$EXPORT_DIR/realm.json" > "$EXPORT_DIR/SHA256SUMS"

gcloud storage cp --recursive "$EXPORT_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/keycloak/staging/$TIMESTAMP/"
```

Lời thoại gợi ý:

> Trên GCP/K3s, backup không chỉ nằm trên disk của VM. Repo có hướng dẫn tạo
> dump từ PostgreSQL pod, sinh checksum/manifest rồi copy lên Google Cloud
> Storage. Vì vậy nếu VM hoặc disk local-path gặp sự cố, nhóm vẫn có một bản
> offsite trong Cloud Storage để tải về restore test.

### 16.4 Restore rehearsal

Nội dung cần trình bày:

- `npm run db:restore:test` tạo PostgreSQL container tạm bằng
  `postgres:15-alpine`.
- Script chạy `pg_restore --list` để kiểm tra metadata backup.
- Script restore thật vào DB tạm bằng `pg_restore`.
- Sau khi test xong, container tạm được dọn.
- Có thể chỉ định file dump cụ thể bằng `RESTORE_TEST_BACKUP_FILE`.

Lệnh restore test local:

```bash
npm run db:restore:test
```

Lệnh restore test từ backup đã tải từ Google Cloud Storage:

```bash
gcloud storage cp \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/<timestamp>/user-service_staging_<timestamp>.dump" \
  "backups/gcp/restore-test/user-service_staging_<timestamp>.dump"

RESTORE_TEST_BACKUP_FILE=backups/gcp/restore-test/user-service_staging_<timestamp>.dump npm run db:restore:test
```

Khi quay demo, nên ghi lại:

- Tên bucket GCS.
- Timestamp backup.
- File `.dump` đã restore test.
- Output `Restore completed successfully` hoặc log pass tương đương.

### 16.5 Runbook liên quan

Runbook giúp cả team xử lý:

- DB down hoặc mất dữ liệu.
- Keycloak lỗi hoặc drift realm config.
- RabbitMQ queue backlog/DLQ.
- Service down hoặc rollout lỗi.
- Rollback release.

Điểm cần nói thật:

- Đã có luồng backup local/Compose tự động, restore test, và hướng dẫn backup
  GCP/K3s lên Google Cloud Storage.
- Chưa có Kubernetes CronJob tự động upload thẳng lên GCS.
- Chưa có Cloud SQL automated backup/PITR vì hiện tại GCP staging dùng
  PostgreSQL trong cluster.
- Roadmap production là thêm CronJob/Workload Identity/lifecycle rule cho GCS,
  hoặc chuyển PostgreSQL sang Cloud SQL và bật PITR.

## 17. Release Safety & Rollback

Mở file:

- `.github/workflows/rollback-release.yml`
- `guides/devops/GITHUB-ACTIONS-RELEASE-SAFETY.md`

Lệnh demo nếu có cluster:

```bash
npm run keycloak:backup:once
```

File/thư mục cần chỉ khi quay:

```text
backups/keycloak/<env>/<timestamp>/
backups/keycloak/weekly/<env>/<yyyy-Www>/
```

Lời thoại gợi ý:

> Rollback bằng Helm có thể đưa release về revision trước, gồm image tag và
> rendered config. Tuy nhiên database migration không tự reverse, nên production
> cần nguyên tắc backward-compatible migration hoặc migration mới để sửa dữ liệu.

## 18. Kết luận

Lời thoại gợi ý:

> Tổng kết lại, phần DevOps của dự án đã đi từ local bootstrap đến CI/CD bằng
> GitHub Actions, image registry, Helm/Kubernetes deployment và day-2 operations
> baseline. Dự án chưa claim là enterprise production hoàn chỉnh, nhưng đã có
> nền tảng tốt cho MVP: Docker, Consul config, DB migration, Trivy, SBOM,
> Cosign, GHCR, smoke test, observability, DORA/business metrics, resilience và
> backup/restore.

Roadmap production hardening:

- Google Secret Manager hoặc Vault.
- Tự động hóa backup GCP bằng Kubernetes CronJob upload thẳng lên Google Cloud
  Storage.
- Cloud SQL/PITR nếu chuyển từ PostgreSQL trong cluster sang managed database.
- Admission policy verify Cosign signature.
- Mở rộng Terraform cho managed database, DNS, TLS, bucket lifecycle và service
  accounts.
- Verify rollback/staging live nhiều lần hơn.

## 19. Checklist demo nhanh

### Local/hybrid

```bash
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
npm run smoke
npm run observability:smoke
npm run rabbitmq:smoke
npm run db:restore:test
```

### GitHub Actions

1. Mở workflow `Pull Request Validation`.
2. Chỉ vào quality gate: install, Prisma generate, Biome, typecheck, test.
3. Mở workflow `Main Image Release`.
4. Chỉ vào build 10 images, Trivy scan, SBOM, Cosign, GHCR push.
5. Mở workflow `Production Release`.
6. Chỉ vào manual `image_tag` và environment `production`.
7. Mở workflow `Rollback Release`.
8. Chỉ vào Helm revision, rollback, smoke test và deployment event.
9. Mở workflow `DevOps Smoke Tests`.
10. Chỉ vào suite observability/RabbitMQ/restore.
11. Mở workflow `DORA Metrics Report`.
12. Chỉ vào bước download deployment event artifacts và export Prometheus metrics.

### Kubernetes nếu có staging

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
kubectl get hpa -n staging
kubectl top pods -n staging
helm history luyen-thi-lai-xe -n staging
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

### GCP/IaC/HPA/k6

```powershell
terraform -chdir=terraform validate
terraform -chdir=terraform output public_ip
terraform -chdir=terraform output api_host

docker run --rm `
  -v "${PWD}/load-tests:/scripts:ro" `
  -e BASE_URL="https://api.<static-ip>.nip.io" `
  grafana/k6 run --insecure-skip-tls-verify /scripts/scenarios/smoke.js

kubectl get hpa -n staging -w
```

### Backup local và cloud

```bash
npm run db:backup:once
npm run keycloak:backup:once
npm run db:restore:test

gcloud storage ls "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/"
RESTORE_TEST_BACKUP_FILE=backups/gcp/restore-test/user-service_staging_<timestamp>.dump npm run db:restore:test
```

## 20. Slide tóm tắt nên có

Slide 1 - Vấn đề:

- 10 microservices, nhiều DB/dependency.
- Cần setup nhất quán, release an toàn, quan sát và phục hồi.

Slide 2 - Architecture:

- Monorepo, NestJS, DDD/Clean Architecture.
- Kong, Keycloak, Consul, RabbitMQ, Redis, PostgreSQL.

Slide 3 - GitHub Actions Pipeline:

- PR validation.
- Main image release.
- GHCR.
- Trivy, SBOM, Cosign.
- Production manual release.
- Rollback workflow.

Slide 4 - Runtime:

- Docker Compose local/full-stack.
- Helm/Kubernetes.
- Terraform GCP/K3s baseline.
- Probes, resources, migration job, HPA baseline, k6 load test.

Slide 5 - Operations:

- Prometheus/Grafana/ELK/Jaeger.
- DORA và business metrics.
- RabbitMQ retry/DLQ.
- Local backup, GCP/K3s backup, Google Cloud Storage offsite copy.
- Restore rehearsal.
- Incident/postmortem templates, auto labels và runbooks.

Slide 6 - Roadmap:

- Secret Manager/Vault.
- Kubernetes CronJob upload backup lên GCS.
- Cloud SQL/PITR nếu nâng cấp managed DB.
- Admission policy verify image signature.
- Terraform mở rộng cho managed cloud resources.

## 21. Q&A có thể gặp

### Vì sao không trình bày Jenkins?

> Ban đầu nhóm có cân nhắc Jenkins, nhưng sau cùng chốt GitHub Actions là CI/CD
> chính vì tích hợp trực tiếp với GitHub repo, GHCR, GitHub Environments,
> workflow dispatch, artifact/SBOM và deployment events. Jenkins không nằm trong
> luồng demo chính để tránh làm thiếu rõ ràng về pipeline chính thức.

### Vì sao GCP/Kubernetes không build code trực tiếp?

> Theo nguyên tắc build once, deploy many. GitHub Actions build và scan image,
> sau đó push lên GHCR. Runtime chỉ pull image theo immutable tag, giúp artifact
> ổn định, dễ audit và dễ rollback.

### Nếu chỉ đổi một service, vì sao main workflow build đủ 10 images?

> Helm chart hiện dùng một `global.imageTag` cho toàn bộ release. Vì vậy Git SHA
> mới phải tồn tại cho cả 10 service images, nếu không một số deployment sẽ
> không pull được image tag đó.

### Nếu deploy lỗi thì sao?

> Helm deploy có `--wait`, `--wait-for-jobs` và timeout. Nếu rollout hoặc
> migration fail, workflow fail. Sau đó dùng logs, events, `helm history` để
> điều tra và dùng rollback workflow nếu cần quay về revision trước.

### Backup có chắc restore được không?

> Có. Local/Compose có `postgres-backup`, `keycloak-backup`, checksum và
> manifest. GCP/K3s có hướng dẫn tạo dump từ PostgreSQL pod rồi đẩy lên Google
> Cloud Storage làm bản offsite. Quan trọng hơn, dự án có `db:restore:test` và
> có thể chỉ định `RESTORE_TEST_BACKUP_FILE` để rehearsal restore từ file tải
> về từ GCS.
