# Ká»‹ch báº£n presentation vÃ  demo DevOps - GitHub Actions CI/CD

TÃ i liá»‡u nÃ y dÃ¹ng Ä‘á»ƒ quay video demo vÃ  thuyáº¿t trÃ¬nh pháº§n DevOps cá»§a dá»± Ã¡n
**Luyá»‡n Thi LÃ¡i Xe Microservices**. Narrative chÃ­nh: tá»« má»™t monorepo 10
microservices Ä‘áº¿n má»™t há»‡ thá»‘ng cÃ³ quy trÃ¬nh DevOps báº±ng Docker, GitHub Actions,
GHCR, Helm/Kubernetes, health check, observability, resilience vÃ  backup/restore.

## 1. ThÃ´ng Ä‘iá»‡p chÃ­nh

- CI/CD chÃ­nh thá»©c cá»§a dá»± Ã¡n lÃ  **GitHub Actions**.
- Jenkins chá»‰ lÃ  hÆ°á»›ng thá»­ nghiá»‡m ban Ä‘áº§u, khÃ´ng Ä‘Æ°a vÃ o presentation/demo chÃ­nh.
- Production scope gá»“m 10 services:
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
- `docs-service` chá»‰ dÃ¹ng cho dev/docs, khÃ´ng thuá»™c production deploy.
- Má»¥c tiÃªu khÃ´ng pháº£i claim enterprise production hoÃ n chá»‰nh, mÃ  lÃ  chá»©ng minh
  dá»± Ã¡n Ä‘Ã£ cÃ³ DevOps baseline máº¡nh cho MVP/demo vÃ  roadmap hardening rÃµ rÃ ng.

## 2. Thá»i lÆ°á»£ng gá»£i Ã½

| Pháº§n                                   | Thá»i lÆ°á»£ng | Ná»™i dung chÃ­nh                                                                                          |
| --------------------------------------- | ------------: | --------------------------------------------------------------------------------------------------------- |
| Má»Ÿ bÃ i                                |       1 phÃºt | Váº¥n Ä‘á» DevOps cá»§a microservices.                                                                      |
| Architecture & tech stack               |       2 phÃºt | Monorepo, NestJS, DDD/Clean Architecture, Kong, Keycloak, Consul, RabbitMQ, Redis, PostgreSQL.            |
| Local/dev runtime                       |       2 phÃºt | Hybrid mode vÃ  full Docker mode.                                                                         |
| Containerization & DB lifecycle         |       2 phÃºt | Dockerfile, hardened runtime, migration-runner, Prisma migration/seed.                                    |
| GitHub Actions CI/CD                    |       4 phÃºt | PR validation, main image release, GHCR, Trivy, SBOM, Cosign, production release, rollback.               |
| Helm/Kubernetes + GCP/IaC               |       3 phÃºt | Helm chart, probes, resources, migration job, Terraform GCP/K3s, HPA baseline.                            |
| Observability, DORA, resilience, backup |       5 phÃºt | Prometheus/Grafana/ELK/Jaeger, DORA/business metrics, RabbitMQ DLQ, local + GCP/GCS backup, restore test. |
| Káº¿t luáº­n & Q&A                        |       1 phÃºt | Má»©c Ä‘Ã£ lÃ m vÃ  roadmap production hardening.                                                          |

Tá»•ng thá»i lÆ°á»£ng khuyáº¿n nghá»‹: **20 phÃºt**. Náº¿u chá»‰ cÃ³ 10-12 phÃºt, rÃºt gá»n
observability/resilience/backup thÃ nh má»™t pháº§n tá»•ng há»£p 2 phÃºt vÃ  chá»‰ demo cÃ¡c
lá»‡nh smoke chÃ­nh.

## 3. Chuáº©n bá»‹ trÆ°á»›c khi quay/demo

Má»Ÿ sáºµn cÃ¡c tab:

- GitHub repository.
- GitHub Actions:
  - `Pull Request Validation`
  - `Main Image Release`
  - `Production Release`
  - `Rollback Release`
  - `DORA Metrics Report`
- GHCR packages cá»§a cÃ¡c service.
- Grafana dashboards náº¿u local stack Ä‘ang cháº¡y:
  - `Microservices Observability`
  - `DORA Metrics`
  - `Business Metrics`
- Jaeger UI náº¿u demo tracing.
- Swagger/docs hoáº·c Kong endpoint náº¿u mÃ´i trÆ°á»ng Ä‘ang cháº¡y.

Má»Ÿ terminal táº¡i root repo:

```bash
git status --short --branch
```

Náº¿u demo local/hybrid:

```bash
npm install
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
```

