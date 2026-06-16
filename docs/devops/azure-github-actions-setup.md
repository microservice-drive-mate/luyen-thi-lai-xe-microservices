# Azure GitHub Actions Setup Checklist

Guide nay dung sau khi Terraform va Helm manual deploy Azure AKS da chay duoc. Muc tieu la cau hinh GitHub Actions de build image len GHCR va deploy lai AKS staging bang Git SHA.

## 1. Lay Gia Tri Azure/Local

Verify subscription:

```powershell
az account show --output table
```

Set bien co ban:

```powershell
$SUBSCRIPTION_ID = az account show --query id -o tsv
$TENANT_ID = az account show --query tenantId -o tsv
$RESOURCE_GROUP = "rg-lttl-staging-sea"
$AKS_CLUSTER = "aks-lttl-staging"
$API_HOST = "api.52.139.233.166.nip.io"
$AUTH_HOST = "auth.52.139.233.166.nip.io"
```

Lay Storage Account values:

```powershell
$STORAGE_ACCOUNT_NAME = terraform -chdir=terraform/azure-aks output -raw storage_account_name
$STORAGE_ACCOUNT_KEY = terraform -chdir=terraform/azure-aks output -raw storage_account_primary_access_key
```

Khong commit cac file local/secret:

```text
terraform/azure-aks/terraform.tfvars
terraform/azure-aks/terraform.tfstate
terraform/azure-aks/.terraform/
```

## 2. Tao Azure OIDC Identity Cho GitHub

Khuyen nghi dung helper script:

```powershell
.\scripts\setup-azure-github-staging.ps1 `
  -Repo "OWNER/luyen-thi-lai-xe-microservices" `
  -CreateAzureIdentity
```

Script se:

- Lay subscription/tenant hien tai tu `az account show`.
- Lay storage account/key tu Terraform output.
- Tao hoac tai su dung Azure App Registration `github-lttl-azure-staging`.
- Gan role `Contributor` vao resource group staging.
- Gan role `Azure Kubernetes Service Cluster Admin Role` vao AKS.
- Tao federated credential voi subject `repo:<owner>/<repo>:environment:staging`.
- In ra GitHub Variables va Secrets can tao.

Neu muon lam thu cong:

```powershell
$REPO = "OWNER/REPO"
$APP_ID = az ad app create --display-name "github-lttl-azure-staging" --query appId -o tsv
az ad sp create --id $APP_ID

$RG_SCOPE = "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
$AKS_ID = az aks show -g $RESOURCE_GROUP -n $AKS_CLUSTER --query id -o tsv

az role assignment create --assignee $APP_ID --role "Contributor" --scope $RG_SCOPE
az role assignment create --assignee $APP_ID --role "Azure Kubernetes Service Cluster Admin Role" --scope $AKS_ID
```

Tao federated credential:

```powershell
$fic = @{
  name = "github-staging"
  issuer = "https://token.actions.githubusercontent.com"
  subject = "repo:${REPO}:environment:staging"
  audiences = @("api://AzureADTokenExchange")
}

$fic | ConvertTo-Json | Set-Content fic.json
az ad app federated-credential create --id $APP_ID --parameters fic.json
```

## 3. Setup GitHub Secrets Va Variables

Vao:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions
```

Secrets:

```text
AZURE_CLIENT_ID=<app-id>
AZURE_TENANT_ID=<tenant-id>
AZURE_SUBSCRIPTION_ID=<subscription-id>

GHCR_PULL_USERNAME=<github-username>
GHCR_PULL_TOKEN=<github-pat-read-packages>

STAGING_POSTGRES_PASSWORD=change-me
STAGING_RABBITMQ_PASSWORD=change-me
STAGING_RABBITMQ_ERLANG_COOKIE=change-me-rabbitmq-cookie
STAGING_KEYCLOAK_ADMIN_PASSWORD=change-me
STAGING_KEYCLOAK_CLIENT_SECRET=change-me

