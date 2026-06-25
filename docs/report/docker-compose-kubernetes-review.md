# Triển Khai Bằng Docker, Docker Compose Và Kubernetes Trong DriveMate

## 1. Mục tiêu của tài liệu

Tài liệu này tổng hợp phần **Triển khai bằng Docker và Compose** theo đề cương môn học, đồng thời đối chiếu trực tiếp với cách DriveMate đã triển khai trong codebase.

Các nội dung được trình bày gồm:

- Tạo Dockerfile hiệu quả: layer cache, multi-stage build.
- Docker Compose: gom nhiều service, network nội bộ, dependency startup.
- Quản lý volume, port, environment variables giữa container.
- Vai trò của Kubernetes orchestration.
- So sánh Docker/Compose và Kubernetes.
- Pod, Deployment, Service trong Kubernetes.

Mục tiêu không phải mô tả chung chung Docker/Kubernetes, mà là giải thích **DriveMate đã áp dụng như thế nào**, áp dụng đến đâu, và vì sao thiết kế đó phù hợp với một hệ thống microservices.

## 2. Tổng quan hiện trạng trong codebase

DriveMate hiện có các thành phần triển khai chính:

| Nhóm | File/thư mục | Vai trò |
| --- | --- | --- |
| Docker image cho service | `Dockerfile.service` | Dockerfile dùng chung cho 10 NestJS microservices thông qua build argument `SERVICE_NAME`. |
| Docker image cho migration | `Dockerfile.migration-runner` | Image riêng để chạy Prisma migration/seed trong CI/CD hoặc Kubernetes Job. |
| Tối ưu build context | `.dockerignore` | Loại bỏ `node_modules`, `.git`, docs, output build, cache khỏi Docker build context. |
| Local full stack | `docker-compose.yaml` | Chạy toàn bộ database, infra, observability và microservices bằng container. |
| Local hybrid infra | `docker-compose.infra.yml` | Chạy hạ tầng bằng Docker, còn service chạy local bằng `pnpm dev`. |
| K6/observability phụ trợ | `docker-compose.observability.yml` | Chạy InfluxDB cho performance test. |
| Kubernetes/Helm | `charts/luyen-thi-lai-xe/` | Helm chart deploy lên AKS/Kubernetes: Deployment, Service, StatefulSet, Ingress, Secret, ConfigMap, Job, HPA, NetworkPolicy. |
| Script vận hành | `package.json` | Có script `infra:up`, `infra:down`, `docker:up`, `docker:build`, `db:deploy`, `staging:start`, `staging:stop`. |

Nói ngắn gọn:

- **Docker** dùng để đóng gói từng service thành image chạy độc lập.
- **Docker Compose** dùng cho môi trường local/dev nhiều container.
- **Kubernetes + Helm** dùng cho môi trường staging/production-style trên AKS.

## 3. Dockerfile hiệu quả

### 3.1. Vì sao cần tối ưu Dockerfile?

Trong monorepo microservices, nếu mỗi service có một Dockerfile riêng và build lại toàn bộ dependencies mỗi lần, CI/CD sẽ rất chậm. DriveMate giải quyết bằng một Dockerfile dùng chung, nhận `SERVICE_NAME` để build image tương ứng.

Ví dụ khi build `identity-service`, CI/CD truyền:

```bash
docker build \
  --file Dockerfile.service \
  --build-arg SERVICE_NAME=identity-service \
  --tag ghcr.io/<owner>/luyen-thi-lai-xe-identity-service:<sha> .
```

Tương tự, cùng Dockerfile có thể build `user-service`, `course-service`, `exam-service`, v.v.

### 3.2. Multi-stage build trong `Dockerfile.service`

`Dockerfile.service` chia làm ba stage chính:

| Stage | Vai trò |
| --- | --- |
| `deps` | Cài dependencies bằng pnpm. Chỉ copy các file manifest trước để tận dụng Docker layer cache. |
| `builder` | Copy source code, generate Prisma client, build service bằng Turbo, prune production dependencies. |
| `runner` | Chỉ chứa runtime artifacts cần thiết để chạy service. |

Thiết kế này giúp:

- Cache dependency layer tốt hơn.
- Không đưa toàn bộ source/build tools dư thừa vào runtime image.
- Dùng chung một Dockerfile cho nhiều service.
- Tách rõ build-time và runtime.

Một số điểm đáng chú ý trong code:

- `COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./` được đặt trước khi copy toàn bộ source để tận dụng cache.
- `RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store,sharing=locked pnpm install --frozen-lockfile` dùng BuildKit cache cho pnpm store.
- `ARG SERVICE_NAME` giúp build đúng service trong monorepo.
- `pnpm exec turbo build --filter=${SERVICE_NAME}` chỉ build service cần thiết.
- Runtime stage chạy bằng `USER node`, hạn chế chạy app bằng root.
- Runner copy `packages/common/dist` và service artifact cần thiết thay vì giữ nguyên toàn bộ môi trường build.

### 3.3. `.dockerignore`

Repo có `.dockerignore` để giảm kích thước build context:

- Bỏ `.git`, `.github`.
- Bỏ `node_modules`.
- Bỏ `dist`, `.turbo`, `coverage`.
- Bỏ `.env`, `.env.*`.
- Bỏ docs và các file không cần cho image runtime.

Điều này giúp Docker build nhanh hơn, giảm khả năng vô tình đưa secret/local artifact vào image.

### 3.4. Migration runner image

Ngoài service image, repo có `Dockerfile.migration-runner`. Image này không chạy business API mà dùng cho tác vụ database:

- Copy Prisma schema/config của tất cả service.
- Cài `prisma`, `@prisma/client`, `tsx`, `pg`, `axios`.
- Generate Prisma client cho từng service.
- Dùng trong workflow/Kubernetes Job để chạy migration và seed.

Việc tách migration runner khỏi app image có lợi:

- App container chỉ tập trung chạy service.
- Migration chạy một lần như Job, không chạy lặp trong mỗi pod.
- Dễ kiểm soát rollout: migrate trước, rồi app pods mới start.

## 4. Docker Compose trong local development

### 4.1. Hai chế độ Compose

DriveMate có hai cách chạy local:

| Mode | File | Cách dùng | Phù hợp khi |
| --- | --- | --- | --- |
| Full container stack | `docker-compose.yaml` | Chạy database, infra, observability và 10 service bằng container. | Muốn mô phỏng gần môi trường deploy, test container image. |
| Hybrid dev mode | `docker-compose.infra.yml` + `pnpm dev` | Docker chỉ chạy infra; service chạy trực tiếp bằng Node/tsx trên máy dev. | Muốn code nhanh, hot reload, debug dễ. |

Trong `package.json`, các script hỗ trợ:

```bash
pnpm infra:up
pnpm infra:down
pnpm infra:logs
pnpm docker:up
pnpm docker:down
pnpm docker:build
pnpm dev
```

### 4.2. Docker Compose gom nhiều service

`docker-compose.yaml` mô tả gần như toàn bộ hệ thống local:

- 10 PostgreSQL database theo service: `db-identity`, `db-user`, `db-exam`, `db-course`, `db-question`, `db-notification`, `db-analytics`, `db-simulation`, `db-media`, `db-audit`.
- RabbitMQ cho async messaging.
- Redis cho cache/token blacklist.
- Consul cho centralized config.
- Keycloak và database riêng của Keycloak.
- Kong API Gateway.
- Observability stack: Elasticsearch, Logstash, Kibana, Jaeger, Prometheus, Alertmanager, Grafana.
- Mailpit cho email local.
- 10 NestJS service build từ `Dockerfile.service`.

Nhờ Compose, lập trình viên không cần cài từng phần mềm riêng trên máy. Chỉ cần Docker Desktop và một số lệnh:

```powershell
pnpm infra:up
pnpm consul:seed:local
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Hoặc chạy full container:

```powershell
pnpm docker:build
pnpm docker:up
```

### 4.3. Network nội bộ giữa container

Docker Compose tự tạo default network cho project. Các container có thể gọi nhau bằng service name:

- `identity-service` gọi PostgreSQL qua `db-identity:5432`.
- Các service gọi RabbitMQ qua `rabbitmq:5672`.
- Service đọc Consul qua `consul:8500`.
- Service dùng Redis qua `redis:6379`.
- Kong route tới service thông qua tên container hoặc `host.docker.internal` ở hybrid mode.

Ví dụ trong `docker-compose.yaml`, `exam-service` có:

```yaml
QUESTION_SERVICE_URL=http://question-service:3000
USER_SERVICE_URL=http://user-service:3000
```

Điều này thể hiện service discovery local của Docker Compose: không cần hard-code IP container, chỉ dùng tên service.

### 4.4. `depends_on` và healthcheck

Compose file không chỉ khai báo container, mà còn khai báo thứ tự phụ thuộc:

- App service chờ database healthy.
- App service chờ Consul healthy và `consul-init` chạy xong.
- App service chờ RabbitMQ/Redis healthy nếu cần.
- Keycloak chờ `db-keycloak` healthy.

Ví dụ các database dùng `pg_isready`; Redis dùng `redis-cli ping`; service app dùng endpoint `/health/ready`.

Điều này giúp local environment ổn định hơn, tránh lỗi service start quá sớm khi database hoặc message broker chưa sẵn sàng.

### 4.5. Quản lý volume

Compose dùng named volumes để giữ dữ liệu sau khi container restart:

- `db_identity_data`, `db_user_data`, `db_course_data`, ...
- `db_keycloak_data`.
- `redis_data`.
- `rabbitmq_data`.
- `elasticsearch_data`.
- `prometheus_data`.
- `grafana_data`.
- `alertmanager_data`.

Nếu chạy `docker compose down`, volume vẫn còn. Nếu muốn reset toàn bộ dữ liệu local, cần dùng:

```powershell
docker compose down -v
```

Đây là điểm quan trọng khi demo: restart container không làm mất dữ liệu, còn `down -v` là thao tác phá dữ liệu local có chủ đích.

### 4.6. Quản lý port

Compose map port container ra host để developer truy cập:

| Component | Host port | Container port | Mục đích |
| --- | --- | --- | --- |
| `identity-service` | `3001` | `3000` | Debug service trực tiếp. |
| `user-service` | `3002` | `3000` | Debug service trực tiếp. |
| `exam-service` | `3003` | `3000` | Debug service trực tiếp. |
| `course-service` | `3004` | `3000` | Debug service trực tiếp. |
| `question-service` | `3005` | `3000` | Debug service trực tiếp. |
| `notification-service` | `3006` | `3000` | Debug service trực tiếp. |
| `analytics-service` | `3007` | `3000` | Debug service trực tiếp. |
| `simulation-service` | `3008` | `3000` | Debug service trực tiếp. |
| `media-service` | `3010` | `3000` | Debug service trực tiếp. |
| `audit-service` | `3011` | `3000` | Debug service trực tiếp. |
| Kong | `8000` | `8000` | API Gateway public local. |
| Kong Admin | `8001` | `8001` | Kiểm tra cấu hình Kong. |
| Keycloak | `8080` | `8080` | Identity Provider UI/API. |
| RabbitMQ Management | `15672` | `15672` | RabbitMQ UI. |
| Consul | `8500` | `8500` | Consul UI/API. |
| Grafana | `30000` | `3000` | Dashboard UI. |
| Prometheus | `9090` | `9090` | Metrics UI. |
| Kibana | `5601` | `5601` | Log search UI. |
| Jaeger | `16686` | `16686` | Tracing UI. |

### 4.7. Quản lý env vars

Compose dùng `${VAR:-default}` để đọc biến từ môi trường host hoặc `.env` local. Ví dụ:

```yaml
POSTGRES_USER: ${POSTGRES_USER:-user}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET:-change-me}
```

Các service nhận config qua environment variables như:

- `DATABASE_URL`.
- `CONSUL_URL`.
- `RABBITMQ_URL`.
- `REDIS_URL`.
- `KEYCLOAK_AUTH_SERVER_URL`.
- `KEYCLOAK_CLIENT_SECRET`.
- `OTEL_TRACING_ENABLED`.
- `STORAGE_ACCOUNT_NAME`.
- `STORAGE_ACCOUNT_KEY`.

Ở local, đây là cách tiện cho developer. Ở Kubernetes, các biến nhạy cảm được render vào `Secret` và pod đọc qua `secretKeyRef`.

## 5. Vai trò của Kubernetes orchestration

Docker Compose phù hợp để chạy local, nhưng khi lên môi trường staging/production-style, hệ thống cần orchestration mạnh hơn. Kubernetes giải quyết các nhu cầu sau:

- Duy trì desired state: nếu pod chết, Kubernetes tạo pod mới.
- Rolling update: cập nhật version image mà không cần tắt toàn bộ hệ thống.
- Service discovery: service nội bộ gọi nhau qua Kubernetes DNS/ClusterIP.
- Load balancing nội bộ: Service phân phối traffic tới các pod matching selector.
- Health check: readiness/liveness probe quyết định pod có nhận traffic không.
- Secret/config management: tách Secret, ConfigMap khỏi image.
- Scaling: tăng/giảm replica qua Deployment hoặc HPA.
- Storage orchestration: StatefulSet/PVC cho Redis, RabbitMQ, PostgreSQL nếu chạy in-cluster.
- Network isolation: NetworkPolicy giới hạn traffic nội bộ.
- Ingress: expose public traffic qua ingress-nginx và Kong.

Trong DriveMate, Kubernetes không thay thế Docker. Kubernetes **chạy các Docker/OCI images** đã build và push lên GHCR.

## 6. Helm chart trong DriveMate

### 6.1. Vì sao dùng Helm?

Nếu viết tay YAML cho 10 service, mỗi service cần Deployment, Service, env, probes, resources, route, secret, migration dependency. Số lượng file sẽ rất lớn và dễ lệch cấu hình.

DriveMate dùng Helm chart `charts/luyen-thi-lai-xe` để:

- Dùng vòng lặp `range .Values.services` render Deployment/Service cho nhiều service.
- Đổi image tag theo Git SHA.
- Cấu hình staging/production bằng values khác nhau.
- Bật/tắt external database, Key Vault, observability, tracing.
- Render secret, configmap, jobs, ingress, network policy một cách nhất quán.

### 6.2. Các Kubernetes resource chính

| Resource | File | Vai trò |
| --- | --- | --- |
| `Deployment` | `templates/apps.yaml` | Chạy 10 NestJS microservices, rolling update, probes, resources. |
| `Service` | `templates/apps.yaml` | Tạo ClusterIP cho từng service, service discovery nội bộ. |
| `StatefulSet` | `templates/postgres.yaml`, `rabbitmq.yaml`, `redis.yaml`, `consul.yaml` | Chạy stateful dependencies khi không dùng managed/external service. |
| `Ingress` | `templates/ingress.yaml` | Expose public host vào Kong/Keycloak. |
| `ConfigMap` | `templates/configmap.yaml`, `kong.yaml`, observability templates | Lưu cấu hình không nhạy cảm, Kong declarative config, Consul seed. |
| `Secret` | `templates/secret.yaml` | Lưu password/token/storage key/image pull secret. |
| `Job` | `templates/jobs.yaml` | Chạy migration và seed config trước khi app sẵn sàng. |
| `HorizontalPodAutoscaler` | `templates/hpa.yaml` | Tự động scale service theo CPU/memory khi được bật. |
| `NetworkPolicy` | `templates/networkpolicy.yaml` | Giới hạn traffic giữa pods theo vai trò. |
| `ServiceAccount/RBAC` | `templates/rbac.yaml` | Cho init container đọc trạng thái Job migration/Consul seed. |

### 6.3. Pod, Deployment, Service trong hệ thống

#### Pod

Pod là đơn vị chạy nhỏ nhất trong Kubernetes. Trong DriveMate, mỗi pod app thường có:

- Init containers:
  - `wait-for-consul-seed`.
  - `wait-for-migrations`.
  - `wait-for-core`.
- Main container:
  - `app`, chạy image tương ứng như `luyen-thi-lai-xe-user-service:<sha>`.
- Env từ `ConfigMap` và `Secret`.
- Liveness/readiness probe.
- Resource requests/limits.

Điểm này quan trọng: app pod không start mù quáng. Nó chờ config seed, migration và core dependencies sẵn sàng.

#### Deployment

Deployment quản lý replica set của pod. Trong `apps.yaml`, mỗi service được render thành một Deployment:

- Có strategy `RollingUpdate`.
- Có `replicas` khi HPA không bật.
- Có checksum annotation cho config/secrets để rollout khi config thay đổi.
- Có resource requests/limits để scheduler biết phân bổ CPU/RAM.

Khi CI/CD deploy image tag mới, Deployment tạo pod mới và dần thay pod cũ theo rolling update.

#### Service

Service trong Kubernetes tạo endpoint ổn định cho pod. Tất cả app services trong chart dùng:

```yaml
type: ClusterIP
port: 3000
```

Ví dụ, các service nội bộ có thể gọi:

```text
http://luyen-thi-lai-xe-question-service:3000
http://luyen-thi-lai-xe-user-service:3000
```

Kubernetes Service sẽ load balance traffic đến các pod matching label selector. Nếu scale `user-service` lên 2 replicas, Service tự phân phối request đến cả hai pod.

### 6.4. Ingress và API Gateway

Public traffic trong AKS đi theo flow:

```text
Client/Frontend
  -> Azure Load Balancer
  -> ingress-nginx
  -> Kubernetes Ingress
  -> Kong Service
  -> service ClusterIP
  -> app pod
