# DevOps Assessment - Luyen Thi Lai Xe Microservices

**Ngay cap nhat**: 2026-05-27
**Branch**: `devops/baseline-local-stability`
**Latest CI verified commit**: `2265ae813da9294db4bd7276c693b7d0db7748de`
**Ghi chu**: `DEVOPS-SUMMARY.md` la tai lieu lich su/lac quan hon thuc te. File nay la baseline hien hanh de tiep tuc cac phase DevOps.

## 1. Ket Luan Nhanh

Du an da chot baseline:

- Production scope: **10 services**.
- `docs-service`: **Dev-only**, khong dua vao staging/production.
- Development co the chay 11 services neu can `docs-service`.
- Staging/Production Consul seed va deploy chi gom 10 production services.

Trang thai hien tai:

| Hang muc | Trang thai | Ghi chu |
| --- | --- | --- |
| Phase 0 Baseline | Done | README da mo ta local/full-stack, production 10 services, docs-service Dev-only. |
| Phase 1 Local/Dev | Mostly done | `.env.example`, deploy env examples, Consul seed optional media storage, health endpoints va AppLogger da co tren services. Runtime smoke can chay lai khi Docker Desktop/DNS on dinh. |
| Phase 3 DevSecOps | Done for baseline | CI run #154 pass tren commit `2265ae8`; 10 production images build + Trivy HIGH/CRITICAL scan success. |
| Phase 4 CI/CD | In progress | Working tree da tach PR validation, main image release, production release manual; can push de GitHub Actions verify. |
| Phase 5 Deployment Runtime | In progress | Kubernetes Helm path da duoc scaffold va target chinh da doi sang GCP/GKE: app services, in-cluster dependencies, Ingress, probes, resources, Consul seed va Prisma migration Job. K3s/VPS chi con la lab/fallback legacy. |
| Phase 9 IaC/Scaling | Pending | Chua co `terraform`, HPA hay load test; cac phan nay tach khoi Phase 5. |

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

## 3. Phase 3 Closure

Phase 3 DevSecOps co the chot baseline vi cac muc can thiet da qua:

- Hardcoded secrets trong Compose/Consul seed da chuyen sang env variable hoac placeholder.
- `.env.example`, `deploy/staging.env.example`, `deploy/production.env.example` da chuan hoa.
- `scripts/consul-seed.ts` ho tro env interpolation.
- `docker/consul/init.sh` khong crash khi thieu media storage optional.
- Docker runtime image da prune dev dependencies.
- Runtime image da xoa `npm`, `npx`, `corepack`, `yarn` de giam CVE surface.
- GitHub Actions da co Trivy image scan voi `severity: CRITICAL,HIGH`, `exit-code: 1`.
- PR thay doi DevOps/shared files se build/scan du 10 production services.
- `media-service` da nang `multer` len `^2.1.1`.
- CI run #154 tren commit `2265ae813da9294db4bd7276c693b7d0db7748de` pass:
  - Code Quality & Testing: success.
  - Detect Changed Services: success.
  - Build Services cho 10 production services: success.
  - Trivy scan cho tung image: success.
  - Push image: skipped dung ky vong vi run tren PR.

Rui ro con lai:

- Neu secret that tung bi paste/push, can rotate ngoai repo.
- Chua co SBOM/signing/CodeQL nhu lop hardening bo sung.
- Production secret store chua duoc chon chinh thuc; voi GCP nen uu tien Google Secret Manager hoac Vault.

## 4. Phase 4 CI/CD Baseline

Working tree hien da dinh huong Phase 4 nhu sau:

- `.github/workflows/pr-validation.yml`
  - Trigger: pull request vao `main`.
  - Chay quality gate: `npm ci`, Prisma generate, Biome, typecheck, test.
  - Detect changed services.
  - Build Docker image va scan Trivy.
  - Khong login GHCR, khong push image.
  - Tu dong label PR theo service bi anh huong.