STAGING_STORAGE_ACCOUNT_NAME=lttlmediastg260614
STAGING_STORAGE_ACCOUNT_KEY=<terraform storage key output>
```

Variables:

```text
AZURE_AKS_RESOURCE_GROUP=rg-lttl-staging-sea
AZURE_AKS_CLUSTER_NAME=aks-lttl-staging
GHCR_OWNER=bolac71
STAGING_AUTO_DEPLOY_ENABLED=true
STAGING_API_HOST=api.52.139.233.166.nip.io
STAGING_AUTH_HOST=auth.52.139.233.166.nip.io
STAGING_FRONTEND_ORIGIN=http://localhost:5173
STAGING_API_SCHEME=http
STAGING_SEED_ENABLED=true
```

PAT `GHCR_PULL_TOKEN` can scope:

```text
read:packages
```

`GHCR_OWNER` phai trung voi namespace dang chua Docker packages tren GHCR. Neu images nam o personal account thi dung `bolac71`; neu team da chuyen packages sang organization thi dung organization owner, vi workflow build/deploy se doc va ghi image theo dang:

```text
ghcr.io/<GHCR_OWNER>/luyen-thi-lai-xe-<service>:<git-sha>
```

Neu da cai GitHub CLI va muon script set tu dong:

```powershell
.\scripts\setup-azure-github-staging.ps1 `
  -Repo "OWNER/luyen-thi-lai-xe-microservices" `
  -CreateAzureIdentity `
  -ApplyGitHub `
  -GhcrPullUsername "<github-username>" `
  -GhcrPullToken "<github-pat-read-packages>"
```

## 4. Push Code, Build GHCR, Deploy AKS

Flow:

```text
push main
-> .github/workflows/ci.yml
-> build/test
-> docker build service images
-> push GHCR :latest and :<git-sha> under GHCR_OWNER
-> Deploy Azure AKS Staging auto-runs with image_tag=<git-sha>
```

Neu push chi doi docs hoac GitHub khong tu chay `Main Image Release`, co the vao:

```text
GitHub -> Actions -> Main Image Release -> Run workflow -> branch main
```

Workflow nay build/push day du 10 service images va `luyen-thi-lai-xe-migration-runner` voi tag la SHA cua branch `main` tai luc chay. Image namespace lay tu variable `GHCR_OWNER`, fallback ve repository owner neu khong set. Neu `STAGING_AUTO_DEPLOY_ENABLED=true`, workflow `Deploy Azure AKS Staging` se tu chay sau khi build thanh cong tren `main`.

Lay SHA:

```powershell
git rev-parse HEAD
```

Manual deploy chi dung khi can replay/debug mot image tag cu:

```text
GitHub -> Actions -> Deploy Azure AKS Staging -> Run workflow
image_tag=<git-sha>
install_nginx_ingress=false
confirm_staging=true
```

`image_tag` nen la full 40-character Git SHA tu `git rev-parse HEAD`. Neu nhap short SHA, workflow se co gang resolve sang full SHA truoc khi deploy. Workflow cung kiem tra truoc tren GHCR de dam bao tag do ton tai cho 10 service images va `luyen-thi-lai-xe-migration-runner`; neu CI chua build/push du images, workflow se fail som thay vi doi Helm timeout.

Dung `install_nginx_ingress=true` chi khi cluster chua co ingress-nginx hoac ban muon upgrade ingress controller. Neu ingress da co external IP va API dang vao duoc, de `false` de workflow deploy app nhanh va tranh wait lai Azure Load Balancer.

Neu buoc install ingress-nginx fail voi loi:

```text
UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress
```

thi Helm release `ingress-nginx` dang bi ket o trang thai pending tu lan chay truoc. Workflow Azure staging se tu kiem tra `ingress-nginx` trong namespace `ingress-nginx` va chi xoa Helm secret cua revision dang pending truoc khi install/upgrade lai. Workflow khong xoa revision da deploy thanh cong.

