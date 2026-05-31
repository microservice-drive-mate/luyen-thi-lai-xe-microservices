# Phase 3/4/5/9 - Hướng Dẫn Setup Và Vận Hành

Tài liệu này tổng hợp phần việc của Người 1: bảo mật, CI/CD, Kubernetes deployment, GCP IaC, HPA và load test. File này tách riêng với `README.md` để team có thể dùng như runbook vận hành, sau này mới trích lọc đưa vào README.

## 1. Tổng Quan Hiện Trạng

Phase 3 đã chuyển các mật khẩu/config nhạy cảm sang biến môi trường, Helm values, Kubernetes Secret và GitHub Secrets. CI có bước Trivy để scan image trước khi publish. Image migration-runner đã được test build và scan lại, không còn HIGH/CRITICAL với cấu hình hiện tại.

Phase 4 đã có luồng CI/CD tách riêng:

* **Pull Request:** validate/test/build/scan, không deploy.
* **Main branch:** build và push image lên GHCR, sau đó deploy staging nếu bật biến deploy.
* **Production Release:** chạy thủ công bằng `workflow_dispatch`, đi qua GitHub Environment approval trước khi deploy production.

Phase 5 đã có Helm chart `charts/luyen-thi-lai-xe`:

* Deploy 10 production app services, không deploy `docs-service`.
* Chạy dependency trong cluster: Postgres, RabbitMQ, Redis, Consul, Keycloak, Kong.
* Expose public qua K3s Traefik Ingress và Kong gateway.
* Có ConfigMap/Secret, resource requests/limits, liveness/readiness probes.
* Có Job seed Consul, Job init database và Job Prisma migration trước app rollout.
* Có HTTPS bằng cert-manager khi dùng GCP/K3s và `nip.io`.

Phase 9 đã có Terraform GCP:

* Provision VM `e2-standard-8` trên GCP Compute Engine.
* Cài K3s, metrics-server và các thành phần cần thiết bằng startup script.
* Tạo static IP, firewall public `80/443`, admin `22/6443` giới hạn theo `allowed_admin_cidrs`.
* Có HPA cho các service chính và k6 scripts để smoke/load/stress/spike test.

Kết quả test gần nhất:

* Terraform plan chạy được, không yêu cầu thay đổi infra ngoài output URL HTTPS.
* Helm lint/render đã đúng với 10 app deployments và không render `docs-service`.
* GCP K3s đã deploy thành công, jobs và deployments ready.
* API host: `[https://api.35.187.227.152.nip.io](https://api.35.187.227.152.nip.io)`.
* Auth host: `[https://auth.35.187.227.152.nip.io](https://auth.35.187.227.152.nip.io)`.
* Keycloak chạy được qua HTTPS.
* Smoke test qua Kong pass.
* k6 load nội bộ pass, HPA đã scale up `exam-service` và `course-service`, sau đó scale down lại.

## 2. Phase 3 - DevSecOps

Mục tiêu của Phase 3 là không để mật khẩu hardcode trong source/Compose và có security gate trước khi release image.

Vận hành hàng ngày:

1. Dùng `.env.example` làm template cho local/dev.
2. Dùng `deploy/staging.env.example` và `deploy/production.env.example` làm template nếu vận hành bằng Docker Compose/deploy script.
3. Không commit `.env`, `*.local.yaml`, `terraform.tfvars`, kubeconfig, token, private key.
4. Secrets production/staging nên nằm trong GitHub Secrets hoặc file local ignored.
5. Trước khi release image, CI phải build và Trivy scan.

Lệnh test local:

```powershell
node -e "const fs=require('fs'); const yaml=require('js-yaml'); for (const f of fs.readdirSync('.github/workflows').filter(f=>f.endsWith('.yml'))) { yaml.load(fs.readFileSync('.github/workflows/'+f,'utf8')); console.log('OK '+f); }"

docker build -f Dockerfile.migration-runner -t local/luyen-thi-lai-xe-migration-runner:test .

trivy image --scanners vuln --pkg-types os,library `
  --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 `
  local/luyen-thi-lai-xe-migration-runner:test

```

