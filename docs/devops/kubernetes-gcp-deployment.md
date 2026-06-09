# Triá»ƒn Khai Kubernetes

TÃ i liá»‡u nÃ y triá»ƒn khai pháº¡m vi production lÃªn má»™t Kubernetes runtime tháº­t. Target chÃ­nh hiá»‡n táº¡i lÃ  **GCP/GKE**. K3s/VPS chá»‰ cÃ²n lÃ  hÆ°á»›ng lab ná»™i bá»™ hoáº·c fallback legacy.

Checklist GCP Ä‘áº§y Ä‘á»§, bao gá»“m sizing cluster, DNS, static IP, TLS vÃ  GitHub secrets, náº±m á»Ÿ `docs/devops/gcp-setup.md`.

## Pháº¡m vi

Bao gá»“m:

- 10 production services: identity, user, exam, course, question, notification, analytics, simulation, media, audit.
- Kong DB-less gateway expose qua Ingress.
- Keycloak expose qua Ingress host riÃªng.
- Postgres, RabbitMQ, Redis, Consul vÃ  Keycloak cháº¡y trong cluster cho giai Ä‘oáº¡n MVP.
- Consul seed Job cho runtime config khÃ´ng pháº£i secret.
- Prisma migration Job dÃ¹ng image `luyen-thi-lai-xe-migration-runner`.
- App Pods Ä‘á»£i Consul seed vÃ  Prisma migration Jobs hoÃ n táº¥t trÆ°á»›c khi cháº¡y main containers.
- Liveness/readiness probes vÃ  `resources.requests`/`resources.limits`.
- Helm rollback.

KhÃ´ng náº±m trong pháº¡m vi Kubernetes baseline:

- Terraform, HPA vÃ  load testing. CÃ¡c pháº§n nÃ y thuá»™c production hardening sau MVP.
- Chuyá»ƒn toÃ n bá»™ ELK/Prometheus/Grafana sang Kubernetes.
- Vault hoáº·c External Secrets integration.

## Thiáº¿t láº­p GCP/GKE Cluster

Táº¡o hoáº·c chá»n GCP project, rá»“i báº­t cÃ¡c API cáº§n thiáº¿t:

```bash
gcloud config set project <gcp-project-id>
gcloud services enable container.googleapis.com compute.googleapis.com
```

Táº¡o staging cluster nhá». CÃ³ thá»ƒ Ä‘iá»u chá»‰nh region, node count vÃ  machine type theo ngÃ¢n sÃ¡ch/táº£i thá»±c táº¿:

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

DÃ¹ng DNS records tháº­t cho staging/production:

```text
api.staging.example.com
auth.staging.example.com
api.example.com
auth.example.com
```

Chart Ä‘ang máº·c Ä‘á»‹nh theo hÆ°á»›ng phÃ¹ há»£p vá»›i GKE:

- `global.storageClassName: standard-rwo`
- `ingress.className: gce`

Náº¿u cÃ i Traefik hoáº·c NGINX Ingress trÃªn GKE thay vÃ¬ dÃ¹ng GKE Ingress, override `ingress.className` trong values file cá»§a mÃ´i trÆ°á»ng Ä‘Ã³.

## GitHub Variables VÃ  Secrets

Repository variable optional:

```text
GCP_AUTO_DEPLOY_ENABLED=false
```

Máº·c Ä‘á»‹nh `.github/workflows/ci.yml` sáº½ deploy GCP staging sau má»—i láº§n push vÃ o `main` thÃ nh cÃ´ng. Chá»‰ set `GCP_AUTO_DEPLOY_ENABLED=false` khi cáº§n táº¡m dá»«ng auto deploy.

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

`GHCR_PULL_TOKEN` nÃªn lÃ  GitHub token cÃ³ quyá»n pull packages tá»« GHCR sau khi workflow build image xong.

## Pull Image Tá»« GHCR

GCP/GKE khÃ´ng build source code. Cluster chá»‰ pull image Ä‘Ã£ cÃ³ trÃªn GHCR theo tag Ä‘Æ°á»£c truyá»n vÃ o Helm.

Pattern image hiá»‡n táº¡i:

```text
ghcr.io/${{ github.repository_owner }}/luyen-thi-lai-xe-<service>:<tag>
ghcr.io/${{ github.repository_owner }}/luyen-thi-lai-xe-migration-runner:<tag>
```

`${{ github.repository_owner }}` chá»‰ Ä‘Æ°á»£c GitHub Actions tá»± Ä‘á»™ng thay khi workflow cháº¡y. Náº¿u deploy thá»§ cÃ´ng báº±ng Helm, dÃ¹ng `ghcr.io/<github-owner>` qua `--set global.imageRegistry=...`.

Vá»›i deploy thá»§ cÃ´ng, cÃ³ thá»ƒ dÃ¹ng má»™t Git SHA tag Ä‘Ã£ tá»“n táº¡i trÃªn GHCR:

```bash
helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  --set global.imageRegistry=ghcr.io/<github-owner> \
  --set global.imageTag=<existing-ghcr-tag> \
  --set migration.imageTag=<existing-ghcr-tag>
```

Náº¿u dÃ¹ng cÃ¹ng má»™t `global.imageTag`, tag Ä‘Ã³ cáº§n tá»“n táº¡i cho Ä‘á»§ 10 production service images. Náº¿u GHCR package lÃ  private, cáº§n cáº¥u hÃ¬nh `GHCR_PULL_USERNAME` vÃ  `GHCR_PULL_TOKEN`.

## Kiá»ƒm tra Helm trÃªn local

```bash
helm lint charts/luyen-thi-lai-xe
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml
```

## Deploy thá»§ cÃ´ng

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

Smoke script kiá»ƒm tra `/health/live` vÃ  `/health/ready` cá»§a toÃ n bá»™ 10 production services thÃ´ng qua Kong.

## Rollback

```bash
helm history luyen-thi-lai-xe -n production
helm rollback luyen-thi-lai-xe <revision> -n production
SMOKE_BASE_URL=https://api.example.com bash scripts/k8s-smoke.sh
```

Rollback sáº½ Ä‘Æ°a Kubernetes release vá» revision cÅ©, bao gá»“m app image tags vÃ  rendered config. Database migrations khÃ´ng tá»± reverse; náº¿u migration khÃ´ng backward compatible thÃ¬ cáº§n táº¡o migration tiáº¿p theo thay vÃ¬ ká»³ vá»ng rollback DB tá»± xá»­ lÃ½.

Hiá»‡n táº¡i rollback cÃ³ thá»ƒ cháº¡y báº±ng GitHub Actions workflow `Rollback Release`. Workflow nÃ y nháº­n `target_environment`, `helm_revision`, `confirm_rollback`, tÃ¹y chá»n cháº¡y smoke test sau rollback vÃ  ghi deployment event Ä‘á»ƒ DORA report tÃ­nh Ä‘Æ°á»£c rollback/change failure.

## K3s Legacy Lab

Chá»‰ dÃ¹ng pháº§n nÃ y khi cáº§n rehearsal giÃ¡ ráº» trÃªn local/VM ngoÃ i GCP:

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
sudo kubectl get storageclass
```

Vá»›i K3s, override chart values nhÆ° sau:

```yaml
global:
  storageClassName: local-path

ingress:
  className: traefik
```
