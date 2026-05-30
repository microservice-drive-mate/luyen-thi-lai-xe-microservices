# Kịch bản demo DevOps - Luyện Thi Lái Xe Microservices

Tài liệu này là kịch bản demo phần DevOps để thuyết trình với giảng viên. Mục tiêu là chứng minh dự án không chỉ chạy được ở local, mà đã có pipeline DevOps tương đối đầy đủ: container hóa, CI/CD, DevSecOps, registry, deploy lên GCP/GKE, health check, observability, resilience, backup/restore và runbook.

## 1. Mục tiêu demo

Sau buổi demo, giảng viên cần thấy rõ 6 điểm:

1. Hệ thống microservices đã được container hóa và có thể chạy nhất quán bằng Docker.
2. Mỗi lần có code mới, GitHub Actions kiểm tra chất lượng code, build image, scan bảo mật và push image lên GHCR.
3. GCP/GKE không build source code; GKE chỉ pull image đã có từ GHCR theo tag được Helm truyền vào.
4. Jenkins vẫn được giữ như pipeline CI/CD tự host cho luồng nội bộ hoặc legacy Docker Compose trên VM/Compute Engine.
5. Hệ thống có nền tảng vận hành: health check, metrics, logs, alert rules, smoke test, backup/restore.
6. Nhóm hiểu rõ phần đã làm, phần còn thiếu và hướng production hardening tiếp theo.

## 2. Thời lượng gợi ý

| Phần | Thời lượng | Nội dung chính |
| --- | ---: | --- |
| Mở bài | 1 phút | Giới thiệu vấn đề DevOps cần giải quyết. |
| Kiến trúc triển khai | 2 phút | Docker, GHCR, GitHub Actions, Jenkins, Helm, GKE. |
| Local/hybrid runtime | 3 phút | Infra Docker + services local/full Docker. |
| CI/CD + DevSecOps | 4 phút | PR validation, build image, Trivy, GHCR. |
| Jenkins CI/CD legacy | 2 phút | Self-hosted pipeline, GHCR, Docker Compose deploy qua SSH. |
| GCP/GKE deployment | 4 phút | GKE pull image từ GHCR, Helm deploy, smoke test. |
| Observability/Resilience/Backup | 4 phút | Health, metrics, logs, RabbitMQ DLQ, restore test. |
| Kết luận + Q&A | 2 phút | Đánh giá mức hoàn thành và roadmap. |

Tổng thời lượng: khoảng 22 phút. Nếu chỉ có 10-12 phút, ưu tiên mở bài, kiến trúc, CI/CD chính, GCP/GKE và kết luận; Jenkins có thể nói ngắn trong 30-45 giây như pipeline thay thế.

## 3. Chuẩn bị trước buổi demo

### 3.1. Chuẩn bị trình duyệt

Mở sẵn các tab:

- GitHub repository.
- Pull request DevOps.
- GitHub Actions:
  - `Pull Request Validation`.
  - `Main Image Release`.
  - `Production Release`.
- Jenkins nếu muốn demo pipeline tự host:
  - Job hoặc Multibranch Pipeline của repo.
  - Console output của lần build gần nhất.
- GHCR packages của các service.
- GCP Console:
  - GKE cluster.
  - Workloads.
  - Services & Ingress.
  - Logs Explorer nếu có.
- Swagger/docs hoặc Kong endpoint nếu môi trường đang chạy.

### 3.2. Chuẩn bị terminal

Mở terminal tại root repo:

```bash
cd D:/UIT/SE359/luyen-thi-lai-xe-microservices
git status --short --branch
```

Nếu demo local:

```bash
npm install
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
```

