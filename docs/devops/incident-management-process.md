
<!-- Merged from docs/devops/incident-management-process.md -->
# Runbook xá»­ lÃ½ sá»± cá»‘

TÃ i liá»‡u nÃ y ghi cÃ¡c bÆ°á»›c xá»­ lÃ½ khi há»‡ thá»‘ng gáº·p sá»± cá»‘ váº­n hÃ nh.

## NguyÃªn táº¯c chung

- XÃ¡c Ä‘á»‹nh pháº¡m vi áº£nh hÆ°á»Ÿng trÆ°á»›c khi restart hÃ ng loáº¡t.
- Láº¥y `correlationId` tá»« response/log náº¿u lá»—i phÃ¡t sinh tá»« má»™t request cá»¥ thá»ƒ.
- Kiá»ƒm tra health endpoint, container status, logs vÃ  metrics trÆ°á»›c khi thay Ä‘á»•i cáº¥u hÃ¬nh.
- KhÃ´ng xÃ³a backup, DLQ hoáº·c log khi chÆ°a Ä‘iá»u tra xong.
- Sau má»—i thao tÃ¡c kháº¯c phá»¥c, luÃ´n verify láº¡i báº±ng health check hoáº·c smoke test.

## Lá»‡nh kiá»ƒm tra nhanh

```bash
docker compose ps
docker compose logs --tail=200 <service>
docker compose -f docker-compose.infra.yml ps
docker compose -f docker-compose.infra.yml logs --tail=200 <service>
npm run observability:smoke
npm run rabbitmq:smoke
```

## Service container bá»‹ sáº­p

Dáº¥u hiá»‡u:

- `docker compose ps` tháº¥y service `Exited` hoáº·c restart liÃªn tá»¥c.
- Prometheus alert `ServiceMetricsEndpointDown`.
- Kong tráº£ `502` hoáº·c `503`.

Xá»­ lÃ½:

1. Xem log service:

```bash
docker compose logs --tail=200 <service>
```

2. Kiá»ƒm tra phá»¥ thuá»™c chÃ­nh: DB, RabbitMQ, Consul, Keycloak.
3. Náº¿u lá»—i do config, kiá»ƒm tra Consul key vÃ  biáº¿n mÃ´i trÆ°á»ng deploy.
4. Restart service:

```bash
docker compose restart <service>
```

5. Verify:

```bash
curl http://localhost:<port>/health/live
curl http://localhost:<port>/health/ready
```

## PostgreSQL bá»‹ sáº­p

Dáº¥u hiá»‡u:

- Service log cÃ³ lá»—i connection refused hoáº·c timeout tá»›i DB.
- Health check DB khÃ´ng healthy.

Xá»­ lÃ½:

1. Kiá»ƒm tra DB container:

```bash
docker compose ps db-user
docker compose logs --tail=200 db-user
```

2. Restart DB náº¿u container lá»—i:

```bash
docker compose restart db-user
```

3. Náº¿u volume há»ng hoáº·c máº¥t dá»¯ liá»‡u, dÃ¹ng backup gáº§n nháº¥t trong:

```text
backups/postgres/<env>/<timestamp>/
```

4. TrÆ°á»›c khi restore production, test file backup:

```bash
RESTORE_TEST_BACKUP_FILE=<file.dump> npm run db:restore:test
```

5. Sau restore, cháº¡y migration deploy náº¿u cáº§n:

```bash
npm run db:deploy
```

## Keycloak bá»‹ sáº­p

Dáº¥u hiá»‡u:

- Login/token refresh fail.
- Services bÃ¡o lá»—i validate JWT hoáº·c khÃ´ng gá»i Ä‘Æ°á»£c Keycloak.
- `keycloak` container restart liÃªn tá»¥c.

Xá»­ lÃ½:

1. Kiá»ƒm tra Keycloak vÃ  DB:

```bash
docker compose logs --tail=200 keycloak
docker compose logs --tail=200 db-keycloak
```

2. Verify Keycloak:

