# Roadmap Hoan Thien Kien Truc Microservices

Tai lieu nay la plan hanh dong cho repo hien tai de dat muc microservices chuan. Thu tu duoi day duoc xep theo uu tien thuc thi, lam tu tren xuong duoi.

Muc tieu chung:

- Moi service doc lap, de scale, de deploy.
- He thong co kha nang phuc hoi, de quan sat, de van hanh.
- Team co quy trinh ro rang de phat trien lau dai.

## Thu tu uu tien tong quan

1. P0: Core Service Foundation
2. P0: Infrastructure Foundation
3. P0: Inter-service Communication Standard
4. P1: Resiliency
5. P1: Observability
6. P1-P2: CI/CD + Containerization + Orchestration

---

## 1) Core Service Foundation (P0)

Day la nen tang cua tung service, phai xong truoc khi mo rong tinh nang.

### 1.1 Database per Service

Muc tieu:

- Moi service quan ly DB rieng, khong chia se schema.

Viec can lam:

1. Chot ORM chung cho repo (de xuat Prisma).
2. Tao migration cho tung service theo thu tu: identity -> user -> notification -> cac service con lai.
3. Them seed script cho du lieu toi thieu de test local.
4. Them volume cho cac DB trong [docker-compose.yaml](docker-compose.yaml) de tranh mat du lieu.

Cach lam chi tiet:

1. Tao folder schema/migration rieng trong tung service.
2. Them script o package.json moi service: db:migrate, db:seed, db:reset.
3. Tao endpoint health check co kiem tra ket noi DB.

Definition of Done:

- Khoi tao DB bang migration, khong tao tay.
- Restart container van giu du lieu.
- Co du lieu seed de demo va test.

### 1.2 Business Logic theo Bounded Context

Muc tieu:

- Moi service chi giai quyet mot pham vi nghiep vu ro rang.

Viec can lam:

1. Ghi ro boundary cua 8 services trong 1 bang mapping domain.
2. Tranh de service A truy cap truc tiep DB service B.
3. Dua rule domain chung vao [packages/common/src](packages/common/src) chi khi thuc su dung chung.

Cach lam chi tiet:

1. Tao tai lieu domain boundary trong [README.md](README.md).
2. Khi mo rong tinh nang, check boundary truoc khi code.

Definition of Done:

- Moi endpoint moi deu thuoc dung service owner.
- Khong co truy cap DB cheo service.

### 1.3 API Layer (REST/gRPC)

Muc tieu:

- API ro rang, version duoc, co validation.

Viec can lam:

1. Chuan hoa REST API cho tat ca service truoc, gRPC co the them sau cho internal high-throughput.
2. Them validation DTO cho input, map loi theo format thong nhat.
3. Them OpenAPI cho moi service.

Cach lam chi tiet:

1. Dinh nghia convention endpoint: /v1/<resource>.
2. Viet error response contract dung chung trong common.

Definition of Done:

- Service nao cung co swagger va input validation.
- API contract duoc version hoa.

---

## 2) Infrastructure Foundation (P0)

### 2.1 API Gateway

Hien trang:

- Da co Kong trong [kong/kong.yaml](kong/kong.yaml).

Viec can lam tiep:

1. Chuan hoa route naming va prefix version (vd /v1/auth).
2. Bat plugin auth, request id, CORS policy, rate limit theo moi truong.
3. Tach config dev/prod cho gateway.

Cach lam chi tiet:

1. Tao convention route table trong README.
2. Test route bang smoke test script sau moi thay doi Kong config.

Definition of Done:

- Tat ca request client di qua gateway.
- Co auth + rate limit + log context tai gateway.

### 2.2 Service Discovery

Hien trang:

- Dang dung static service name trong Docker network.

Viec can lam tiep:

1. Ngan han: duy tri service name naming convention de on dinh local.
2. Trung han: khi len K8s, dung service discovery native cua Kubernetes.
3. Chuan bi health/readiness endpoint de orchestration co the route dung.

Definition of Done:

- Service giao tiep qua DNS/service name, khong hardcode IP.
- Co readiness/liveness endpoint.

### 2.3 Config Management

Viec can lam:

1. Tao env template cho root va tung service.
2. Validate env luc startup (fail-fast).
3. Tach secrets khoi compose/file code.

Cach lam chi tiet:

1. Them .env.example cho tung app.
2. Dung schema validate env (zod/joi).
3. Neu deploy cloud: dua secret vao secret manager.

Definition of Done:

- Clone repo, copy env, chay duoc.
- Sai env thi service dung ngay voi loi ro rang.

---

## 3) Inter-service Communication Standard (P0)

Co 2 kenh can chuan hoa song song.

### 3.1 Synchronous (HTTP/REST, gRPC)

Viec can lam:

1. Chot service nao goi sync service nao.
2. Them timeout, retry co gioi han, va fallback.
3. Neu can hieu nang cao cho internal call, lap ke hoach gRPC cho cap service nhieu traffic.

Definition of Done:

- Co ma tran call graph giua services.
- Moi external/internal sync call deu co timeout.

