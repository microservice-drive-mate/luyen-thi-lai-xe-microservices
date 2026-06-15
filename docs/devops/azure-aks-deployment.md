# Azure AKS Deployment

This guide is the recommended cloud path for the student demo: Azure AKS Free tier, Azure Blob Storage, Helm, Terraform, and GitHub Actions. It keeps media on Azure Blob, which is already the storage provider used by `media-service`.

After the manual AKS deployment works, configure GitHub Actions with `docs/devops/azure-github-actions-setup.md`.

## 1. What This Deploys

- AKS Free tier cluster for the runtime.
- Azure Storage Account and private Blob container `media`.
- Helm release `luyen-thi-lai-xe` into namespace `staging`.
- 10 production services, Kong, Keycloak, PostgreSQL, RabbitMQ, Redis, Consul, migration job, and Consul seed job.
- Optional Log Analytics workspace through Terraform.

This is a demo/staging topology. PostgreSQL and infrastructure dependencies stay inside Kubernetes to keep the setup affordable and portable. A real production follow-up should move databases/cache/secrets to managed services.

## 2. Check Azure Credit

Before creating AKS, check credit and expiration:

1. Open Azure Portal.
2. Go to `Cost Management + Billing`.
3. Select the correct billing scope.
4. Open `Payment methods`.
5. Open `Azure credits`.
6. Confirm `Available balance`, `Expiration date`, and subscription status.

For Azure for Students or sponsorship accounts, also check:

```text
https://www.microsoftazuresponsorships.com/
```

## 3. Local Tools

Install:

- Azure CLI
- Terraform
- kubectl
- Helm
- GitHub CLI optional

Login and choose a subscription:

```powershell
az login
az account list --output table
az account set --subscription "<subscription-id>"
```

Register providers:

```powershell
az provider register --namespace Microsoft.ContainerService
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Network
az provider register --namespace Microsoft.OperationalInsights
```

## 4. Terraform

Copy the example variables:

```powershell
Copy-Item terraform\azure-aks\terraform.tfvars.example terraform\azure-aks\terraform.tfvars
```

Edit:

- `subscription_id`
- `storage_account_name` using a globally unique lowercase name
- `blob_cors_allowed_origins`
- node size/count if needed

Recommended demo defaults:

```hcl
location             = "southeastasia"
node_count           = 1
node_vm_size         = "Standard_D4s_v4"
app_node_pool_enabled = true
app_node_count        = 1
app_node_vm_size      = "Standard_B2s_v2"
enable_auto_scaling  = false
storage_container_name = "media"
```

Run:

```powershell
terraform -chdir=terraform/azure-aks init
terraform -chdir=terraform/azure-aks fmt -check
terraform -chdir=terraform/azure-aks validate
terraform -chdir=terraform/azure-aks plan
terraform -chdir=terraform/azure-aks apply
```

Fetch kubeconfig:

```powershell
terraform -chdir=terraform/azure-aks output get_credentials_command
az aks get-credentials --resource-group <resource-group> --name <cluster-name> --overwrite-existing
kubectl get nodes
```

Get the storage key for GitHub/manual Helm:

```powershell
terraform -chdir=terraform/azure-aks output storage_account_name
terraform -chdir=terraform/azure-aks output -raw storage_account_primary_access_key
```

## 5. Install NGINX Ingress

The Azure values file uses `ingress.className=nginx`. Install the controller once:

```powershell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx `
  --namespace ingress-nginx `
  --create-namespace `
  --version 4.15.1 `
  --set-string controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz `
  --set controller.service.externalTrafficPolicy=Local `
  --wait `
  --rollback-on-failure `
  --timeout 15m

kubectl get svc -n ingress-nginx
```

When the `ingress-nginx-controller` service has an external IP, choose temporary demo hosts:

```text
api.<external-ip>.nip.io
auth.<external-ip>.nip.io
```

Use those values in Helm/GitHub variables.

