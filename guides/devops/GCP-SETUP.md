# Hướng dẫn thiết lập GCP - Luyện Thi Lái Xe Microservices

Tài liệu này mô tả các việc cần làm để đưa toàn bộ hệ thống lên Google Cloud Platform theo hướng **GKE + Helm**. Trạng thái hiện tại của repo phù hợp nhất với **MVP/staging trên GKE Standard**, các dependency vẫn tự chạy trong cluster. Khi lên production thật, nên tách dần database, cache, secret và storage sang managed services của GCP.

## 1. Kiến trúc đề xuất

### MVP/Staging

- Compute runtime: **GKE Standard**.
- Region: `asia-southeast1` nếu người dùng chính ở Việt Nam/Đông Nam Á.
- Namespace:
  - `staging` cho môi trường kiểm thử.
  - `production` cho release thật nếu giai đoạn đầu dùng chung cluster.
- Container registry: tiếp tục dùng **GHCR** theo workflow hiện có.
- GCP/GKE chỉ pull image từ GHCR để chạy workload; không build source code trên GCP.
- Ingress: GKE Ingress class `gce`.
- StorageClass: `standard-rwo`.
- Media storage:
  - Trạng thái code hiện tại: `media-service` đang dùng Azure Blob SDK.
  - Nếu muốn full GCP: cần thêm `GoogleCloudStorageProvider` cho `media-service` trước khi chuyển media sang Cloud Storage.
  - Nếu chưa sửa code: tạm thời giữ Azure Blob cho media, còn runtime vẫn chạy trên GKE.
- Secrets: tạm thời dùng GitHub Secrets rồi render thành Kubernetes Secret qua Helm.

### Production Hardening Sau MVP

- Postgres: chuyển sang **Cloud SQL for PostgreSQL** thay vì Postgres trong cluster.
- Redis: chuyển sang **Memorystore for Redis**.
- Media: Cloud Storage + Workload Identity Federation for GKE, sau khi `media-service` có GCS provider.
- Secrets: Google Secret Manager + Secret Manager CSI add-on hoặc External Secrets.
- DNS/TLS: Cloud DNS + Google-managed certificate.
- IaC: Terraform cho project, GKE, DNS, static IP, service accounts, IAM và secrets.

## 2. Thông số nên chọn

| Hạng mục | MVP/Staging khuyến nghị | Production nhỏ khuyến nghị | Ghi chú |
| --- | --- | --- | --- |
| GKE mode | Standard | Standard regional | Autopilot vận hành rất gọn, nhưng chart hiện có nhiều dependency stateful nên Standard dễ kiểm soát node/storage hơn. |
| Region | `asia-southeast1` | `asia-southeast1` | Gần Việt Nam/Singapore để giảm latency. |
| Cluster type | Zonal hoặc regional 1 region | Regional | Zonal rẻ hơn; regional tốt hơn cho HA. |
| Node machine | `e2-standard-4` | `e2-standard-4` hoặc `e2-standard-8` | MVP nên bắt đầu với `e2-standard-4`, rồi scale sau khi có metrics. |
| Node count | 2 nodes | Tối thiểu 3 nodes | 2 nodes đủ cho demo và có chỗ cho rolling update; production cần HA hơn. |
| Autoscaling | min 2, max 3 | min 3, max 6 | Nên bật autoscaling để tránh hết tài nguyên lúc deploy. |
| Boot disk | `pd-balanced`, 50-100Gi | `pd-balanced`, 100Gi | Image/cache/log trên node cần đủ dung lượng. |
| Pod storage | `standard-rwo` | `standard-rwo` hoặc managed DB | Chart đang dùng PVC cho Postgres/RabbitMQ/Redis/Consul. |
| Public traffic | GKE Ingress `gce` | GKE Ingress `gce` + static IP + managed cert | Nếu dùng NGINX/Traefik thì override `ingress.className`. |
| Media storage | Tạm giữ Azure Blob hoặc implement GCS provider | Cloud Storage sau khi code support GCS | Hiện `media-service` chưa phải GCS-native. |
| App replicas | 1 mỗi service | 2+ cho service stateless | Chart hiện default 1 replica; tăng sau khi DB/session/config sẵn sàng. |

Resource request hiện tại từ chart:

- 10 app services: mỗi service request `100m CPU`, `128Mi`.
- Postgres: `250m CPU`, `512Mi`, PVC `10Gi`.
- RabbitMQ: `100m CPU`, `256Mi`, PVC `2Gi`.
- Redis: `50m CPU`, `128Mi`, PVC `1Gi`.
- Consul: `100m CPU`, `128Mi`, PVC `1Gi`.
- Keycloak: `250m CPU`, `512Mi`.
- Kong: `100m CPU`, `512Mi`.
- Migration job: `100m CPU`, `256Mi` lúc deploy.

Tổng request MVP xấp xỉ `2 CPU` và `3.5Gi RAM`, chưa tính kube-system, surge rollout và buffer. Vì vậy 2 node `e2-standard-4` là điểm bắt đầu hợp lý cho staging/demo; production nên có ít nhất 3 node hoặc chuyển stateful dependency sang managed services.

## 3. Chuẩn bị GCP Project

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

Tạo biến shell dùng lại:

```bash
export PROJECT_ID=<gcp-project-id>
export REGION=asia-southeast1
export ZONE=asia-southeast1-a
export CLUSTER_NAME=lttl-staging
```

## 4. Tạo GKE Cluster

### Option A - MVP/Staging tiết kiệm hơn

Dùng zonal cluster 2 node:

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

Bật autoscaling cho node pool mặc định:

```bash
gcloud container clusters update "$CLUSTER_NAME" \
  --zone "$ZONE" \
  --enable-autoscaling \
  --node-pool default-pool \
  --min-nodes 2 \
  --max-nodes 3
```

### Option B - Production nhỏ/HA hơn

Dùng regional cluster:

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

Với regional cluster, `--num-nodes 1` nghĩa là mỗi zone trong region có 1 node. Tổng số node thực tế có thể lớn hơn zonal cluster, nên cần kiểm tra chi phí trước khi tạo.

Lấy credentials:

```bash
gcloud container clusters get-credentials "$CLUSTER_NAME" --zone "$ZONE" --project "$PROJECT_ID"
kubectl get nodes
kubectl get storageclass
```

## 5. Media Storage Trên GCP

Quan trọng: repo hiện tại có provider `AzureBlobStorageProvider` và dependency `@azure/storage-blob`. Các biến `STORAGE_ACCOUNT_NAME`, `STORAGE_ACCOUNT_KEY`, `STORAGE_CONTAINER_NAME` đang map theo Azure Blob. Vì vậy có 2 hướng:

1. **Nhanh nhất để deploy hệ thống lên GKE**: vẫn dùng Azure Blob cho media, chỉ chuyển compute/runtime sang GCP.
2. **Full GCP**: thêm `GoogleCloudStorageProvider` vào `media-service`, cập nhật config/env, test upload/download/delete, rồi mới dùng Cloud Storage bucket bên dưới.

Phần dưới là checklist cho hướng full GCP sau khi code đã support GCS.

```bash
export MEDIA_BUCKET=lttl-media-staging-$PROJECT_ID

gcloud storage buckets create "gs://$MEDIA_BUCKET" \
  --project "$PROJECT_ID" \
  --location "$REGION" \
  --uniform-bucket-level-access
```

Sau khi code đã support GCS, lúc đầu có thể dùng service account key để inject qua Kubernetes Secret/Helm. Đây là bước tạm thời; không nên giữ lâu trong production:

```bash
gcloud iam service-accounts create lttl-media-sa \
  --display-name "LTTL media storage service account"

gcloud storage buckets add-iam-policy-binding "gs://$MEDIA_BUCKET" \
  --member "serviceAccount:lttl-media-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/storage.objectAdmin"

gcloud iam service-accounts keys create media-sa-key.json \
  --iam-account "lttl-media-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

Sau MVP nên bỏ key file và chuyển sang Workload Identity Federation for GKE.

## 6. DNS, Static IP Và TLS

Đặt 2 host:

- `api.staging.example.com`
- `auth.staging.example.com`

Reserve static IP:

```bash
gcloud compute addresses create lttl-staging-ip --global
gcloud compute addresses describe lttl-staging-ip --global --format="value(address)"
```

Tạo A records trong Cloud DNS hoặc DNS provider đang dùng, trỏ 2 host trên về static IP này.

Nếu dùng Google-managed certificate, cần thêm annotation vào Ingress:

```yaml
ingress:
  className: gce
  annotations:
    kubernetes.io/ingress.global-static-ip-name: lttl-staging-ip
    networking.gke.io/managed-certificates: lttl-staging-cert
