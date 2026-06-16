# DevOps Status Report

## Current Direction

The supported cloud runtime is Azure AKS. The supported CI/CD path is:

```text
GitHub Actions -> GHCR -> Azure AKS -> Helm
```

Local Docker Compose remains supported for development only.

## Release Flow

- `Main Image Release`: quality gate, SBOM, image scan/sign, and GHCR push for immutable Git SHA tags.
- `Deploy Azure AKS Staging`: auto deploys after `Main Image Release` succeeds on `main` when `STAGING_AUTO_DEPLOY_ENABLED=true`. It can also be run manually with `image_tag`.
- `Production Release`: manual only, protected by GitHub Environment `production`.
- `Rollback Release`: manual Helm rollback for staging or production.
- `DORA Metrics Report`: reads deployment event artifacts from Azure AKS workflows.

## Azure Runtime

- Terraform: `terraform/azure-aks`
- Helm chart: `charts/luyen-thi-lai-xe`
- Namespace: `staging` for demo/staging
- Ingress class: `nginx`
- Storage class: `managed-csi`
- Media storage: Azure Blob Storage

## Environment Policy

- `staging`: no required reviewers, automatic deploy from `main` is allowed.
- `production`: required reviewers/manual approval, no automatic deploy trigger.

## Required GitHub Configuration

Variables:

```text
AZURE_AKS_RESOURCE_GROUP
AZURE_AKS_CLUSTER_NAME
STAGING_AUTO_DEPLOY_ENABLED
STAGING_API_HOST
STAGING_AUTH_HOST
STAGING_FRONTEND_ORIGIN
STAGING_API_SCHEME
STAGING_SEED_ENABLED
```

Secrets:

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

Production uses the same Azure OIDC secret names and production-scoped API/storage/application secrets.

## Demo Evidence

Show these during the demo:

- GitHub Actions run history.
- GHCR image tags matching the deployed Git SHA.
- Azure Portal AKS workloads, services, ingresses, and storage account.
- Lens or k9s for pods, deployments, services, ingress, jobs, logs, scaling, and rollout.
- Helm history and rollback workflow.
- DORA report artifact.

## Remaining Production Hardening

- Move PostgreSQL to Azure Database for PostgreSQL Flexible Server.
- Move secrets to Azure Key Vault with workload identity.
- Add real DNS/TLS.
- Add NetworkPolicy, PodDisruptionBudget, and production backup automation.
- Add managed observability if budget allows.