Neu release `ingress-nginx` da co status `deployed`, workflow se khong chay Helm upgrade nua. No chi dam bao Service co Azure health probe `/healthz` va `externalTrafficPolicy=Local`, roi tiep tuc deploy app de tranh treo o buoc wait cua ingress controller.

Azure workflow se:

```text
Azure OIDC login
resolve short image_tag to full Git SHA if needed
verify required GHCR images exist
az aks get-credentials
self-heal pending ingress-nginx Helm revision if needed
install ingress-nginx 4.15.1, or patch settings if already deployed
render Helm values
helm upgrade --install
run migration job
wait rollout
run smoke test
record deployment event
```

## 5. Verify Sau Deploy

Cluster:

```powershell
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
```

API docs:

```powershell
$API = "http://api.52.139.233.166.nip.io"
Invoke-WebRequest "$API/identity-service/docs"
```

Login:

```powershell
$body = @{
  email = "admin@test.com"
  password = "Admin@123"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "$API/auth/login" `
  -ContentType "application/json" `
  -Body $body

$token = $login.data.accessToken
```

Protected endpoint:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "$API/users/me" `
  -Headers @{ Authorization = "Bearer $token" }
```

Media direct upload:

```text
POST /media/files/init
PUT uploadUrl directly to Azure Blob without Authorization
POST /media/files/:id/complete
GET /media/files/:id/url
```

## 6. Production Policy

Production deploy is manual only:

```text
GitHub -> Actions -> Production Release -> Run workflow
image_tag=<git-sha-that-passed-staging>
confirm_production=true
```

Configure GitHub Environment `production` with required reviewers. Do not add a production auto trigger. Production should use environment-scoped variables/secrets:

```text
AZURE_AKS_RESOURCE_GROUP
AZURE_AKS_CLUSTER_NAME
PRODUCTION_API_HOST
PRODUCTION_AUTH_HOST
PRODUCTION_FRONTEND_ORIGIN
PRODUCTION_API_SCHEME
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
PRODUCTION_POSTGRES_PASSWORD
PRODUCTION_RABBITMQ_PASSWORD
PRODUCTION_RABBITMQ_ERLANG_COOKIE
PRODUCTION_KEYCLOAK_ADMIN_PASSWORD
PRODUCTION_KEYCLOAK_CLIENT_SECRET
PRODUCTION_STORAGE_ACCOUNT_NAME
PRODUCTION_STORAGE_ACCOUNT_KEY
```

## 7. Demo Script: DevOps, Kubernetes, Scaling, Secrets

IaC/Terraform:

```text
Show terraform/azure-aks.
Show Azure Portal resource group rg-lttl-staging-sea.
Explain Terraform creates AKS, node pools, Storage Account, Blob container, Log Analytics.
```

Kubernetes/AKS:

```powershell
kubectl get nodes
kubectl get pods -n staging -o wide
kubectl get svc,ingress -n staging
```

Helm:

```powershell
helm list -n staging
helm history luyen-thi-lai-xe -n staging
```

Secrets/ConfigMap:

```powershell
kubectl get secret -n staging
kubectl describe secret luyen-thi-lai-xe-secrets -n staging
kubectl get configmap luyen-thi-lai-xe-config -n staging -o yaml
```

Scaling:

```powershell
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=2
kubectl get pods -n staging -o wide
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=1
```

Rolling update/rollback:

```powershell
kubectl rollout restart deploy/luyen-thi-lai-xe-user-service -n staging
kubectl rollout status deploy/luyen-thi-lai-xe-user-service -n staging

helm history luyen-thi-lai-xe -n staging
helm rollback luyen-thi-lai-xe <revision> -n staging
```

UI evidence:

```text
Azure Portal -> AKS -> Workloads
Azure Portal -> AKS -> Services and ingresses
Azure Portal -> Storage Account -> Containers -> media
GitHub -> Actions -> CI + Deploy Azure AKS Staging
GitHub -> Packages -> GHCR service images
```