Nếu demo GKE:

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
```

### 3.3. Chuẩn bị phương án dự phòng

Nếu internet, GitHub Actions hoặc GCP gặp vấn đề:

- Dùng screenshot/video quay trước của GitHub Actions pass.
- Dùng log output đã lưu từ lần push trước.
- Demo local bằng Docker Compose.
- Mở các file cấu hình để giải thích:
  - `.github/workflows/ci.yml`
  - `.github/workflows/pr-validation.yml`
  - `Jenkinsfile`
  - `guides/devops/JENKINS-DOCKER-COMPOSE.md`
  - `charts/luyen-thi-lai-xe/values.yaml`
  - `guides/devops/GCP-SETUP.md`
  - `DEVOPS-SUMMARY.md`

## 4. Mở bài

Lời thoại gợi ý:

> Phần DevOps của dự án tập trung giải quyết 3 vấn đề chính. Thứ nhất là làm sao để 10 microservices chạy nhất quán ở local, Docker và môi trường cloud. Thứ hai là làm sao mỗi lần merge code vào `main` đều có pipeline tự động kiểm tra, build, scan bảo mật và phát hành image. Thứ ba là làm sao môi trường triển khai có health check, smoke test, quan sát hệ thống, backup và hướng rollback.

Điểm nhấn:

- Đây là hệ thống microservices nên DevOps không chỉ là “chạy được Docker”.
- DevOps phải bao gồm vòng đời: build, test, release, deploy, monitor, recover.
- Dự án đang chọn GCP/GKE làm target triển khai chính.
- Jenkins là luồng CI/CD tự host/legacy để chứng minh dự án có thể chạy được cả trong môi trường doanh nghiệp không dùng GitHub Actions.

## 5. Sơ đồ luồng DevOps

Trình bày nhanh bằng lời hoặc vẽ trên slide:

```text
Developer
  -> Pull Request
  -> GitHub Actions PR Validation
  -> Merge vào main
  -> Main Image Release
  -> Build đủ 10 production images
  -> Trivy scan
  -> Push GHCR
  -> GKE pull image từ GHCR
  -> Helm upgrade
  -> Smoke test qua Kong
  -> Observability + backup + runbook

Luồng thay thế/legacy:

Developer
  -> Jenkins Multibranch Pipeline
  -> Lint / typecheck / test / build
  -> Build & push image lên GHCR
  -> SSH vào server VM/Compute Engine
  -> Docker Compose pull image mới
  -> Smoke test qua Kong
