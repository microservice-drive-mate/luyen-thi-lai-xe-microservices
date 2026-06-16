# DORA Metrics Guide

This project records DevOps delivery data from the GitHub Actions and Azure AKS release path.

## Supported Deployment Sources

- `Deploy Azure AKS Staging`: automatic staging deploy after `Main Image Release` succeeds on `main`, when `STAGING_AUTO_DEPLOY_ENABLED=true`.
- `Production Release`: manual production deploy through the GitHub Environment `production`.
- `Rollback Release`: manual Helm rollback for staging or production.

Deployment events are written with:

```text
source=github-actions
provider=github-actions
deploymentTarget=azure-aks
```

## Data Flow

1. GitHub Actions builds immutable GHCR images tagged by Git SHA.
2. Azure deployment workflows deploy the same SHA to AKS with Helm.
3. `scripts/devops-record-deployment.js` writes a deployment event JSON artifact.
4. `DORA Metrics Report` downloads deployment event artifacts and runs `pnpm run dora:report`.
5. Incident issues with label `incident` are used for MTTR and change failure analysis.

## Run The Report

```powershell
pnpm run dora:report
pnpm run dora:export-prometheus
```

Or run in GitHub:

```text
Actions -> DORA Metrics Report -> Run workflow
deploy_workflows=Deploy Azure AKS Staging,Production Release,Rollback Release
```

## Demo Notes

- Deployment Frequency comes from successful staging/production deployment events.
- Lead Time compares the deployed Git SHA with commit time.
- Change Failure Rate uses failed deployment events plus incident labels such as `change-failure`, `deploy-failure`, or `rollback`.
- MTTR uses incident issue `created_at` to `closed_at`.

Keep deployment event artifacts for every release so the report stays explainable during the demo.