```

`templates/ingress.yaml` route:

- `apiHost` vào Kong.
- `authHost` vào Keycloak.

Kong tiếp tục route theo path như `/auth`, `/users`, `/courses`, `/admin/analytics`, v.v.

### 6.5. HPA trong chart

Chart có template `templates/hpa.yaml` dùng `autoscaling/v2`. HPA có thể scale Deployment theo:

- CPU utilization.
- Memory utilization.

Trong `values.yaml`, một số service có `hpa.enabled: true`. Trong `values-azure.example.yaml`, HPA có thể được tắt để tiết kiệm tài nguyên Azure Student.

Khi trình bày, nên nói:

> Helm chart đã hỗ trợ HPA. Tuy nhiên ở staging/student environment, nhóm có thể tắt HPA mặc định để tránh vượt tài nguyên. Khi production đủ capacity và metrics-server sẵn sàng, có thể bật HPA theo từng service.

## 7. So sánh Docker Compose và Kubernetes trong DriveMate

| Tiêu chí | Docker Compose | Kubernetes/AKS |
| --- | --- | --- |
| Mục tiêu chính | Local development, test tích hợp, dựng nhanh infra. | Staging/production-style deployment. |
| Đơn vị chạy | Container. | Pod. |
| Service discovery | Docker DNS qua service name trong default network. | Kubernetes DNS qua Service/ClusterIP. |
| Restart | `restart: unless-stopped`, container restart policy. | ReplicaSet/Deployment tự duy trì desired state. |
| Rolling update | Không phải thế mạnh chính. | Native rolling update qua Deployment. |
| Scaling | Có thể scale thủ công nhưng giới hạn. | Scale replica, HPA, node scheduling. |
| Secret/config | `.env`, environment variables, mounted config files. | ConfigMap, Secret, SecretProviderClass/Key Vault option. |
| Storage | Named volumes local. | PVC/StorageClass hoặc external managed services. |
| Network policy | Gần như không dùng cho local. | Có `NetworkPolicy` trong Helm chart. |
| Ingress/public traffic | Kong exposed qua port `8000`. | Azure LB + ingress-nginx + Ingress + Kong. |
| Phù hợp với demo | Dễ show local full-stack. | Dễ show vận hành thật: pods, services, rollout, scaling. |

Tóm lại:

- Docker Compose giúp developer có môi trường local tái lập nhanh.
- Kubernetes giúp vận hành hệ thống nhiều service ổn định hơn trên cloud.
- Hai công cụ không đối lập nhau; chúng phục vụ hai giai đoạn khác nhau của vòng đời phần mềm.

## 8. Những điểm nên nhấn mạnh khi báo cáo/phản biện

### 8.1. Vì sao không chỉ dùng Docker Compose cho production?

Docker Compose tốt cho local nhưng thiếu nhiều tính năng production-grade:

- Không có scheduler phân bổ pod trên nhiều node.
- Không có Deployment rolling update mạnh như Kubernetes.
- Không có HPA native.
- Không có Ingress ecosystem như ingress-nginx/cert-manager.
- Quản lý secret/config/network policy kém hơn Kubernetes.
- Khó vận hành nhiều môi trường staging/production tách biệt.

Vì vậy, DriveMate dùng Compose cho local và Kubernetes/AKS cho staging/production-style.

### 8.2. Vì sao không chạy tất cả database riêng như local trên AKS?

Local Docker chạy nhiều database container để minh họa database-per-service rõ ràng. Trên AKS Student, tài nguyên hạn chế nên hệ thống có thể dùng:

- External database như Neon.
- Hoặc một PostgreSQL StatefulSet tạo nhiều logical database.

Điểm quan trọng là ownership vẫn tách theo service. Không nên đánh đồng physical database container với database ownership.

### 8.3. Vì sao cần migration runner?

Nếu mỗi app pod tự chạy migration khi start, nhiều pod có thể chạy migration đồng thời. Điều này nguy hiểm khi scale replicas. Vì vậy hệ thống tách migration thành Kubernetes Job thông qua migration runner image.

Flow đúng:

```text
Helm deploy
  -> migration Job chạy trước
  -> Consul seed Job chạy trước
  -> app initContainer chờ Job complete
  -> app pods start