Náº¿u cÃ³ mÃ´i trÆ°á»ng Kubernetes/staging Ä‘ang cháº¡y:

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
```

PhÆ°Æ¡ng Ã¡n dá»± phÃ²ng náº¿u internet/GitHub/GCP gáº·p váº¥n Ä‘á»:

- DÃ¹ng screenshot hoáº·c video quay trÆ°á»›c cá»§a GitHub Actions pass.
- DÃ¹ng output/log Ä‘Ã£ lÆ°u tá»« láº§n cháº¡y trÆ°á»›c.
- Demo local báº±ng Docker Compose.
- Má»Ÿ file cáº¥u hÃ¬nh Ä‘á»ƒ giáº£i thÃ­ch thay cho live deploy.

## 4. Má»Ÿ bÃ i

Lá»i thoáº¡i gá»£i Ã½:

> Pháº§n DevOps cá»§a dá»± Ã¡n táº­p trung giáº£i quyáº¿t 3 váº¥n Ä‘á» chÃ­nh. Thá»© nháº¥t lÃ  lÃ m
> sao Ä‘á»ƒ 10 microservices cháº¡y nháº¥t quÃ¡n á»Ÿ local, Docker vÃ  mÃ´i trÆ°á»ng cloud.
> Thá»© hai lÃ  má»—i láº§n merge code vÃ o `main` Ä‘á»u cÃ³ pipeline tá»± Ä‘á»™ng kiá»ƒm tra,
> build, scan báº£o máº­t vÃ  phÃ¡t hÃ nh image. Thá»© ba lÃ  mÃ´i trÆ°á»ng deploy pháº£i cÃ³
> health check, smoke test, observability, rollback vÃ  backup/restore.

Äiá»ƒm nháº¥n:

- ÄÃ¢y lÃ  microservices, nÃªn DevOps khÃ´ng chá»‰ lÃ  "cháº¡y Ä‘Æ°á»£c Docker".
- DevOps bao gá»“m vÃ²ng Ä‘á»i: build, test, release, deploy, monitor, recover.
- CI/CD chÃ­nh thá»©c lÃ  GitHub Actions vÃ¬ tÃ­ch há»£p trá»±c tiáº¿p vá»›i repo, GHCR,
  workflow dispatch, GitHub Environments, artifacts, SBOM vÃ  deployment events.

## 5. Architecture & Tech Stack

Má»Ÿ file:

- `README.md`
- `package.json`
- `apps/exam-service/src`
- `packages/common/src/index.ts`

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Monorepo dÃ¹ng `npm workspaces` vÃ  `turbo`.
- Backend chÃ­nh lÃ  NestJS + TypeScript.
- Service code theo Clean Architecture/DDD:
  - `presentation`: controller, DTO, messaging adapter.
  - `application`: use case, command/query, ports.
  - `domain`: aggregate, event, exception, repository interface.
  - `infrastructure`: Prisma, RabbitMQ, cache, filters, external clients.
- Platform dependencies:
  - Kong lÃ m API Gateway.
  - Keycloak lÃ m identity provider.
  - Consul lÃ m config KV store.
  - RabbitMQ lÃ m message broker.
  - Redis cho cache/token blacklist.
  - PostgreSQL per service.
  - Prisma migration cho DB lifecycle.
- `packages/common` gom logger, health, metrics, tracing, correlation id,
  resilient HTTP, RabbitMQ resilience vÃ  shared DDD base classes.

## 6. Local/Dev Environment

Má»Ÿ file:

- `README.md`
- `package.json`
- `docker-compose.infra.yml`
- `docker-compose.yaml`
- `kong/kong.dev.yaml`
- `consul-seed-development-local.json`

Lá»i thoáº¡i gá»£i Ã½:

> á»ž local, nhÃ³m cÃ³ 2 cÃ¡ch cháº¡y. Hybrid mode dÃ¹ng Docker cho háº¡ táº§ng nhÆ°
> PostgreSQL, RabbitMQ, Consul, Keycloak, Kong, Redis; cÃ²n NestJS services cháº¡y
> local Ä‘á»ƒ debug. Full Docker mode thÃ¬ toÃ n bá»™ app vÃ  infra Ä‘á»u cháº¡y container.
> CÃ¡ch nÃ y giÃºp thÃ nh viÃªn má»›i clone repo cÃ³ thá»ƒ dá»±ng mÃ´i trÆ°á»ng nhanh vÃ  nháº¥t
> quÃ¡n.

Lá»‡nh demo:

```bash
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
npm run smoke
```

Äiá»ƒm nháº¥n:

- Root scripts chuáº©n hÃ³a thao tÃ¡c DevOps háº±ng ngÃ y.
- Consul seed giÃºp config nháº¥t quÃ¡n theo mÃ´i trÆ°á»ng.
- `npm run smoke` verify health cá»§a 10 production services qua Kong.

## 7. Containerization

Má»Ÿ file:

- `apps/user-service/Dockerfile`
- `Dockerfile.service`
- `Dockerfile.migration-runner`
- `docker-compose.yaml`

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Má»—i production service cÃ³ Dockerfile riÃªng.
- Dockerfile dÃ¹ng multi-stage build: prune/install/build/runner.
- Runtime image prune dev dependencies.
- Runtime image xÃ³a `npm`, `npx`, `corepack`, `yarn` Ä‘á»ƒ giáº£m CVE surface.
- Prisma client Ä‘Æ°á»£c generate trÆ°á»›c khi prune.
- Migration Ä‘Æ°á»£c tÃ¡ch sang `migration-runner`, khÃ´ng cháº¡y trá»±c tiáº¿p trong app
  runtime container.

Lá»i thoáº¡i gá»£i Ã½:

> Äiá»ƒm quan trá»ng lÃ  runtime container chá»‰ cáº§n cháº¡y app, khÃ´ng cáº§n tool build hay
> package manager. Migration Ä‘Æ°á»£c tÃ¡ch riÃªng Ä‘á»ƒ vá»«a giá»¯ image gá»n/hardened, vá»«a
> váº«n cÃ³ deploy-time migration path.

## 8. Configuration & Database Lifecycle

Má»Ÿ file:

- `.env.example`
- `deploy/staging.env.example`
- `deploy/production.env.example`
- `consul-seed-*.json`
- `scripts/consul-seed.ts`
- `scripts/prisma-migrate-all.ts`
- `scripts/prisma-seed-all.ts`

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Config thÆ°á»ng Ä‘Æ°á»£c seed qua Consul.
- Secret hiá»‡n táº¡i dÃ¹ng env/Kubernetes Secret baseline.
- DB schema Ä‘Æ°á»£c quáº£n lÃ½ báº±ng Prisma migration.
- Root migration script Ä‘á»c DB URL tá»« Consul vÃ  cháº¡y migration cho 10 services.
- Seed script táº¡o demo data cho local/staging.

Lá»‡nh demo:

```bash
npm run consul:seed:local
npm run db:deploy
npm run db:seed
```

Äiá»ƒm cáº§n nÃ³i tháº­t:

- ÄÃ£ cÃ³ env template vÃ  K8s Secret baseline.
- Production hardening tiáº¿p theo lÃ  Google Secret Manager hoáº·c Vault.

## 9. CI/CD báº±ng GitHub Actions

Má»Ÿ file:

- `.github/workflows/pr-validation.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/production-release.yml`
- `.github/workflows/rollback-release.yml`
- `.github/workflows/devops-smoke.yml`
- `.github/workflows/dora-report.yml`
- `.github/workflows/incident-labeler.yml`

### 9.1 Pull Request Validation

Lá»i thoáº¡i gá»£i Ã½:

> Khi cÃ³ pull request vÃ o `main`, pipeline PR validation cháº¡y quality gate:
> install dependency, generate Prisma client, Biome check, TypeScript check,
> test, detect service bá»‹ áº£nh hÆ°á»Ÿng, build Docker image vÃ  scan Trivy. á»ž PR,
> image chá»‰ build vÃ  scan, khÃ´ng push lÃªn registry.

Äiá»ƒm nháº¥n:

- PR khÃ´ng push image Ä‘á»ƒ trÃ¡nh registry bá»‹ rÃ¡c.
- Thay Ä‘á»•i shared/devops files sáº½ build/scan Ä‘á»§ 10 production services.
- Trivy fail náº¿u cÃ³ HIGH/CRITICAL vulnerability chÆ°a Ä‘Æ°á»£c ignore.

### 9.2 Main Image Release

Lá»i thoáº¡i gá»£i Ã½:

> Sau khi merge vÃ o `main`, workflow `Main Image Release` build Ä‘á»§ 10 production
> images vÃ  `migration-runner`. Viá»‡c build Ä‘á»§ 10 images lÃ  cÃ³ chá»§ Ã½, vÃ¬ Helm
> release dÃ¹ng cÃ¹ng má»™t `global.imageTag`, thÆ°á»ng lÃ  Git SHA. Náº¿u chá»‰ build má»™t
> service, cÃ¡c service cÃ²n láº¡i sáº½ khÃ´ng cÃ³ image tag Ä‘Ã³.

Ná»™i dung cáº§n chá»‰ trong workflow:

- build 10 services.
- build migration-runner.
- scan Trivy HIGH/CRITICAL.
- generate SBOM SPDX.
- push GHCR vá»›i `${github.sha}` vÃ  `latest`.
- Cosign keyless signing.
- SBOM attestation.
- deploy staging báº±ng Helm náº¿u `GCP_AUTO_DEPLOY_ENABLED` khÃ´ng táº¯t.

### 9.3 Production Release

Lá»i thoáº¡i gá»£i Ã½:

> Production khÃ´ng tá»± deploy má»—i láº§n push. Production release lÃ  manual
> workflow, yÃªu cáº§u nháº­p immutable `image_tag` vÃ  cÃ³ GitHub Environment
> `production` Ä‘á»ƒ báº­t reviewer/manual approval.

### 9.4 Rollback Release

Lá»i thoáº¡i gá»£i Ã½:

> Náº¿u deploy lá»—i, nhÃ³m cÃ³ workflow rollback. Workflow yÃªu cáº§u chá»n mÃ´i trÆ°á»ng,
> nháº­p Helm revision, xÃ¡c nháº­n rollback, cháº¡y `helm rollback`, Ä‘á»£i rollout,
> smoke test vÃ  ghi deployment event cho DORA.

### 9.5 DevOps smoke vÃ  DORA automation

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- `devops-smoke.yml` cháº¡y thá»§ cÃ´ng báº±ng `workflow_dispatch`, cÃ³ thá»ƒ chá»n suite:
  - `observability`
  - `rabbitmq`
  - `restore`
  - `all`
- Workflow nÃ y nháº­n URL Prometheus, Alertmanager, Grafana, Elasticsearch,
  Kibana, RabbitMQ Management vÃ  file backup cáº§n restore test.
- `dora-report.yml` cháº¡y thá»§ cÃ´ng hoáº·c Ä‘á»‹nh ká»³ háº±ng tuáº§n, táº£i deployment event
  artifacts rá»“i táº¡o DORA report vÃ  Prometheus metrics.
- `incident-labeler.yml` tá»± gáº¯n label chuáº©n cho incident/postmortem issues Ä‘á»ƒ
  dá»¯ liá»‡u MTTR vÃ  Change Failure Rate nháº¥t quÃ¡n hÆ¡n.

Lá»i thoáº¡i gá»£i Ã½:

> NgoÃ i pipeline release, repo cÃ²n cÃ³ workflow váº­n hÃ nh. `devops-smoke` dÃ¹ng Ä‘á»ƒ
> kiá»ƒm tra observability, RabbitMQ topology vÃ  restore test khi cáº§n. `dora-report`
> tá»•ng há»£p deployment events thÃ nh DORA metrics, cÃ²n `incident-labeler` chuáº©n hÃ³a
> incident labels Ä‘á»ƒ tÃ­nh MTTR vÃ  Change Failure Rate.

## 10. GHCR Image Registry

Má»Ÿ GitHub Packages/GHCR hoáº·c dÃ¹ng lá»‡nh minh há»a:

```bash
docker pull ghcr.io/<github-owner>/luyen-thi-lai-xe-user-service:<git-sha>
docker pull ghcr.io/<github-owner>/luyen-thi-lai-xe-migration-runner:<git-sha>
```

Lá»i thoáº¡i gá»£i Ã½:

> GCP/Kubernetes khÃ´ng build source code trá»±c tiáº¿p. GitHub Actions build vÃ  scan
> image, sau Ä‘Ã³ push lÃªn GHCR. Runtime chá»‰ pull image theo immutable tag. ÄÃ¢y lÃ 
> nguyÃªn táº¯c build once, deploy many.

Náº¿u tháº§y há»i vÃ¬ sao chÆ°a dÃ¹ng Google Artifact Registry:

> Hiá»‡n táº¡i nhÃ³m dÃ¹ng GHCR vÃ¬ tÃ­ch há»£p trá»±c tiáº¿p vá»›i GitHub Actions vÃ  repo. Khi
> production hÃ³a sÃ¢u hÆ¡n trÃªn GCP, cÃ³ thá»ƒ mirror/chuyá»ƒn image sang Google
> Artifact Registry, nhÆ°ng nguyÃªn táº¯c DevOps váº«n khÃ´ng Ä‘á»•i.

## 11. Deployment Runtime vá»›i Helm/Kubernetes

Má»Ÿ file:

- `charts/luyen-thi-lai-xe/values.yaml`
- `charts/luyen-thi-lai-xe/templates/apps.yaml`
- `charts/luyen-thi-lai-xe/templates/jobs.yaml`
- `charts/luyen-thi-lai-xe/templates/hpa.yaml`
- `docs/devops/gcp-setup.md`

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Helm chart deploy 10 production services.
- Chart deploy thÃªm Kong, Keycloak, PostgreSQL, RabbitMQ, Redis, Consul vÃ 
  Jaeger baseline.
- App deployment cÃ³:
  - `resources.requests`
  - `resources.limits`
  - liveness probe `/health/live`
  - readiness probe `/health/ready`
  - init containers Ä‘á»£i Consul seed vÃ  migration job.
- `global.imageRegistry` trá» vá» GHCR.
- `global.imageTag` lÃ  immutable tag cáº§n deploy.
- `migration-runner` cháº¡y Prisma migration ngoÃ i runtime container.
- Terraform Ä‘Ã£ cÃ³ module GCP táº¡o VM Compute Engine cháº¡y K3s, static IP,
  firewall, startup script vÃ  kubeconfig output.
- GCP/K3s guide ghi nháº­n staging Ä‘Ã£ deploy Ä‘Æ°á»£c, smoke qua Kong pass, k6 load
  ná»™i bá»™ pass, HPA tá»«ng scale up `exam-service` vÃ  `course-service` rá»“i scale
  down láº¡i.
- HPA cÃ³ template trong Helm vÃ  má»™t sá»‘ service Ä‘Ã£ báº­t; khi demo live cáº§n kiá»ƒm
  tra `kubectl get hpa` cÃ³ CPU/memory tháº­t thay vÃ¬ `<unknown>`.

Lá»‡nh demo náº¿u cÃ³ cluster:

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
kubectl get hpa -n staging
kubectl top pods -n staging
```

