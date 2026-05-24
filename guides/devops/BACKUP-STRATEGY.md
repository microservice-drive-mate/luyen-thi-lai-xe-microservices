# Phase 8 - Backup Strategy, Keycloak Backup và Restore Test

Tài liệu này mô tả phạm vi backup, cơ chế tự động backup hằng ngày, backup Keycloak và kiểm tra restore.

## Phase 8.1 - Backup Strategy & Scope

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

## Phase 8.2 - Automated Daily Backup

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

Biến môi trường chính:

| Biến | Mặc định | Ý nghĩa |
| ---- | -------- | ------- |
| `BACKUP_ROOT` | `/backups/postgres` | Thư mục backup trong container |
| `BACKUP_RETENTION_DAYS` | `7` | Số ngày giữ backup |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Khoảng cách giữa 2 lần backup |
| `BACKUP_RUN_ONCE` | `false` | Chạy một lần rồi thoát |

Staging giữ mặc định 7 ngày. Production example đặt 14 ngày.

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

Diễn tập restore đầy đủ sẽ được xử lý ở Phase 8.4.

## Phase 8.3 - Keycloak Backup

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

## Phase 8.4 - Restore Test

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
