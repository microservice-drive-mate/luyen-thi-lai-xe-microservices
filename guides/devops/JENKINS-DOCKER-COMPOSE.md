# Jenkins + GHCR + Docker Compose

Tài liệu này mô tả luồng CI/CD đã được căn chỉnh để deploy được với repo hiện tại.

## 1. Mục tiêu

- Pull Request: chạy `lint`, `check-types`, `test`, `build`
- Merge `main`: build image, push lên GHCR, deploy `staging`
- Tag release `v*`: build image, phê duyệt thủ công, deploy `production`

## 2. File liên quan

- `Jenkinsfile`
- `docker-compose.deploy.yml`
- `deploy/staging.env.example`
- `deploy/production.env.example`
- `scripts/deploy-staging.sh`
- `scripts/deploy-prod.sh`
- `scripts/deploy-compose.sh`

## 3. Jenkins cần có gì

Node/agent Jenkins cần có:

- Node.js 20+
- Docker Engine + Docker Compose plugin
- Git
- SSH client

Plugin Jenkins nên có:

- Pipeline
- Git
- Credentials Binding
- SSH Agent
- AnsiColor

`Jenkinsfile` đang dùng label `docker-node20`. Nếu agent của bạn dùng label khác, sửa lại label này.

## 4. Credentials cần tạo trong Jenkins

- `ghcr-credentials`
  - Type: Username with password
  - Username: tài khoản GitHub hoặc bot account
  - Password: GitHub Personal Access Token có quyền `write:packages`
- `deploy-ssh-key`
  - Type: SSH Username with private key
  - Private key của user deploy trên server

## 5. Chuẩn bị server staging/prod

Trên mỗi server:

1. Cài Docker Engine và Docker Compose plugin
2. Tạo thư mục deploy:

```bash
sudo mkdir -p /opt/luyen-thi-lai-xe/kong
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/consul
sudo mkdir -p /opt/luyen-thi-lai-xe/docker/keycloak
sudo chown -R deploy:deploy /opt/luyen-thi-lai-xe
```

3. Copy file env mẫu thành file thật:

```bash
cp deploy/staging.env.example /opt/luyen-thi-lai-xe/staging.env
cp deploy/production.env.example /opt/luyen-thi-lai-xe/production.env
```

4. Điền giá trị secrets thật vào file env trên server

Cần điền ít nhất:

- `POSTGRES_PASSWORD`
- `RABBITMQ_DEFAULT_PASS`
- `KEYCLOAK_DB_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_CLIENT_SECRET`
- `STORAGE_ACCOUNT_NAME`
- `STORAGE_ACCOUNT_KEY`

`IMAGE_TAG` trong file env chỉ là placeholder. Jenkins sẽ override bằng tag mới mỗi lần deploy.

## 6. Webhook và branch flow

- Bật multibranch pipeline trong Jenkins
- Nối webhook GitHub/GitLab vào Jenkins
- Quy ước:
  - PR -> chỉ verify
  - `main` -> deploy staging
  - tag `v1.0.0` -> deploy production

## 7. Các biến cần sửa trong Jenkinsfile

- `GHCR_OWNER`
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_DEPLOY_PATH`
- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_DEPLOY_PATH`

## 8. Những gì pipeline đã xử lý

Pipeline hiện tại build và push image cho 10 service:

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

Runner image của tất cả service dùng Prisma đã copy kèm thư mục `prisma/`, vì vậy `prisma migrate deploy` có thể chạy trực tiếp trên server.

## 9. Luồng deploy

Script deploy sẽ:

1. Upload `docker-compose.deploy.yml`
2. Upload `kong/kong.yaml`
3. Upload `docker/consul/init.sh`
4. Upload `docker/keycloak/realm-export.json`
5. Pull image từ GHCR
6. Start infrastructure: Postgres, RabbitMQ, Redis, Consul, Consul init, Keycloak
7. Chạy `prisma migrate deploy` cho toàn bộ 10 service có Prisma:
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
8. Start app services + Kong
9. Smoke check `health/live` và `health/ready` của từng service qua Kong

Smoke check sử dụng service-prefix route:

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

Rollback nhanh nhất:

1. Chạy lại job Jenkins với tag cũ
2. Hoặc đổi `IMAGE_TAG` trong `/opt/luyen-thi-lai-xe/production.env`
3. Chạy lại script deploy

File `.last-deployed-tag` trên server giúp biết image tag gần nhất đã deploy.

## 11. Việc nên làm tiếp sau Phase 2

- Thêm TLS/reverse proxy trước Kong nếu expose ra Internet
- Bổ sung backup Postgres và restore drill
- Thêm monitoring/alerting cho host, container, DB, RabbitMQ
- Tối ưu pipeline chỉ build service thay đổi nếu cần giảm thời gian build