Lá»‡nh Terraform/GCP nÃªn show trÃªn slide hoáº·c terminal náº¿u khÃ´ng cháº¡y live:

```powershell
terraform -chdir=terraform init
terraform -chdir=terraform validate
terraform -chdir=terraform plan -var-file=terraform.tfvars
terraform -chdir=terraform output public_ip
terraform -chdir=terraform output api_host
terraform -chdir=terraform output auth_host
```

Lá»‡nh k6 load test Ä‘Ã£ cÃ³ trong repo:

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

Lá»i thoáº¡i gá»£i Ã½:

> NgoÃ i Helm chart, repo cÃ²n cÃ³ Phase 9 baseline cho GCP: Terraform táº¡o VM
> Compute Engine cháº¡y K3s, startup script cÃ i metrics-server, Helm deploy app,
> HPA theo dÃµi CPU/memory vÃ  k6 dÃ¹ng Ä‘á»ƒ smoke/load/stress/spike test. ÄÃ¢y chÆ°a
> pháº£i managed Kubernetes enterprise, nhÆ°ng lÃ  má»™t Ä‘Æ°á»ng deploy cloud hoÃ n chá»‰nh
> cho demo mÃ´n há»c.

## 12. Health Check & Smoke Test

Má»Ÿ file:

- `scripts/smoke.ts`
- `scripts/k8s-smoke.sh`
- `packages/common/src/health`

