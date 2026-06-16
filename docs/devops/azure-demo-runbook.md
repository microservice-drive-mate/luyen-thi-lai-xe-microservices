# Azure AKS Demo Runbook

This is the 15-20 minute demo script for the microservices DevOps presentation.

## 1. Opening

Message:

```text
The system is deployed as independent NestJS microservices on Azure AKS.
Kong is the single public entrypoint, Keycloak handles identity, RabbitMQ handles async events, Redis handles cache/session revocation, and each service owns its own PostgreSQL database.
Media upload uses Azure Blob Storage with SAS URLs.
```

Show:

```powershell
kubectl get nodes
kubectl get pods -n staging
kubectl get deploy,svc,ingress,job -n staging
```

## 2. Infrastructure as Code

Show:

```powershell
terraform -chdir=terraform/azure-aks validate
terraform -chdir=terraform/azure-aks output resource_group_name
terraform -chdir=terraform/azure-aks output aks_cluster_name
terraform -chdir=terraform/azure-aks output storage_account_name
```

Talking points:

- Terraform creates the Azure Resource Group, AKS cluster, Storage Account, private Blob container, and optional Log Analytics.
- Azure AKS is the supported cloud demo path, and media is already Azure Blob-native.
- No Ansible is used because AKS is managed; Terraform and Helm are the correct abstraction levels.

## 3. CI/CD

Show GitHub Actions:

- `Main Image Release`: code quality gate, Docker build, Trivy HIGH/CRITICAL audit, fixed CRITICAL vulnerability gate, SBOM, Cosign signing, GHCR push.
- `Deploy Azure AKS Staging`: AKS credentials, Helm values render, Helm deploy, rollout wait, smoke test, deployment event.
- Setup checklist: `docs/devops/azure-github-actions-setup.md`.

Talking points:

- Images are immutable by Git SHA.
- Migration runs as a Kubernetes Job before app pods serve traffic.
- Deployment event is recorded for DORA metrics.

## 4. Kubernetes Runtime

Commands:

```powershell
helm history luyen-thi-lai-xe -n staging
kubectl get ingress -n staging -o wide
kubectl get pods -n staging -l app.kubernetes.io/component=app
```

UI walkthrough:

```powershell
k9s
```

- In `k9s`, switch to namespace `staging`, then show `:deploy`, `:pods`, `:svc`, `:ing`, and `:jobs`.
- In Lens, open context `aks-lttl-staging`, choose namespace `staging`, then show Workloads, Pods, Services, Ingresses, and Jobs.
- Use Lens as the main visual UI and k9s as the realtime terminal UI during scaling or rollout demos.

Smoke:

```powershell
$env:SMOKE_BASE_URL="http://api.<external-ip>.nip.io"
bash scripts/k8s-smoke.sh
```

Expected:

- All `health/live` and `health/ready` routes pass through Kong.
- App pods are ready after migration and Consul seed jobs complete.

## 5. API Gateway And Auth

Open Scalar or direct docs:

```text
http://api.<external-ip>.nip.io/identity-service/docs
http://api.<external-ip>.nip.io/media-service/docs
http://api.<external-ip>.nip.io/analytics-service/docs
```

Demo:

1. `POST /auth/login`.
2. `GET /users/me`.
3. Explain that frontend never talks to internal service DNS directly.

## 6. Azure Blob Media Flow

Demo:

1. `POST /media/files/init`.
2. PUT file directly to `uploadUrl` from browser/Postman.
3. `POST /media/files/{id}/complete`.
4. `GET /media/files/{id}/url`.

Talking points:

- Backend controls metadata and permissions.
- Browser uploads directly to Azure Blob through SAS URL, reducing backend load.
- Azure Blob CORS is configured in Terraform.

## 7. Event-Driven Flow

Pick one:

- Exam session completed -> analytics projection.
- Course enrollment/lesson completed -> analytics/notification.
- User/course/question links media -> media file becomes `LINKED`.

Show:

```powershell
kubectl logs -n staging deploy/luyen-thi-lai-xe-analytics-service --tail=80
kubectl logs -n staging deploy/luyen-thi-lai-xe-notification-service --tail=80
```

Talking points:

- RabbitMQ decouples producers and consumers.
- Analytics is eventually consistent by design.

## 8. Observability

If running in AKS:

```powershell
kubectl port-forward -n staging svc/luyen-thi-lai-xe-jaeger 16686:16686
```

If using local observability fallback:

```text
Grafana: http://localhost:30000
Kibana: http://localhost:5601
Jaeger: http://localhost:16686
```

Talking points:

- Health/readiness probes protect rollout.
- Metrics and traces are cross-cutting concerns from `packages/common`.
- Logs carry correlation IDs.

## 9. Resilience And Rollback

Scaling:

```powershell
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=2
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging
kubectl get pods -n staging -l app.kubernetes.io/service-name=user-service -o wide
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=1
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging
```

Keep Lens or k9s open while scaling to show the new `user-service` pod appearing and then returning to the desired replica count.

Rollout restart:

```powershell
kubectl rollout restart deployment/luyen-thi-lai-xe-media-service -n staging
kubectl rollout status deployment/luyen-thi-lai-xe-media-service -n staging
```

Rollback:

```powershell
helm history luyen-thi-lai-xe -n staging
helm rollback luyen-thi-lai-xe <revision> -n staging
```

Talking points:

- Kubernetes replaces pods while readiness gates traffic.
- Helm rollback restores the previous manifest/image tag.
- DB rollback is handled by forward migrations, not automatic reverse migrations.

## 10. Backup/Restore

Local/demo backup evidence:

```powershell
pnpm.cmd run db:backup:once
pnpm.cmd run db:restore:test
```

Talking points:

- Current demo has backup scripts and restore rehearsal.
- Production roadmap is Azure-managed database backups/PITR.

## 11. Closing

Message:

```text
This is not just a local microservices demo. The project has service boundaries, gateway routing, auth, messaging, cache, media storage, CI/CD, IaC, Kubernetes deployment, smoke tests, rollback, and observability evidence. The production roadmap is clear: managed databases, Key Vault, real DNS/TLS, stronger network policies, and durable event inbox/outbox.
```

## Pre-Demo Checklist

- Azure credit checked.
- Terraform outputs saved.
- AKS cluster running.
- NGINX ingress has external IP.
- `STAGING_API_HOST` and `STAGING_AUTH_HOST` point to working hosts.
- GHCR image tag exists for all 10 services and migration runner.
- `Deploy Azure AKS Staging` passed.
- `scripts/k8s-smoke.sh` passed.
- Login token works.
- Media direct upload works.
- One dashboard/API screen has seeded data.
- Rollback revision exists.
