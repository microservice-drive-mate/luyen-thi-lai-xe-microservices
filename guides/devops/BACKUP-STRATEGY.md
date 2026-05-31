# Backup Strategy, Keycloak Backup và Restore Test

Tài liệu này mô tả phạm vi backup, cơ chế tự động backup hằng ngày, backup Keycloak và kiểm tra restore.

## Backup Strategy & Scope

Các database được backup:

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

Backup dùng `pg_dump --format=custom` để tạo file `.dump`. Định dạng custom phù hợp cho restore bằng `pg_restore`, hỗ trợ kiểm tra metadata và linh hoạt hơn plain SQL.

Quy ước tên file:

```text
<service>_<env>_<yyyyMMddTHHmmssZ>.dump
```

Ví dụ:

```text
user-service_production_20260524T150000Z.dump
keycloak_production_20260524T150000Z.dump
```

Mỗi lần backup tạo thêm:

- File `.dump` cho từng database.
- File `.sha256` để kiểm tra checksum.
- `manifest.csv` ghi danh sách service, database, host, port và file dump.

Thư mục lưu:

```text
backups/postgres/<env>/<timestamp>/
```

`backups/` bị ignore bởi Git vì chứa dữ liệu thật.

## Automated Daily Backup

Service `postgres-backup` đã được thêm vào:

- `docker-compose.infra.yml` cho local/hybrid.
- `docker-compose.deploy.yml` cho staging/production deploy.

Service này dùng image `postgres:15-alpine`, mount script:

```text
docker/backup/postgres-daily-backup.sh
```

Mặc định service sẽ:

- Chờ tất cả PostgreSQL containers healthy.
- Backup ngay khi container khởi động.
- Lặp lại mỗi `86400` giây, tương đương hằng ngày.
- Xóa backup cũ theo `BACKUP_RETENTION_DAYS`.
- Mỗi Chủ nhật tạo thêm weekly snapshot và giữ theo `BACKUP_WEEKLY_RETENTION_WEEKS`.

Biến môi trường chính:

| Biến | Mặc định | Ý nghĩa |
| ---- | -------- | ------- |
| `BACKUP_ROOT` | `/backups/postgres` | Thư mục backup trong container |
| `BACKUP_RETENTION_DAYS` | `7` | Số ngày giữ backup |
| `BACKUP_WEEKLY_RETENTION_WEEKS` | `4` | Số tuần giữ weekly snapshot |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Khoảng cách giữa 2 lần backup |
| `BACKUP_RUN_ONCE` | `false` | Chạy một lần rồi thoát |

Staging giữ mặc định 7 ngày. Production example đặt 14 ngày.

Weekly snapshot được lưu riêng:

```text
backups/postgres/weekly/<env>/<yyyy-Www>/
backups/keycloak/weekly/<env>/<yyyy-Www>/
```

Chính sách hiện tại đáp ứng yêu cầu tối thiểu: daily backup giữ 7-14 ngày tùy môi trường, weekly snapshot giữ 4 tuần.

## Cách chạy local

Backup one-shot bằng script TypeScript cũ đã được chuẩn hóa lại:

```bash
npm run db:backup:local
```

Backup one-shot bằng chính container backup:

```bash
npm run db:backup:once
```

Backup Keycloak realm one-shot:

```bash
npm run keycloak:backup:once
```

Chạy tự động cùng infra:

```bash
npm run infra:up
```

Sau khi chạy, kiểm tra thư mục:

```text
backups/postgres/development-local/<timestamp>/
```

## Kiểm tra nhanh file backup

Checksum:

```bash
sha256sum -c backups/postgres/<env>/<timestamp>/<file>.sha256
```

Liệt kê metadata bằng `pg_restore`:

```bash
pg_restore --list backups/postgres/<env>/<timestamp>/<file>.dump
```

Diễn tập restore đầy đủ được mô tả ở phần Restore Test.

## Keycloak Backup

Keycloak được backup theo 2 lớp:

- `keycloak_db` được backup bằng `pg_dump --format=custom` giống các PostgreSQL DB khác.
- Realm runtime config được export hằng ngày bằng `kcadm.sh` từ service `keycloak-backup`.

Service `keycloak-backup` đã được thêm vào:

- `docker-compose.infra.yml`
- `docker-compose.deploy.yml`

Artifact Keycloak export nằm ở:

```text
backups/keycloak/<env>/<timestamp>/
```

Weekly export của Keycloak cũng được tạo vào Chủ nhật và giữ theo `BACKUP_WEEKLY_RETENTION_WEEKS`.

Các file được tạo:

| File | Nội dung |
| ---- | -------- |
| `realm.json` | Cấu hình realm |
| `users.json` | Danh sách users |
| `clients.json` | Danh sách clients |
| `roles.json` | Realm roles |
| `SHA256SUMS` | Checksum các file JSON |
| `manifest.csv` | Danh sách artifact |

Lưu ý: source khôi phục đầy đủ nhất cho Keycloak vẫn là `keycloak_db` dump. Realm export giúp review cấu hình, phục hồi thủ công một phần và kiểm tra nhanh drift cấu hình.

## Backup trên GCP/K3s