```

Chart hiện tại chưa có template `ManagedCertificate`, nên có 2 cách:

1. Tạo file manifest riêng `ManagedCertificate` và apply trước Helm.
2. Bổ sung template cert vào chart trong phase hardening tiếp theo.

Manifest mẫu:

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

## 7. Cấu Hình GitHub Secrets Và Variables

Repository variable optional:

```text
GCP_AUTO_DEPLOY_ENABLED=false
```

Mặc định `.github/workflows/ci.yml` sẽ auto deploy GCP staging sau mỗi lần push/merge vào `main` thành công. Chỉ set `GCP_AUTO_DEPLOY_ENABLED=false` khi muốn tạm dừng auto deploy.

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

Trên Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("kubeconfig-gke-staging.yaml"))
```

## 8. Điều Chỉnh Helm Values

File đã có:

- `charts/luyen-thi-lai-xe/values-staging.example.yaml`
- `charts/luyen-thi-lai-xe/values-production.example.yaml`

Giá trị GKE quan trọng:

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

Nếu chưa dùng HTTPS ngay, có thể tạm để `STAGING_API_SCHEME=http`, nhưng production nên dùng HTTPS.

Với media storage, nếu chưa implement GCS provider thì tiếp tục điền Azure Blob credentials vào:

```yaml
secrets:
  storageAccountName: <azure-storage-account>
  storageAccountKey: <azure-storage-key>
  storageContainerName: media
```

## 9. Deploy Từ Image GHCR Đã Có

Nếu GHCR đã có image của các services rồi, GCP/GKE chỉ cần pull về để chạy. Không cần build source code trên GCP.

Chart hiện đang dùng image theo pattern:

```text
ghcr.io/${{ github.repository_owner }}/luyen-thi-lai-xe-<service>:<tag>
```

Trong GitHub Actions, `${{ github.repository_owner }}` được tự động thay bằng owner của repository. Nếu deploy thủ công ngoài GitHub Actions, thay bằng owner thật:

```text
ghcr.io/<github-owner>/luyen-thi-lai-xe-<service>:<tag>
```

Ví dụ:

```text
ghcr.io/${{ github.repository_owner }}/luyen-thi-lai-xe-user-service:latest
ghcr.io/${{ github.repository_owner }}/luyen-thi-lai-xe-user-service:<git-sha>
ghcr.io/${{ github.repository_owner }}/luyen-thi-lai-xe-migration-runner:<git-sha>
```

Các giá trị Helm cần quan tâm:

```yaml
global:
  imageRegistry: ghcr.io/<github-owner>
  imageTag: <existing-ghcr-tag>

migration:
  imageTag: <existing-ghcr-tag>

imagePullSecret:
  enabled: true
  username: <github-username>
  token: <github-token-co-quyen-read-packages>
```

Khuyến nghị:

- Dùng Git SHA tag cho staging/production để biết chính xác đang chạy version nào.
- Chỉ dùng `latest` cho demo nhanh, vì `latest` có thể thay đổi sau mỗi lần push vào `main`.
- Nếu package GHCR là private, bắt buộc cấu hình `GHCR_PULL_USERNAME` và `GHCR_PULL_TOKEN`.
- Nếu dùng cùng một `global.imageTag`, tag đó phải tồn tại cho đủ 10 production service images và `migration-runner`.

Có thể kiểm tra image tồn tại bằng Docker:

```bash
docker pull ghcr.io/<github-owner>/luyen-thi-lai-xe-user-service:<existing-ghcr-tag>
docker pull ghcr.io/<github-owner>/luyen-thi-lai-xe-migration-runner:<existing-ghcr-tag>
```

Nếu chỉ muốn deploy thủ công từ image đã có:

```bash
helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml \
  --set global.imageRegistry=ghcr.io/<github-owner> \
  --set global.imageTag=<existing-ghcr-tag> \
  --set migration.imageTag=<existing-ghcr-tag>
```

## 10. Deploy Thủ Công Lần Đầu

Cần có `helm`, `kubectl`, `gcloud` trên máy operator.

