# Microservices Techniques Applied And Improvements

## Current DevOps Direction

The project now standardizes on:

- GitHub Actions for CI/CD.
- GHCR for immutable Docker images tagged by Git SHA.
- Azure AKS for cloud runtime.
- Azure Blob Storage for media.
- Terraform under `terraform/azure-aks`.
- Helm chart under `charts/luyen-thi-lai-xe`.

Local Docker Compose remains supported for development only.

## Implemented Techniques

- Monorepo with `pnpm`, Turbo, NestJS, Prisma, and shared packages.
- Service-per-domain microservices.
- Kong gateway routing.
- Keycloak authentication and RBAC.
- RabbitMQ event communication.
- PostgreSQL per service.
- Redis, Consul, health checks, metrics, logging, and tracing baseline.
- Helm deployment with migration and seed jobs.
- GitHub Actions build/test/typecheck/image scan/sign/SBOM.
- Staging auto deploy after `Main Image Release` succeeds on `main`.
- Production manual deploy through GitHub Environment approval.
- DORA deployment event artifacts and report generation.

## Main Evidence Paths

| Area | Evidence |
| --- | --- |
| CI/CD | `.github/workflows/ci.yml`, `.github/workflows/deploy-azure-staging.yml`, `.github/workflows/production-release.yml`, `.github/workflows/rollback-release.yml` |
| Cloud IaC | `terraform/azure-aks`, `terraform/modules/azure-aks` |
| Kubernetes | `charts/luyen-thi-lai-xe` |
| DevOps docs | `docs/devops/azure-aks-deployment.md`, `docs/devops/azure-github-actions-setup.md`, `docs/devops/azure-demo-runbook.md` |
| DORA | `scripts/devops-record-deployment.js`, `scripts/devops-dora-report.ts`, `.github/workflows/dora-report.yml` |

## Improvement Roadmap

- Move PostgreSQL to Azure Database for PostgreSQL Flexible Server.
- Move secrets to Azure Key Vault with workload identity.
- Add real DNS/TLS and cert-manager.
- Add NetworkPolicy, PodDisruptionBudget, and restore rehearsal automation.
- Add production-grade observability dashboards and alerts.