Lá»‡nh demo local:

```bash
npm run smoke
```

Lá»‡nh demo Kubernetes:

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

Lá»i thoáº¡i gá»£i Ã½:

> Smoke test khÃ´ng kiá»ƒm tra sÃ¢u nghiá»‡p vá»¥, nhÆ°ng xÃ¡c nháº­n 10 production services
> cÃ³ thá»ƒ truy cáº­p qua Kong vÃ  health endpoints pháº£n há»“i Ä‘Ãºng. ÄÃ¢y lÃ  bÆ°á»›c báº¯t
> buá»™c sau deploy Ä‘á»ƒ phÃ¡t hiá»‡n lá»—i rollout sá»›m.

## 13. Observability

Má»Ÿ file:

- `packages/common/src/metrics`
- `packages/common/src/logger`
- `packages/common/src/tracing`
- `docker/prometheus/prometheus.yml`
- `docker/prometheus/alerts.yml`
- `docker/grafana/dashboards/microservices-observability.json`
- `docs/devops/elk-logging-guide.md`
- `docs/devops/observability-runbook.md`
- `docs/devops/opentelemetry-jaeger-tracing.md`

Lá»‡nh demo:

```bash
npm run observability:smoke
```

Náº¿u local stack Ä‘ang cháº¡y:

```bash
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready
curl http://localhost:3002/metrics
curl -H "x-correlation-id: demo-trace-001" http://localhost:8000/user-service/health
```

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Má»—i service expose health endpoints vÃ  `/metrics`.
- Prometheus scrape service metrics, RabbitMQ metrics vÃ  DORA metrics exporter.
- Grafana cÃ³ dashboards cho microservices, DORA vÃ  business metrics.
- Alert rules gá»“m service down, high 5xx, high p95 latency, high CPU/memory,
  RabbitMQ retry backlog vÃ  DLQ.
- Winston logger cÃ³ correlation id vÃ  optional Logstash transport.
- OpenTelemetry/Jaeger há»— trá»£ trace end-to-end tá»« Kong Ä‘áº¿n NestJS services.

## 14. DORA & Business Metrics

Má»Ÿ file:

- `.github/workflows/dora-report.yml`
- `.github/workflows/incident-labeler.yml`
- `.github/ISSUE_TEMPLATE/incident_report.yml`
- `.github/ISSUE_TEMPLATE/postmortem.yml`
- `scripts/devops-record-deployment.js`
- `scripts/devops-dora-report.ts`
- `scripts/devops-dora-prometheus-export.ts`
- `docker/grafana/dashboards/dora-metrics.json`
- `docker/grafana/dashboards/business-metrics.json`
- `docs/devops/dora-metrics-guide.md`
- `docs/devops/business-metrics.md`

Lá»‡nh demo:

```bash
npm run dora:report
npm run dora:export-prometheus
```

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Deployment event Ä‘Æ°á»£c ghi sau deploy/rollback.
- Deployment events Ä‘Æ°á»£c upload artifact Ä‘á»ƒ DORA report khÃ´ng phá»¥ thuá»™c hoÃ n
  toÃ n vÃ o lá»‹ch sá»­ workflow.
- Incident/postmortem issue templates chuáº©n hÃ³a dá»¯ liá»‡u sá»± cá»‘.
- `incident-labeler.yml` tá»± gáº¯n label nhÆ° `incident`, `postmortem`, `sev1`,
  `sev2`, `change-failure`, `deploy-failure`, `rollback`, `production`,
  `staging`.
- DORA report gá»“m:
  - Deployment Frequency
  - Lead Time for Changes
  - MTTR
  - Change Failure Rate
- Business metrics gá»“m:
  - users created
  - exam sessions started/completed
  - pass/fail
  - course completion
  - notification delivery
  - media upload

Lá»i thoáº¡i gá»£i Ã½:

> Dá»± Ã¡n khÃ´ng chá»‰ quan sÃ¡t runtime mÃ  cÃ²n Ä‘o hiá»‡u quáº£ delivery vÃ  giÃ¡ trá»‹
> nghiá»‡p vá»¥. DORA metrics cho biáº¿t tá»‘c Ä‘á»™/Ä‘á»™ á»•n Ä‘á»‹nh release, cÃ²n business
> metrics cho biáº¿t há»‡ thá»‘ng Ä‘ang táº¡o ra hÃ nh vi sáº£n pháº©m nÃ o.

> Vá»›i MTTR vÃ  Change Failure Rate, repo cÃ³ incident/postmortem templates vÃ 
> workflow tá»± gáº¯n label. Nhá» váº­y khi cÃ³ sá»± cá»‘ tháº­t, team cÃ³ dá»¯ liá»‡u cÃ³ cáº¥u trÃºc
> Ä‘á»ƒ tá»•ng há»£p vÃ o DORA report thay vÃ¬ ghi chÃº rá»i ráº¡c.

## 15. Resilience

Má»Ÿ file:

- `packages/common/src/http/resilient-http-client.ts`
- `packages/common/src/messaging/rabbitmq-resilience.ts`
- `docs/devops/system-resilience-guide.md`
- `docs/devops/system-resilience-guide.md`

Lá»‡nh demo:

```bash
npm run rabbitmq:smoke
```

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- HTTP client cÃ³ timeout, retry vÃ  circuit breaker.
- RabbitMQ consumer dÃ¹ng durable queue, `noAck: false`, retry queue vá»›i TTL
  backoff, DLQ vÃ  metrics.
- Queue topology ká»³ vá»ng:
  - `<queue>`
  - `<queue>.retry.1`
  - `<queue>.retry.2`
  - `<queue>.retry.3`
  - `<queue>.dlq`
- Idempotency hiá»‡n táº¡i lÃ  memory TTL baseline; production hardening nÃªn chuyá»ƒn
  sang Redis hoáº·c database Ä‘á»ƒ durable hÆ¡n khi pod restart.

## 16. Backup, Restore & Runbook

Má»Ÿ file:

- `docs/devops/backup-strategy.md`
- `docker/backup/postgres-daily-backup.sh`
- `docker/keycloak/keycloak-daily-export.sh`
- `scripts/db-backup-local.ts`
- `scripts/db-restore-test.ts`
- `docs/devops/incident-management-process.md`
- `docs/devops/observability-runbook.md`

### 16.1 Backup local/Compose tá»± Ä‘á»™ng

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Pháº¡m vi backup gá»“m 11 PostgreSQL databases:
  - 10 service DB: `identity_db`, `user_db`, `exam_db`, `course_db`,
    `question_db`, `notification_db`, `analytics_db`, `simulation_db`,
    `media_db`, `audit_db`.
  - `keycloak_db`.