```bash
curl http://localhost:8080/realms/luyen-thi-lai-xe-realm/.well-known/openid-configuration
```

3. Náº¿u DB Keycloak lá»—i, dÃ¹ng backup `keycloak_*.dump`.
4. Náº¿u cáº¥u hÃ¬nh realm bá»‹ sai, so sÃ¡nh vá»›i export:

```text
backups/keycloak/<env>/<timestamp>/realm.json
```

5. Sau khi khÃ´i phá»¥c, test login vÃ  gá»i API qua Kong.

## RabbitMQ bá»‹ ngháº½n hoáº·c DLQ tÄƒng

Dáº¥u hiá»‡u:

- Alert `RabbitMqDlqHasMessages`, `RabbitMqRetryBacklogHigh`.
- Queue `.retry.*` hoáº·c `.dlq` tÄƒng trong Grafana.
- Eventual consistency bá»‹ trá»….

Xá»­ lÃ½:

1. Má»Ÿ RabbitMQ UI:

```text
http://localhost:15672
```

2. Kiá»ƒm tra queue chÃ­nh, `.retry.*`, `.dlq`.
3. Xem message headers: `x-last-error`, `x-retry-count`, `x-correlation-id`.
4. TÃ¬m log cÃ¹ng `correlationId` trong Kibana.
5. Sá»­a lá»—i code/config/data trÆ°á»›c khi replay.
6. Replay message tá»« DLQ vá» queue chÃ­nh náº¿u Ä‘Ã£ xá»­ lÃ½ nguyÃªn nhÃ¢n gá»‘c.
7. KhÃ´ng purge DLQ náº¿u chÆ°a lÆ°u báº±ng chá»©ng sá»± cá»‘.

## Consul bá»‹ sáº­p hoáº·c config sai

Dáº¥u hiá»‡u:

- Service khÃ´ng load Ä‘Æ°á»£c config.
- Service dÃ¹ng fallback env/default khÃ´ng Ä‘Ãºng.
- Consul UI khÃ´ng truy cáº­p Ä‘Æ°á»£c.

Xá»­ lÃ½:

1. Kiá»ƒm tra Consul:

```bash
docker compose logs --tail=200 consul
curl http://localhost:8500/v1/status/leader
```

2. Seed láº¡i config local náº¿u cáº§n:

```bash
npm run consul:seed:local
```

3. Kiá»ƒm tra key:

```bash
npm run consul:list
npm run consul:get <key>
```

4. Restart service sau khi sá»­a config.

## Kong/API Gateway lá»—i

Dáº¥u hiá»‡u:

- Client khÃ´ng truy cáº­p Ä‘Æ°á»£c API qua `8000`.
- Kong tráº£ `404`, `502`, `503`.

Xá»­ lÃ½:

1. Kiá»ƒm tra Kong:

```bash
docker compose logs --tail=200 kong
docker compose logs --tail=200 kong-dev
```

2. Kiá»ƒm tra declarative config:

```text
kong/kong.yaml
kong/kong.dev.yaml
```

3. Restart Kong:

```bash
docker compose restart kong
```

4. Verify route báº±ng API health endpoint qua gateway.

## Observability stack lá»—i

Dáº¥u hiá»‡u:

- KhÃ´ng tháº¥y log trong Kibana.
- Prometheus target down.
- Grafana khÃ´ng hiá»‡n dashboard.
- Alertmanager khÃ´ng nháº­n alert.

Xá»­ lÃ½:

1. Cháº¡y smoke test:

```bash
npm run observability:smoke
```

2. Kiá»ƒm tra logs:

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

## Backup job lá»—i

Dáº¥u hiá»‡u:

- KhÃ´ng cÃ³ folder má»›i trong `backups/postgres` hoáº·c `backups/keycloak`.
- `postgres-backup` hoáº·c `keycloak-backup` restart liÃªn tá»¥c.

Xá»­ lÃ½:

1. Kiá»ƒm tra logs:

```bash
docker compose logs --tail=200 postgres-backup
docker compose logs --tail=200 keycloak-backup
```

2. Cháº¡y one-shot Ä‘á»ƒ tÃ¡i hiá»‡n lá»—i:

```bash
npm run db:backup:once
npm run keycloak:backup:once
```

3. Kiá»ƒm tra quyá»n ghi thÆ° má»¥c `backups/`.
4. Kiá»ƒm tra DB/Keycloak health.
5. Sau khi cÃ³ backup má»›i, test restore:

```bash
npm run db:restore:test
```

## Checklist sau sá»± cá»‘

- Ghi láº¡i thá»i Ä‘iá»ƒm báº¯t Ä‘áº§u/káº¿t thÃºc sá»± cá»‘.
- Ghi root cause hoáº·c giáº£ thuyáº¿t root cause.
- Ghi service bá»‹ áº£nh hÆ°á»Ÿng vÃ  má»©c Ä‘á»™ áº£nh hÆ°á»Ÿng.
- Ghi cÃ¡c lá»‡nh Ä‘Ã£ cháº¡y Ä‘á»ƒ kháº¯c phá»¥c.
- Ghi backup file náº¿u cÃ³ restore.
- Ghi `correlationId` hoáº·c alert name liÃªn quan.
- Táº¡o task follow-up náº¿u cáº§n sá»­a code/config lÃ¢u dÃ i.



<!-- Merged from docs/devops/incident-management-process.md -->
# Quy trÃ¬nh Incident vÃ  Postmortem

TÃ i liá»‡u nÃ y chuáº©n hÃ³a quy trÃ¬nh ghi nháº­n sá»± cá»‘ Ä‘á»ƒ bÃ¡o cÃ¡o DORA tÃ­nh Ä‘Æ°á»£c **MTTR** vÃ  **Change Failure Rate** Ä‘Ã¡ng tin hÆ¡n.

Dá»± Ã¡n Ä‘Ã£ cÃ³ script táº¡o DORA report. Quy trÃ¬nh incident/postmortem bá»• sung váº­n hÃ nh:

- Khi nÃ o pháº£i táº¡o incident.
- CÃ¡ch phÃ¢n loáº¡i severity.
- Label chuáº©n Ä‘á»ƒ DORA script hiá»ƒu dá»¯ liá»‡u.
- Khi nÃ o báº¯t buá»™c postmortem.
- Checklist xá»­ lÃ½ vÃ  Ä‘Ã³ng incident.

## 1. Khi nÃ o táº¡o incident

Táº¡o GitHub issue báº±ng template `Incident report` khi cÃ³ má»™t trong cÃ¡c trÆ°á»ng há»£p sau:

- Production hoáº·c staging khÃ´ng truy cáº­p Ä‘Æ°á»£c qua Kong/Ingress.
- Health check, smoke test hoáº·c rollout fail sau deploy.
- Tá»· lá»‡ lá»—i 5xx tÄƒng báº¥t thÆ°á»ng.
- Latency tÄƒng cao lÃ m áº£nh hÆ°á»Ÿng tráº£i nghiá»‡m ngÆ°á»i dÃ¹ng.
- RabbitMQ retry/DLQ backlog tÄƒng vÃ  khÃ´ng tá»± há»“i phá»¥c.
- Database, Keycloak, Consul, Redis hoáº·c RabbitMQ lá»—i lÃ m service chÃ­nh khÃ´ng hoáº¡t Ä‘á»™ng.
- NgÆ°á»i dÃ¹ng hoáº·c giáº£ng viÃªn demo bÃ¡o lá»—i áº£nh hÆ°á»Ÿng luá»“ng chÃ­nh.

KhÃ´ng cáº§n táº¡o incident cho lá»—i local cÃ¡ nhÃ¢n, lá»—i format/lint trong PR hoáº·c pipeline fail trÆ°á»›c khi deploy náº¿u khÃ´ng áº£nh hÆ°á»Ÿng staging/production.

## 2. Severity chuáº©n

