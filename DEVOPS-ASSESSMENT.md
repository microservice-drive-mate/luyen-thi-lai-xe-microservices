# Đánh giá DevOps - Luyện Thi Lái Xe Microservices

**Ngày cập nhật**: 2026-05-27
**Branch gốc**: `devops/baseline-local-stability`
**Commit CI đã xác minh trước đó**: `2265ae813da9294db4bd7276c693b7d0db7748de`
**Ghi chú**: `DEVOPS-SUMMARY.md` là bản tổng kết ngắn gọn/lạc quan hơn. File này ghi lại baseline chi tiết hơn để tiếp tục các phase DevOps.

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
  - Chạy quality gate: `npm ci`, Prisma generate, Biome, typecheck, test.
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
