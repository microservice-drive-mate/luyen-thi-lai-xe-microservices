# Phase 5 Kubernetes Deployment

Phase 5 deploys the production scope to a real Kubernetes runtime. The current primary target is GCP/GKE. K3s/VPS is now only a local lab or legacy fallback path.

For the full GCP checklist, including cluster sizing, DNS, static IP, TLS and GitHub secrets, see `guides/devops/GCP-SETUP.md`.

## Scope

Included:

- 10 production services: identity, user, exam, course, question, notification, analytics, simulation, media, audit.
- Kong DB-less gateway exposed through Ingress.
- Keycloak exposed through a separate Ingress host.
- In-cluster Postgres, RabbitMQ, Redis, Consul and Keycloak.
- Consul seed Job for non-secret runtime config.
- Prisma migration Job using `luyen-thi-lai-xe-migration-runner`.
- App Pods wait for Consul seed and Prisma migration Jobs before the main containers start.
- Liveness/readiness probes and resource requests/limits.
- Helm rollback.

Out of scope for Phase 5:

- Terraform, HPA and load testing. These belong to Phase 9.
- Full ELK/Prometheus/Grafana migration to Kubernetes.
- Vault or External Secrets integration.

## GCP/GKE Cluster Setup

Create or select a GCP project, then enable the required APIs:

```bash
gcloud config set project <gcp-project-id>
gcloud services enable container.googleapis.com compute.googleapis.com
```

Create a small staging cluster. Adjust region, node count and machine type for budget/capacity:

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

Export kubeconfig for GitHub Actions:

```bash
kubectl config view --raw --minify > kubeconfig-gke-staging.yaml
base64 -w0 kubeconfig-gke-staging.yaml
```

Use real DNS records for staging/production:

```text
api.staging.example.com
auth.staging.example.com
api.example.com
auth.example.com
```

The chart defaults to GKE-friendly values:

- `global.storageClassName: standard-rwo`
- `ingress.className: gce`

If you install Traefik or NGINX Ingress on GKE instead of using GKE Ingress, override `ingress.className` in the environment values file.

## GitHub Variables And Secrets

Repository variable:

```text
STAGING_DEPLOY_ENABLED=true
```

Staging variables:

```text
STAGING_API_SCHEME=https
STAGING_API_HOST=api.staging.example.com
STAGING_AUTH_HOST=auth.staging.example.com
STAGING_FRONTEND_ORIGIN=https://staging.example.com
```

Production variables:

```text
PRODUCTION_API_SCHEME=http
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

`GHCR_PULL_TOKEN` should be a GitHub token that can pull packages from GHCR after the workflow has finished.

## Local Helm Validation

```bash
helm lint charts/luyen-thi-lai-xe
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml
```

## Manual Deploy

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

## Smoke Test

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

The smoke script checks `/health/live` and `/health/ready` for all 10 production services through Kong.

## Rollback

```bash
helm history luyen-thi-lai-xe -n production
helm rollback luyen-thi-lai-xe <revision> -n production
SMOKE_BASE_URL=https://api.example.com bash scripts/k8s-smoke.sh
```

Rollback reverts the Kubernetes release, including app image tags and rendered config. Database migrations are not automatically reversed; if a migration is not backward compatible, create a follow-up migration instead of relying on rollback.

## K3s Legacy Lab

Use this only when you need a cheap local/VM rehearsal outside GCP:

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
sudo kubectl get storageclass
```

For K3s, override the chart values:

```yaml
global:
  storageClassName: local-path

ingress:
  className: traefik
```