```bash
helm lint charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-staging.example.yaml

helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml \
  --set global.imageRegistry=ghcr.io/<github-owner> \
  --set global.imageTag=<git-sha-da-pass-ci> \
  --set migration.imageTag=<git-sha-da-pass-ci>
```

Kiểm tra:

```bash
kubectl get pods -n staging
kubectl get ingress -n staging
kubectl get pvc -n staging
kubectl rollout status deployment -l app.kubernetes.io/component=app -n staging --timeout=10m
```

Nếu bật tracing mặc định trong chart, kiểm tra thêm Jaeger:

```bash
kubectl get pods -n staging | grep jaeger
kubectl port-forward svc/luyen-thi-lai-xe-jaeger 16686:16686 -n staging
```

Sau đó mở `http://localhost:16686`, chọn service `kong` để xem trace request đi qua Kong và các service.

Smoke test:

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

## 11. Deploy Bằng GitHub Actions

Luồng hiện có:

1. Merge vào `main`.
2. `Main Image Release` build đủ 10 production images, scan Trivy và push image GHCR với tag `${github.sha}`.
3. GCP/GKE pull image từ GHCR và workflow auto deploy staging bằng Helm với đúng tag `${github.sha}` vừa build.
4. Production release dùng `.github/workflows/production-release.yml`, chạy manual với `image_tag` là Git SHA đã pass.

Cần cấu hình GitHub Environment:

- `staging`: cho phép auto deploy nếu team đồng ý.
- `production`: bật required reviewers/manual approval.

## 12. Checklist Trước Khi Mở Public

- DNS A records đã trỏ đúng static IP.
- ManagedCertificate trạng thái `Active`.
- Kong Ingress trả về được `/identity-service/health/live`.
- Keycloak public URL đúng `https://auth...`.
- `KONG_CORS_ORIGINS` gồm frontend, API và auth origins.
- Tắt hoặc giới hạn Kong admin public exposure.
- Secret không nằm trong repo.
- GitHub Environment `production` có required reviewers.
- Backup Postgres/Keycloak đã có lịch và restore test.
- Alerting có kênh nhận cảnh báo thật.

## 13. Lỗi Hay Gặp

| Triệu chứng | Nguyên nhân hay gặp | Cách xử lý |
| --- | --- | --- |
| Pod pending | Node thiếu CPU/RAM hoặc PVC chưa bind | `kubectl describe pod`, tăng node/max-nodes, kiểm tra StorageClass. |
| Ingress không có IP | GKE Ingress đang reconcile hoặc annotation sai | `kubectl describe ingress -n staging`, kiểm tra static IP global. |
| HTTPS chưa active | DNS chưa trỏ đúng IP hoặc cert đang provisioning | Chờ propagate DNS, `kubectl describe managedcertificate`. |
| ImagePullBackOff | GHCR pull secret sai | Kiểm tra `GHCR_PULL_USERNAME`, `GHCR_PULL_TOKEN`, package visibility. |
| Migration job fail | DB chưa sẵn sàng hoặc Prisma env sai | `kubectl logs job/<migration-job> -n staging`. |
| Keycloak redirect sai | `KEYCLOAK_PUBLIC_URL`, `KC_HOSTNAME`, scheme/host sai | Kiểm tra `STAGING_AUTH_HOST`, `STAGING_API_SCHEME`. |

## 14. Ghi Chú Chi Phí

Không hardcode giá trong tài liệu vì bảng giá GCP thay đổi theo thời gian. Trước khi tạo production cluster, hãy ước tính bằng Google Cloud Pricing Calculator với:

- Số node và machine type.
- Persistent Disk dùng cho PVC.
- Load balancer/Ingress.
- Cloud Storage.
- Cloud SQL/Memorystore nếu tách managed services.
- Network egress.

## 15. Tài Liệu Tham Khảo

- GKE cluster configuration choices: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/configuration-overview
- GKE Autopilot overview: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview
- GKE Standard regional clusters: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/creating-a-regional-cluster
- GKE persistent volumes and StorageClasses: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/persistent-volumes
- Workload Identity Federation for GKE: https://docs.cloud.google.com/kubernetes-engine/docs/concepts/workload-identity
- Secret Manager add-on for GKE: https://docs.cloud.google.com/secret-manager/docs/secret-manager-managed-csi-component
- Google-managed SSL certificates for GKE Ingress: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/managed-certs