> **Ghi chú:** `.env` local vừa được bổ sung `NOTIFICATION_WARNING_RETRY_INTERVAL_MS=300000` để đồng bộ với Consul staging/production.

## 3. Phase 4 - CI/CD Và Release

Repo đang có các workflow chính:

* `.github/workflows/pr-validation.yml`: validate PR, test/build/scan, không deploy.
* `.github/workflows/ci.yml`: main release, build/push image lên GHCR, deploy staging nếu biến deploy được bật.
* `.github/workflows/production-release.yml`: production deploy thủ công, cần GitHub Environment approval.
* `.github/workflows/devops-smoke.yml`: smoke/devops checks khi cần.

Cần cấu hình GitHub Secrets/Variables:

* `GHCR_PULL_USERNAME`
* `GHCR_PULL_TOKEN`
* `STAGING_KUBE_CONFIG_B64`
* `PRODUCTION_KUBE_CONFIG_B64`
* `STAGING_POSTGRES_PASSWORD`
* `STAGING_RABBITMQ_PASSWORD`
* `STAGING_RABBITMQ_ERLANG_COOKIE`
* `STAGING_KEYCLOAK_ADMIN_PASSWORD`
* `STAGING_KEYCLOAK_CLIENT_SECRET`
* `STAGING_STORAGE_ACCOUNT_NAME`
* `STAGING_STORAGE_ACCOUNT_KEY`
* Các biến production tương ứng với prefix `PRODUCTION_...`

GitHub Variables nên có:

* `STAGING_DEPLOY_ENABLED=true`
* `STAGING_API_HOST=api.<static-ip>.nip.io`
* `STAGING_AUTH_HOST=auth.<static-ip>.nip.io`
* `STAGING_FRONTEND_ORIGIN=https://api.<static-ip>.nip.io`
* `STAGING_API_SCHEME=https`
* `STAGING_SEED_ENABLED=true`
* Production host/origin/schema tương ứng.

Quy trình release:

1. Tạo PR vào `main`.
2. PR pass validation và Trivy.
3. Merge vào `main`.
4. Workflow main build/push image với tag immutable là Git SHA.
5. Staging deploy bằng Helm với image tag đó.
6. Production release chạy thủ công, nhập image tag đã pass staging, approve environment rồi mới deploy.

Rollback production/staging:

```powershell
helm history luyen-thi-lai-xe -n staging
helm rollback luyen-thi-lai-xe <revision-cu> -n staging
kubectl rollout status deployment -l app.kubernetes.io/component=app -n staging --timeout=10m

```

## 4. Phase 5 - Kubernetes Deployment

Helm chart nằm tại:

```text
charts/luyen-thi-lai-xe

```

File values quan trọng:

* `charts/luyen-thi-lai-xe/values.yaml`: default chart values.
* `charts/luyen-thi-lai-xe/values-staging.example.yaml`: template staging.
* `charts/luyen-thi-lai-xe/values-production.example.yaml`: template production.
* `charts/luyen-thi-lai-xe/values-gcp.example.yaml`: template GCP/K3s có HTTPS.
* `charts/luyen-thi-lai-xe/values-gcp.local.yaml`: file local thật, không commit.

Deploy thủ công lên cluster thông qua IAP Tunnel (Linh hoạt & Bảo mật):

Do máy local của bạn có IP công cộng thay đổi liên tục và bị tường lửa GCP chặn, chúng ta sẽ quản trị cụm K8s một cách an toàn thông qua đường truyền **GCP Identity-Aware Proxy (IAP) Tunnel** mà không cần mở cổng tường lửa công cộng.

