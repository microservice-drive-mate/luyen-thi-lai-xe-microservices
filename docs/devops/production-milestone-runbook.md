# Production Milestone Runbook

Runbook nay dung de demo production milestone tren Azure AKS, tap trung vao cac yeu cau trong de cuong:

- Cau hinh tap trung va quan ly secrets.
- Service discovery va load balancing.
- Observability production-lite.
- Production release manual, co approval va rollback evidence.

## 1. Deployment Model

Production milestone dung AKS rieng de tranh anh huong staging:

```text
staging AKS cluster: aks-lttl-staging
staging namespace: staging
staging policy: auto deploy sau Main Image Release

production AKS cluster: aks-lttl-production
production namespace: production
production policy: manual deploy qua Production Release
```

Production khong auto deploy. Workflow `Production Release` chi chay bang `workflow_dispatch`, yeu cau `confirm_production=true` va GitHub Environment `production`.

Production image tag phai la Git SHA da duoc `Main Image Release` build/push len GHCR va nen la SHA da pass staging smoke test.

Safety rule: production workflow se fail neu `AZURE_AKS_RESOURCE_GROUP` hoac `AZURE_AKS_CLUSTER_NAME` cua Environment `production` co chua chu `staging`.

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
PRODUCTION_DEPLOY_ENABLED=false
GHCR_OWNER=microservice-drive-mate
AZURE_AKS_RESOURCE_GROUP=rg-lttl-production-sea
AZURE_AKS_CLUSTER_NAME=aks-lttl-production
PRODUCTION_API_SCHEME=http
PRODUCTION_API_HOST=api-prod.<production-ingress-ip>.nip.io
PRODUCTION_AUTH_HOST=auth-prod.<production-ingress-ip>.nip.io
PRODUCTION_FRONTEND_ORIGIN=http://localhost:5173
PRODUCTION_NEON_ENABLED=true
PRODUCTION_NEON_HOST=<production-neon-host>
PRODUCTION_POSTGRES_USER=<production-neon-user>
PRODUCTION_SEED_ENABLED=false
```

Keep `PRODUCTION_DEPLOY_ENABLED=false` until the production AKS cluster, ingress-nginx, Neon database, and GitHub secrets are ready. Then change it to `true` before the first manual production release.

Secrets:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
GHCR_PULL_USERNAME
GHCR_PULL_TOKEN
PRODUCTION_POSTGRES_PASSWORD
PRODUCTION_REDIS_PASSWORD
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

Do not remove or rename existing repo-level staging secrets/variables while setting up production. Staging remains the priority environment.

## 2.1. Production Infrastructure Setup

Do not edit or apply `terraform/azure-aks/terraform.tfvars` for production because that file is the current staging config.

Create a separate production var file from:

```powershell
Copy-Item terraform\azure-aks\production.tfvars.example terraform\azure-aks\production.tfvars
```

Edit only `terraform/azure-aks/production.tfvars`, then use a separate Terraform workspace or backend state for production:

```powershell
terraform -chdir=terraform/azure-aks workspace new production
terraform -chdir=terraform/azure-aks workspace select production
terraform -chdir=terraform/azure-aks plan -var-file=production.tfvars
terraform -chdir=terraform/azure-aks apply -var-file=production.tfvars
```

After apply:

```powershell
az aks get-credentials `
  --resource-group rg-lttl-production-sea `
  --name aks-lttl-production `
  --overwrite-existing

kubectl get nodes -o wide
```

Install ingress-nginx on the production cluster before the first Production Release. After the LoadBalancer IP appears, update:

```text
PRODUCTION_API_HOST=api-prod.<production-ingress-ip>.nip.io
PRODUCTION_AUTH_HOST=auth-prod.<production-ingress-ip>.nip.io
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
- Helm can deploy lightweight Prometheus/Grafana/Alertmanager when `observability.enabled=true`.
- Terraform can enable AKS Log Analytics/OMS agent.
- DORA metrics come from GitHub Actions deployment event artifacts and incident issues.

Local Docker Compose is a full lab stack. AKS Student staging is optimized for limited CPU/RAM:

| Area         | Local Docker Compose                                 | AKS Student staging                                            |
| ------------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| Databases    | One PostgreSQL container per service database        | One PostgreSQL StatefulSet with multiple logical databases     |
| Metrics UI   | Prometheus + Grafana always available in local infra | Optional lightweight Prometheus + Grafana, disabled by default |
| Tracing UI   | Jaeger in local infra                                | Optional Jaeger, disabled by default                           |
| Central logs | Elasticsearch + Logstash + Kibana                    | `kubectl logs`, Lens/k9s, optional Azure Monitor/Log Analytics |

Keep the in-cluster observability stack disabled during normal auto deploy. Enable it manually only when demo capacity is available.

Useful checks:

```powershell
kubectl top nodes
kubectl top pods -n staging
kubectl get pods -A
kubectl logs deploy/luyen-thi-lai-xe-kong -n staging --tail=100
kubectl logs deploy/luyen-thi-lai-xe-identity-service -n staging --tail=100
kubectl port-forward svc/luyen-thi-lai-xe-identity-service -n staging 3001:3000
Invoke-WebRequest http://localhost:3001/metrics
```

Optional Prometheus/Grafana demo:

Use the rendered staging values with real image tag and secrets. Do not use `values-azure.example.yaml` directly against the live cluster.

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  -f <rendered-staging-values.yaml> `
  --set observability.enabled=true `
  --set observability.prometheus.enabled=true `
  --set observability.grafana.enabled=true

kubectl rollout status statefulset/luyen-thi-lai-xe-prometheus -n staging
kubectl rollout status deploy/luyen-thi-lai-xe-grafana -n staging
kubectl port-forward svc/luyen-thi-lai-xe-prometheus -n staging 9090:9090
kubectl port-forward svc/luyen-thi-lai-xe-grafana -n staging 30000:3000
```

Open:

```text
Prometheus: http://localhost:9090/targets
Grafana: http://localhost:30000
```

Optional tracing demo:

Use the rendered staging values with real image tag and secrets.

```powershell
helm upgrade luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  -n staging `
  -f <rendered-staging-values.yaml> `
  --set tracing.enabled=true

kubectl rollout status deploy/luyen-thi-lai-xe-jaeger -n staging
kubectl port-forward svc/luyen-thi-lai-xe-jaeger -n staging 16686:16686
```

Production roadmap:

```text
Logs: Azure Monitor / Log Analytics
Metrics: Azure Managed Prometheus or kube-prometheus-stack
Traces: OpenTelemetry Collector -> Jaeger/Tempo/Application Insights
Alerts: Azure Monitor alerts or Alertmanager
Dashboards: Azure Managed Grafana or Grafana in-cluster
```

Azure Student cost guardrails:

- Do not run production and staging workloads together on the current AKS cluster.
- Do not deploy ELK to AKS Student; keep ELK local or use Azure Monitor/Log Analytics.
- Keep Prometheus retention short, default `6h`, and storage small, default `2Gi`.
- Azure Monitor Logs and Managed Grafana can generate cost after free/trial limits, so verify usage before leaving them enabled.

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
