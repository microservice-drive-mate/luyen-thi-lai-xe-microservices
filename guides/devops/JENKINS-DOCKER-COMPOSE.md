# Jenkins + GHCR + Docker Compose

Tai lieu nay scaffold cho luong DevOps co ban nhung deploy duoc that voi repo hien tai.

## 1. Muc tieu

- Pull Request: chi chay `lint`, `check-types`, `test`, `build`
- Merge `main`: build image, push len GHCR, deploy `staging`
- Tag release `v*`: build image, approve tay, deploy `production`

## 2. File da duoc them

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
- Docker + Docker Compose plugin
- Git
- SSH client

Plugin Jenkins nen co:

- Pipeline
- Git
- Credentials Binding
- SSH Agent
- AnsiColor

Agent label trong `Jenkinsfile` dang la `docker-node20`.
Neu agent cua ban dung label khac, sua lai ngay trong `Jenkinsfile`.

## 4. Credentials can tao trong Jenkins

Tao cac credential sau:

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
2. Tao thu muc deploy, vi du:

```bash
sudo mkdir -p /opt/luyen-thi-lai-xe/kong
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
- `KEYCLOAK_DB_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_CLIENT_SECRET`

`IMAGE_TAG` trong file env chi la placeholder. Jenkins se override bang tag commit/tag release moi.

## 6. Webhook va branch flow

- Bat multibranch pipeline trong Jenkins
- Noi webhook GitHub/GitLab vao Jenkins
- Quy uoc:
  - PR -> chi verify
  - `main` -> deploy staging
  - tag `v1.0.0` -> deploy production

## 7. Cac bien can sua trong Jenkinsfile

Sua cac gia tri nay cho dung ha tang that:

- `GHCR_OWNER`
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_DEPLOY_PATH`
- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_DEPLOY_PATH`

## 8. Tai sao Dockerfile Prisma da duoc sua

Ba service:

- `identity-service`
- `user-service`
- `course-service`

da duoc copy them thu muc `prisma/` vao runner image.
Neu khong co buoc nay, lenh migrate production se fail vi container runtime khong co schema Prisma.

## 9. Cach deploy

### Deploy staging

- Merge code vao `main`
- Jenkins build image va push GHCR
- Jenkins SSH vao server staging
- Pull compose + `kong.yaml`
- Start infrastructure
- Chay `prisma migrate deploy`
- Start app services + Kong

### Deploy production

- Tao tag release, vi du `v1.0.0`
- Jenkins build image
- Cho approve tay
- Jenkins deploy len production

## 10. Rollback

Rollback nhanh nhat:

1. Chay lai job Jenkins voi tag cu
2. Hoac doi `IMAGE_TAG` trong `/opt/luyen-thi-lai-xe/production.env`
3. Chay lai script deploy

File `.last-deployed-tag` tren server giup biet ban gan nhat da deploy tag nao.

## 11. Viec nen lam tiep sau scaffold nay

- Them health endpoint `/health` cho tung service de smoke check sau deploy
- Tach backup Postgres thanh cron job rieng
- Them TLS/reverse proxy truoc Kong neu expose ra Internet
- Them monitoring va alerting
- Tach pipeline chi build service thay doi neu can toi uu thoi gian