1. **Khởi động IAP Tunnel trong nền (Background):**
   Mở một cửa sổ PowerShell mới và chạy lệnh sau để chuyển tiếp cổng API K8s (`6443`) về cổng local `16443`:
   ```powershell
   gcloud compute start-iap-tunnel luyen-thi-lai-xe-staging-k3s 6443 --local-host-port=127.0.0.1:16443 --zone=asia-southeast1-b --project=devops-497910
   ```
   *Giữ cửa sổ này mở trong suốt quá trình chạy lệnh kubectl/helm.*

2. **Cấu hình cert-manager (Bắt buộc chạy 1 lần đối với cụm mới sạch):**
   ```powershell
   # Thêm và update repo
   helm repo add jetstack https://charts.jetstack.io
   helm repo update

   # Cài đặt cert-manager
   helm upgrade --install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --version v1.14.4 --set installCRDs=true --kubeconfig kubeconfig-gcp.yaml --kube-insecure-skip-tls-verify
   ```

3. **Tạo ClusterIssuer phát hành chứng chỉ Let's Encrypt SSL/TLS:**
   Tạo file `letsencrypt-issuer.yaml` với nội dung ClusterIssuer trỏ tới `ingressClassName: traefik` và apply:
   ```powershell
   kubectl --kubeconfig kubeconfig-gcp.yaml --insecure-skip-tls-verify=true apply -f letsencrypt-issuer.yaml
   ```

4. **Triển khai ứng dụng (Redeploy động) bằng Helm:**
   Để tránh việc hardcode địa chỉ IP khi IP của VM có thay đổi, chúng ta sẽ tự động lấy IP từ GCP API và ghi đè (override) động vào tham số của Helm tại thời điểm chạy:
   ```powershell
   # 1. Trỏ biến Kubeconfig về IAP Tunnel local
   $env:KUBECONFIG = (Resolve-Path .\kubeconfig-gcp.yaml)

   # 2. Lấy IP VM động và thực thi cài đặt Helm
   $VM_IP = (gcloud compute addresses list --filter="name=luyen-thi-lai-xe-staging-ip" --format="value(address)").Trim()
   helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe `
     --namespace staging --create-namespace --wait --wait-for-jobs --timeout 25m `
     -f charts/luyen-thi-lai-xe/values-gcp.local.yaml --kube-insecure-skip-tls-verify `
     --set ingress.apiHost="api.$VM_IP.nip.io" `
     --set ingress.authHost="auth.$VM_IP.nip.io" `
     --set config.frontendOrigin="https://api.$VM_IP.nip.io" `
     --set config.gatewayPublicUrl="https://api.$VM_IP.nip.io" `
     --set config.keycloakPublicUrl="https://auth.$VM_IP.nip.io" `
     --set config.corsOrigins[0]="https://api.$VM_IP.nip.io" `
     --set config.corsOrigins[1]="https://auth.$VM_IP.nip.io"
   ```

Kiểm tra sau deploy:

```powershell
kubectl get pods -n staging
kubectl get jobs -n staging
kubectl rollout status deployment -l app.kubernetes.io/component=app -n staging --timeout=10m
kubectl get ingress -n staging
kubectl get certificate -n staging
kubectl get hpa -n staging
kubectl top pods -n staging
```

Smoke test:

```powershell
$env:SMOKE_BASE_URL="https://api.<static-ip>.nip.io"
& "C:\Program Files\Git\bin\bash.exe" scripts/k8s-smoke.sh

```

Điều kiện pass Phase 5:

* Postgres, RabbitMQ, Redis, Consul, Keycloak, Kong ready.
* Consul seed Job complete.
* Migration Job complete.
* 10 app deployments rollout xong.
* Ingress và certificate ready.
* Health `/health/live` và `/health/ready` của các service pass qua API host.

## 5. Phase 9 - GCP IaC, HPA, k6

Tài liệu chi tiết đang nằm ở:

```text
docs/phase-9-gcp-iac-load-test.md

