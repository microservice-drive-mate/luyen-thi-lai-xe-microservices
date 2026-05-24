# Phase 8.5-8.6 - Runbook xử lý sự cố

Tài liệu này ghi các bước xử lý khi hệ thống gặp sự cố vận hành.

## Nguyên tắc chung

- Xác định phạm vi ảnh hưởng trước khi restart hàng loạt.
- Lấy `correlationId` từ response/log nếu lỗi phát sinh từ một request cụ thể.
- Kiểm tra health endpoint, container status, logs và metrics trước khi thay đổi cấu hình.
- Không xóa backup, DLQ hoặc log khi chưa điều tra xong.
- Sau mỗi thao tác khắc phục, luôn verify lại bằng health check hoặc smoke test.

## Lệnh kiểm tra nhanh

```bash
docker compose ps
docker compose logs --tail=200 <service>
docker compose -f docker-compose.infra.yml ps
docker compose -f docker-compose.infra.yml logs --tail=200 <service>
npm run observability:smoke
npm run rabbitmq:smoke
```

## Service container bị sập

Dấu hiệu:

- `docker compose ps` thấy service `Exited` hoặc restart liên tục.
- Prometheus alert `ServiceMetricsEndpointDown`.
- Kong trả `502` hoặc `503`.

Xử lý:

1. Xem log service:

```bash
docker compose logs --tail=200 <service>
```

2. Kiểm tra phụ thuộc chính: DB, RabbitMQ, Consul, Keycloak.
3. Nếu lỗi do config, kiểm tra Consul key và biến môi trường deploy.
4. Restart service:

```bash
docker compose restart <service>
```

5. Verify:

```bash
curl http://localhost:<port>/health/live
curl http://localhost:<port>/health/ready
```

## PostgreSQL bị sập

Dấu hiệu:

- Service log có lỗi connection refused hoặc timeout tới DB.
- Health check DB không healthy.

Xử lý:

1. Kiểm tra DB container:

```bash
docker compose ps db-user
docker compose logs --tail=200 db-user
```

2. Restart DB nếu container lỗi:

```bash
docker compose restart db-user
```

3. Nếu volume hỏng hoặc mất dữ liệu, dùng backup gần nhất trong:

```text
backups/postgres/<env>/<timestamp>/
```

4. Trước khi restore production, test file backup:

```bash
RESTORE_TEST_BACKUP_FILE=<file.dump> npm run db:restore:test
```

5. Sau restore, chạy migration deploy nếu cần:

```bash
npm run db:deploy
```

## Keycloak bị sập

Dấu hiệu:

- Login/token refresh fail.
- Services báo lỗi validate JWT hoặc không gọi được Keycloak.
- `keycloak` container restart liên tục.

Xử lý:

1. Kiểm tra Keycloak và DB:

```bash
docker compose logs --tail=200 keycloak
docker compose logs --tail=200 db-keycloak
```

2. Verify Keycloak:

```bash
curl http://localhost:8080/realms/luyen-thi-lai-xe-realm/.well-known/openid-configuration
```

3. Nếu DB Keycloak lỗi, dùng backup `keycloak_*.dump`.
4. Nếu cấu hình realm bị sai, so sánh với export:

```text
backups/keycloak/<env>/<timestamp>/realm.json
```

5. Sau khi khôi phục, test login và gọi API qua Kong.

## RabbitMQ bị nghẽn hoặc DLQ tăng

Dấu hiệu:

- Alert `RabbitMqDlqHasMessages`, `RabbitMqRetryBacklogHigh`.
- Queue `.retry.*` hoặc `.dlq` tăng trong Grafana.
- Eventual consistency bị trễ.

Xử lý:

1. Mở RabbitMQ UI:

```text
http://localhost:15672
```

2. Kiểm tra queue chính, `.retry.*`, `.dlq`.
3. Xem message headers: `x-last-error`, `x-retry-count`, `x-correlation-id`.
4. Tìm log cùng `correlationId` trong Kibana.
5. Sửa lỗi code/config/data trước khi replay.
6. Replay message từ DLQ về queue chính nếu đã xử lý nguyên nhân gốc.
7. Không purge DLQ nếu chưa lưu bằng chứng sự cố.

## Consul bị sập hoặc config sai

Dấu hiệu:

- Service không load được config.
- Service dùng fallback env/default không đúng.
- Consul UI không truy cập được.

Xử lý:

1. Kiểm tra Consul:

```bash
docker compose logs --tail=200 consul
curl http://localhost:8500/v1/status/leader
```

2. Seed lại config local nếu cần:

```bash
npm run consul:seed:local
```

3. Kiểm tra key:

```bash
npm run consul:list
npm run consul:get <key>
```

4. Restart service sau khi sửa config.

## Kong/API Gateway lỗi

Dấu hiệu:

- Client không truy cập được API qua `8000`.
- Kong trả `404`, `502`, `503`.

Xử lý:

1. Kiểm tra Kong:

```bash
docker compose logs --tail=200 kong
docker compose logs --tail=200 kong-dev
```

2. Kiểm tra declarative config:

```text
kong/kong.yaml
kong/kong.dev.yaml
```

3. Restart Kong:

```bash
docker compose restart kong
```

4. Verify route bằng API health endpoint qua gateway.

## Observability stack lỗi

Dấu hiệu:

- Không thấy log trong Kibana.
- Prometheus target down.
- Grafana không hiện dashboard.
- Alertmanager không nhận alert.

Xử lý:

1. Chạy smoke test:

```bash
npm run observability:smoke
```

2. Kiểm tra logs:

```bash
docker compose logs --tail=200 prometheus
docker compose logs --tail=200 grafana
docker compose logs --tail=200 logstash
docker compose logs --tail=200 elasticsearch
```

3. Verify Prometheus target:

```text
http://localhost:9090/targets
```

4. Verify Kibana:

```text
http://localhost:5601
```

## Backup job lỗi

Dấu hiệu:

- Không có folder mới trong `backups/postgres` hoặc `backups/keycloak`.
- `postgres-backup` hoặc `keycloak-backup` restart liên tục.

Xử lý:

1. Kiểm tra logs:

```bash
docker compose logs --tail=200 postgres-backup
docker compose logs --tail=200 keycloak-backup
```

2. Chạy one-shot để tái hiện lỗi:

```bash
npm run db:backup:once
npm run keycloak:backup:once
```

3. Kiểm tra quyền ghi thư mục `backups/`.
4. Kiểm tra DB/Keycloak health.
5. Sau khi có backup mới, test restore:

```bash
npm run db:restore:test
```

## Checklist sau sự cố

- Ghi lại thời điểm bắt đầu/kết thúc sự cố.
- Ghi root cause hoặc giả thuyết root cause.
- Ghi service bị ảnh hưởng và mức độ ảnh hưởng.
- Ghi các lệnh đã chạy để khắc phục.
- Ghi backup file nếu có restore.
- Ghi `correlationId` hoặc alert name liên quan.
- Tạo task follow-up nếu cần sửa code/config lâu dài.
