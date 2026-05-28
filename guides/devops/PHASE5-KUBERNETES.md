# Phase 5 Kubernetes Deployment

Phase 5 deploys the production scope to a real Kubernetes runtime. The current baseline targets K3s on a VPS with Traefik ingress and the default `local-path` storage class.

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

## K3s Host Setup

Install K3s on the VPS:

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
sudo kubectl get storageclass
```

Export kubeconfig for GitHub Actions:

```bash
sudo cat /etc/rancher/k3s/k3s.yaml > kubeconfig.yaml
# Replace 127.0.0.1 with the VPS public host or IP in kubeconfig.yaml.
base64 -w0 kubeconfig.yaml
```

Use DNS records or nip.io-style hosts:

```text
api.<vps-ip>.nip.io
auth.<vps-ip>.nip.io
```

## GitHub Variables And Secrets

Repository variable:

```text
STAGING_DEPLOY_ENABLED=true
```

Staging variables:

```text
STAGING_API_SCHEME=http
STAGING_API_HOST=api.<vps-ip>.nip.io
STAGING_AUTH_HOST=auth.<vps-ip>.nip.io
STAGING_FRONTEND_ORIGIN=http://localhost:3000
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
SMOKE_BASE_URL=http://api.<vps-ip>.nip.io bash scripts/k8s-smoke.sh
```

The smoke script checks `/health/live` and `/health/ready` for all 10 production services through Kong.

## Rollback

```bash
helm history luyen-thi-lai-xe -n production
helm rollback luyen-thi-lai-xe <revision> -n production
SMOKE_BASE_URL=https://api.example.com bash scripts/k8s-smoke.sh
```

Rollback reverts the Kubernetes release, including app image tags and rendered config. Database migrations are not automatically reversed; if a migration is not backward compatible, create a follow-up migration instead of relying on rollback.