- PostgreSQL backup dÃ¹ng `pg_dump --format=custom`, táº¡o file `.dump`.
- Má»—i láº§n backup cÃ³:
  - `.dump` cho tá»«ng DB.
  - `.sha256` Ä‘á»ƒ kiá»ƒm tra checksum.
  - `manifest.csv` ghi service, database, host, port vÃ  file dump.
- Service `postgres-backup` Ä‘Ã£ cÃ³ trong `docker-compose.infra.yml` vÃ 
  `docker-compose.deploy.yml`.
- Service backup cháº¡y ngay khi container khá»Ÿi Ä‘á»™ng, sau Ä‘Ã³ láº·p theo
  `BACKUP_INTERVAL_SECONDS`, máº·c Ä‘á»‹nh 86400 giÃ¢y.
- Retention:
  - daily retention qua `BACKUP_RETENTION_DAYS`, máº·c Ä‘á»‹nh 7 ngÃ y.
  - weekly snapshot vÃ o Chá»§ nháº­t qua `BACKUP_WEEKLY_RETENTION_WEEKS`, máº·c Ä‘á»‹nh
    4 tuáº§n.

Lá»‡nh demo local:

```bash
npm run db:backup:local
npm run db:backup:once
npm run db:restore:test
```

File/thÆ° má»¥c cáº§n chá»‰ khi quay:

```text
backups/postgres/<env>/<timestamp>/
backups/postgres/weekly/<env>/<yyyy-Www>/
```

Lá»i thoáº¡i gá»£i Ã½:

> Backup khÃ´ng chá»‰ lÃ  má»™t command thá»§ cÃ´ng. Trong Compose cÃ³ service
> `postgres-backup` cháº¡y Ä‘á»‹nh ká»³, backup Ä‘á»§ 10 service DB vÃ  `keycloak_db`, táº¡o
> checksum vÃ  manifest Ä‘á»ƒ biáº¿t báº£n backup gá»“m nhá»¯ng gÃ¬. Khi quay demo, mÃ¬nh cÃ³
> thá»ƒ cháº¡y one-shot Ä‘á»ƒ táº¡o báº±ng chá»©ng ngay, sau Ä‘Ã³ má»Ÿ thÆ° má»¥c `backups/postgres`
> cho tháº§y tháº¥y file `.dump`, `.sha256` vÃ  `manifest.csv`.

### 16.2 Keycloak backup 2 lá»›p

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- `keycloak_db` Ä‘Æ°á»£c backup báº±ng PostgreSQL dump giá»‘ng cÃ¡c DB khÃ¡c.
- Runtime realm config Ä‘Æ°á»£c export báº±ng `kcadm.sh` tá»« service
  `keycloak-backup`.
- Artifact Keycloak export gá»“m:
  - `realm.json`
  - `users.json`
  - `clients.json`
  - `roles.json`
  - `SHA256SUMS`
  - `manifest.csv`
- Keycloak export cÅ©ng cÃ³ daily retention vÃ  weekly snapshot.

Lá»‡nh demo:

```bash
npm run keycloak:backup:once
```

File/thÆ° má»¥c cáº§n chá»‰ khi quay:

```text
backups/keycloak/<env>/<timestamp>/
backups/keycloak/weekly/<env>/<yyyy-Www>/
```

Lá»i thoáº¡i gá»£i Ã½:

> Vá»›i Keycloak, nhÃ³m backup theo 2 lá»›p. Lá»›p phá»¥c há»“i Ä‘áº§y Ä‘á»§ nháº¥t lÃ 
> `keycloak_db` dump. Lá»›p thá»© hai lÃ  export realm runtime config Ä‘á»ƒ review cáº¥u
> hÃ¬nh, kiá»ƒm tra drift vÃ  cÃ³ thá»ƒ phá»¥c há»“i thá»§ cÃ´ng má»™t pháº§n náº¿u cáº§n.

### 16.3 Backup trÃªn GCP/K3s vÃ  Google Cloud Storage

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- Khi deploy lÃªn GCP hiá»‡n táº¡i, há»‡ thá»‘ng cháº¡y theo mÃ´ hÃ¬nh K3s trÃªn Compute
  Engine VM.
- PostgreSQL vÃ  Keycloak váº«n cháº¡y trong namespace `staging`, dá»¯ liá»‡u náº±m trÃªn
  PVC `local-path`.
- VÃ¬ chÆ°a dÃ¹ng Cloud SQL automated backup/PITR, repo Ä‘Ã£ cÃ³ hÆ°á»›ng dáº«n backup GCP
  theo hÆ°á»›ng:
  - exec vÃ o PostgreSQL pod Ä‘á»ƒ cháº¡y `pg_dump --format=custom`.
  - táº¡o checksum vÃ  `manifest.csv`.
  - copy backup ra ngoÃ i VM.
  - Ä‘áº©y backup quan trá»ng lÃªn Google Cloud Storage lÃ m báº£n offsite.

Lá»‡nh demo backup má»™t DB trÃªn GCP/K3s:

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

Lá»‡nh Ä‘áº©y backup lÃªn Google Cloud Storage:

```bash
# Chá»‰ cáº§n táº¡o bucket má»™t láº§n; náº¿u bucket Ä‘Ã£ tá»“n táº¡i thÃ¬ bá» qua bÆ°á»›c create.
gcloud storage buckets create gs://<project-id>-luyen-thi-lai-xe-backups \
  --location=asia-southeast1 \
  --uniform-bucket-level-access

gcloud storage cp --recursive "$BACKUP_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"

gcloud storage ls "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"
```

Lá»‡nh backup Keycloak realm trÃªn GCP/K3s:

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

