# GCP Setup Guide - Luyen Thi Lai Xe Microservices

Tai lieu nay mo ta cac viec can lam de dua toan bo he thong len Google Cloud Platform theo huong **GKE + Helm**. Trang thai hien tai cua repo phu hop nhat voi **MVP/staging tren GKE Standard**, self-contained dependencies trong cluster. Khi len production that, nen tach dan database/cache/secret/storage sang managed services cua GCP.

## 1. Kien truc de xuat

### MVP/Staging

- Compute runtime: **GKE Standard**.
- Region: `asia-southeast1` neu nguoi dung chinh o Viet Nam/Dong Nam A.
- Namespace:
  - `staging` cho moi truong test.
  - `production` cho release that neu dung chung cluster luc dau.
- Container registry: tiep tuc dung **GHCR** theo workflow hien co.
- Ingress: GKE Ingress class `gce`.
- StorageClass: `standard-rwo`.
- Media storage:
  - Trang thai code hien tai: `media-service` dang dung Azure Blob SDK.
  - Neu muon full GCP: can implement Google Cloud Storage provider cho `media-service` truoc khi chuyen media sang Cloud Storage.
  - Neu chua sua code: tam thoi giu Azure Blob cho media, con runtime van chay tren GKE.
- Secrets: tam thoi dung GitHub Secrets -> render thanh Kubernetes Secret qua Helm.

### Production hardening sau MVP

- Postgres: chuyen sang **Cloud SQL for PostgreSQL** thay vi Postgres trong cluster.
- Redis: chuyen sang **Memorystore for Redis**.
- Media: Cloud Storage + Workload Identity Federation for GKE, sau khi `media-service` co GCS provider.
- Secrets: Google Secret Manager + Secret Manager CSI add-on hoac External Secrets.
- DNS/TLS: Cloud DNS + Google-managed certificate.
- IaC: Terraform cho project, GKE, DNS, static IP, service accounts, IAM va secrets.

## 2. Thong so nen chon

| Hang muc | MVP/Staging khuyen nghi | Production nho khuyen nghi | Ghi chu |
| --- | --- | --- | --- |
| GKE mode | Standard | Standard regional | Autopilot rat gon van hanh, nhung chart hien tai co nhieu stateful dependency nen Standard de kiem soat node/storage hon. |
| Region | `asia-southeast1` | `asia-southeast1` | Gan Viet Nam/Singapore de latency thap. |
| Cluster type | Zonal hoac regional 1 region | Regional | Zonal re hon; regional tot hon cho HA. |
| Node machine | `e2-standard-4` | `e2-standard-4` hoac `e2-standard-8` | MVP nen bat dau `e2-standard-4`, scale sau khi co metrics. |
| Node count | 2 nodes | 3 nodes toi thieu | 2 nodes du cho demo co du dia cho rolling update; production can HA hon. |
| Autoscaling | min 2, max 3 | min 3, max 6 | Nen bat autoscaling de tranh het tai nguyen luc deploy. |
| Boot disk | `pd-balanced`, 50-100Gi | `pd-balanced`, 100Gi | Image/cache/log tren node can du dung luong. |
| Pod storage | `standard-rwo` | `standard-rwo` hoac managed DB | Chart da dung PVC cho Postgres/RabbitMQ/Redis/Consul. |
| Public traffic | GKE Ingress `gce` | GKE Ingress `gce` + static IP + managed cert | Neu dung NGINX/Traefik thi override `ingress.className`. |
| Media storage | Tam giu Azure Blob hoac implement GCS provider | Cloud Storage sau khi code support GCS | Hien `media-service` chua phai GCS-native. |
| App replicas | 1 moi service | 2+ cho service stateless | Hien chart app default 1 replica; tang sau khi DB/session/config san sang. |

Resource request hien tai tu chart:

- 10 app services: moi service request `100m CPU`, `128Mi`.
- Postgres: `250m CPU`, `512Mi`, PVC `10Gi`.
- RabbitMQ: `100m CPU`, `256Mi`, PVC `2Gi`.
- Redis: `50m CPU`, `128Mi`, PVC `1Gi`.
- Consul: `100m CPU`, `128Mi`, PVC `1Gi`.
- Keycloak: `250m CPU`, `512Mi`.
- Kong: `100m CPU`, `512Mi`.
- Migration job: `100m CPU`, `256Mi` luc deploy.

Tong request MVP xap xi `2 CPU` va `3.5Gi RAM`, chua tinh kube-system, surge rollout va buffer. Vi vay 2 node `e2-standard-4` la diem bat dau hop ly cho staging/demo; production nen co it nhat 3 node hoac chuyen stateful dependency sang managed services.

## 3. Chuan bi GCP project

```bash
gcloud auth login
gcloud config set project <gcp-project-id>

gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  dns.googleapis.com \
  cloudresourcemanager.googleapis.com
```

Tao bien shell dung lai:

```bash
export PROJECT_ID=<gcp-project-id>
export REGION=asia-southeast1
export ZONE=asia-southeast1-a
export CLUSTER_NAME=lttl-staging
```

## 4. Tao GKE cluster

### Option A - MVP staging tiet kiem hon

Dung zonal cluster 2 node:

```bash
gcloud container clusters create "$CLUSTER_NAME" \
  --project "$PROJECT_ID" \
  --zone "$ZONE" \
  --machine-type e2-standard-4 \
  --num-nodes 2 \
  --disk-type pd-balanced \
  --disk-size 100 \
  --enable-ip-alias \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-managed-prometheus \
  --enable-secret-manager \
  --workload-pool "$PROJECT_ID.svc.id.goog" \
  --release-channel regular
```

Bat autoscaling cho node pool mac dinh:

```bash
gcloud container clusters update "$CLUSTER_NAME" \
  --zone "$ZONE" \
  --enable-autoscaling \
  --node-pool default-pool \
  --min-nodes 2 \
  --max-nodes 3
```

### Option B - Production nho/HA hon

Dung regional cluster:

```bash
gcloud container clusters create lttl-production \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --machine-type e2-standard-4 \
  --num-nodes 1 \
  --disk-type pd-balanced \
  --disk-size 100 \
  --enable-ip-alias \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-managed-prometheus \
  --enable-secret-manager \
  --workload-pool "$PROJECT_ID.svc.id.goog" \
  --release-channel regular
```

Voi regional cluster, `--num-nodes 1` nghia la moi zone trong region co 1 node. Tong so node thuc te co the lon hon zonal cluster, nen can kiem tra chi phi truoc khi tao.

Lay credentials:

```bash
gcloud container clusters get-credentials "$CLUSTER_NAME" --zone "$ZONE" --project "$PROJECT_ID"
kubectl get nodes
kubectl get storageclass
```

## 5. Media storage tren GCP

Quan trong: repo hien tai co provider `AzureBlobStorageProvider` va dependency `@azure/storage-blob`. Cac bien `STORAGE_ACCOUNT_NAME`, `STORAGE_ACCOUNT_KEY`, `STORAGE_CONTAINER_NAME` dang map theo Azure Blob. Vi vay co 2 huong:

1. **Nhanh nhat de deploy he thong len GKE**: van dung Azure Blob cho media, chi chuyen compute/runtime sang GCP.
2. **Full GCP**: them `GoogleCloudStorageProvider` vao `media-service`, cap nhat config/env, test upload/download/delete, roi moi dung Cloud Storage bucket ben duoi.

Phan duoi la checklist cho huong full GCP sau khi code da support GCS.

```bash
export MEDIA_BUCKET=lttl-media-staging-$PROJECT_ID

gcloud storage buckets create "gs://$MEDIA_BUCKET" \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --uniform-bucket-level-access
```

Sau khi code da support GCS, luon dau co the dung service account key de inject qua Kubernetes Secret/Helm. Day la buoc tam thoi; khong nen giu lau trong production:

```bash
gcloud iam service-accounts create lttl-media-sa \
  --display-name "LTTL media storage service account"

gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" \
  --member "serviceAccount:lttl-media-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/storage.objectAdmin"

gcloud iam service-accounts keys create media-sa-key.json \
  --iam-account "lttl-media-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

Sau MVP nen bo key file va chuyen sang Workload Identity Federation for GKE.

## 6. DNS, static IP va TLS

Dat 2 host:

- `api.staging.example.com`
- `auth.staging.example.com`

Reserve static IP:

```bash
gcloud compute addresses create lttl-staging-ip --global
gcloud compute addresses describe lttl-staging-ip --global --format="value(address)"
```

Tao A records trong Cloud DNS hoac DNS provider dang dung, tro 2 host tren ve static IP nay.

Neu dung Google-managed certificate, can them annotation vao Ingress:

```yaml
ingress:
  className: gce
  annotations:
    kubernetes.io/ingress.global-static-ip-name: lttl-staging-ip
    networking.gke.io/managed-certificates: lttl-staging-cert
```

Chart hien tai chua co template `ManagedCertificate`, nen co 2 cach:

1. Tao file manifest rieng `ManagedCertificate` va apply truoc Helm.
2. Bo sung template cert vao chart trong phase hardening tiep theo.

Manifest mau:

```yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: lttl-staging-cert
  namespace: staging
spec:
  domains:
    - api.staging.example.com
    - auth.staging.example.com
```

```bash
kubectl create namespace staging
kubectl apply -f managed-certificate-staging.yaml
```

## 7. Cau hinh GitHub Secrets va Variables

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

Shared secrets:

```text
GHCR_PULL_USERNAME=<github-username>
GHCR_PULL_TOKEN=<github-token-co-quyen-read-packages>
```

Staging secrets:

```text
STAGING_KUBE_CONFIG_B64=<base64-kubeconfig>
STAGING_POSTGRES_PASSWORD=<strong-password>
STAGING_RABBITMQ_PASSWORD=<strong-password>
STAGING_RABBITMQ_ERLANG_COOKIE=<strong-cookie>
STAGING_KEYCLOAK_ADMIN_PASSWORD=<strong-password>
STAGING_KEYCLOAK_CLIENT_SECRET=<strong-secret>
STAGING_STORAGE_ACCOUNT_NAME=<azure-storage-account-hien-tai-hoac-gcs-config-sau-khi-code-support>
STAGING_STORAGE_ACCOUNT_KEY=<azure-storage-key-hien-tai-hoac-gcs-secret-sau-khi-code-support>
```

Export kubeconfig cho GitHub Actions:

```bash
kubectl config view --raw --minify > kubeconfig-gke-staging.yaml
base64 -w0 kubeconfig-gke-staging.yaml
```

Tren Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("kubeconfig-gke-staging.yaml"))
```

## 8. Dieu chinh Helm values

File da co:

- `charts/luyen-thi-lai-xe/values-staging.example.yaml`
- `charts/luyen-thi-lai-xe/values-production.example.yaml`

Gia tri GKE quan trong:

```yaml
global:
  imageTag: <git-sha-da-pass-ci>
  storageClassName: standard-rwo

ingress:
  className: gce
  apiHost: api.staging.example.com
  authHost: auth.staging.example.com
  annotations:
    kubernetes.io/ingress.global-static-ip-name: lttl-staging-ip
    networking.gke.io/managed-certificates: lttl-staging-cert

config:
  frontendOrigin: https://staging.example.com
  gatewayPublicUrl: https://api.staging.example.com
  keycloakPublicUrl: https://auth.staging.example.com
```

Neu chua dung HTTPS ngay, co the tam de `STAGING_API_SCHEME=http`, nhung production nen dung HTTPS.

Voi media storage, neu chua implement GCS provider thi tiep tuc dien Azure Blob credentials vao:

