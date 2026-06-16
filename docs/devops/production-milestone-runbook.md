# Production Milestone Runbook

Runbook nay dung de demo production milestone tren Azure AKS, tap trung vao cac yeu cau trong de cuong:

- Cau hinh tap trung va quan ly secrets.
- Service discovery va load balancing.
- Observability production-lite.
- Production release manual, co approval va rollback evidence.

## 1. Deployment Model

V1 dung cung AKS hien tai de tiet kiem chi phi demo:

```text
AKS cluster: aks-lttl-staging
staging namespace: auto deploy sau Main Image Release
production namespace: manual deploy qua Production Release
```

Production khong auto deploy. Workflow `Production Release` chi chay bang `workflow_dispatch`, yeu cau `confirm_production=true` va GitHub Environment `production`.

Production image tag phai la Git SHA da duoc `Main Image Release` build/push len GHCR va nen la SHA da pass staging smoke test.

## 2. GitHub Environment Setup

Tao GitHub Environment:

```text
Settings -> Environments -> New environment -> production
```

Khuyen nghi:

- Bat required reviewers.
- Khong them auto deployment branch rule neu chua can.
- Dung environment-scoped variables/secrets cho production.

Variables:

```text
GHCR_OWNER=microservice-drive-mate
AZURE_AKS_RESOURCE_GROUP=rg-lttl-staging-sea
AZURE_AKS_CLUSTER_NAME=aks-lttl-staging
PRODUCTION_API_SCHEME=http
PRODUCTION_API_HOST=api.<external-ip>.nip.io
PRODUCTION_AUTH_HOST=auth.<external-ip>.nip.io
PRODUCTION_FRONTEND_ORIGIN=http://localhost:5173
```

Secrets:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
GHCR_PULL_USERNAME
GHCR_PULL_TOKEN
PRODUCTION_POSTGRES_PASSWORD
PRODUCTION_RABBITMQ_PASSWORD
PRODUCTION_RABBITMQ_ERLANG_COOKIE
PRODUCTION_KEYCLOAK_ADMIN_PASSWORD
PRODUCTION_KEYCLOAK_CLIENT_SECRET
PRODUCTION_STORAGE_ACCOUNT_NAME
PRODUCTION_STORAGE_ACCOUNT_KEY
```

For GitHub OIDC, Azure federated credential subject must match:

```text
repo:<owner>/<repo>:environment:production
```

## 3. Centralized Config And Secrets

Current demo implementation:

- ConfigMap provides bootstrap config such as `CONSUL_URL`, public URLs, CORS, logging, and service base URLs.
- Consul runs in AKS and stores runtime config under `config/<env>/...`.
- `consul-seed` Job seeds Consul KV on every Helm release revision.
- Services load config through `ConsulConfigFactory` with priority:

```text
environment variables > Consul KV > .env fallback/defaults
```

Secrets implementation:

- GitHub Secrets are injected into workflow env.
- Workflow renders Helm values.
- Helm renders Kubernetes Secret `luyen-thi-lai-xe-secrets`.
- Pods consume secrets through `secretKeyRef`.
- Secrets are not stored in Consul.

Demo commands:

```powershell
kubectl get configmap -n staging
kubectl get secret -n staging
kubectl get job -n staging -l app.kubernetes.io/component=consul-seed
kubectl describe configmap luyen-thi-lai-xe-config -n staging
kubectl describe secret luyen-thi-lai-xe-secrets -n staging
```

Inspect Consul KV:

```powershell
kubectl port-forward svc/luyen-thi-lai-xe-consul -n staging 8500:8500
```

In another terminal:

```powershell
Invoke-RestMethod http://localhost:8500/v1/kv/config/staging/?keys
Invoke-RestMethod http://localhost:8500/v1/kv/config/staging/shared/public.gateway.url
```

Production roadmap:

```text
Azure Key Vault -> External Secrets/CSI Driver -> Kubernetes Secret volume/env
AKS workload identity -> no long-lived cloud credentials in pods
GitHub Actions keeps only bootstrap OIDC/package secrets
```

## 4. Service Discovery And Load Balancing

Current demo implementation:

- Every microservice has a Kubernetes `Service` with `type=ClusterIP`.
- Internal calls use Kubernetes DNS names.
- Kubernetes Service load balances to healthy pod endpoints.
- Public traffic path:

```text
Browser/client
-> Azure Load Balancer
-> ingress-nginx
-> Kubernetes Ingress
-> Kong API Gateway
-> service ClusterIP
-> app pods
```

Consul is used for config KV in this deployment. It is not the primary service registry. Kubernetes DNS and Services provide service discovery and load balancing.

Demo commands:

```powershell
kubectl get svc -n staging
kubectl get endpoints -n staging
kubectl get ingress -n staging -o wide
kubectl describe ingress luyen-thi-lai-xe -n staging
```

Show load balancing by scaling one service:

```powershell
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=2
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging
kubectl get pods -n staging -l app.kubernetes.io/service-name=user-service -o wide
kubectl get endpoints luyen-thi-lai-xe-user-service -n staging
```

Scale back:

```powershell
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=1
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging
```

## 5. Observability Production-Lite

Current implementation:

- Services expose `/metrics` through `@repo/common`.
- Services include OpenTelemetry tracing hooks.
- Helm can deploy Jaeger when `tracing.enabled=true`.
- Terraform can enable AKS Log Analytics/OMS agent.
- DORA metrics come from GitHub Actions deployment event artifacts and incident issues.

Useful checks:

```powershell
kubectl logs deploy/luyen-thi-lai-xe-kong -n staging --tail=100
kubectl logs deploy/luyen-thi-lai-xe-identity-service -n staging --tail=100
kubectl port-forward svc/luyen-thi-lai-xe-identity-service -n staging 3001:3000
Invoke-WebRequest http://localhost:3001/metrics
```

Optional tracing demo:

```text
Set tracing.enabled=true in Helm values
Deploy Jaeger with the chart
Port-forward svc/luyen-thi-lai-xe-jaeger 16686:16686
Open http://localhost:16686
```

Production roadmap:

```text
Logs: Azure Monitor / Log Analytics
Metrics: Azure Managed Prometheus or kube-prometheus-stack
Traces: OpenTelemetry Collector -> Jaeger/Tempo/Application Insights
Alerts: Azure Monitor alerts or Alertmanager
Dashboards: Azure Managed Grafana or Grafana in-cluster
```

## 6. Production Release Demo

1. Confirm staging is green.

```powershell
kubectl get deploy,pod,svc,ingress,job -n staging
helm history luyen-thi-lai-xe -n staging
```

2. Pick an immutable image SHA from a successful `Main Image Release`.

3. Run:

```text
Actions -> Production Release -> Run workflow
image_tag=<sha-that-passed-staging>
confirm_production=true
```

4. Approve the GitHub Environment `production`.

5. Confirm release:

```powershell
kubectl get deploy,pod,svc,ingress,job -n production
helm history luyen-thi-lai-xe -n production
```

6. If needed, rollback:

```powershell
helm history luyen-thi-lai-xe -n production
helm rollback luyen-thi-lai-xe <revision> -n production
```

Key explanation for demo:

```text
Staging proves every merge can deploy automatically.
Production is protected: same immutable image, manual approval, separate namespace, smoke test, and rollback path.
Config is centralized through Consul KV; secrets are isolated in Kubernetes Secret today, with Key Vault as the production-grade next step.
Service discovery and load balancing are handled by Kubernetes Service/DNS, ingress-nginx, and Kong.
```
