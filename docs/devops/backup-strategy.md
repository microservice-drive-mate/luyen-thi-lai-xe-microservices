# Backup Strategy, Keycloak Backup vÃ  Restore Test

TÃ i liá»‡u nÃ y mÃ´ táº£ pháº¡m vi backup, cÆ¡ cháº¿ tá»± Ä‘á»™ng backup háº±ng ngÃ y, backup Keycloak vÃ  kiá»ƒm tra restore.

## Backup Strategy & Scope

CÃ¡c database Ä‘Æ°á»£c backup:

| Service | Container | Database | User |
| ------- | --------- | -------- | ---- |
| `identity-service` | `db-identity` | `identity_db` | `user` |
| `user-service` | `db-user` | `user_db` | `user` |
| `exam-service` | `db-exam` | `exam_db` | `user` |
| `course-service` | `db-course` | `course_db` | `user` |
| `question-service` | `db-question` | `question_db` | `user` |
| `notification-service` | `db-notification` | `notification_db` | `user` |
| `analytics-service` | `db-analytics` | `analytics_db` | `user` |
| `simulation-service` | `db-simulation` | `simulation_db` | `user` |
| `media-service` | `db-media` | `media_db` | `user` |
| `audit-service` | `db-audit` | `audit_db` | `user` |
| `keycloak` | `db-keycloak` | `keycloak_db` | `keycloak` |

Backup dÃ¹ng `pg_dump --format=custom` Ä‘á»ƒ táº¡o file `.dump`. Äá»‹nh dáº¡ng custom phÃ¹ há»£p cho restore báº±ng `pg_restore`, há»— trá»£ kiá»ƒm tra metadata vÃ  linh hoáº¡t hÆ¡n plain SQL.

Quy Æ°á»›c tÃªn file:

```text
<service>_<env>_<yyyyMMddTHHmmssZ>.dump
```

VÃ­ dá»¥:

```text
user-service_production_20260524T150000Z.dump
keycloak_production_20260524T150000Z.dump
```

Má»—i láº§n backup táº¡o thÃªm:

- File `.dump` cho tá»«ng database.
- File `.sha256` Ä‘á»ƒ kiá»ƒm tra checksum.
- `manifest.csv` ghi danh sÃ¡ch service, database, host, port vÃ  file dump.

ThÆ° má»¥c lÆ°u:

```text
backups/postgres/<env>/<timestamp>/
```

`backups/` bá»‹ ignore bá»Ÿi Git vÃ¬ chá»©a dá»¯ liá»‡u tháº­t.

## Automated Daily Backup

Service `postgres-backup` Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o:

- `docker-compose.infra.yml` cho local/hybrid.
- `docker-compose.deploy.yml` cho staging/production deploy.

Service nÃ y dÃ¹ng image `postgres:15-alpine`, mount script:

```text
docker/backup/postgres-daily-backup.sh
```

Máº·c Ä‘á»‹nh service sáº½:

- Chá» táº¥t cáº£ PostgreSQL containers healthy.
- Backup ngay khi container khá»Ÿi Ä‘á»™ng.
- Láº·p láº¡i má»—i `86400` giÃ¢y, tÆ°Æ¡ng Ä‘Æ°Æ¡ng háº±ng ngÃ y.
- XÃ³a backup cÅ© theo `BACKUP_RETENTION_DAYS`.
- Má»—i Chá»§ nháº­t táº¡o thÃªm weekly snapshot vÃ  giá»¯ theo `BACKUP_WEEKLY_RETENTION_WEEKS`.

Biáº¿n mÃ´i trÆ°á»ng chÃ­nh:

| Biáº¿n | Máº·c Ä‘á»‹nh | Ã nghÄ©a |
| ---- | -------- | ------- |
| `BACKUP_ROOT` | `/backups/postgres` | ThÆ° má»¥c backup trong container |
| `BACKUP_RETENTION_DAYS` | `7` | Sá»‘ ngÃ y giá»¯ backup |
| `BACKUP_WEEKLY_RETENTION_WEEKS` | `4` | Sá»‘ tuáº§n giá»¯ weekly snapshot |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Khoáº£ng cÃ¡ch giá»¯a 2 láº§n backup |
| `BACKUP_RUN_ONCE` | `false` | Cháº¡y má»™t láº§n rá»“i thoÃ¡t |

Staging giá»¯ máº·c Ä‘á»‹nh 7 ngÃ y. Production example Ä‘áº·t 14 ngÃ y.