```

Tóm tắt vận hành:

1. Cài và login Google Cloud SDK.
2. Tạo/cấu hình `terraform/terraform.tfvars` từ `terraform/terraform.tfvars.example`.
3. Chạy Terraform tạo VM/K3s/static IP/firewall.
4. Lấy kubeconfig về local.
5. Deploy app bằng Helm.
6. Chạy smoke/k6.
7. Quan sát HPA scale.
8. Destroy infra khi demo/test xong để tránh tốn credit.

Lệnh Terraform (Khuyến nghị di chuyển vào thư mục terraform trước):

```powershell
# 1. Di chuyển vào thư mục terraform
cd terraform

# 2. Khởi tạo dự án
terraform init

# 3. Tự động định dạng code
terraform fmt -recursive

# 4. Kiểm tra cú pháp hợp lệ
terraform validate

# 5. Xem trước kế hoạch triển khai (Dry-run)
terraform plan

# 6. Thực thi triển khai thực tế trên GCP (nhập yes để xác nhận)
terraform apply
```

Lấy thông tin output (Chạy trong thư mục terraform):

```powershell
terraform output public_ip
terraform output api_host
terraform output auth_host
# LƯU Ý: Lệnh này mặc định gọi SSH trực tiếp, có thể bị firewall chặn nếu IP local đổi:
terraform output kubeconfig_fetch_command_powershell
```

**Cách đồng bộ Kubeconfig linh hoạt tuyệt đối qua IAP Tunnel (Khuyên dùng khi IP thay đổi):**
Nếu lệnh fetch trực tiếp của Terraform bị timeout do tường lửa chặn IP local của bạn, hãy chạy lệnh PowerShell này từ thư mục gốc của project (sử dụng IAP tunnel chạy ngầm để lấy file, tự động nhận diện IP của VM):
```powershell
$VM_IP = (gcloud compute addresses list --filter="name=luyen-thi-lai-xe-staging-ip" --format="value(address)").Trim()
gcloud compute ssh luyen-thi-lai-xe-staging-k3s --zone=asia-southeast1-b --project=devops-497910 --command="sudo sed 's/127.0.0.1/$VM_IP/g' /etc/rancher/k3s/k3s.yaml" --tunnel-through-iap --ssh-flag="-batch" | Out-File -Encoding ascii kubeconfig-gcp.yaml
```

Load test bằng Docker k6:
*(⚠️ Do môi trường staging dùng domain nip.io với SSL/TLS của Traefik không thuộc CA tin cậy toàn cầu, cần thêm flag `--insecure-skip-tls-verify` để bỏ qua lỗi xác thực chứng chỉ).*

```powershell
# Chạy Smoke Test (tải nhẹ 30s)
docker run --rm `
  -v "${PWD}/load-tests:/scripts:ro" `
  -e BASE_URL="https://api.<static-ip>.nip.io" `
  grafana/k6 run --insecure-skip-tls-verify /scripts/scenarios/smoke.js

# Chạy Load Test (giả lập 50 users trong 12 phút)
docker run --rm `
  -v "${PWD}/load-tests:/scripts:ro" `
  -e BASE_URL="https://api.<static-ip>.nip.io" `
  grafana/k6 run --insecure-skip-tls-verify /scripts/scenarios/load.js