| Severity | Khi dÃ¹ng | VÃ­ dá»¥ |
| --- | --- | --- |
| `sev1` | Há»‡ thá»‘ng ngá»«ng phá»¥c vá»¥ hoáº·c máº¥t dá»¯ liá»‡u | Kong/GKE ingress down, user khÃ´ng thá»ƒ Ä‘Äƒng nháº­p toÃ n há»‡ thá»‘ng |
| `sev2` | Chá»©c nÄƒng chÃ­nh lá»—i, áº£nh hÆ°á»Ÿng nhiá»u user | KhÃ´ng ná»™p Ä‘Æ°á»£c bÃ i thi, exam-service lá»—i 5xx diá»‡n rá»™ng |
| `sev3` | Lá»—i cá»¥c bá»™ hoáº·c cÃ³ workaround | Má»™t endpoint admin lá»—i, retry queue tÄƒng nhÆ°ng há»‡ thá»‘ng váº«n phá»¥c vá»¥ |
| `sev4` | Cáº£nh bÃ¡o hoáº·c lá»—i nhá» | Alert warning, dashboard thiáº¿u panel, log format chÆ°a chuáº©n |

Quy táº¯c:

- `sev1` vÃ  `sev2` báº¯t buá»™c cÃ³ postmortem.
- `sev3` nÃªn cÃ³ postmortem náº¿u láº·p láº¡i nhiá»u láº§n hoáº·c liÃªn quan deploy.
- `sev4` chá»‰ cáº§n ghi chÃº trong incident náº¿u khÃ´ng cÃ³ áº£nh hÆ°á»Ÿng tháº­t.

## 3. Label chuáº©n

| Label | Ã nghÄ©a |
| --- | --- |
| `incident` | Issue lÃ  incident, Ä‘Æ°á»£c dÃ¹ng Ä‘á»ƒ tÃ­nh MTTR |
| `postmortem` | Issue lÃ  postmortem sau incident |
| `production` | Incident xáº£y ra á»Ÿ production |
| `staging` | Incident xáº£y ra á»Ÿ staging |
| `local` | Incident tÃ¡i hiá»‡n á»Ÿ local/dev |
| `sev1` | Sá»± cá»‘ nghiÃªm trá»ng nháº¥t |
| `sev2` | Sá»± cá»‘ áº£nh hÆ°á»Ÿng chá»©c nÄƒng chÃ­nh |
| `sev3` | Sá»± cá»‘ cá»¥c bá»™/cÃ³ workaround |
| `sev4` | Cáº£nh bÃ¡o/lá»—i nhá» |
| `change-failure` | Deploy thÃ nh cÃ´ng nhÆ°ng gÃ¢y lá»—i runtime |
| `deploy-failure` | Deploy/smoke/health check fail |
| `rollback` | Cáº§n rollback hoáº·c redeploy vá» tag cÅ© |
| `needs-postmortem` | Incident cáº§n postmortem |

Workflow `.github/workflows/incident-labeler.yml` sáº½ tá»± thÃªm pháº§n lá»›n label dá»±a trÃªn ná»™i dung issue form. Náº¿u workflow khÃ´ng cháº¡y, ngÆ°á»i táº¡o issue gáº¯n label thá»§ cÃ´ng theo báº£ng trÃªn.

## 4. Quy trÃ¬nh xá»­ lÃ½ incident

1. Táº¡o issue báº±ng template `Incident report`.
2. Chá»n Ä‘Ãºng mÃ´i trÆ°á»ng vÃ  severity.
3. Äiá»n thá»i Ä‘iá»ƒm phÃ¡t hiá»‡n theo ISO 8601 náº¿u cÃ³ thá»ƒ.
4. Náº¿u liÃªn quan deploy, Ä‘iá»n Git SHA, image tag, workflow URL hoáº·c Jenkins build URL.
5. Náº¿u lá»—i do deploy, tick cÃ¡c checkbox tÆ°Æ¡ng á»©ng:
   - Sá»± cá»‘ do deploy má»›i gÃ¢y ra.
   - Cáº§n rollback hoáº·c redeploy vá» tag cÅ©.
   - Smoke test hoáº·c health check fail sau deploy.
