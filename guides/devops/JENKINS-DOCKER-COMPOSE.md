# Jenkins + GHCR + Docker Compose

Tai lieu nay mo ta luong CI/CD da duoc canh chinh de deploy duoc voi repo hien tai.

## 1. Muc tieu

- Pull Request: chay `lint`, `check-types`, `test`, `build`
- Merge `main`: build image, push len GHCR, deploy `staging`
- Tag release `v*`: build image, approve tay, deploy `production`

## 2. File lien quan

- `Jenkinsfile`
- `docker-compose.deploy.yml`
- `deploy/staging.env.example`
- `deploy/production.env.example`
- `scripts/deploy-staging.sh`
- `scripts/deploy-prod.sh`
- `scripts/deploy-compose.sh`

## 3. Jenkins can co gi

Node/agent Jenkins can co:

- Node.js 20+
- Docker Engine + Docker Compose plugin
- Git
- SSH client

Plugin Jenkins nen co:

- Pipeline
- Git
- Credentials Binding
- SSH Agent
- AnsiColor

`Jenkinsfile` dang dung label `docker-node20`. Neu agent cua ban dung label khac, sua lai label nay.

## 4. Credentials can tao trong Jenkins

- `ghcr-credentials`
  - Type: Username with password
  - Username: tai khoan GitHub hoac bot account
  - Password: GitHub Personal Access Token co quyen `write:packages`
- `deploy-ssh-key`
  - Type: SSH Username with private key
  - Private key cua user deploy tren server

## 5. Chuan bi server staging/prod

Tren moi server:

1. Cai Docker Engine va Docker Compose plugin
2. Tao thu muc deploy:

```bash
sudo mkdir -p /opt/luyen-thi-lai-xe/kong
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/consul
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/keycloak
sudo chown -R deploy:deploy /opt/luyen-thi-lai-xe
```

3. Copy file env mau thanh file that:

```bash
cp deploy/staging.env.example /opt/luyen-thi-lai-xe/staging.env
cp deploy/production.env.example /opt/luyen-thi-lai-xe/production.env
```

4. Dien gia tri secrets that vao file env tren server

Can dien it nhat:

- `POSTGRES_PASSWORD`
- `RABBITMQ_DEFAULT_PASS`
- `KEYCLOAK_DB_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_CLIENT_SECRET`
- `STORAGE_ACCOUNT_NAME`
- `STORAGE_ACCOUNT_KEY`

`IMAGE_TAG` trong file env chi la placeholder. Jenkins se override bang tag moi moi lan deploy.

## 6. Webhook va branch flow

- Bat multibranch pipeline trong Jenkins
- Noi webhook GitHub/GitLab vao Jenkins
- Quy uoc:
  - PR -> chi verify
  - `main` -> deploy staging
  - tag `v1.0.0` -> deploy production

## 7. Cac bien can sua trong Jenkinsfile

- `GHCR_OWNER`
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_DEPLOY_PATH`
- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_DEPLOY_PATH`

## 8. Nhung gi pipeline da xu ly

Pipeline hien tai build va push image cho 9 service:

- `identity-service`
- `user-service`
- `exam-service`
- `course-service`
- `question-service`
- `notification-service`
- `analytics-service`
- `simulation-service`
- `media-service`

Runner image cua tat ca service dung Prisma da copy kem thu muc `prisma/`, vi vay `prisma migrate deploy` co the chay truc tiep tren server.

## 9. Luong deploy

Script deploy se:

1. Upload `docker-compose.deploy.yml`
2. Upload `kong/kong.yaml`
3. Upload `docker/consul/init.sh`
4. Upload `docker/keycloak/realm-export.json`
5. Pull image tu GHCR
6. Start infrastructure: Postgres, RabbitMQ, Redis, Consul, Consul init, Keycloak
7. Chay `prisma migrate deploy` cho toan bo 9 service co Prisma:
   - `identity-service`
   - `user-service`
   - `exam-service`
   - `course-service`
   - `question-service`
   - `notification-service`
   - `analytics-service`
   - `simulation-service`
   - `media-service`
8. Start app services + Kong
9. Smoke check `health/live` va `health/ready` cua tung service qua Kong

Smoke check su dung service-prefix route:

- `/identity-service`
- `/user-service`
- `/exam-service`
- `/course-service`
- `/question-service`
- `/notification-service`
- `/analytics-service`
- `/simulation-service`
- `/media-service`

## 10. Rollback

Rollback nhanh nhat:

1. Chay lai job Jenkins voi tag cu
2. Hoac doi `IMAGE_TAG` trong `/opt/luyen-thi-lai-xe/production.env`
3. Chay lai script deploy

File `.last-deployed-tag` tren server giup biet image tag gan nhat da deploy.

## 11. Viec nen lam tiep sau Phase 2

- Them TLS/reverse proxy truoc Kong neu expose ra Internet
- Bo sung backup Postgres va restore drill
- Them monitoring/alerting cho host, container, DB, RabbitMQ
- Toi uu pipeline chi build service thay doi neu can giam thoi gian build
