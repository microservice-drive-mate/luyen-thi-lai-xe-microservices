# DevOps Demo Script

Use this script for a concise Azure AKS demo.

## 1. Delivery Flow

Say:

> The project uses one delivery path: GitHub Actions builds immutable images in GHCR, then Azure AKS staging deploys automatically. Production is manual and protected by GitHub Environment approval.

Show:

- `Actions -> Main Image Release`
- `Actions -> Deploy Azure AKS Staging`
- `Actions -> Production Release`
- GitHub Packages/GHCR image tags

## 2. Azure Runtime

Show:

```powershell
kubectl config current-context
kubectl get deploy,pod,svc,ingress,job -n staging
helm history luyen-thi-lai-xe -n staging
```

Say:

> Each microservice is a Deployment. Services expose traffic inside the cluster, and NGINX Ingress exposes the public API host into Kong.

## 3. Lens Or k9s

Open namespace `staging`.

Show:

- Workloads -> Deployments
- Workloads -> Pods
- Network -> Services
- Network -> Ingresses
- Jobs
- Pod logs

## 4. API Smoke

Open:

```text
http://api.52.139.233.166.nip.io/identity-service/docs
```

Run a login request and show the response.

## 5. Scaling

```powershell
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=2
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging
kubectl get pods -n staging -l app.kubernetes.io/service-name=user-service -o wide
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=1
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging
```

Say:

> Kubernetes reconciles desired state. When replicas change from one to two, a new pod is scheduled and service discovery keeps routing stable.

## 6. Rolling Restart And Rollback

```powershell
kubectl rollout restart deploy/luyen-thi-lai-xe-media-service -n staging
kubectl rollout status deploy/luyen-thi-lai-xe-media-service -n staging
helm history luyen-thi-lai-xe -n staging
```

Say:

> A failed release can be rolled back by Helm revision. The rollback workflow also records a deployment event for DORA metrics.

## 7. DORA

Show:

- `Actions -> DORA Metrics Report`
- `reports/dora/dora-report.md` artifact

Say:

> Deployment events plus incident issues allow the team to calculate Deployment Frequency, Lead Time, Change Failure Rate, and MTTR.

## 8. Production Milestone

Use:

```text
docs/devops/production-milestone-runbook.md
```

Show centralized config and secrets:

```powershell
kubectl get configmap,secret -n staging
kubectl get job -n staging -l app.kubernetes.io/component=consul-seed
```

Say:

> Consul KV stores centralized runtime config. Secrets come from GitHub Secrets into Kubernetes Secrets and are mounted into pods through secretKeyRef. We do not put real secrets into Consul.

Show service discovery and load balancing:

```powershell
kubectl get svc,endpoints,ingress -n staging
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=2
kubectl get endpoints luyen-thi-lai-xe-user-service -n staging
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=1
```

Say:

> Kubernetes Service DNS provides service discovery, ClusterIP Services load balance across pod endpoints, ingress-nginx exposes public traffic, and Kong routes API paths to the right microservice.