6. Xá»­ lÃ½ theo runbook:
   - `docs/devops/incident-management-process.md`
   - `docs/devops/observability-runbook.md`
7. Khi há»‡ thá»‘ng Ä‘Ã£ khÃ´i phá»¥c, cáº­p nháº­t pháº§n mitigation/evidence náº¿u cáº§n.
8. ÄÃ³ng issue incident ngay khi dá»‹ch vá»¥ Ä‘Ã£ phá»¥c há»“i.
9. Náº¿u lÃ  `sev1` hoáº·c `sev2`, táº¡o issue `Postmortem`.
10. Cháº¡y láº¡i DORA report:

```bash
npm run dora:report
```

## 5. Quy trÃ¬nh postmortem

Postmortem khÃ´ng dÃ¹ng Ä‘á»ƒ Ä‘á»• lá»—i cÃ¡ nhÃ¢n. Má»¥c tiÃªu lÃ  há»c tá»« incident vÃ  giáº£m kháº£ nÄƒng láº·p láº¡i.

Postmortem cáº§n cÃ³:

- Incident liÃªn quan.
- Timeline báº¯t Ä‘áº§u - phÃ¡t hiá»‡n - khÃ´i phá»¥c.
- NguyÃªn nhÃ¢n gá»‘c.
- Äiá»u Ä‘Ã£ lÃ m tá»‘t.
- Äiá»u chÆ°a tá»‘t.
- Action items cÃ³ owner vÃ  deadline.
- Ghi chÃº DORA: incident cÃ³ tÃ­nh vÃ o MTTR/CFR khÃ´ng, cÃ³ rollback khÃ´ng.

Checklist trÆ°á»›c khi Ä‘Ã³ng postmortem:

- [ ] Root cause rÃµ rÃ ng.
- [ ] Action items cÃ³ owner.
- [ ] Action items cÃ³ deadline.
- [ ] Náº¿u do deploy, incident Ä‘Ã£ cÃ³ label `change-failure` hoáº·c `rollback`.
- [ ] Náº¿u do smoke/health fail, incident Ä‘Ã£ cÃ³ label `deploy-failure`.
- [ ] Runbook hoáº·c smoke test Ä‘Æ°á»£c cáº­p nháº­t náº¿u thiáº¿u.

## 6. CÃ¡ch DORA script dÃ¹ng dá»¯ liá»‡u nÃ y

Script `scripts/devops-dora-report.ts` Ä‘á»c GitHub issues cÃ³ label `incident`.

- MTTR = `closed_at - created_at`.
- MÃ´i trÆ°á»ng Ä‘Æ°á»£c suy ra tá»« label `production`, `staging` hoáº·c `local`.
- Severity Ä‘Æ°á»£c suy ra tá»« label `sev1`, `sev2`, `sev3`, `sev4`.
- Change Failure Rate tÄƒng khi issue cÃ³ label `change-failure`, `deploy-failure` hoáº·c `rollback`.

Náº¿u incident chÆ°a Ä‘Ã³ng, script váº«n liá»‡t kÃª nhÆ°ng chÆ°a tÃ­nh vÃ o MTTR trung bÃ¬nh.

## 7. CÃ¢u nÃ³i demo

> Quy trÃ¬nh incident/postmortem giÃºp biáº¿n incident thÃ nh dá»¯ liá»‡u Ä‘o lÆ°á»ng. Khi cÃ³ sá»± cá»‘, nhÃ³m táº¡o issue theo template, workflow tá»± gáº¯n label mÃ´i trÆ°á»ng/severity/change-failure. Khi issue Ä‘Ã³ng, DORA report tÃ­nh Ä‘Æ°á»£c MTTR. Náº¿u incident liÃªn quan deploy hoáº·c rollback, report cÅ©ng pháº£n Ã¡nh vÃ o Change Failure Rate.