```

### 8.4. Vì sao cần readiness/liveness probe?

- Readiness probe quyết định pod đã sẵn sàng nhận traffic chưa.
- Liveness probe phát hiện app bị treo để Kubernetes restart.

Trong DriveMate, app expose:

- `/health/live`.
- `/health/ready`.

Helm chart dùng hai endpoint này cho Deployment.

## 9. Gợi ý minh họa khi đưa vào báo cáo

Có thể chụp các minh họa sau:

1. VS Code mở `Dockerfile.service`, highlight ba stage `deps`, `builder`, `runner`.
2. VS Code mở `docker-compose.infra.yml`, highlight các database service và named volumes.
3. Terminal chạy:

```powershell
docker compose -f docker-compose.infra.yml ps
```

4. RabbitMQ UI ở `http://localhost:15672`.
5. Consul UI ở `http://localhost:8500`.
6. Grafana ở `http://localhost:30000`.
7. VS Code mở `charts/luyen-thi-lai-xe/templates/apps.yaml`, highlight `kind: Deployment`, `kind: Service`, `readinessProbe`, `livenessProbe`.
8. k9s/Lens trên AKS, show namespace `staging`:

```powershell
kubectl get deploy,pod,svc,ingress -n staging
```

9. Demo scale:

```powershell
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=2
kubectl get pods -n staging -l app.kubernetes.io/service-name=user-service -o wide
kubectl scale deploy luyen-thi-lai-xe-user-service -n staging --replicas=1
```