```

Lời thoại gợi ý:

> Điểm quan trọng là GCP/GKE không build source code. Source code được build trong GitHub Actions, image được đẩy lên GHCR. Khi deploy, GKE chỉ pull image theo tag immutable, ví dụ Git SHA, sau đó Helm render Kubernetes resources và rollout bản mới.

Nếu nói thêm về Jenkins:

> Jenkins không phải đường deploy chính cho GKE trong phiên bản hiện tại. Jenkins là pipeline CI/CD tự host cho môi trường nội bộ hoặc legacy Docker Compose. Hai luồng cùng dùng chung nguyên tắc quan trọng: build image, push lên GHCR, rồi môi trường runtime chỉ pull image đã đóng gói.

## 6. Demo 1 - Local/Hybrid Runtime

Mục tiêu: chứng minh môi trường dev có thể dựng nhanh và nhất quán.

Mở file:

- `docker-compose.infra.yml`
- `docker-compose.yaml`
- `kong/kong.dev.yaml`
- `consul-seed-development-local.json`

Lệnh demo:

```bash
npm run infra:up
npm run consul:seed:local
npm run dev
```

Nếu không muốn chạy toàn bộ service, chỉ giải thích:

```bash
npm run dev --filter=user-service
```

Lời thoại gợi ý:

> Ở local, nhóm dùng hybrid mode: các service NestJS chạy local để dễ debug, còn hạ tầng như PostgreSQL, RabbitMQ, Consul, Keycloak, Kong chạy bằng Docker. Cách này giúp dev không cần cài thủ công từng dependency, nhưng vẫn có hot reload khi code.

Điểm nên nhấn:

- Có 2 mode:
  - Hybrid dev: infra Docker, service local.
  - Full Docker: toàn bộ app + infra trong container.
- Kong có config riêng cho hybrid dev và full Docker.
- Consul seed giúp config nhất quán giữa môi trường.

## 7. Demo 2 - CI/CD Và DevSecOps

Mục tiêu: chứng minh code không được merge/deploy tùy tiện.

Mở file:

- `.github/workflows/pr-validation.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/production-release.yml`

### 7.1. Pull Request Validation

Lời thoại gợi ý:

> Khi có pull request vào `main`, pipeline PR validation chạy quality gate: cài dependency, generate Prisma client, format/lint check, typecheck, test, detect service bị ảnh hưởng, build Docker image và scan Trivy. Ở PR, image chỉ build và scan, không push lên registry.

Điểm nhấn:

- PR không push image để tránh registry bị rác.
- PR thay đổi shared/devops files sẽ build/scan đủ 10 production services.
- Trivy scan fail nếu có vulnerability HIGH/CRITICAL chưa được ignore.

### 7.2. Main Image Release

Lời thoại gợi ý:

> Sau khi merge vào `main`, workflow `Main Image Release` sẽ build đủ 10 production images và `migration-runner`. Việc build đủ 10 image là có chủ ý, vì Helm release dùng cùng một `global.imageTag`, thường là `${github.sha}`. Như vậy tag đó phải tồn tại cho tất cả service images.

Mở đoạn trong `.github/workflows/ci.yml`:

```bash
rg -n "Main push uses one immutable release tag|Deploy GCP Staging|GCP_AUTO_DEPLOY_ENABLED" .github/workflows/ci.yml
```

Lời thoại tiếp:

> Sau build, workflow scan Trivy rồi push image lên GHCR với 2 tag: Git SHA và `latest`. Git SHA dùng cho staging/production vì immutable; `latest` chỉ tiện cho demo nhanh.

### 7.3. Production Release

Lời thoại gợi ý:

> Production không tự deploy mỗi lần push. Production release là manual workflow, yêu cầu nhập `image_tag` và có GitHub Environment `production` để bật reviewer/manual approval. Đây là cách giảm rủi ro khi đưa code lên production.

## 8. Demo 3 - GHCR Image Registry

Mục tiêu: chứng minh artifact đã được đóng gói và lưu ở registry.

Mở GitHub Packages/GHCR hoặc dùng lệnh:

```bash
docker pull ghcr.io/nhactaohocbai/luyen-thi-lai-xe-user-service:<tag>
docker pull ghcr.io/nhactaohocbai/luyen-thi-lai-xe-migration-runner:<tag>
```

Lời thoại gợi ý:

> Đây là artifact thật của hệ thống. GCP/GKE không lấy source code từ GitHub để chạy, mà chỉ pull image từ GHCR. Điều này làm deployment repeatable hơn: cùng một image tag thì chạy cùng một artifact.

Nếu giảng viên hỏi vì sao không dùng Google Artifact Registry:

> Hiện tại nhóm dùng GHCR vì tích hợp trực tiếp với GitHub Actions và repo. Khi production hóa sâu hơn trên GCP, có thể chuyển hoặc mirror image sang Google Artifact Registry. Tuy nhiên về mặt DevOps, nguyên tắc không đổi: build một lần, scan một lần, deploy bằng immutable image tag.

## 9. Demo 4 - Jenkins CI/CD Legacy

Mục tiêu: chứng minh dự án có thêm pipeline CI/CD tự host, phù hợp khi doanh nghiệp muốn kiểm soát runner nội bộ hoặc vẫn deploy bằng Docker Compose trên VM/Compute Engine.

Mở file:

- `Jenkinsfile`
- `guides/devops/JENKINS-DOCKER-COMPOSE.md`
- `scripts/deploy-staging.sh`
- `scripts/deploy-prod.sh`
- `scripts/deploy-compose.sh`

Lời thoại gợi ý:

> Ngoài GitHub Actions, dự án còn có `Jenkinsfile` để chạy CI/CD trên Jenkins tự host. Jenkins dùng agent label `docker-node20`, chạy `npm ci`, lint, typecheck, unit test, build workspace. Khi branch là `main` hoặc tag release, Jenkins login GHCR, build và push image của 10 service. Sau đó Jenkins deploy qua SSH bằng Docker Compose cho môi trường staging hoặc production legacy.

Các stage chính trong `Jenkinsfile`:

- `Checkout`
- `Prepare`
- `Install`
- `Lint`
- `Typecheck`
- `Unit Tests`
- `Build Workspace`
- `Docker Login`
- `Build & Push Images`
- `Deploy Staging`
- `Deploy Production`

Credentials Jenkins cần có:

- `ghcr-credentials`: GitHub username/token có quyền push/pull package.
- `deploy-ssh-key`: SSH key của user deploy trên server.

Điểm nên nhấn:

- GitHub Actions là đường chính cho GCP/GKE bằng Helm.
- Jenkins là đường thay thế cho self-hosted CI/CD hoặc legacy Docker Compose trên VM/Compute Engine.
- Cả hai đều không build source code trên server runtime; server chỉ pull image đã build từ GHCR.
- Production Jenkins có bước `input` để phê duyệt thủ công trước khi deploy tag.

Nếu muốn demo nhanh bằng terminal:

```bash
rg -n "stage\\('Checkout'\\)|stage\\('Build & Push Images'\\)|stage\\('Deploy Staging'\\)|stage\\('Deploy Production'\\)" Jenkinsfile
rg -n "ghcr-credentials|deploy-ssh-key|docker compose|IMAGE_TAG" guides/devops/JENKINS-DOCKER-COMPOSE.md
```

Nếu giảng viên hỏi Jenkins có còn phù hợp khi đã qua GCP/GKE:

> Có, nhưng vai trò khác nhau. Với target hiện tại, GitHub Actions triển khai lên GKE bằng Helm. Jenkins được giữ như pipeline tự host/legacy để deploy Docker Compose qua SSH, hoặc có thể phát triển tiếp để gọi `gcloud`, `kubectl` và `helm` nếu muốn chuyển Jenkins thành runner chính cho GKE.

## 10. Demo 5 - Deploy Lên GCP/GKE

Mục tiêu: chứng minh có Kubernetes deployment path bằng Helm.

Mở file:

- `charts/luyen-thi-lai-xe/values.yaml`
- `charts/luyen-thi-lai-xe/templates/apps.yaml`
- `charts/luyen-thi-lai-xe/templates/jobs.yaml`
- `guides/devops/GCP-SETUP.md`

Lệnh kiểm tra:

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
```