### 3.2 Asynchronous (RabbitMQ)

Hien trang:

- Da co RabbitMQ va demo event identity -> notification.

Viec can lam:

1. Chuan hoa ten exchange, queue, routing key.
2. Chuan hoa event contract va version hoa payload.
3. Dua event constants vao [packages/common/src](packages/common/src).

Cach lam chi tiet:

1. Event naming format: domain.action.v1.
2. Queue naming format: service.purpose.queue.
3. Tao tai lieu event catalog (publisher, consumer, schema).

Definition of Done:

- Producer/consumer khong hardcode chuoi event tuy y.
- Event contract duoc version hoa va tai su dung duoc.

---

## 4) Resiliency (P1)

### 4.1 Circuit Breaker

Viec can lam:

1. Ap dung circuit breaker cho sync call quan trong.
2. Track trang thai open/half-open/closed qua metric.

Cach lam chi tiet:

1. Chon thu vien phu hop NestJS.
2. Cau hinh threshold theo SLA (error rate, timeout).

Definition of Done:

- Mot service bi loi khong lam sap day chuyen cac service con lai.

### 4.2 Retry Logic

Viec can lam:

1. Retry co backoff cho loi tam thoi (network timeout).
2. Khong retry vo han.
3. Cho async flow: them DLQ va xu ly poison message.

Cach lam chi tiet:

1. Sync retry toi da 2-3 lan, exponential backoff.
2. Async retry qua dead-letter exchange va TTL.

Definition of Done:

- Loi tam thoi duoc tu phuc hoi.
- Message loi duoc day vao DLQ de dieu tra.

---

## 5) Observability (P1)

### 5.1 Centralized Logging

Viec can lam:

1. Chuan hoa structured log JSON cho tat ca service.
2. Day log ve 1 he thong tap trung (ELK hoac EFK).
3. Gan correlation id cho moi request/event.

Definition of Done:

- Tim duoc log cua 1 request xuyen qua nhieu service.

### 5.2 Distributed Tracing

Viec can lam:

1. Tich hop OpenTelemetry.
2. Day trace ve Jaeger/Zipkin/Tempo.

Definition of Done:

- Xem duoc trace end-to-end tu gateway den service cuoi.

### 5.3 Metrics and Health Check

Viec can lam:

1. Export metrics cho tung service.
2. Dung Prometheus + Grafana dashboard.
3. Co endpoint /health va /ready.

Definition of Done:

- Co dashboard latency, error rate, throughput, resource usage.
- Co alert co ban khi service down hoac error dot bien.

---

## 6) CI/CD + Containerization + Orchestration (P1-P2)

### 6.1 Containerization

Hien trang:

- Da co Dockerfile cho cac service.

Viec can lam:

1. Chuan hoa Dockerfile template cho moi service moi.
2. Them security scan image (Trivy).

Definition of Done:

- Moi service build image duoc va pass security scan co ban.

### 6.2 CI Pipeline

Viec can lam:

1. Tao CI pipeline: lint -> typecheck -> test -> build.
2. Chi build service thay doi (turbo filter).
3. Luu artifact test report.

Definition of Done:

- PR fail quality gate thi khong duoc merge.

### 6.3 CD + Orchestration (Kubernetes)

Viec can lam:

1. Tao manifest Helm/Kustomize cho service deployment.
2. Cau hinh readiness/liveness probe.
3. Cau hinh HPA de auto-scale.
4. Thiet lap rollout strategy (rolling/canary).

Definition of Done:

- Co the deploy tu dong len moi truong staging.
- Co kha nang scale va rollback an toan.

---

## Ke hoach theo milestone

### Milestone 1 (2-3 tuan) - Foundation

1. Hoan thanh Config Management.
2. Hoan thanh migration + seed cho identity va user.
3. Chuan hoa API contract + event contract trong common.

### Milestone 2 (2-3 tuan) - Reliable Communication

1. Hoan thien vertical slice dang ky user -> event -> notification.
2. Them timeout/retry cho sync calls.
3. Them DLQ + idempotency cho async flow.

### Milestone 3 (2-3 tuan) - Operability

1. Trien khai logging tap trung + tracing + metrics.
2. Co dashboard va alert toi thieu.

### Milestone 4 (2-4 tuan) - Delivery at Scale

1. Hoan thien CI quality gate.
2. Chuan bi Kubernetes deployment cho staging.
3. Chot quy trinh release/rollback.

---

## Checklist lam ngay (Top 10)

1. Tao env template va env validation cho 8 services.
2. Them volume cho cac DB trong [docker-compose.yaml](docker-compose.yaml).
3. Chon ORM va tao migration dau tien cho identity-service.
4. Chot event naming convention domain.action.v1.
5. Dua constants event vao [packages/common/src](packages/common/src).
6. Them timeout cho moi HTTP call giua services.
7. Them DLQ cho queue quan trong.
8. Them request id/correlation id middleware.
9. Dung CI toi thieu lint + test + build.
10. Viet e2e test cho 1 luong nghiep vu xuyen suot qua gateway.