## 6. Manual Helm Deploy

Copy the example values and fill secrets:

```powershell
Copy-Item charts\luyen-thi-lai-xe\values-azure.example.yaml charts\luyen-thi-lai-xe\values-azure.local.yaml
```

Set:

- `global.imageRegistry`
- `global.imageTag`
- `imagePullSecret.username`
- `imagePullSecret.token`
- `ingress.apiHost`
- `ingress.authHost`
- `config.frontendOrigin`
- `config.gatewayPublicUrl`
- `config.keycloakPublicUrl`
- `secrets.*`

Validate and deploy:

```powershell
helm lint charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-azure.local.yaml
helm template luyen-thi-lai-xe charts/luyen-thi-lai-xe -f charts/luyen-thi-lai-xe/values-azure.local.yaml

helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  --namespace staging `
  --create-namespace `
  --wait `
  --wait-for-jobs `
  --timeout 25m `
  -f charts/luyen-thi-lai-xe/values-azure.local.yaml
```

Check:

```powershell
kubectl get nodes
kubectl get pods -n staging
kubectl get deploy,svc,ingress,job -n staging
helm history luyen-thi-lai-xe -n staging
```

Smoke test:

```powershell
$env:SMOKE_BASE_URL="http://api.<external-ip>.nip.io"
bash scripts/k8s-smoke.sh
```

## 7. GitHub Actions Deploy

Use `.github/workflows/deploy-azure-staging.yml` after a Git SHA has already been built by `Main Image Release`.

Repository secrets:

```text
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
GHCR_PULL_USERNAME
GHCR_PULL_TOKEN
STAGING_POSTGRES_PASSWORD
STAGING_RABBITMQ_PASSWORD
STAGING_RABBITMQ_ERLANG_COOKIE
STAGING_KEYCLOAK_ADMIN_PASSWORD
STAGING_KEYCLOAK_CLIENT_SECRET
STAGING_STORAGE_ACCOUNT_NAME
STAGING_STORAGE_ACCOUNT_KEY
```

Repository variables:

```text
AZURE_AKS_RESOURCE_GROUP
AZURE_AKS_CLUSTER_NAME
STAGING_API_SCHEME=http
STAGING_API_HOST=api.<external-ip>.nip.io
STAGING_AUTH_HOST=auth.<external-ip>.nip.io
STAGING_FRONTEND_ORIGIN=http://localhost:5173
STAGING_SEED_ENABLED=false
```

Run the workflow manually:

1. Open `Deploy Azure AKS Staging`.
2. Enter `image_tag` as a Git SHA that exists in GHCR.
3. Keep `install_nginx_ingress=true` on the first run.
4. Set `confirm_staging=true`.

## 8. Media Direct Upload Check

Azure Blob CORS is configured by Terraform from `blob_cors_allowed_origins`.

Flow:

1. `POST /media/files/init` through Kong/backend.
2. Browser `PUT data.uploadUrl` directly to Azure Blob with only:
   - `Content-Type`
   - `x-ms-blob-type: BlockBlob`
3. `POST /media/files/{id}/complete`.
4. `GET /media/files/{id}/url`.

Do not send backend JWT or app headers to Azure Blob.

## 9. Cost Guardrails

- Start with one node.
- Keep `seed.enabled=false` unless preparing a demo dataset.
- Do not deploy ELK inside AKS on a small node.
- Delete the cluster after the demo if credit is low:

```powershell
terraform -chdir=terraform/azure-aks destroy
```

## 10. Production Roadmap

After the demo is stable:

- Move PostgreSQL to Azure Database for PostgreSQL Flexible Server.
- Move secrets to Azure Key Vault with workload identity.
- Use Azure Container Registry if GHCR access becomes painful.
- Add DNS/TLS with a real domain and cert-manager.
- Add NetworkPolicy, PodDisruptionBudget, and durable event inbox/outbox.
- Add Azure Monitor dashboards or managed Prometheus if budget allows.