```

Quan sát autoscale:

```powershell
kubectl get hpa -n staging -w
kubectl get pods -n staging -w
kubectl top pods -n staging
```

Destroy khi không dùng (Chạy trong thư mục terraform):

```powershell
terraform destroy
```

---

## 6. File Cần Commit, File Cần Share Nội Bộ, File Không Nên Share Rộng

Nên commit/share qua Git:

* `.env.example`
* `.env.vps.example`
* `deploy/staging.env.example`
* `deploy/production.env.example`
* `charts/luyen-thi-lai-xe/values-gcp.example.yaml`
* `charts/luyen-thi-lai-xe/values-staging.example.yaml`
* `charts/luyen-thi-lai-xe/values-production.example.yaml`
* `terraform/terraform.tfvars.example`
* `consul-seed-staging.json` nếu file này chỉ chứa placeholder/template.
* `guides/`, `docs/`, `load-tests/`, `terraform/`, `charts/`, `.github/workflows/`.

Nên share qua Drive nội bộ, folder hạn chế quyền:

* `.env` thật để team chạy local Compose.
* `charts/luyen-thi-lai-xe/values-gcp.local.yaml` để team vận hành đúng cluster GCP hiện tại.
* `charts/luyen-thi-lai-xe/values-staging.local.yaml` nếu dùng Docker Desktop/K3s local.
* `terraform/terraform.tfvars` nếu team cùng quản lý GCP infra.
* `kubeconfig-gcp.yaml` chỉ share cho thành viên cần deploy/debug cluster.
* `consul-seed-production.json`, `consul-seed-development.json`, `consul-seed-development-local.json` nếu các file này đã được điền secret thật.

Không nên upload rộng lên Drive, chỉ cấp khi thật sự cần:

* SSH private key: `*.pem`, `id_rsa`, `phase9_gcp`, các private key khác.
* `terraform/*.tfstate`, `terraform/*.tfstate.*`.
* Thư mục `terraform/.terraform/`.
* File kubeconfig có quyền cluster-admin nếu người nhận không cần deploy.
* GHCR token, GCP service account key, Google ADC file.
* Rendered manifests có Secret: `rendered-*.yaml`.

---

## 7. Env Và Consul Có Cần Cập Nhật Không?

Có một thay đổi nhỏ cần đồng bộ: `.env` local cần có:

```env
NOTIFICATION_WARNING_RETRY_INTERVAL_MS=300000

```

**Lý do:** `consul-seed-staging.json` và `consul-seed-production.json` đang đọc biến này cho `notification-service.notification.warningRetryIntervalMs`. Nếu không set, seed file có fallback `300000`, nhưng thêm vào `.env` giúp team nhìn thấy đây là biến runtime thật.

Về Consul:

* `consul-seed-staging.json` và `consul-seed-production.json` vẫn cần giữ để seed config cho môi trường tương ứng.
* Các file seed có thể còn config `docs-service`; riêng Kubernetes staging/production không deploy `docs-service`, nên config này không ảnh hưởng Phase 5/9.
* Khi đổi host public, Keycloak URL, RabbitMQ URL, Redis URL, storage, DB hoặc client secret, cần đồng bộ lại env/Helm values/Consul seed.
* Với Kubernetes Phase 5/9, Helm chart là nguồn deploy chính; Consul seed Job sẽ lấy config runtime từ chart values/secret và seed vào Consul trong cluster.

Khuyến nghị upload Drive:

> **Có**, nên upload một gói `runtime-config` cho team, nhưng chia folder rõ ràng:
> * `templates`: các file example, không secret.
> * `local-compose`: `.env` thật cho local/dev.
> * `gcp-staging`: `values-gcp.local.yaml`, `terraform.tfvars`, kubeconfig nếu cần.
> * `secrets-restricted`: token/password, chỉ người vận hành có quyền.
> 
> 
> Không nên để tất cả thành viên có quyền vào kubeconfig/GHCR token/GCP key nếu họ không cần deploy.

---

## 8. Checklist Bàn Giao Cho Thành Viên Khác

### Người nhận muốn chạy local:

1. Lấy `.env` từ Drive nội bộ.
2. Cài Docker Desktop.
3. Chạy Compose theo guide hiện có.
4. Seed Consul nếu dùng Consul local.

### Người nhận muốn deploy staging:

1. Có quyền GitHub Actions/GHCR.
2. Có `values-gcp.local.yaml` hoặc GitHub Secrets đã được set.
3. Có kubeconfig cluster hoặc quyền fetch kubeconfig từ GCP VM.
4. Chạy Helm deploy hoặc trigger CI/CD.
5. Chạy smoke test.

### Người nhận muốn quản lý infra:

1. Có GCP project access.
2. Có Google Cloud SDK và Terraform.
3. Có `terraform/terraform.tfvars`.
4. Chạy `terraform plan` trước mỗi thay đổi.
5. Sau demo/test, chạy `terraform destroy` nếu không cần giữ VM.