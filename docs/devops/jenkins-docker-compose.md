# Jenkins + GHCR + Docker Compose

TÃ i liá»‡u nÃ y mÃ´ táº£ luá»“ng CI/CD Ä‘Ã£ Ä‘Æ°á»£c cÄƒn chá»‰nh Ä‘á»ƒ triá»ƒn khai Ä‘Æ°á»£c vá»›i repo hiá»‡n táº¡i.

## 1. Má»¥c tiÃªu

- Pull Request: cháº¡y `lint`, `check-types`, `test`, `build`
- Merge `main`: build image, push lÃªn GHCR, triá»ƒn khai `staging`
- Tag release `v*`: build image, phÃª duyá»‡t thá»§ cÃ´ng, triá»ƒn khai `production`

## 2. File liÃªn quan

- `Jenkinsfile`
- `docker-compose.deploy.yml`
- `deploy/staging.env.example`
- `deploy/production.env.example`
- `scripts/deploy-staging.sh`
- `scripts/deploy-prod.sh`
- `scripts/deploy-compose.sh`
- `scripts/devops-record-deployment.js`
- `docker/logstash/logstash.conf`

## 3. Jenkins cáº§n cÃ³ gÃ¬

Node/agent Jenkins cáº§n cÃ³:

- Node.js 20+
- Docker Engine + Docker Compose plugin
- Git
- SSH client

Plugin Jenkins nÃªn cÃ³:

- Pipeline
- Git
- Credentials Binding
- SSH Agent
- AnsiColor

`Jenkinsfile` Ä‘ang dÃ¹ng label `docker-node20`. Náº¿u agent cá»§a báº¡n dÃ¹ng label khÃ¡c, sá»­a láº¡i label nÃ y.

## 4. Credentials cáº§n táº¡o trong Jenkins

- `ghcr-credentials`
  - Type: Username with password
  - Username: tÃ i khoáº£n GitHub hoáº·c bot account
  - Password: GitHub Personal Access Token cÃ³ quyá»n `write:packages`
- `deploy-ssh-key`
  - Type: SSH Username with private key
  - Private key cá»§a user deploy trÃªn server

## 5. Chuáº©n bá»‹ server staging/prod

TrÃªn má»—i server:

1. CÃ i Docker Engine vÃ  Docker Compose plugin
2. Táº¡o thÆ° má»¥c triá»ƒn khai:

```bash
sudo mkdir -p /opt/luyen-thi-lai-xe/kong
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/consul
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/keycloak
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/logstash
sudo chown -R deploy:deploy /opt/luyen-thi-lai-xe
```

3. Copy file env máº«u thÃ nh file tháº­t:

```bash
cp deploy/staging.env.example /opt/luyen-thi-lai-xe/staging.env
cp deploy/production.env.example /opt/luyen-thi-lai-xe/production.env
```

4. Äiá»n giÃ¡ trá»‹ secrets tháº­t vÃ o file env trÃªn server

Cáº§n Ä‘iá»n Ã­t nháº¥t:

- `POSTGRES_PASSWORD`
- `RABBITMQ_DEFAULT_PASS`
- `KEYCLOAK_DB_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_CLIENT_SECRET`
- `STORAGE_ACCOUNT_NAME`
- `STORAGE_ACCOUNT_KEY`

`IMAGE_TAG` trong file env chá»‰ lÃ  placeholder. Jenkins sáº½ ghi Ä‘Ã¨ báº±ng tag má»›i á»Ÿ má»—i láº§n triá»ƒn khai.

## 6. Webhook vÃ  luá»“ng branch

- Báº­t multibranch pipeline trong Jenkins
- Ná»‘i webhook GitHub/GitLab vÃ o Jenkins
- Quy Æ°á»›c:
  - PR -> chá»‰ kiá»ƒm tra
  - `main` -> triá»ƒn khai staging
  - tag `v1.0.0` -> triá»ƒn khai production

## 7. CÃ¡c biáº¿n cáº§n sá»­a trong Jenkinsfile

- `GHCR_OWNER`
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_DEPLOY_PATH`
- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_DEPLOY_PATH`

## 8. Nhá»¯ng gÃ¬ pipeline Ä‘Ã£ xá»­ lÃ½

Pipeline hiá»‡n táº¡i build vÃ  push image cho 10 service:

- `identity-service`
- `user-service`
- `exam-service`
- `course-service`
- `question-service`
- `notification-service`
- `analytics-service`
- `simulation-service`
- `media-service`
- `audit-service`

Runner image cá»§a táº¥t cáº£ service dÃ¹ng Prisma Ä‘Ã£ copy kÃ¨m thÆ° má»¥c `prisma/`, vÃ¬ váº­y `prisma migrate deploy` cÃ³ thá»ƒ cháº¡y trá»±c tiáº¿p trÃªn server.

## 9. Luá»“ng triá»ƒn khai

Script triá»ƒn khai sáº½:

1. Upload `docker-compose.deploy.yml`
2. Upload `kong/kong.yaml`
3. Upload `docker/consul/init.sh`
4. Upload `docker/keycloak/realm-export.json`
5. Upload `docker/logstash/logstash.conf`
6. Pull image tá»« GHCR
7. Khá»Ÿi Ä‘á»™ng infrastructure: Postgres, RabbitMQ, Redis, Consul, Consul init, Keycloak
8. Khá»Ÿi Ä‘á»™ng ELK: Elasticsearch, Logstash, Kibana
9. Cháº¡y `prisma migrate deploy` cho toÃ n bá»™ 10 service cÃ³ Prisma:
   - `identity-service`
   - `user-service`
   - `exam-service`
   - `course-service`
   - `question-service`
   - `notification-service`
   - `analytics-service`
   - `simulation-service`
   - `media-service`
   - `audit-service`
10. Khá»Ÿi Ä‘á»™ng app services + Kong
11. Smoke check `health/live` vÃ  `health/ready` cá»§a tá»«ng service qua Kong

Smoke check sá»­ dá»¥ng service-prefix route:

- `/identity-service`
- `/user-service`
- `/exam-service`
- `/course-service`
- `/question-service`
- `/notification-service`
- `/analytics-service`
- `/simulation-service`
- `/media-service`
- `/audit-service`

## 10. Rollback

Rollback nhanh nháº¥t:

1. Cháº¡y láº¡i job Jenkins vá»›i tag cÅ©
2. Hoáº·c Ä‘á»•i `IMAGE_TAG` trong `/opt/luyen-thi-lai-xe/production.env`
3. Cháº¡y láº¡i script triá»ƒn khai

File `.last-deployed-tag` trÃªn server giÃºp biáº¿t image tag gáº§n nháº¥t Ä‘Ã£ triá»ƒn khai.

## 11. DORA deployment event

`Jenkinsfile` ghi deployment event sau `Deploy Staging` vÃ  `Deploy Production`.

Event Ä‘Æ°á»£c lÆ°u á»Ÿ:

```text
reports/deployments/events/*.json
```

Jenkins archive cÃ¡c file nÃ y lÃ m build artifact. Khi cáº§n tÃ­nh DORA tá»« Jenkins deploy, táº£i artifact vá» vÃ  Ä‘áº·t vÃ o:

```text
reports/deployments/events/
```

Sau Ä‘Ã³ cháº¡y:

```bash
npm run dora:report
```

Chi tiáº¿t náº±m á»Ÿ `docs/devops/dora-metrics-guide.md`.

## 12. Viá»‡c nÃªn lÃ m tiáº¿p

- ThÃªm TLS/reverse proxy trÆ°á»›c Kong náº¿u expose ra Internet.
- ThÃªm Trivy image scan, secret scan, dependency audit vÃ  SBOM vÃ o pipeline trÆ°á»›c khi push/deploy image.
- Chá»‘t production deploy báº±ng immutable image tag (`IMAGE_TAG` lÃ  Git SHA hoáº·c release tag), háº¡n cháº¿ dÃ¹ng `latest`.
- Táº¡o Jenkins parameterized rollback job Ä‘á»ƒ redeploy `.last-deployed-tag` hoáº·c tag cÅ© Ä‘Æ°á»£c chá»‰ Ä‘á»‹nh.
- Äáº©y backup PostgreSQL/Keycloak ra offsite storage vÃ  ghi láº¡i restore rehearsal theo tá»«ng release lá»›n.
- Bá»• sung host/container/DB-level monitoring náº¿u mÃ´i trÆ°á»ng VM/Compute Engine legacy cáº§n quan sÃ¡t sÃ¢u hÆ¡n app metrics hiá»‡n cÃ³.