Nếu deploy thủ công từ image GHCR đã có:

```bash
helm upgrade --install luyen-thi-lai-xe charts/luyen-thi-lai-xe \
  --namespace staging \
  --create-namespace \
  --wait \
  --wait-for-jobs \
  --timeout 25m \
  -f charts/luyen-thi-lai-xe/values-staging.example.yaml \
  --set global.imageTag=<existing-ghcr-tag> \
  --set migration.imageTag=<existing-ghcr-tag>
```

Lời thoại gợi ý:

> Helm chart deploy 10 production services, Kong, Keycloak, Postgres, RabbitMQ, Redis và Consul. Mỗi app deployment có resource requests/limits, liveness probe và readiness probe. Trước khi app chạy, init containers đợi Consul seed Job và Prisma migration Job hoàn tất.

Điểm nhấn:

- `global.imageRegistry` trỏ về `ghcr.io/nhactaohocbai`.
- `global.imageTag` là tag image sẽ pull.
- `migration-runner` chạy Prisma migration ngoài runtime container.
- GKE pull image từ GHCR bằng `imagePullSecret`.
- Ingress target hiện tại là GKE Ingress class `gce`.

## 11. Demo 6 - Smoke Test Qua Kong

Mục tiêu: chứng minh sau deploy có bước xác minh runtime.