Khi deploy bằng Helm lên GCP hiện tại, hệ thống chạy theo mô hình **K3s trên Compute Engine VM**. PostgreSQL và Keycloak vẫn chạy trong Kubernetes namespace `staging`, dữ liệu PostgreSQL nằm trên PVC local-path của K3s. Vì vậy backup trên GCP hiện chưa dùng Cloud SQL automated backup/PITR, mà nên xử lý theo hướng:

- Backup thủ công hoặc theo CronJob trong Kubernetes.
- Lưu file `.dump`, checksum và manifest ra ngoài VM.
- Đẩy bản backup quan trọng lên Google Cloud Storage để tránh mất dữ liệu nếu VM hoặc disk lỗi.

### Backup thủ công PostgreSQL trên GCP

Kết nối vào cluster trước theo hướng dẫn trong `guides/devops/GCP-SETUP.md`, sau đó kiểm tra pod PostgreSQL:

```bash
kubectl get pods -n staging | grep postgres
```

Tạo thư mục backup trên máy đang chạy lệnh:

```bash
mkdir -p backups/gcp/postgres/$(date -u +%Y%m%dT%H%M%SZ)
```

Ví dụ backup một database:

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

Các database cần backup giống bảng phạm vi ở đầu tài liệu: `identity_db`, `user_db`, `exam_db`, `course_db`, `question_db`, `notification_db`, `analytics_db`, `simulation_db`, `media_db`, `audit_db` và `keycloak_db`.

Nếu muốn backup nhanh toàn bộ trong một lần demo, có thể lặp danh sách database:

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

### Đẩy backup lên Google Cloud Storage

Tạo bucket riêng cho backup:

```bash
gcloud storage buckets create gs://<project-id>-luyen-thi-lai-xe-backups \
  --location=asia-southeast1 \
  --uniform-bucket-level-access
```

Đẩy thư mục backup vừa tạo:

```bash
gcloud storage cp --recursive "$BACKUP_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"
```

Kiểm tra lại object:

```bash
gcloud storage ls "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/$TIMESTAMP/"
```

Với demo môn học, có thể nói rằng bản backup được tạo trong cluster, sau đó copy ra Cloud Storage để có một bản offsite không phụ thuộc vào disk của VM.

### Backup Keycloak realm trên GCP

`keycloak_db` đã được backup bằng PostgreSQL dump ở bước trên. Nếu muốn export thêm realm runtime config, có thể exec vào pod Keycloak:

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

Sau đó đẩy lên Cloud Storage:

```bash
gcloud storage cp --recursive "$EXPORT_DIR" \
  "gs://<project-id>-luyen-thi-lai-xe-backups/keycloak/staging/$TIMESTAMP/"
```

### Restore rehearsal từ backup GCP

Tải một bản backup từ Cloud Storage về máy:

```bash
gcloud storage cp \
  "gs://<project-id>-luyen-thi-lai-xe-backups/postgres/staging/<timestamp>/user-service_staging_<timestamp>.dump" \
  "backups/gcp/restore-test/user-service_staging_<timestamp>.dump"
```

Chạy restore test bằng script hiện có:

```bash
RESTORE_TEST_BACKUP_FILE=backups/gcp/restore-test/user-service_staging_<timestamp>.dump npm run db:restore:test
```

Khi demo, nên ghi lại:

- Tên bucket.
- Timestamp của backup.
- File `.dump` đã restore test.
- Kết quả `Restore completed successfully`.

### Hướng nâng cấp sau demo

Để đầy đủ hơn trên GCP, nên thêm các bước sau:

- Tạo Kubernetes `CronJob` cho PostgreSQL backup, chạy mỗi ngày và upload thẳng lên Cloud Storage.
- Tạo Kubernetes `CronJob` cho Keycloak realm export.
- Dùng Secret hoặc Workload Identity để cấp quyền ghi Cloud Storage thay vì lưu service account key trong cluster.
- Thêm lifecycle rule cho bucket, ví dụ giữ daily backup 14 ngày và weekly backup 4-8 tuần.
- Nếu chuyển PostgreSQL sang Cloud SQL, bật automated backup và point-in-time recovery, sau đó giữ script `pg_dump` như lớp backup logic/application-level.

## Restore Test

Script test restore:

```bash
npm run db:restore:test
```

Mặc định script tìm file `.dump` mới nhất trong:

```text
backups/postgres/
```

Hoặc chỉ định file cụ thể:

```bash
RESTORE_TEST_BACKUP_FILE=backups/postgres/development-local/<timestamp>/user-service_development-local_<timestamp>.dump npm run db:restore:test
```

Script sẽ:

- Tạo PostgreSQL container tạm bằng image `postgres:15-alpine`.
- Chờ DB tạm sẵn sàng.
- Chạy `pg_restore --list` để kiểm tra metadata backup.
- Restore thật vào DB tạm bằng `pg_restore`.
- Xóa container tạm sau khi test xong.

Kết quả pass của `npm run db:restore:test` là bằng chứng backup có thể dùng được ở mức kỹ thuật. Khi test production thật, nên chọn một backup mới nhất và ghi lại timestamp/file đã test trong log vận hành.
