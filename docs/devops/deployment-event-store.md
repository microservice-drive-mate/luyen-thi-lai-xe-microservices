# Deployment Event Store

The deployment event store keeps a JSON record for every Azure AKS deployment and rollback. DORA reporting reads these files instead of relying only on workflow history.

## Writers

- `.github/workflows/deploy-azure-staging.yml`
- `.github/workflows/production-release.yml`
- `.github/workflows/rollback-release.yml`
- `scripts/devops-record-deployment.js`

## Event Shape

```json
{
  "schemaVersion": 1,
  "source": "github-actions",
  "provider": "github-actions",
  "environment": "staging",
  "deploymentType": "helm-upgrade",
  "deploymentTarget": "azure-aks",
  "releaseName": "luyen-thi-lai-xe",
  "namespace": "staging",
  "gitSha": "<image-sha>",
  "imageTag": "<image-sha>",
  "status": "success",
  "startedAt": "2026-06-16T00:00:00.000Z",
  "finishedAt": "2026-06-16T00:10:00.000Z",
  "deployUrl": "https://github.com/<owner>/<repo>/actions/runs/<id>"
}
```

## Artifacts

Workflows upload deployment event artifacts named:

```text
deployment-event-<environment>-<run-number>
```

The DORA workflow downloads those artifacts into:

```text
reports/deployments/
```

## Intended Flow

```text
merge to main
-> Main Image Release builds and pushes GHCR images
-> Deploy Azure AKS Staging deploys automatically
-> Production Release deploys manually after approval
-> Rollback Release records rollback events when needed
```

This gives the project one consistent delivery data source for GitHub Actions and Azure AKS.