Lệnh demo:

```bash
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

Nếu demo local:

```bash
npm run smoke
```

Lời thoại gợi ý:

> Smoke test không kiểm tra quá sâu nghiệp vụ, nhưng xác nhận toàn bộ 10 production services có thể truy cập qua Kong và health endpoints phản hồi đúng. Đây là bước bắt buộc sau deploy để phát hiện lỗi rollout sớm.

## 12. Demo 7 - Observability

Mục tiêu: chứng minh hệ thống có khả năng quan sát.

Mở file:

- `docker/prometheus/prometheus.yml`
- `docker/prometheus/alerts.yml`
- `docker/grafana/provisioning/dashboards/microservices-observability.json`
- `guides/devops/OBSERVABILITY-ELK.md`
- `guides/devops/OBSERVABILITY-RUNBOOK.md`

Lệnh demo:

```bash
npm run observability:smoke
```

Nếu đang chạy local:

```bash
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready
curl http://localhost:3002/metrics
```

Lời thoại gợi ý:

> Mỗi service expose health endpoints và metrics. Prometheus scrape `/metrics`, Grafana có dashboard, alert rules theo dõi service down, 5xx rate, p95 latency, memory/CPU và RabbitMQ DLQ/retry backlog. Logs được chuẩn hóa qua Winston, correlation id và optional Logstash transport.

Điểm nhấn:

- Health check dùng cho Kubernetes probes.
- Metrics dùng cho Prometheus/Grafana.
- Logs có correlation id để trace request qua nhiều service.
- Có runbook để xử lý incident.

## 13. Demo 8 - Resilience

Mục tiêu: chứng minh hệ thống có xử lý lỗi tạm thời và message failure.

Mở file:

- `packages/common/src/http/resilient-http-client.ts`
- `packages/common/src/messaging/rabbitmq-resilience.ts`
- `guides/devops/HTTP-RESILIENCE.md`
- `guides/devops/RABBITMQ-RESILIENCE.md`

Lệnh demo:

```bash
npm run rabbitmq:smoke
```

Lời thoại gợi ý:

> Với HTTP call giữa services, common package có timeout, retry giới hạn và circuit breaker. Với RabbitMQ, queue durable, consumer dùng `noAck: false`, có retry queues với TTL backoff, DLQ và metrics cho success/retry/DLQ. Đây là nền tảng để hệ thống chịu được lỗi tạm thời thay vì fail im lặng.

Nếu giảng viên hỏi idempotency:

> Hiện tại idempotency mới là memory TTL cho baseline. Production hardening tiếp theo là chuyển idempotency store sang Redis hoặc database để durable hơn khi pod restart.

## 14. Demo 9 - Backup Và Restore

Mục tiêu: chứng minh có phương án phục hồi dữ liệu.

Mở file:

- `docker/backup/postgres-daily-backup.sh`
- `docker/keycloak/keycloak-daily-export.sh`
- `guides/devops/BACKUP-STRATEGY.md`

Lệnh demo:

```bash
npm run db:backup:once
npm run db:restore:test
npm run keycloak:backup:once
```

Lời thoại gợi ý:

> Dự án có backup PostgreSQL định kỳ, export Keycloak realm định kỳ, retention daily/weekly và restore rehearsal. Quan trọng nhất không chỉ là có file backup, mà phải có restore test để chứng minh backup dùng được.

Điểm cần nói thật:

- Hiện backup offsite/PITR chưa hoàn chỉnh.
- Roadmap GCP là đẩy backup lên Cloud Storage và cân nhắc Cloud SQL PITR.

## 15. Demo 10 - Rollback Và Release Safety

Mục tiêu: chứng minh team có suy nghĩ về rollback.

Lệnh demo:

```bash
helm history luyen-thi-lai-xe -n staging
helm rollback luyen-thi-lai-xe <revision> -n staging
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

Lời thoại gợi ý:

> Rollback bằng Helm có thể đưa Kubernetes release về revision trước, bao gồm image tag và rendered config. Tuy nhiên database migration không tự reverse, nên production cần nguyên tắc backward-compatible migration hoặc tạo migration mới để sửa dữ liệu.

## 16. Phần kết luận

Lời thoại gợi ý:

> Tổng kết lại, phần DevOps của dự án hiện đã đủ tốt cho MVP/demo trên local hoặc GCP. Nhóm đã có containerization, CI/CD, DevSecOps scan, GHCR registry, Helm/GKE deployment baseline, health checks, smoke tests, observability, resilience và backup/restore. Những phần còn thiếu như Terraform, HPA, load test, SBOM/signing, Google Secret Manager và managed database đã được ghi rõ trong roadmap, chứ không bị bỏ qua.

Nên nhấn mạnh:

- Mức sẵn sàng DevOps cho MVP: khoảng 90%.
- Production day-2 operations: khoảng 75-80%.
- Chưa claim enterprise production hoàn chỉnh.
- Team hiểu rõ trade-off giữa MVP và production hardening.

## 17. Câu hỏi giảng viên có thể hỏi

### Vì sao chọn GKE thay vì VPS?

Trả lời:

> Vì hệ thống có 10 microservices và nhiều dependency, Kubernetes giúp chuẩn hóa deployment, health check, rolling update, rollback và resource management tốt hơn. VPS/Docker Compose vẫn giữ làm fallback legacy, nhưng target chính là GKE để gần với production thực tế hơn.

### Vì sao GCP không build code trực tiếp?

Trả lời:

> Theo nguyên tắc build once, deploy many. GitHub Actions build và scan image, sau đó push lên GHCR. GKE chỉ pull image theo tag immutable. Cách này giúp artifact ổn định, dễ rollback và dễ audit.

### Vì sao vừa có GitHub Actions vừa có Jenkins?

Trả lời:

> GitHub Actions là pipeline chính cho hướng GCP/GKE hiện tại: PR validation, build/scan image, push GHCR và Helm deploy lên GKE. Jenkins được giữ như pipeline tự host/legacy cho môi trường doanh nghiệp hoặc VM/Compute Engine chạy Docker Compose. Hai pipeline không mâu thuẫn nhau; chúng chứng minh cùng một quy trình DevOps có thể chạy trên managed CI hoặc self-hosted CI.

### Nếu chỉ đổi một service, vì sao main workflow build đủ 10 images?

Trả lời:

> Helm chart hiện dùng một `global.imageTag` cho toàn bộ release. Nếu chỉ build một service với tag mới, các service còn lại sẽ không có image tag đó trên GHCR. Vì vậy khi merge vào `main`, workflow build đủ 10 production images để đảm bảo cùng một Git SHA tag tồn tại cho toàn bộ release.

### Nếu GKE không pull được image thì sao?

Trả lời:

> Thường là do GHCR package private hoặc token thiếu quyền. Dự án dùng `imagePullSecret` với `GHCR_PULL_USERNAME` và `GHCR_PULL_TOKEN`. Khi lỗi, kiểm tra pod event `ImagePullBackOff`, token `read:packages` và visibility của package.

### Nếu deploy lỗi giữa chừng thì sao?

Trả lời:

> Helm deploy có `--wait`, `--wait-for-jobs` và timeout. Nếu job migration hoặc rollout fail, workflow fail luôn. Sau đó dùng `kubectl describe`, `kubectl logs`, `helm history` để điều tra, và `helm rollback` nếu cần quay lại revision cũ.

### Vì sao chưa dùng Cloud SQL ngay?

Trả lời:

> Giai đoạn MVP ưu tiên self-contained deployment để demo end-to-end và giảm phụ thuộc cấu hình cloud. Roadmap production là chuyển Postgres sang Cloud SQL, Redis sang Memorystore, secrets sang Google Secret Manager và backup offsite/PITR.

### Hệ thống có bảo mật ở pipeline chưa?

