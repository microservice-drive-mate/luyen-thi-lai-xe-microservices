# Phase 9 - GCP IaC, HPA, and k6 Load Test

This guide completes Phase 9 with one GCP Compute Engine VM running K3s.
Terraform creates the cloud infrastructure, Helm deploys the app, HPA handles
autoscaling, and k6 measures runtime behavior.

## Architecture

- Cloud: Google Cloud Platform
- VM: `e2-standard-8`
- Region: `asia-southeast1`
- Disk: `150GB pd-balanced`
- Runtime: K3s single-node Kubernetes
- Ingress: K3s Traefik plus in-cluster Kong
- Public hosts: `api.<static-ip>.nip.io` and `auth.<static-ip>.nip.io`
- State: local Terraform state, ignored by Git

## 1. Prepare GCP

Create or choose a GCP project, then enable:

- Compute Engine API
- Cloud Billing on the project

Install/authenticate Google Cloud CLI on the machine that will run Terraform:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project <your-gcp-project-id>
```

Create an SSH key if you do not have one:

```powershell
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Find your public IP for the admin firewall:

```powershell
(Invoke-WebRequest -UseBasicParsing https://ifconfig.me).Content
```

## 2. Provision GCP Infrastructure

Create local Terraform variables:

```powershell
Copy-Item terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit `terraform/terraform.tfvars`:

- `project_id`: your GCP project ID
- `ssh_public_key_path`: path to your public SSH key
- `allowed_admin_cidrs`: your public IP as `/32`

Run Terraform:

```powershell
terraform -chdir=terraform init
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform validate
terraform -chdir=terraform plan -var-file=terraform.tfvars
terraform -chdir=terraform apply -var-file=terraform.tfvars
```

Save the useful outputs:

```powershell
terraform -chdir=terraform output public_ip
terraform -chdir=terraform output api_host
terraform -chdir=terraform output auth_host
terraform -chdir=terraform output ssh_command
terraform -chdir=terraform output kubeconfig_fetch_command_powershell
```

Fetch kubeconfig by running the PowerShell command printed by Terraform:

```powershell
terraform -chdir=terraform output -raw kubeconfig_fetch_command_powershell
```

Then verify the cluster:

```powershell
kubectl get nodes
kubectl get pods -A
kubectl get apiservice v1beta1.metrics.k8s.io
```

## 3. Deploy the App with Helm

Create local Helm values:

```powershell
Copy-Item charts/luyen-thi-lai-xe/values-gcp.example.yaml charts/luyen-thi-lai-xe/values-gcp.local.yaml
```

Edit `values-gcp.local.yaml`:

- replace `<static-ip>` placeholders using `terraform output public_ip`
- set `global.imageTag` to a Git SHA already pushed to GHCR
- set GHCR pull username/token
- set DB, RabbitMQ, Keycloak, and storage secrets

Deploy:

```powershell
helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe `
  --namespace staging `
  --create-namespace `
  --wait `
  --wait-for-jobs `
  --timeout 25m `
  -f charts/luyen-thi-lai-xe/values-gcp.local.yaml
```

Verify:

```powershell
kubectl get pods -n staging
kubectl get jobs -n staging
kubectl rollout status deployment -l app.kubernetes.io/component=app -n staging --timeout=10m
kubectl get hpa -n staging
kubectl top pods -n staging
```

HPA is ready only when `kubectl get hpa` shows real CPU/memory values instead
of `<unknown>`.

## 4. Smoke and Load Test

Smoke test through the API host:

```powershell
$env:SMOKE_BASE_URL="https://api.<static-ip>.nip.io"
& "C:\Program Files\Git\bin\bash.exe" scripts/k8s-smoke.sh
```

Run k6 with Docker:

```powershell
docker run --rm `
  -v "${PWD}/load-tests:/scripts:ro" `
  -e BASE_URL="https://api.<static-ip>.nip.io" `
  -e TEST_USERNAME="<test-username-or-email>" `
  -e TEST_USER_PASSWORD="<test-password>" `
  grafana/k6 run /scripts/scenarios/smoke.js
```

Run the Phase 9 sequence:

```powershell
docker run --rm -v "${PWD}/load-tests:/scripts:ro" -e BASE_URL="https://api.<static-ip>.nip.io" grafana/k6 run /scripts/scenarios/smoke.js
docker run --rm -v "${PWD}/load-tests:/scripts:ro" -e BASE_URL="https://api.<static-ip>.nip.io" grafana/k6 run /scripts/scenarios/load.js
docker run --rm -v "${PWD}/load-tests:/scripts:ro" -e BASE_URL="https://api.<static-ip>.nip.io" grafana/k6 run /scripts/scenarios/stress.js
docker run --rm -v "${PWD}/load-tests:/scripts:ro" -e BASE_URL="https://api.<static-ip>.nip.io" grafana/k6 run /scripts/scenarios/spike.js
```

The default Kong rate-limit plugin allows `100` requests per second and `1000`
requests per hour for anonymous traffic. Keep smoke/small-load tests under that
quota, or temporarily raise/disable the limit when the purpose is pure load or
HPA scale-up testing.

Watch autoscaling while k6 runs:

```powershell
kubectl get hpa -n staging -w
kubectl get pods -n staging -w
kubectl top pods -n staging
```

Phase 9 passes when smoke succeeds, load/stress/spike produce recorded latency
and error-rate results, at least one HPA scales up under load, and HPA scales
down after load ends.

## 5. Cost Control

The `e2-standard-8` VM spends trial credit quickly if left running. Destroy
when the demo/test window is finished:

```powershell
terraform -chdir=terraform destroy -var-file=terraform.tfvars
```

After destroy, confirm in GCP Console that the VM, disk, static IP, VPC, and
firewall rules are gone.