## 10. Kết luận

DriveMate đã áp dụng triển khai container hóa theo đúng hướng microservices:

- Dockerfile dùng chung, multi-stage, tận dụng layer cache và BuildKit pnpm cache.
- Docker Compose dựng được local full-stack và hybrid dev environment.
- Volumes, ports, healthcheck, depends_on và env vars được cấu hình rõ cho từng container.
- Kubernetes/Helm được dùng để deploy lên AKS với Deployment, Service, StatefulSet, Ingress, Secret, ConfigMap, Job, HPA và NetworkPolicy.
- Compose phục vụ developer productivity; Kubernetes phục vụ orchestration, rollout, scaling và cloud deployment.

Điểm cần nói trung thực:

- Local Compose chạy full stack hơn AKS staging vì AKS Student bị giới hạn tài nguyên.
- HPA có template và được bật/tắt theo values; staging có thể tắt để tiết kiệm.
- External database/Neon có thể thay PostgreSQL in-cluster, nhưng không làm mất nguyên tắc tách database ownership theo service.

Thiết kế này tạo được một pipeline triển khai hợp lý: code được đóng gói thành Docker image, kiểm tra và push lên GHCR, sau đó Helm/Kubernetes kéo image đó để chạy trên AKS theo cấu hình từng môi trường.
