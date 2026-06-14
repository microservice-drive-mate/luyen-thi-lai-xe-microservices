
<!-- Merged from docs/devops/incident-management-process.md -->
# Runbook xử lý sự cố

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



<!-- Merged from docs/devops/incident-management-process.md -->
# Quy trình Incident và Postmortem

Tài liệu này chuẩn hóa quy trình ghi nhận sự cố để báo cáo DORA tính được **MTTR** và **Change Failure Rate** đáng tin hơn.

Dự án đã có script tạo DORA report. Quy trình incident/postmortem bổ sung vận hành:

- Khi nào phải tạo incident.
- Cách phân loại severity.
- Label chuẩn để DORA script hiểu dữ liệu.
- Khi nào bắt buộc postmortem.
- Checklist xử lý và đóng incident.

## 1. Khi nào tạo incident

Tạo GitHub issue bằng template `Incident report` khi có một trong các trường hợp sau:

- Production hoặc staging không truy cập được qua Kong/Ingress.
- Health check, smoke test hoặc rollout fail sau deploy.
- Tỷ lệ lỗi 5xx tăng bất thường.
- Latency tăng cao làm ảnh hưởng trải nghiệm người dùng.
- RabbitMQ retry/DLQ backlog tăng và không tự hồi phục.
- Database, Keycloak, Consul, Redis hoặc RabbitMQ lỗi làm service chính không hoạt động.
- Người dùng hoặc giảng viên demo báo lỗi ảnh hưởng luồng chính.

Không cần tạo incident cho lỗi local cá nhân, lỗi format/lint trong PR hoặc pipeline fail trước khi deploy nếu không ảnh hưởng staging/production.

## 2. Severity chuẩn

| Severity | Khi dùng | Ví dụ |
| --- | --- | --- |
| `sev1` | Hệ thống ngừng phục vụ hoặc mất dữ liệu | Kong/GKE ingress down, user không thể đăng nhập toàn hệ thống |
| `sev2` | Chức năng chính lỗi, ảnh hưởng nhiều user | Không nộp được bài thi, exam-service lỗi 5xx diện rộng |
| `sev3` | Lỗi cục bộ hoặc có workaround | Một endpoint admin lỗi, retry queue tăng nhưng hệ thống vẫn phục vụ |
| `sev4` | Cảnh báo hoặc lỗi nhỏ | Alert warning, dashboard thiếu panel, log format chưa chuẩn |

Quy tắc:

- `sev1` và `sev2` bắt buộc có postmortem.
- `sev3` nên có postmortem nếu lặp lại nhiều lần hoặc liên quan deploy.
- `sev4` chỉ cần ghi chú trong incident nếu không có ảnh hưởng thật.

## 3. Label chuẩn

| Label | Ý nghĩa |
| --- | --- |
| `incident` | Issue là incident, được dùng để tính MTTR |
| `postmortem` | Issue là postmortem sau incident |
| `production` | Incident xảy ra ở production |
| `staging` | Incident xảy ra ở staging |
| `local` | Incident tái hiện ở local/dev |
| `sev1` | Sự cố nghiêm trọng nhất |
| `sev2` | Sự cố ảnh hưởng chức năng chính |
| `sev3` | Sự cố cục bộ/có workaround |
| `sev4` | Cảnh báo/lỗi nhỏ |
| `change-failure` | Deploy thành công nhưng gây lỗi runtime |
| `deploy-failure` | Deploy/smoke/health check fail |
| `rollback` | Cần rollback hoặc redeploy về tag cũ |
| `needs-postmortem` | Incident cần postmortem |

Workflow `.github/workflows/incident-labeler.yml` sẽ tự thêm phần lớn label dựa trên nội dung issue form. Nếu workflow không chạy, người tạo issue gắn label thủ công theo bảng trên.

## 4. Quy trình xử lý incident

1. Tạo issue bằng template `Incident report`.
2. Chọn đúng môi trường và severity.
3. Điền thời điểm phát hiện theo ISO 8601 nếu có thể.
4. Nếu liên quan deploy, điền Git SHA, image tag, workflow URL hoặc Jenkins build URL.
5. Nếu lỗi do deploy, tick các checkbox tương ứng:
   - Sự cố do deploy mới gây ra.
   - Cần rollback hoặc redeploy về tag cũ.
   - Smoke test hoặc health check fail sau deploy.
6. Xử lý theo runbook:
   - `docs/devops/incident-management-process.md`
   - `docs/devops/observability-runbook.md`
7. Khi hệ thống đã khôi phục, cập nhật phần mitigation/evidence nếu cần.
8. Đóng issue incident ngay khi dịch vụ đã phục hồi.
9. Nếu là `sev1` hoặc `sev2`, tạo issue `Postmortem`.
10. Chạy lại DORA report:

```bash
npm run dora:report
```

## 5. Quy trình postmortem

Postmortem không dùng để đổ lỗi cá nhân. Mục tiêu là học từ incident và giảm khả năng lặp lại.

Postmortem cần có:

- Incident liên quan.
- Timeline bắt đầu - phát hiện - khôi phục.
- Nguyên nhân gốc.
- Điều đã làm tốt.
- Điều chưa tốt.
- Action items có owner và deadline.
- Ghi chú DORA: incident có tính vào MTTR/CFR không, có rollback không.

Checklist trước khi đóng postmortem:

- [ ] Root cause rõ ràng.
- [ ] Action items có owner.
- [ ] Action items có deadline.
- [ ] Nếu do deploy, incident đã có label `change-failure` hoặc `rollback`.
- [ ] Nếu do smoke/health fail, incident đã có label `deploy-failure`.
- [ ] Runbook hoặc smoke test được cập nhật nếu thiếu.

## 6. Cách DORA script dùng dữ liệu này

Script `scripts/devops-dora-report.ts` đọc GitHub issues có label `incident`.

- MTTR = `closed_at - created_at`.
- Môi trường được suy ra từ label `production`, `staging` hoặc `local`.
- Severity được suy ra từ label `sev1`, `sev2`, `sev3`, `sev4`.
- Change Failure Rate tăng khi issue có label `change-failure`, `deploy-failure` hoặc `rollback`.

Nếu incident chưa đóng, script vẫn liệt kê nhưng chưa tính vào MTTR trung bình.

## 7. Câu nói demo

> Quy trình incident/postmortem giúp biến incident thành dữ liệu đo lường. Khi có sự cố, nhóm tạo issue theo template, workflow tự gắn label môi trường/severity/change-failure. Khi issue đóng, DORA report tính được MTTR. Nếu incident liên quan deploy hoặc rollback, report cũng phản ánh vào Change Failure Rate.