Trả lời:

> Có baseline DevSecOps: Trivy scan image với HIGH/CRITICAL gate, hardcoded secrets được chuyển sang env/placeholder, runtime image prune dev dependencies và loại `npm/npx/corepack/yarn` để giảm CVE surface. Phần hardening tiếp theo là SBOM, Cosign signing, provenance và secret manager chính thức.

### Nếu service chết thì Kubernetes phát hiện thế nào?

Trả lời:

> Mỗi service có `/health/live` và `/health/ready`. Kubernetes dùng liveness probe để restart container nếu service không sống, readiness probe để chỉ route traffic khi service sẵn sàng. Smoke test cũng kiểm tra health endpoints qua Kong sau deploy.

### Backup có chắc restore được không?

Trả lời:

> Dự án không chỉ có backup script mà còn có `db:restore:test` để rehearsal restore. Đây là điểm quan trọng vì backup không được kiểm chứng thì chưa đủ tin cậy.

## 18. Checklist thao tác nhanh khi demo

### Nếu demo bằng local

```bash
npm run infra:up
npm run consul:seed:local
npm run db:generate
npm run db:deploy
npm run db:seed
npm run smoke
npm run observability:smoke
npm run rabbitmq:smoke
npm run db:restore:test
```

### Nếu demo bằng GKE

```bash
kubectl get nodes
kubectl get pods -n staging
kubectl get ingress -n staging
helm history luyen-thi-lai-xe -n staging
SMOKE_BASE_URL=https://api.staging.example.com bash scripts/k8s-smoke.sh
```

### Nếu demo bằng GitHub Actions

1. Mở PR và chỉ vào workflow `Pull Request Validation`.
2. Mở workflow `Main Image Release` trên push vào `main`.
3. Chỉ vào jobs:
   - Code Quality & Testing.
   - Build Services.
   - Trivy scan.
   - Push Docker Image.
   - Build Migration Runner.
   - Deploy GCP Staging.
4. Mở GHCR packages để chỉ image tags.
5. Mở GKE workloads để chỉ pods đang chạy image tag đó.

### Nếu demo bằng Jenkins

1. Mở `Jenkinsfile`.
2. Chỉ vào agent `docker-node20` và các stage lint/typecheck/test/build.
3. Chỉ vào stage `Build & Push Images` để giải thích image được push lên GHCR.
4. Chỉ vào stage `Deploy Staging` và `Deploy Production` để giải thích Docker Compose deploy qua SSH.
5. Mở `guides/devops/JENKINS-DOCKER-COMPOSE.md` để chỉ credentials `ghcr-credentials`, `deploy-ssh-key` và các script deploy.

## 19. Slide tóm tắt nên có

Slide 1 - Vấn đề:

- 10 microservices, nhiều DB/dependency.
- Cần deploy nhất quán, kiểm tra tự động, quan sát và phục hồi.

Slide 2 - Pipeline:

- PR validation.
- Main image release.
- Jenkins self-hosted CI/CD cho Docker Compose legacy.
- GHCR.
- GKE pull image.
- Helm deploy.
- Smoke test.

Slide 3 - Runtime:

- Kong, Keycloak, Consul, RabbitMQ, Redis, Postgres.
- Health/readiness/liveness.
- Migration job.

Slide 4 - Operations:

- Prometheus/Grafana/ELK.
- RabbitMQ retry/DLQ.
- Backup/restore.
- Runbooks.

Slide 5 - Roadmap:

- Terraform.
- HPA/load test.
- Google Secret Manager.
- Cloud SQL/PITR.
- SBOM/Cosign.

## 20. Kết bài ngắn gọn

> Phần DevOps của dự án đã đi từ local bootstrap đến CI/CD, image registry, GKE deployment và day-2 operations baseline. Dự án chưa claim là production enterprise hoàn chỉnh, nhưng đã có nền tảng đủ tốt cho MVP và có roadmap rõ ràng để harden lên production thật.
