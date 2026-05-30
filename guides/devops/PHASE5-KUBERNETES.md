# Phase 5 - Triển Khai Kubernetes

Phase 5 triển khai phạm vi production lên một Kubernetes runtime thật. Target chính hiện tại là **GCP/GKE**. K3s/VPS chỉ còn là hướng lab nội bộ hoặc fallback legacy.

Checklist GCP đầy đủ, bao gồm sizing cluster, DNS, static IP, TLS và GitHub secrets, nằm ở `guides/devops/GCP-SETUP.md`.

## Phạm vi

Bao gồm:

- 10 production services: identity, user, exam, course, question, notification, analytics, simulation, media, audit.
- Kong DB-less gateway expose qua Ingress.
- Keycloak expose qua Ingress host riêng.
- Postgres, RabbitMQ, Redis, Consul và Keycloak chạy trong cluster cho giai đoạn MVP.
- Consul seed Job cho runtime config không phải secret.
- Prisma migration Job dùng image `luyen-thi-lai-xe-migration-runner`.
- App Pods đợi Consul seed và Prisma migration Jobs hoàn tất trước khi chạy main containers.
- Liveness/readiness probes và `resources.requests`/`resources.limits`.
- Helm rollback.

Không nằm trong Phase 5:

- Terraform, HPA và load testing. Các phần này thuộc Phase 9.
- Chuyển toàn bộ ELK/Prometheus/Grafana sang Kubernetes.
- Vault hoặc External Secrets integration.

## Thiết lập GCP/GKE Cluster

Tạo hoặc chọn GCP project, rồi bật các API cần thiết:

```bash
gcloud config set project <gcp-project-id>
gcloud services enable container.googleapis.com compute.googleapis.com
```

Tạo staging cluster nhỏ. Có thể điều chỉnh region, node count và machine type theo ngân sách/tải thực tế:

```bash
gcloud container clusters create luyen-thi-lai-xe-staging \
  --region asia-southeast1 \
  --num-nodes 1 \
  --machine-type e2-standard-4 \
  --enable-ip-alias \
  --release-channel regular

gcloud container clusters get-credentials luyen-thi-lai-xe-staging \
  --region asia-southeast1

kubectl get nodes
kubectl get storageclass
```

Export kubeconfig cho GitHub Actions:

```bash
kubectl config view --raw --minify > kubeconfig-gke-staging.yaml
base64 -w0 kubeconfig-gke-staging.yaml
```

Dùng DNS records thật cho staging/production:

```text
api.staging.example.com
auth.staging.example.com
api.example.com
auth.example.com
```

Chart đang mặc định theo hướng phù hợp với GKE:

- `global.storageClassName: standard-rwo`
- `ingress.className: gce`

Nếu cài Traefik hoặc NGINX Ingress trên GKE thay vì dùng GKE Ingress, override `ingress.className` trong values file của môi trường đó.

## GitHub Variables Và Secrets

Repository variable optional:

```text
GCP_AUTO_DEPLOY_ENABLED=false
```

Mặc định `.github/workflows/ci.yml` sẽ deploy GCP staging sau mỗi lần push vào `main` thành công. Chỉ set `GCP_AUTO_DEPLOY_ENABLED=false` khi cần tạm dừng auto deploy.

Staging variables:

```text
STAGING_API_SCHEME=https
STAGING_API_HOST=api.staging.example.com
STAGING_AUTH_HOST=auth.staging.example.com
STAGING_FRONTEND_ORIGIN=https://staging.example.com
```

Production variables:

```text
PRODUCTION_API_SCHEME=https
PRODUCTION_API_HOST=api.example.com
PRODUCTION_AUTH_HOST=auth.example.com
PRODUCTION_FRONTEND_ORIGIN=https://example.com
```

Shared secrets:

```text
GHCR_PULL_USERNAME
GHCR_PULL_TOKEN
```

Staging secrets:

```text
STAGING_KUBE_CONFIG_B64
STAGING_POSTGRES_PASSWORD
STAGING_RABBITMQ_PASSWORD
STAGING_RABBITMQ_ERLANG_COOKIE
STAGING_KEYCLOAK_ADMIN_PASSWORD
STAGING_KEYCLOAK_CLIENT_SECRET
STAGING_STORAGE_ACCOUNT_NAME
STAGING_STORAGE_ACCOUNT_KEY
```

Production secrets:

```text
PRODUCTION_KUBE_CONFIG_B64
PRODUCTION_POSTGRES_PASSWORD
PRODUCTION_RABBITMQ_PASSWORD
PRODUCTION_RABBITMQ_ERLANG_COOKIE
PRODUCTION_KEYCLOAK_ADMIN_PASSWORD
PRODUCTION_KEYCLOAK_CLIENT_SECRET
PRODUCTION_STORAGE_ACCOUNT_NAME
PRODUCTION_STORAGE_ACCOUNT_KEY
```

`GHCR_PULL_TOKEN` nên là GitHub token có quyền pull packages từ GHCR sau khi workflow build image xong.

## Pull Image Từ GHCR

GCP/GKE không build source code. Cluster chỉ pull image đã có trên GHCR theo tag được truyền vào Helm.

Pattern image hiện tại:

```text
ghcr.io/nhactaohocbai/luyen-thi-lai-xe-<service>:<tag>
ghcr.io/nhactaohocbai/luyen-thi-lai-xe-migration-runner:<tag>
```

Với deploy thủ công, có thể dùng một Git SHA tag đã tồn tại trên GHCR:

```bash
helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  --set global.imageTag=<existing-ghcr-tag> \
  --set migration.imageTag=<existing-ghcr-tag>
```

Nếu dùng cùng một `global.imageTag`, tag đó cần tồn tại cho đủ 10 production service images. Nếu GHCR package là private, cần cấu hình `GHCR_PULL_USERNAME` và `GHCR_PULL_TOKEN`.

## Kiểm tra Helm trên local

```bash
helm lint charts/luyen-thi-lai-xe
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml
```

## Deploy thủ công

```bash
helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  --set global.imageTag=<git-sha> \
  --set migration.imageTag=<git-sha>
```

## Smoke test

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

Smoke script kiểm tra `/health/live` và `/health/ready` của toàn bộ 10 production services thông qua Kong.

## Rollback

```bash
helm history luyen-thi-lai-xe -n production
helm rollback luyen-thi-lai-xe <revision> -n production
SMOKE_BASE_URL=https://api.example.com bash scripts/k8s-smoke.sh
```

Rollback sẽ đưa Kubernetes release về revision cũ, bao gồm app image tags và rendered config. Database migrations không tự reverse; nếu migration không backward compatible thì cần tạo migration tiếp theo thay vì kỳ vọng rollback DB tự xử lý.

## K3s Legacy Lab

Chỉ dùng phần này khi cần rehearsal giá rẻ trên local/VM ngoài GCP:

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
sudo kubectl get storageclass
```

Với K3s, override chart values như sau:

```yaml
global:
  storageClassName: local-path

ingress:
  className: traefik
```