- `.github/workflows/ci.yml`
  - Trigger: push vao `main`.
  - Chay quality gate.
  - Build va Trivy scan changed/all-required services.
  - Tren push vao `main`, build du 10 production services de dam bao cung mot immutable tag `${github.sha}` ton tai cho toan bo Helm release.
  - Push GHCR voi 2 tag: `${github.sha}` va `latest`.
  - Auto deploy GCP staging bang Helm sau khi build image va migration-runner thanh cong.
  - Co the tam tat auto deploy bang repository variable `GCP_AUTO_DEPLOY_ENABLED=false`.
  - Staging job gan GitHub Environment `staging`.

- `.github/workflows/production-release.yml`
  - Trigger: `workflow_dispatch`.
  - Input: immutable `image_tag`, thuong la Git SHA da pass Main Image Release.
  - Job gan GitHub Environment `production`.
  - Can cau hinh manual approval/reviewer trong GitHub Environments.

Deployment secrets/vars can cau hinh:

Kubernetes/GCP/GKE path:

- Repository variable optional: `GCP_AUTO_DEPLOY_ENABLED=false` neu can tam tat auto deploy GCP staging. Mac dinh workflow se deploy sau moi push vao `main`.
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

Legacy SSH/Compose path, chi dung neu deploy len VM/Compute Engine bang Docker Compose:

- Repository variable optional: `GCP_AUTO_DEPLOY_ENABLED=false` neu can tam tat auto deploy GCP staging. Mac dinh workflow se deploy sau moi push vao `main`.
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

## 5. Deploy/Migration Note

Runtime images intentionally remove `npm/npx`, so deploy must not run migrations inside application runtime containers.

Current working tree fixes this by:

- Adding a `migration-runner` service in `docker-compose.deploy.yml` based on `node:20-alpine`.
- Uploading each production service `prisma/` directory to the remote deploy path.
- Running `prisma migrate deploy` from `migration-runner` with `DATABASE_URL` injected per service.

This keeps application runtime images small/hardened while preserving a deploy-time migration path.

## 6. Remaining Priority

Next recommended order:

1. Validate workflow YAML and Compose deploy config locally.
2. Push Phase 4 changes and verify PR Validation/Main Image Release behavior.
3. Configure GitHub Environments:
   - `staging` for automatic deploy.
   - `production` with required reviewers/manual approval.
4. Configure Phase 5 Kubernetes runtime:
   - GCP/GKE cluster as the primary target.
   - Ingress controller/load balancer, DNS records and optional static IP on GCP.
   - GitHub variables: `STAGING_API_HOST`, `STAGING_AUTH_HOST`, `STAGING_FRONTEND_ORIGIN`, and production equivalents.
   - GitHub secrets: `STAGING_KUBE_CONFIG_B64`, `PRODUCTION_KUBE_CONFIG_B64`, `GHCR_PULL_USERNAME`, `GHCR_PULL_TOKEN`, DB/RabbitMQ/Keycloak/storage secrets.
5. Verify Helm deployment:
   - `helm lint charts/luyen-thi-lai-xe`.
   - `helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml`.
   - Staging deploy via main workflow and smoke test through Kong.
   - Production manual release with `workflow_dispatch` and Helm rollback test.
6. Add SBOM/signing/CodeQL only after Phase 5 deploy path is stable.

## 7. Phase 5 Kubernetes Baseline

Phase 5 target da doi sang Kubernetes Helm tren GCP/GKE, self-contained trong cluster cho giai doan MVP. K3s/VPS chi con la lab/fallback legacy.

Implemented baseline:

- Helm chart `charts/luyen-thi-lai-xe` deploy 10 production services, Kong, Keycloak, Postgres, RabbitMQ, Redis va Consul.
- Kubernetes `Secret` dung cho password/token/storage; Consul seed Job chi seed non-secret config.
- App Deployments co `resources.requests`, `resources.limits`, `/health/live` va `/health/ready` probes.
- `Dockerfile.migration-runner` build image rieng cho Prisma migration Job.
- GitHub Actions deploy staging/production bang Helm va kubeconfig base64.
- `scripts/k8s-smoke.sh` verify health endpoints qua Kong.

Khong nam trong Phase 5:

- Terraform, HPA, k6/JMeter.
- Full ELK/Prometheus/Grafana tren Kubernetes.
- Vault/External Secrets.
