# Roadmap Hoan Thien DevOps & Microservices

Tai lieu nay cap nhat theo trang thai repo hien tai. Ban tong ket chi tiet nam o [DEVOPS-SUMMARY.md](./DEVOPS-SUMMARY.md).

## Trang Thai Hien Tai

Repo da co nen tang DevOps kha day du cho MVP/local/VPS:

- Docker Compose cho hybrid local, full stack va VPS deploy.
- 10 app services production/VPS: `identity`, `user`, `exam`, `course`, `question`, `notification`, `analytics`, `simulation`, `media`, `audit`.
- `docs-service` dung cho dev/noi bo, khong nam trong production deploy hien tai.
- Database-per-service voi Prisma migration/seed orchestration.
- Kong, Consul, Keycloak, RabbitMQ, Redis.
- Health endpoints: `/health`, `/health/live`, `/health/ready`.
- Metrics endpoints: `/metrics`.
- Prometheus, Grafana, Alertmanager.
- ELK logging + correlation id + access log.
- HTTP timeout/retry/circuit breaker helper.
- RabbitMQ DLQ/retry/backoff/idempotency helper.
- PostgreSQL/Keycloak backup scripts, restore test va runbooks.
- GitHub Actions CI/CD, VPS deploy workflow va Jenkinsfile.

## Viec Can Lam Ngay

### 1. DevSecOps Gate

Muc tieu: moi PR/build phai co kiem tra bao mat co ban.

Viec can lam:

1. Them Trivy Docker image scan vao `.github/workflows/ci.yml`.
2. Them secret scanning bang Gitleaks hoac TruffleHog.
3. Them dependency audit gate bang `npm audit --audit-level=high` hoac `audit-ci`.
4. Generate SBOM bang Syft/CycloneDX va upload artifact.
5. Neu co thoi gian, sign image bang Cosign.

Definition of Done:

- PR/main build fail neu co secret leak hoac vulnerability nghiem trong.
- Moi image release co scan result va SBOM artifact.

### 2. Release Hardening

Muc tieu: release co the truy vet va rollback an toan.

Viec can lam:

1. Chot production deploy bang immutable tag: Git SHA hoac release tag, khong dua vao `latest`.
2. Them rollback workflow hoac Jenkins parameter de redeploy tag cu.
3. Luu ket qua smoke test sau moi deploy.
4. Document rule GitHub Environment protection cho production approval.

Definition of Done:

- Biet ro version nao dang chay qua `.last-deployed-tag`.
- Co the rollback bang 1 job/command co tham so image tag.

### 3. Secret Management

Muc tieu: production secret khong nam trong repo hoac Consul plaintext.

Viec can lam:

1. Chon mot secret manager: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, hoac secret store cua VPS provider.
2. Dua DB password, RabbitMQ password, Keycloak secret, storage key vao secret manager.
3. Giu Consul cho non-secret config.
4. Document quy trinh rotate secret.

Definition of Done:

- Production deploy khong can ghi secret that vao file tracked.
- Co checklist rotate secret khi leak/doi nhan su.

### 4. CI/Test Consistency

Muc tieu: quality gate khong bi lech giua service.

Viec can lam:

1. Bo sung `test` script cho `media-service`.
2. Chay lai `npx turbo run test` tren CI va local.
3. Them e2e smoke that cho cac luong chinh neu con dang placeholder.

Definition of Done:

- Tat ca service trong matrix co script test hop le.
- CI fail neu test service loi.

## Viec Can Lam Gan Han

### 5. Backup Offsite & DR

Hien tai da co local/container daily backup va restore test. Can lam tiep:

1. Day backup len S3/Azure Blob hoac storage ngoai VPS.
2. Ghi lai restore rehearsal theo timestamp/file cu the.
3. Chot RPO/RTO toi thieu cho mon/demo hoac production.
4. Can nhac managed PostgreSQL PITR neu deploy that.

### 6. Observability Nang Cao

Hien tai da co RED metrics, dashboard va alert co ban. Can lam tiep:

1. Them business metrics:
   - exam sessions completed
   - pass/fail count
   - notification delivery outcome
   - media upload success/failure
2. Them dashboard rieng cho RabbitMQ va DB neu can demo van hanh.
3. Neu can truy vet end-to-end sau hon, them OpenTelemetry + Tempo/Jaeger.

### 7. Load Test

Chua co load test. Nen them k6 cho cac luong:

1. Login/refresh token.
2. Lay danh sach khoa hoc/cau hoi.
3. Bat dau bai thi, luu cau tra loi, nop bai.
4. Upload media neu dung storage that.

Definition of Done:

- Co baseline RPS/latency/error rate.
- Co script chay local/VPS va ghi ket qua.

## De Sau MVP

### Kubernetes & Autoscaling

Chi lam khi Docker Compose/VPS khong con du:

- Helm/Kustomize.
- Deployment/Service/Ingress.
- resource requests/limits.
- liveness/readiness probes theo `/health/live` va `/health/ready`.
- HPA.

### Infrastructure as Code

Nen lam sau khi chot cloud/runtime that:

- Terraform cho network, compute, database, storage.
- Ansible hoac cloud-init cho VPS bootstrap neu tiep tuc dung VPS.
- Drift detection va quy trinh review infra change.

### Multi-region

Post-MVP:

- DNS failover.
- Offsite backup/restore cross-region.
- Data replication strategy.
- Message broker/Consul federation neu that su can.

## Checklist Top 10

1. Them Trivy image scan.
2. Them Gitleaks/TruffleHog secret scan.
3. Them dependency audit gate.
4. Generate SBOM artifact.
5. Bo sung `test` script cho `media-service`.
6. Chot production deploy bang immutable tag.
7. Them rollback workflow/job.
8. Dua production secret vao secret manager.
9. Day backup offsite va ghi restore rehearsal.
10. Them k6 load test baseline.