Lá»i thoáº¡i gá»£i Ã½:

> TrÃªn GCP/K3s, backup khÃ´ng chá»‰ náº±m trÃªn disk cá»§a VM. Repo cÃ³ hÆ°á»›ng dáº«n táº¡o
> dump tá»« PostgreSQL pod, sinh checksum/manifest rá»“i copy lÃªn Google Cloud
> Storage. VÃ¬ váº­y náº¿u VM hoáº·c disk local-path gáº·p sá»± cá»‘, nhÃ³m váº«n cÃ³ má»™t báº£n
> offsite trong Cloud Storage Ä‘á»ƒ táº£i vá» restore test.

### 16.4 Restore rehearsal

Ná»™i dung cáº§n trÃ¬nh bÃ y:

- `npm run db:restore:test` táº¡o PostgreSQL container táº¡m báº±ng
  `postgres:15-alpine`.
- Script cháº¡y `pg_restore --list` Ä‘á»ƒ kiá»ƒm tra metadata backup.
- Script restore tháº­t vÃ o DB táº¡m báº±ng `pg_restore`.
- Sau khi test xong, container táº¡m Ä‘Æ°á»£c dá»n.
- CÃ³ thá»ƒ chá»‰ Ä‘á»‹nh file dump cá»¥ thá»ƒ báº±ng `RESTORE_TEST_BACKUP_FILE`.

Lá»‡nh restore test local:

```bash
npm run db:restore:test
```

Lá»‡nh restore test tá»« backup Ä‘Ã£ táº£i tá»« Google Cloud Storage:

```bash
gcloud storage cp \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/<timestamp>/user-service_staging_<timestamp>.dump" \
  "backups/gcp/restore-test/user-service_staging_<timestamp>.dump"

RESTORE_TEST_BACKUP_FILE=backups/gcp/restore-test/user-service_staging_<timestamp>.dump npm run db:restore:test
```

Khi quay demo, nÃªn ghi láº¡i:

- TÃªn bucket GCS.
- Timestamp backup.
- File `.dump` Ä‘Ã£ restore test.
- Output `Restore completed successfully` hoáº·c log pass tÆ°Æ¡ng Ä‘Æ°Æ¡ng.

### 16.5 Runbook liÃªn quan

Runbook giÃºp cáº£ team xá»­ lÃ½:

- DB down hoáº·c máº¥t dá»¯ liá»‡u.
- Keycloak lá»—i hoáº·c drift realm config.
- RabbitMQ queue backlog/DLQ.
- Service down hoáº·c rollout lá»—i.
- Rollback release.

Äiá»ƒm cáº§n nÃ³i tháº­t:

- ÄÃ£ cÃ³ luá»“ng backup local/Compose tá»± Ä‘á»™ng, restore test, vÃ  hÆ°á»›ng dáº«n backup
  GCP/K3s lÃªn Google Cloud Storage.
- ChÆ°a cÃ³ Kubernetes CronJob tá»± Ä‘á»™ng upload tháº³ng lÃªn GCS.
- ChÆ°a cÃ³ Cloud SQL automated backup/PITR vÃ¬ hiá»‡n táº¡i GCP staging dÃ¹ng
  PostgreSQL trong cluster.
- Roadmap production lÃ  thÃªm CronJob/Workload Identity/lifecycle rule cho GCS,
  hoáº·c chuyá»ƒn PostgreSQL sang Cloud SQL vÃ  báº­t PITR.

## 17. Release Safety & Rollback

Má»Ÿ file:

- `.github/workflows/rollback-release.yml`
- `docs/devops/github-actions-release-safety.md`

Lá»‡nh demo náº¿u cÃ³ cluster:

```bash
npm run keycloak:backup:once
```

File/thÆ° má»¥c cáº§n chá»‰ khi quay:

```text
backups/keycloak/<env>/<timestamp>/
backups/keycloak/weekly/<env>/<yyyy-Www>/
```

Lá»i thoáº¡i gá»£i Ã½:

> Rollback báº±ng Helm cÃ³ thá»ƒ Ä‘Æ°a release vá» revision trÆ°á»›c, gá»“m image tag vÃ 
> rendered config. Tuy nhiÃªn database migration khÃ´ng tá»± reverse, nÃªn production
> cáº§n nguyÃªn táº¯c backward-compatible migration hoáº·c migration má»›i Ä‘á»ƒ sá»­a dá»¯ liá»‡u.

## 18. Káº¿t luáº­n

Lá»i thoáº¡i gá»£i Ã½:

> Tá»•ng káº¿t láº¡i, pháº§n DevOps cá»§a dá»± Ã¡n Ä‘Ã£ Ä‘i tá»« local bootstrap Ä‘áº¿n CI/CD báº±ng
> GitHub Actions, image registry, Helm/Kubernetes deployment vÃ  day-2 operations
> baseline. Dá»± Ã¡n chÆ°a claim lÃ  enterprise production hoÃ n chá»‰nh, nhÆ°ng Ä‘Ã£ cÃ³
> ná»n táº£ng tá»‘t cho MVP: Docker, Consul config, DB migration, Trivy, SBOM,
> Cosign, GHCR, smoke test, observability, DORA/business metrics, resilience vÃ 
> backup/restore.

Roadmap production hardening:

- Google Secret Manager hoáº·c Vault.
- Tá»± Ä‘á»™ng hÃ³a backup GCP báº±ng Kubernetes CronJob upload tháº³ng lÃªn Google Cloud
  Storage.
