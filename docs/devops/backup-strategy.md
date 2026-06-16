# Backup Strategy

This project currently targets Azure AKS for cloud demos. Local Docker Compose remains useful for development, but cloud backup planning should follow the Azure path.

## Current Demo Scope

- PostgreSQL runs inside AKS for the affordable staging/demo topology.
- Media files are stored in Azure Blob Storage.
- Keycloak, RabbitMQ, Redis, and Consul run inside the cluster.

This is acceptable for demo/staging. Production should move stateful services to managed Azure services.

## Manual PostgreSQL Backup From AKS

```powershell
kubectl get pods -n staging
kubectl exec -n staging deploy/luyen-thi-lai-xe-postgresql -- pg_dumpall -U postgres > backups\azure\postgres\staging.dump
```

For a single database, exec into the PostgreSQL pod and run `pg_dump` with the service database name.

## Media Backup

Media is already in Azure Blob Storage. For demo evidence:

```powershell
az storage blob list `
  --account-name <storage-account> `
  --container-name media `
  --output table
```

For production, enable:

- Blob soft delete.
- Container point-in-time restore if available for the subscription.
- Lifecycle rules.
- Storage account monitoring and alerts.

## Keycloak Realm Export

```powershell
kubectl exec -n staging deploy/luyen-thi-lai-xe-keycloak -- `
  /opt/keycloak/bin/kc.sh export --dir /tmp/keycloak-export --users realm_file
```

Copy the export from the pod if a realm backup is needed for rehearsal.

## Production Roadmap

- Azure Database for PostgreSQL Flexible Server with automated backup/PITR.
- Azure Key Vault for secrets.
- Azure Blob soft delete and retention policy.
- Scheduled backup jobs with restore rehearsal.
- Alerts for backup failure and storage growth.