Weekly snapshot Ä‘Æ°á»£c lÆ°u riÃªng:

```text
backups/postgres/weekly/<env>/<yyyy-Www>/
backups/keycloak/weekly/<env>/<yyyy-Www>/
```

ChÃ­nh sÃ¡ch hiá»‡n táº¡i Ä‘Ã¡p á»©ng yÃªu cáº§u tá»‘i thiá»ƒu: daily backup giá»¯ 7-14 ngÃ y tÃ¹y mÃ´i trÆ°á»ng, weekly snapshot giá»¯ 4 tuáº§n.

## CÃ¡ch cháº¡y local

Backup one-shot báº±ng script TypeScript cÅ© Ä‘Ã£ Ä‘Æ°á»£c chuáº©n hÃ³a láº¡i:

```bash
npm run db:backup:local
```

Backup one-shot báº±ng chÃ­nh container backup:

```bash
npm run db:backup:once
```

Backup Keycloak realm one-shot:

```bash
npm run keycloak:backup:once
```

Cháº¡y tá»± Ä‘á»™ng cÃ¹ng infra:

```bash
npm run infra:up
```

Sau khi cháº¡y, kiá»ƒm tra thÆ° má»¥c:

```text
backups/postgres/development-local/<timestamp>/
```

## Kiá»ƒm tra nhanh file backup

Checksum:

```bash
sha256sum -c backups/postgres/<env>/<timestamp>/<file>.sha256
```

Liá»‡t kÃª metadata báº±ng `pg_restore`:

```bash
pg_restore --list backups/postgres/<env>/<timestamp>/<file>.dump
```

Diá»…n táº­p restore Ä‘áº§y Ä‘á»§ Ä‘Æ°á»£c mÃ´ táº£ á»Ÿ pháº§n Restore Test.

## Keycloak Backup

Keycloak Ä‘Æ°á»£c backup theo 2 lá»›p:

- `keycloak_db` Ä‘Æ°á»£c backup báº±ng `pg_dump --format=custom` giá»‘ng cÃ¡c PostgreSQL DB khÃ¡c.
- Realm runtime config Ä‘Æ°á»£c export háº±ng ngÃ y báº±ng `kcadm.sh` tá»« service `keycloak-backup`.

Service `keycloak-backup` Ä‘Ã£ Ä‘Æ°á»£c thÃªm vÃ o:

- `docker-compose.infra.yml`
- `docker-compose.deploy.yml`

Artifact Keycloak export náº±m á»Ÿ:

```text
backups/keycloak/<env>/<timestamp>/
```

Weekly export cá»§a Keycloak cÅ©ng Ä‘Æ°á»£c táº¡o vÃ o Chá»§ nháº­t vÃ  giá»¯ theo `BACKUP_WEEKLY_RETENTION_WEEKS`.

CÃ¡c file Ä‘Æ°á»£c táº¡o:

| File | Ná»™i dung |
| ---- | -------- |
| `realm.json` | Cáº¥u hÃ¬nh realm |
| `users.json` | Danh sÃ¡ch users |
| `clients.json` | Danh sÃ¡ch clients |
| `roles.json` | Realm roles |
| `SHA256SUMS` | Checksum cÃ¡c file JSON |
| `manifest.csv` | Danh sÃ¡ch artifact |

LÆ°u Ã½: source khÃ´i phá»¥c Ä‘áº§y Ä‘á»§ nháº¥t cho Keycloak váº«n lÃ  `keycloak_db` dump. Realm export giÃºp review cáº¥u hÃ¬nh, phá»¥c há»“i thá»§ cÃ´ng má»™t pháº§n vÃ  kiá»ƒm tra nhanh drift cáº¥u hÃ¬nh.

## Backup trÃªn GCP/K3s

Khi deploy báº±ng Helm lÃªn GCP hiá»‡n táº¡i, há»‡ thá»‘ng cháº¡y theo mÃ´ hÃ¬nh **K3s trÃªn Compute Engine VM**. PostgreSQL vÃ  Keycloak váº«n cháº¡y trong Kubernetes namespace `staging`, dá»¯ liá»‡u PostgreSQL náº±m trÃªn PVC local-path cá»§a K3s. VÃ¬ váº­y backup trÃªn GCP hiá»‡n chÆ°a dÃ¹ng Cloud SQL automated backup/PITR, mÃ  nÃªn xá»­ lÃ½ theo hÆ°á»›ng:

- Backup thá»§ cÃ´ng hoáº·c theo CronJob trong Kubernetes.
- LÆ°u file `.dump`, checksum vÃ  manifest ra ngoÃ i VM.
- Äáº©y báº£n backup quan trá»ng lÃªn Google Cloud Storage Ä‘á»ƒ trÃ¡nh máº¥t dá»¯ liá»‡u náº¿u VM hoáº·c disk lá»—i.

### Backup thá»§ cÃ´ng PostgreSQL trÃªn GCP

Káº¿t ná»‘i vÃ o cluster trÆ°á»›c theo hÆ°á»›ng dáº«n trong `docs/devops/gcp-setup.md`, sau Ä‘Ã³ kiá»ƒm tra pod PostgreSQL:

```bash
kubectl get pods -n staging | grep postgres
```

Táº¡o thÆ° má»¥c backup trÃªn mÃ¡y Ä‘ang cháº¡y lá»‡nh:

```bash
mkdir -p backups/gcp/postgres/$(date -u +%Y%m%dT%H%M%SZ)
```

VÃ­ dá»¥ backup má»™t database:

```bash
NAMESPACE=staging
POSTGRES_POD=$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/component=postgres -o jsonpath='{.items[0].metadata.name}')
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="backups/gcp/postgres/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-privileges --username "$POSTGRES_USER" --dbname user_db' \
  > "$BACKUP_DIR/user-service_staging_$TIMESTAMP.dump"

sha256sum "$BACKUP_DIR/user-service_staging_$TIMESTAMP.dump" \
  > "$BACKUP_DIR/user-service_staging_$TIMESTAMP.dump.sha256"
```

CÃ¡c database cáº§n backup giá»‘ng báº£ng pháº¡m vi á»Ÿ Ä‘áº§u tÃ i liá»‡u: `identity_db`, `user_db`, `exam_db`, `course_db`, `question_db`, `notification_db`, `analytics_db`, `simulation_db`, `media_db`, `audit_db` vÃ  `keycloak_db`.

Náº¿u muá»‘n backup nhanh toÃ n bá»™ trong má»™t láº§n demo, cÃ³ thá»ƒ láº·p danh sÃ¡ch database:

```bash
NAMESPACE=staging
POSTGRES_POD=$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/component=postgres -o jsonpath='{.items[0].metadata.name}')
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="backups/gcp/postgres/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

cat > "$BACKUP_DIR/manifest.csv" <<EOF
service,database,file
EOF

for item in \
  identity-service:identity_db \
  user-service:user_db \
  exam-service:exam_db \
  course-service:course_db \
  question-service:question_db \
  notification-service:notification_db \
  analytics-service:analytics_db \
  simulation-service:simulation_db \
  media-service:media_db \
  audit-service:audit_db \
  keycloak:keycloak_db
do
  service="${item%%:*}"
  database="${item##*:}"
  file="${service}_staging_${TIMESTAMP}.dump"

  kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- \
    sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_dump --format=custom --no-owner --no-privileges --username \"\$POSTGRES_USER\" --dbname \"$database\"" \
    > "$BACKUP_DIR/$file"

  sha256sum "$BACKUP_DIR/$file" > "$BACKUP_DIR/$file.sha256"
  echo "$service,$database,$file" >> "$BACKUP_DIR/manifest.csv"
done
```

### Äáº©y backup lÃªn Google Cloud Storage

Táº¡o bucket riÃªng cho backup:

```bash
gcloud storage buckets create gs://<project-id>-luyen-thi-lai-xe-backups \
  --location=asia-southeast1 \
  --uniform-bucket-level-access
```

Äáº©y thÆ° má»¥c backup vá»«a táº¡o:

```bash
gcloud storage cp --recursive "$BACKUP_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"
```

Kiá»ƒm tra láº¡i object:

```bash
gcloud storage ls "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"
```

Vá»›i demo mÃ´n há»c, cÃ³ thá»ƒ nÃ³i ráº±ng báº£n backup Ä‘Æ°á»£c táº¡o trong cluster, sau Ä‘Ã³ copy ra Cloud Storage Ä‘á»ƒ cÃ³ má»™t báº£n offsite khÃ´ng phá»¥ thuá»™c vÃ o disk cá»§a VM.

### Backup Keycloak realm trÃªn GCP

`keycloak_db` Ä‘Ã£ Ä‘Æ°á»£c backup báº±ng PostgreSQL dump á»Ÿ bÆ°á»›c trÃªn. Náº¿u muá»‘n export thÃªm realm runtime config, cÃ³ thá»ƒ exec vÃ o pod Keycloak:

```bash
NAMESPACE=staging
KEYCLOAK_POD=$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/component=keycloak -o jsonpath='{.items[0].metadata.name}')
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
EXPORT_DIR="backups/gcp/keycloak/$TIMESTAMP"
mkdir -p "$EXPORT_DIR"

kubectl exec -n "$NAMESPACE" "$KEYCLOAK_POD" -- \
  /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$KEYCLOAK_ADMIN" \
  --password "$KEYCLOAK_ADMIN_PASSWORD"

kubectl exec -n "$NAMESPACE" "$KEYCLOAK_POD" -- \
  /opt/keycloak/bin/kcadm.sh get "realms/luyen-thi-lai-xe-realm" \
  > "$EXPORT_DIR/realm.json"

sha256sum "$EXPORT_DIR/realm.json" > "$EXPORT_DIR/SHA256SUMS"
```

Sau Ä‘Ã³ Ä‘áº©y lÃªn Cloud Storage:

```bash
gcloud storage cp --recursive "$EXPORT_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/keycloak/staging/$TIMESTAMP/"
```

### Restore rehearsal tá»« backup GCP

Táº£i má»™t báº£n backup tá»« Cloud Storage vá» mÃ¡y:

```bash
gcloud storage cp \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/<timestamp>/user-service_staging_<timestamp>.dump" \
  "backups/gcp/restore-test/user-service_staging_<timestamp>.dump"
```

Cháº¡y restore test báº±ng script hiá»‡n cÃ³:

```bash
RESTORE_TEST_BACKUP_FILE=backups/gcp/restore-test/user-service_staging_<timestamp>.dump npm run db:restore:test
```

Khi demo, nÃªn ghi láº¡i:

- TÃªn bucket.
- Timestamp cá»§a backup.
- File `.dump` Ä‘Ã£ restore test.
- Káº¿t quáº£ `Restore completed successfully`.

### HÆ°á»›ng nÃ¢ng cáº¥p sau demo

Äá»ƒ Ä‘áº§y Ä‘á»§ hÆ¡n trÃªn GCP, nÃªn thÃªm cÃ¡c bÆ°á»›c sau:

- Táº¡o Kubernetes `CronJob` cho PostgreSQL backup, cháº¡y má»—i ngÃ y vÃ  upload tháº³ng lÃªn Cloud Storage.
- Táº¡o Kubernetes `CronJob` cho Keycloak realm export.
- DÃ¹ng Secret hoáº·c Workload Identity Ä‘á»ƒ cáº¥p quyá»n ghi Cloud Storage thay vÃ¬ lÆ°u service account key trong cluster.
- ThÃªm lifecycle rule cho bucket, vÃ­ dá»¥ giá»¯ daily backup 14 ngÃ y vÃ  weekly backup 4-8 tuáº§n.
- Náº¿u chuyá»ƒn PostgreSQL sang Cloud SQL, báº­t automated backup vÃ  point-in-time recovery, sau Ä‘Ã³ giá»¯ script `pg_dump` nhÆ° lá»›p backup logic/application-level.

## Restore Test

Script test restore:

```bash
npm run db:restore:test
```

Máº·c Ä‘á»‹nh script tÃ¬m file `.dump` má»›i nháº¥t trong:

```text
backups/postgres/
```

Hoáº·c chá»‰ Ä‘á»‹nh file cá»¥ thá»ƒ:

```bash
RESTORE_TEST_BACKUP_FILE=backups/postgres/development-local/<timestamp>/user-service_development-local_<timestamp>.dump npm run db:restore:test
```

Script sáº½:

- Táº¡o PostgreSQL container táº¡m báº±ng image `postgres:15-alpine`.
- Chá» DB táº¡m sáºµn sÃ ng.
- Cháº¡y `pg_restore --list` Ä‘á»ƒ kiá»ƒm tra metadata backup.
- Restore tháº­t vÃ o DB táº¡m báº±ng `pg_restore`.
- XÃ³a container táº¡m sau khi test xong.

Káº¿t quáº£ pass cá»§a `npm run db:restore:test` lÃ  báº±ng chá»©ng backup cÃ³ thá»ƒ dÃ¹ng Ä‘Æ°á»£c á»Ÿ má»©c ká»¹ thuáº­t. Khi test production tháº­t, nÃªn chá»n má»™t backup má»›i nháº¥t vÃ  ghi láº¡i timestamp/file Ä‘Ã£ test trong log váº­n hÃ nh.
