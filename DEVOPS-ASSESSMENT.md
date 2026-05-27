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
| Phase 5 Deployment Runtime | Pending | Can chon Render hay Docker Compose/Kubernetes cho staging that. Repo hien co Docker Compose deploy scripts. |
| Phase 9 IaC/Scaling | Pending | Chua co `k8s`, `helm`, `terraform`. |

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
- Production secret store chua duoc chon chinh thuc.

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
  - Push GHCR voi 2 tag: `${github.sha}` va `latest`.
  - Deploy staging tu dong neu repository variable `STAGING_DEPLOY_ENABLED=true`.
  - Staging job gan GitHub Environment `staging`.

- `.github/workflows/production-release.yml`
  - Trigger: `workflow_dispatch`.
  - Input: immutable `image_tag`, thuong la Git SHA da pass Main Image Release.
  - Job gan GitHub Environment `production`.
  - Can cau hinh manual approval/reviewer trong GitHub Environments.

Deployment secrets/vars can cau hinh:

- Repository variable: `STAGING_DEPLOY_ENABLED=true`
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
4. Decide Phase 5 target:
   - Render if optimizing for a quick demo in 1 week.
   - Docker Compose VM if using the existing deploy scripts.
   - Kubernetes/Helm if the assignment requires orchestration depth.
5. Add SBOM/signing/CodeQL only after Phase 4 deploy path is stable.