- Cloud SQL/PITR náº¿u chuyá»ƒn tá»« PostgreSQL trong cluster sang managed database.
- Admission policy verify Cosign signature.
- Má»Ÿ rá»™ng Terraform cho managed database, DNS, TLS, bucket lifecycle vÃ  service
  accounts.
- Verify rollback/staging live nhiá»u láº§n hÆ¡n.

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

1. Má»Ÿ workflow `Pull Request Validation`.
2. Chá»‰ vÃ o quality gate: install, Prisma generate, Biome, typecheck, test.
3. Má»Ÿ workflow `Main Image Release`.
4. Chá»‰ vÃ o build 10 images, Trivy scan, SBOM, Cosign, GHCR push.
5. Má»Ÿ workflow `Production Release`.
6. Chá»‰ vÃ o manual `image_tag` vÃ  environment `production`.
7. Má»Ÿ workflow `Rollback Release`.
8. Chá»‰ vÃ o Helm revision, rollback, smoke test vÃ  deployment event.
9. Má»Ÿ workflow `DevOps Smoke Tests`.
10. Chá»‰ vÃ o suite observability/RabbitMQ/restore.
11. Má»Ÿ workflow `DORA Metrics Report`.
12. Chá»‰ vÃ o bÆ°á»›c download deployment event artifacts vÃ  export Prometheus metrics.

### Kubernetes náº¿u cÃ³ staging

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

### Backup local vÃ  cloud

```bash
npm run db:backup:once
npm run keycloak:backup:once
npm run db:restore:test

gcloud storage ls "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/"
RESTORE_TEST_BACKUP_FILE=backups/gcp/restore-test/user-service_staging_<timestamp>.dump npm run db:restore:test
```

## 20. Slide tÃ³m táº¯t nÃªn cÃ³

Slide 1 - Váº¥n Ä‘á»:

- 10 microservices, nhiá»u DB/dependency.
- Cáº§n setup nháº¥t quÃ¡n, release an toÃ n, quan sÃ¡t vÃ  phá»¥c há»“i.

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
- DORA vÃ  business metrics.
- RabbitMQ retry/DLQ.
- Local backup, GCP/K3s backup, Google Cloud Storage offsite copy.
- Restore rehearsal.
- Incident/postmortem templates, auto labels vÃ  runbooks.

Slide 6 - Roadmap:

- Secret Manager/Vault.
- Kubernetes CronJob upload backup lÃªn GCS.
- Cloud SQL/PITR náº¿u nÃ¢ng cáº¥p managed DB.
- Admission policy verify image signature.
- Terraform má»Ÿ rá»™ng cho managed cloud resources.

## 21. Q&A cÃ³ thá»ƒ gáº·p

### VÃ¬ sao khÃ´ng trÃ¬nh bÃ y Jenkins?

> Ban Ä‘áº§u nhÃ³m cÃ³ cÃ¢n nháº¯c Jenkins, nhÆ°ng sau cÃ¹ng chá»‘t GitHub Actions lÃ  CI/CD
> chÃ­nh vÃ¬ tÃ­ch há»£p trá»±c tiáº¿p vá»›i GitHub repo, GHCR, GitHub Environments,
> workflow dispatch, artifact/SBOM vÃ  deployment events. Jenkins khÃ´ng náº±m trong
> luá»“ng demo chÃ­nh Ä‘á»ƒ trÃ¡nh lÃ m thiáº¿u rÃµ rÃ ng vá» pipeline chÃ­nh thá»©c.

### VÃ¬ sao GCP/Kubernetes khÃ´ng build code trá»±c tiáº¿p?

> Theo nguyÃªn táº¯c build once, deploy many. GitHub Actions build vÃ  scan image,
> sau Ä‘Ã³ push lÃªn GHCR. Runtime chá»‰ pull image theo immutable tag, giÃºp artifact
> á»•n Ä‘á»‹nh, dá»… audit vÃ  dá»… rollback.

### Náº¿u chá»‰ Ä‘á»•i má»™t service, vÃ¬ sao main workflow build Ä‘á»§ 10 images?

> Helm chart hiá»‡n dÃ¹ng má»™t `global.imageTag` cho toÃ n bá»™ release. VÃ¬ váº­y Git SHA
> má»›i pháº£i tá»“n táº¡i cho cáº£ 10 service images, náº¿u khÃ´ng má»™t sá»‘ deployment sáº½
> khÃ´ng pull Ä‘Æ°á»£c image tag Ä‘Ã³.

### Náº¿u deploy lá»—i thÃ¬ sao?

> Helm deploy cÃ³ `--wait`, `--wait-for-jobs` vÃ  timeout. Náº¿u rollout hoáº·c
> migration fail, workflow fail. Sau Ä‘Ã³ dÃ¹ng logs, events, `helm history` Ä‘á»ƒ
> Ä‘iá»u tra vÃ  dÃ¹ng rollback workflow náº¿u cáº§n quay vá» revision trÆ°á»›c.

### Backup cÃ³ cháº¯c restore Ä‘Æ°á»£c khÃ´ng?

> CÃ³. Local/Compose cÃ³ `postgres-backup`, `keycloak-backup`, checksum vÃ 
> manifest. GCP/K3s cÃ³ hÆ°á»›ng dáº«n táº¡o dump tá»« PostgreSQL pod rá»“i Ä‘áº©y lÃªn Google
> Cloud Storage lÃ m báº£n offsite. Quan trá»ng hÆ¡n, dá»± Ã¡n cÃ³ `db:restore:test` vÃ 
> cÃ³ thá»ƒ chá»‰ Ä‘á»‹nh `RESTORE_TEST_BACKUP_FILE` Ä‘á»ƒ rehearsal restore tá»« file táº£i
> vá» tá»« GCS.