```yaml
secrets:
  storageAccountName: <azure-storage-account>
  storageAccountKey: <azure-storage-key>
  storageContainerName: media
```

## 9. Deploy thu cong lan dau

Can co `helm`, `kubectl`, `gcloud` tren may operator.

```bash
helm lint charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml

helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml \
  --set global.imageTag=<git-sha-da-pass-ci> \
  --set migration.imageTag=<git-sha-da-pass-ci>
```

Kiem tra:

```bash
kubectl get pods -n staging
kubectl get ingress -n staging
kubectl get pvc -n staging
kubectl rollout status deployment -l app.kubernetes.io/component=app -n staging --timeout=10m
```

Smoke test:

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

## 10. Deploy bang GitHub Actions

Luong hien co:

1. Merge vao `main`.
2. `Main Image Release` build, scan Trivy va push image GHCR voi tag `${github.sha}`.
3. Neu `STAGING_DEPLOY_ENABLED=true`, workflow deploy staging bang Helm.
4. Production release dung `.github/workflows/production-release.yml`, chay manual voi `image_tag` la Git SHA da pass.

Can cau hinh GitHub Environment:

- `staging`: cho phep auto deploy neu team dong y.
- `production`: bat required reviewers/manual approval.

## 11. Checklist truoc khi mo public

- DNS A records da tro dung static IP.
- ManagedCertificate trang thai `Active`.
- Kong Ingress tra ve duoc `/identity-service/health/live`.
- Keycloak public URL dung `https://auth...`.
- `KONG_CORS_ORIGINS` gom frontend, API va auth origins.
- Tat hoac gioi han Kong admin public exposure.
- Secret khong nam trong repo.
- GitHub Environment `production` co required reviewers.
- Backup Postgres/Keycloak da co lich va restore test.
- Alerting co kenh nhan canh bao that.

## 12. Loi hay gap

| Trieu chung | Nguyen nhan hay gap | Cach xu ly |
| --- | --- | --- |
| Pod pending | Node thieu CPU/RAM hoac PVC chua bind | `kubectl describe pod`, tang node/max-nodes, kiem tra StorageClass. |
| Ingress khong co IP | GKE Ingress dang reconcile hoac annotation sai | `kubectl describe ingress -n staging`, kiem tra static IP global. |
| HTTPS chua active | DNS chua tro dung IP hoac cert dang provisioning | Cho propagate DNS, `kubectl describe managedcertificate`. |
| ImagePullBackOff | GHCR pull secret sai | Kiem tra `GHCR_PULL_USERNAME`, `GHCR_PULL_TOKEN`, package visibility. |
| Migration job fail | DB chua san sang hoac Prisma env sai | `kubectl logs job/<migration-job> -n staging`. |
| Keycloak redirect sai | `KEYCLOAK_PUBLIC_URL`, `KC_HOSTNAME`, scheme/host sai | Kiem tra `STAGING_AUTH_HOST`, `STAGING_API_SCHEME`. |

## 13. Ghi chu chi phi

Khong hardcode gia trong tai lieu vi bang gia GCP thay doi theo thoi gian. Truoc khi tao production cluster, hay uoc tinh bang Google Cloud Pricing Calculator voi:

- So node va machine type.
- Persistent Disk dung cho PVC.
- Load balancer/Ingress.
- Cloud Storage.
- Cloud SQL/Memorystore neu tach managed services.
- Network egress.

## 14. Tai lieu tham khao

- GKE cluster configuration choices: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/configuration-overview
- GKE Autopilot overview: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview
- GKE Standard regional clusters: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/creating-a-regional-cluster
- GKE persistent volumes and StorageClasses: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/persistent-volumes
- Workload Identity Federation for GKE: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/workload-identity
- Secret Manager add-on for GKE: https://docs.cloud.google.com/secret-manager/docs/secret-manager-managed-csi-component
- Google-managed SSL certificates for GKE Ingress: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/managed-certs
