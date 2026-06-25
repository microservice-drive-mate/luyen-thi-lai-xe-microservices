# Thiết Kế Và Quản Lý Cơ Sở Dữ Liệu Trong DriveMate

## 1. Mục tiêu của tài liệu

Tài liệu này tổng hợp phần **Thiết kế và quản lý cơ sở dữ liệu** theo đề cương môn học và đối chiếu trực tiếp với codebase DriveMate. Nội dung tập trung vào các ý chính:

- Database per Service.
- Eventual consistency và CAP Theorem.
- Saga Pattern.
- Outbox Pattern.
- CQRS.
- Polyglot Persistence.

Điểm quan trọng của tài liệu là phân biệt rõ phần nào hệ thống đã triển khai đầy đủ, phần nào đang triển khai ở mức "production-lite", và phần nào nên trình bày là định hướng phát triển. Khi phản biện, cách nói đúng mức sẽ thuyết phục hơn việc gán nhãn quá rộng cho những pattern chưa được triển khai hoàn chỉnh.

## 2. Đối chiếu đề cương với codebase

| Nội dung trong đề cương | Mức độ trong codebase | Kết luận nên trình bày |
| --- | --- | --- |
| Database per Service | Đã triển khai theo hướng mỗi service sở hữu database/logical schema riêng: `identity_db`, `user_db`, `course_db`, `exam_db`, `question_db`, `notification_db`, `analytics_db`, `simulation_db`, `media_db`, `audit_db`. | Đã áp dụng ở mức ownership và schema. Local Docker tách rõ nhiều database/container; AKS/Neon có thể gom physical instance để tiết kiệm chi phí nhưng vẫn giữ logical database ownership. |
| Eventual consistency | Đã triển khai qua RabbitMQ events và projection tables, đặc biệt giữa identity, user, course, exam, analytics, notification. | Đã áp dụng thực tế. Hệ thống chấp nhận dữ liệu liên service có thể trễ trong thời gian ngắn. |
| CAP Theorem | Không phải một module code cụ thể, mà là nguyên tắc thiết kế distributed system. | Có thể giải thích hệ thống ưu tiên availability và partition tolerance cho luồng cross-service, thay vì global transaction giữa nhiều database. |
| Saga Pattern | Có event choreography qua RabbitMQ, nhưng chưa có Saga Orchestrator trung tâm, saga state table hoặc compensation workflow chuẩn hóa. | Nên nói là "choreography-style saga / event choreography", chưa phải orchestrated saga đầy đủ. |
| Outbox Pattern | Có `outbox_messages` trong `user-service`, `course-service`, `exam-service`; relay publish `security.audit.recorded` sang RabbitMQ rồi `audit-service` lưu audit trail. | Đã triển khai cho audit-critical flows. Chưa mở rộng cho tất cả domain events. |
| CQRS | Có tách command/query use case và analytics read-model/projection. `analytics-service` có các bảng projection cho dashboard. | Nên nói là "CQRS-lite / projection-based read model", chưa phải CQRS + Event Sourcing đầy đủ. |
| Polyglot Persistence | Có PostgreSQL/Neon, Redis, Azure Blob Storage, Consul KV, RabbitMQ durable queues, Keycloak DB, ELK local cho log. | Đã dùng nhiều loại storage theo mục đích, nhưng domain transactional data vẫn chủ yếu là PostgreSQL. Không nên nói đang dùng MongoDB/Cassandra nếu codebase không có. |

## 3. Database per Service

### 3.1. Khái niệm

Trong kiến trúc microservices, **Database per Service** nghĩa là mỗi service sở hữu dữ liệu của chính nó. Service khác không được truy vấn trực tiếp vào database đó, không tạo foreign key cross-service và không phụ thuộc vào schema nội bộ của service khác.

Thay vì để nhiều service cùng đọc/ghi một database chung, mỗi service có ranh giới dữ liệu riêng. Khi cần dữ liệu từ service khác, hệ thống dùng:

- API contract.
- Event bất đồng bộ.
- Read model/projection nội bộ.
- ID reference dạng UUID/string thay vì foreign key vật lý.

### 3.2. Cách DriveMate áp dụng

DriveMate chia dữ liệu theo bounded context. Mỗi service có Prisma schema riêng và database/logical database riêng:

| Service | Database/logical schema | Dữ liệu chính |
| --- | --- | --- |
| `identity-service` | `identity_db` và Keycloak database | Identity user, role, trạng thái active/locked/deleted, tích hợp Keycloak. |
| `user-service` | `user_db` | Hồ sơ người dùng, thông tin học viên, hạng bằng lái, audit gán license. |
| `course-service` | `course_db` | Khóa học, lịch học, instructor assignment, course material, enrollment, student license read model. |
| `question-service` | `question_db` | Ngân hàng câu hỏi, topic, option, difficulty, license category. |
| `exam-service` | `exam_db` | Exam template, exam session, câu trả lời, snapshot đề thi, kết quả pass/fail. |
| `notification-service` | `notification_db` | In-app notification, academic warning, delivery metadata. |
| `analytics-service` | `analytics_db` | Projection/read model cho dashboard, learning progress, recent activity. |
| `simulation-service` | `simulation_db` | Maneuver, simulation session, lỗi mô phỏng. |
| `media-service` | `media_db` | Metadata file, trạng thái upload/link; file thật nằm ở Azure Blob Storage. |
| `audit-service` | `audit_db` | Centralized audit trail. |

Dấu vết trong codebase:

- Mỗi service có `apps/<service>/prisma/schema.prisma`.
- `charts/luyen-thi-lai-xe/values.yaml` và `values-azure.example.yaml` khai báo `dbName` riêng cho từng service.
- `charts/luyen-thi-lai-xe/templates/configmap.yaml` có logic tạo nhiều logical database khi không dùng external database.
- Local Docker/Consul seed cấu hình các URL như `identity_db`, `user_db`, `course_db`, `exam_db`, `analytics_db`, `audit_db`.

### 3.3. Local Docker khác AKS/Neon như thế nào?

Ở local, Docker Compose có thể chạy nhiều PostgreSQL container/database để minh họa rõ database-per-service. Điều này giúp demo ownership trực quan: mỗi service trỏ tới một DB riêng, port riêng, migration riêng.

Ở AKS Student hoặc production-lite, hệ thống có thể dùng Neon hoặc một PostgreSQL instance với nhiều logical database để tiết kiệm CPU/RAM/PVC. Đây là khác biệt về **physical deployment**, không làm mất nguyên tắc **logical ownership**:

- `user-service` vẫn chỉ quản lý `user_db`.
- `course-service` vẫn chỉ quản lý `course_db`.
- `analytics-service` vẫn chỉ quản lý `analytics_db`.
- Service không đọc thẳng bảng của service khác.

Khi thầy hỏi "nếu dùng chung một Neon project thì có còn database per service không?", câu trả lời nên là:

> Về mặt vận hành demo, nhóm tối ưu chi phí bằng cách dùng chung provider/instance. Nhưng về mặt kiến trúc, mỗi service vẫn có database/logical schema, migration và ownership riêng. Không có cross-service foreign key hoặc truy vấn trực tiếp sang schema của service khác. Với production lớn hơn, có thể tách tiếp thành managed database/credential riêng cho từng service.

## 4. Consistency và CAP Theorem

### 4.1. Consistency trong microservices

Trong một monolith dùng một database chung, ta có thể dùng transaction ACID để cập nhật nhiều bảng cùng lúc. Nhưng trong microservices, mỗi service có database riêng, nên không nên dùng distributed transaction hoặc 2-phase commit cho mọi nghiệp vụ vì:

- Coupling giữa service tăng mạnh.
- Khi một service/database chậm hoặc lỗi, toàn bộ giao dịch liên service dễ bị treo.
- Khó scale độc lập.
- Khó thay đổi schema và triển khai độc lập.

DriveMate chọn hướng:

- **Strong consistency bên trong một service**: một aggregate hoặc một use case quan trọng vẫn dùng transaction local trong database của service đó.
- **Eventual consistency giữa các service**: service publish event qua RabbitMQ; consumer cập nhật read model/projection riêng.

### 4.2. Ví dụ eventual consistency trong DriveMate

#### Tạo tài khoản

Luồng tạo user không ghi thẳng vào nhiều database trong cùng một transaction. Thay vào đó:

1. `identity-service` tạo account trên Keycloak và `identity_db`.
2. `identity-service` publish event `identity.user.created`.
3. `user-service` consume event để tạo `UserProfile` trong `user_db`.
4. `notification-service` có thể gửi welcome notification.
5. `analytics-service` cập nhật projection nếu cần.

Trong vài giây đầu sau khi tạo user, `GET /admin/users/:id` có thể chưa thấy profile ngay. Tài liệu API cũng ghi frontend nên retry ngắn vì đồng bộ qua RabbitMQ là bất đồng bộ. Đây là eventual consistency có chủ đích.

#### Gán hạng bằng lái và ghi danh khóa học

Luồng gán license cũng thể hiện ranh giới service rõ ràng:

1. `user-service` là source of truth của license tier.
2. Khi admin gán license, `user-service` publish event `user.student.license-assigned`.
3. `course-service` consume event và cập nhật local read model `student_license_profiles`.
4. Khi student enroll khóa học, `course-service` kiểm tra license từ read model nội bộ, không đọc trực tiếp `user_db`.

Ưu điểm là `course-service` không bị phụ thuộc schema của `user-service`. Hạn chế là nếu event chưa kịp consume, user có thể tạm thời chưa enroll được ngay.

#### Hoàn thành bài thi và dashboard

Khi học viên hoàn thành exam:

1. `exam-service` lưu kết quả trong `exam_db`.
2. Event `exam.session.completed` được publish qua RabbitMQ.
3. `analytics-service` consume event để cập nhật `StudentLearningProfile`, `DailyActivity`, `QuestionAccuracyTracker` và dashboard projections.

Exam result là dữ liệu nghiệp vụ chính, được commit trong `exam_db`. Dashboard có thể cập nhật trễ một chút, nhưng không làm fail luồng submit exam.

### 4.3. CAP Theorem trong bối cảnh hệ thống

CAP Theorem nói rằng trong một distributed system, khi xảy ra network partition, hệ thống không thể đồng thời đảm bảo hoàn hảo cả ba yếu tố:

- **Consistency**: mọi node luôn thấy dữ liệu mới nhất.
- **Availability**: mọi request luôn nhận response.
- **Partition Tolerance**: hệ thống vẫn vận hành khi mạng giữa các thành phần bị chia cắt.

Với microservices, partition tolerance gần như là điều bắt buộc vì các service giao tiếp qua network. DriveMate chọn cách:

- Không dùng global transaction giữa nhiều service.
- Ưu tiên local transaction trong từng service.
- Dùng RabbitMQ, retry/DLQ, idempotent handler và projection để đạt eventual consistency.

Nói ngắn gọn khi phản biện:

> Bên trong từng service, hệ thống vẫn giữ ACID transaction. Nhưng giữa các service, hệ thống ưu tiên khả năng sẵn sàng và chịu lỗi mạng, chấp nhận dữ liệu read model có thể trễ. Đây là trade-off phổ biến của microservices.

## 5. Saga Pattern

### 5.1. Saga Pattern là gì?

Saga Pattern được dùng để quản lý một business transaction trải dài qua nhiều service. Thay vì dùng một distributed transaction lớn, saga chia luồng thành nhiều local transaction. Mỗi bước commit trong database riêng của service đó, sau đó phát event hoặc command để service tiếp theo xử lý.

Có hai cách triển khai phổ biến:

| Kiểu Saga | Cách hoạt động | Ưu điểm | Hạn chế |
| --- | --- | --- | --- |
| Choreography | Các service tự publish/consume event, không có điều phối trung tâm. | Đơn giản, ít coupling ban đầu, hợp với event-driven. | Khó nhìn toàn bộ flow, compensation phân tán. |
| Orchestration | Có Saga Orchestrator điều phối từng command và compensation. | Dễ quan sát state, phù hợp flow phức tạp. | Thêm thành phần trung tâm, cần thiết kế state machine. |

### 5.2. DriveMate đang ở mức nào?

DriveMate hiện **chưa có Saga Orchestrator trung tâm**. Không thấy một service/class chuyên lưu saga state, điều phối command từng bước và chạy compensation chuẩn hóa.

Tuy nhiên, hệ thống đã có **event choreography** qua RabbitMQ. Một số flow có tính chất saga nhẹ:

- `identity.user.created` dẫn tới tạo profile, notification, analytics projection.
- `user.student.license-assigned` dẫn tới cập nhật read model bên `course-service` và dashboard bên `analytics-service`.
- `course.enrollment.created/completed/progress-reset` dẫn tới cập nhật dashboard/progress.
- `exam.session.completed` dẫn tới notification, analytics progress và pass/fail event.

Vì vậy, khi viết báo cáo nên dùng cách diễn đạt:

> Hệ thống áp dụng hướng choreography-style saga cho các luồng đồng bộ liên service qua RabbitMQ. Các service xử lý local transaction của mình và phát event cho service khác cập nhật. Tuy nhiên, hệ thống chưa triển khai Saga Orchestrator đầy đủ với persisted saga state và compensation workflow chuẩn hóa.

### 5.3. Trade-off

Ưu điểm hiện tại:

- Phù hợp với quy mô đồ án.
- Ít thêm thành phần phức tạp.
- Service vẫn độc lập.
- Dễ demo bằng RabbitMQ, logs, projection update.

Hạn chế:

- Flow nghiệp vụ phân tán ở nhiều consumer.
- Nếu có nghiệp vụ cần rollback nhiều bước, hiện chưa có compensation framework rõ ràng.
- Chưa có bảng `saga_instances` hoặc trạng thái saga để truy vết toàn bộ quy trình.

Roadmap hợp lý:

- Với nghiệp vụ đơn giản, giữ choreography.
- Với nghiệp vụ có nhiều bước quan trọng như thanh toán, hoàn tiền, ghi danh trả phí, cấp chứng chỉ, nên thêm Saga Orchestrator.
- Bổ sung durable Inbox Pattern để consumer xử lý event idempotent hơn ở cấp database.

## 6. Outbox Pattern

### 6.1. Vấn đề Outbox giải quyết

Trong microservices event-driven, có một lỗi kinh điển:

1. Service cập nhật database thành công.
2. Service chuẩn bị publish event.
3. RabbitMQ hoặc network lỗi.
4. Database đã commit nhưng event bị mất.

Nếu không có Outbox Pattern, các service khác sẽ không biết dữ liệu đã thay đổi. Điều này gây mất đồng bộ.

Outbox Pattern giải quyết bằng cách ghi event vào bảng outbox **trong cùng transaction với business data**:

```text
Business mutation + Outbox row
        |
        | same local DB transaction
        v
Commit database
        |
        v
Outbox relay đọc PENDING message
        |
        v
Publish RabbitMQ
        |
        v
Mark PUBLISHED hoặc retry/FAILED
```

### 6.2. DriveMate đã triển khai Outbox ở đâu?

Codebase có bảng `outbox_messages` và `OutboxMessageStatus` trong:

- `user-service`.
- `course-service`.
- `exam-service`.

Các service này có `AuditOutboxRelayService` để đọc outbox message và publish event `security.audit.recorded` sang RabbitMQ. `audit-service` consume event này và lưu vào `audit_db.audit_logs`.

Dấu vết quan trọng:

- `apps/user-service/prisma/schema.prisma` có `model OutboxMessage`.
- `apps/course-service/prisma/schema.prisma` có `model OutboxMessage`.
- `apps/exam-service/prisma/schema.prisma` có `model OutboxMessage`.
- `apps/*/src/infrastructure/outbox/audit-outbox-relay.service.ts` xử lý relay.
- Repository ghi outbox trong cùng Prisma transaction với nghiệp vụ, ví dụ gán license, course mutation, exam template mutation.

### 6.3. Vì sao audit dùng Outbox?

Audit là dữ liệu quan trọng vì liên quan đến truy vết bảo mật và trách nhiệm vận hành. Nếu admin gán license, sửa khóa học hoặc thay đổi exam template, hệ thống cần đảm bảo audit event không bị mất chỉ vì RabbitMQ lỗi tạm thời.

Luồng hiện tại:

```text
user/course/exam mutation
  -> ghi business record
  -> ghi user_db/course_db/exam_db.outbox_messages
  -> relay publish security.audit.recorded
  -> audit-service ghi audit_db.audit_logs
```

Cách này tốt hơn fire-and-forget trực tiếp vì event audit được lưu lại trong DB local cho đến khi publish thành công hoặc đánh dấu failed.

### 6.4. Giới hạn hiện tại

Outbox trong DriveMate hiện chưa phải "toàn hệ thống cho mọi event". Theo codebase và docs:

- Outbox tập trung vào audit-critical flows trong `user-service`, `course-service`, `exam-service`.
- Một số event khác vẫn publish trực tiếp qua RabbitMQ, ví dụ identity events, media/question events.
- Chưa thấy cơ chế CDC/Debezium để stream outbox.
- Chưa có UI/admin endpoint để replay outbox failed message.

Cách trình bày nên là:

> Hệ thống đã triển khai Transactional Outbox cho các sự kiện audit quan trọng, giúp tránh mất audit event khi RabbitMQ lỗi. Đây là nền tảng đúng; giai đoạn sau có thể mở rộng Outbox cho các domain events quan trọng khác như `exam.session.completed` hoặc `course.enrollment.created`.

## 7. CQRS và Projection Read Model

### 7.1. CQRS là gì?

CQRS là viết tắt của **Command Query Responsibility Segregation**. Ý tưởng là tách:

- **Command side**: xử lý ghi dữ liệu, validate business rule, thay đổi aggregate.
- **Query side**: tối ưu cho đọc dữ liệu, dashboard, thống kê, search, báo cáo.

CQRS không bắt buộc phải dùng Event Sourcing. Một hệ thống có thể áp dụng CQRS ở mức vừa phải bằng cách tách use case ghi/đọc và xây dựng read model riêng.

### 7.2. DriveMate áp dụng CQRS như thế nào?

DriveMate áp dụng CQRS ở mức **CQRS-lite / projection-based read model**.

Ở cấp code structure:

- Các service có `application/use-cases` riêng cho create/update/assign/submit và list/get/dashboard.
- Domain aggregate tập trung xử lý command business rule.
- Repository trả dữ liệu phục vụ query qua DTO/result riêng.

Ở cấp hệ thống:

- `analytics-service` đóng vai trò read-model service cho dashboard và learning progress.
- Service này không phải source of truth của exam/course/user, mà nhận event từ các service khác để cập nhật projection.

Trong `analytics_db`, có nhiều bảng projection:

- `student_learning_profiles`.
- `daily_activities`.
- `question_accuracy_trackers`.
- `dashboard_user_projections`.
- `dashboard_course_projections`.
- `dashboard_exam_session_projections`.
- `dashboard_recent_activity_projections`.
- `dashboard_processed_events`.
- `instructor_course_projections`.
- `instructor_enrollment_projections`.
- `instructor_schedule_projections`.
- `instructor_exam_session_projections`.
- `instructor_topic_attempt_projections`.

Các event mà `analytics-service` consume gồm:

- `identity.user.created/updated/deleted/role-changed/locked`.
- `user.student.license-assigned`.
- `exam.session.completed`.
- `course.created/updated/archived`.
- `course.schedule.created/updated/deleted`.
- `course.enrollment.created/completed/progress-reset`.
- `course.lesson.completed`.
- `security.audit.recorded`.

### 7.3. Vì sao cần read model riêng?

Nếu dashboard admin hoặc instructor query trực tiếp từ `exam_db`, `course_db`, `user_db` và join dữ liệu liên service, hệ thống sẽ vi phạm database ownership. Ngoài ra, query dashboard thường cần tổng hợp nhiều nguồn dữ liệu, nếu làm trực tiếp trên request path sẽ nặng và coupling cao.

Read model giúp:

- Tối ưu response dashboard.
- Tránh cross-service join.
- Giảm tải cho transactional database.
- Cho phép dashboard chậm một chút mà không ảnh hưởng nghiệp vụ chính.
- Cache bằng Redis cho các endpoint đọc nhiều.

### 7.4. Giới hạn hiện tại

Không nên nói DriveMate đã có CQRS đầy đủ theo nghĩa enterprise/Event Sourcing. Hiện tại:

- Chưa có event store làm source of truth.
- Chưa rebuild toàn bộ state từ event stream.
- Projection chủ yếu phục vụ analytics/dashboard.
- Command và query vẫn nằm trong cùng service ở một số bounded context.

Cách nói chuẩn:

> Hệ thống áp dụng CQRS ở mức thực dụng: tách command/query use case trong từng service và dùng `analytics-service` làm projection-based read model cho dashboard. Hệ thống chưa triển khai Event Sourcing đầy đủ.

## 8. Polyglot Persistence

### 8.1. Khái niệm

Polyglot Persistence là cách chọn nhiều loại storage khác nhau tùy theo đặc điểm dữ liệu. Không phải dữ liệu nào cũng nên lưu vào cùng một database quan hệ.

Ví dụ:

- Dữ liệu giao dịch cần ACID: relational database.
- Cache/session/token blacklist: Redis.
- File binary: object storage.
- Event/message: message broker.
- Config động: key-value store.
- Log/search: Elasticsearch.

### 8.2. DriveMate đang dùng các loại storage nào?

| Storage | Vai trò trong hệ thống |
| --- | --- |
| PostgreSQL/Neon | Dữ liệu nghiệp vụ transactional của các service: user, course, exam, question, notification, analytics, simulation, media metadata, audit. |
| Redis | Cache-aside cho read-heavy endpoint, token blacklist/session revocation, Socket.IO adapter/multi-instance support. |
| Azure Blob Storage | Lưu file/media thật; `media-service` chỉ lưu metadata trong `media_db` và cấp SAS URL/direct upload. |
| Consul KV | Centralized configuration theo môi trường/service. Không dùng để lưu secret nhạy cảm. |
| RabbitMQ | Message broker cho event-driven integration, retry/DLQ, communication giữa services. |
| Keycloak database | Dữ liệu nội bộ của Identity Provider: realm/user/session/client configuration. |
| Elasticsearch/Kibana/Logstash | Local observability/log search stack, dùng để demo log tập trung; không phải domain transactional storage. |
| Azure Key Vault/Kubernetes Secret | Quản lý secret/config nhạy cảm ở deployment layer, không phải domain database. |

### 8.3. Polyglot ở mức nào?

DriveMate có sử dụng nhiều loại persistence theo mục đích, nhưng cần nói cẩn thận:

- Domain transactional data vẫn chủ yếu dùng PostgreSQL.
- Redis dùng cho cache/session/token blacklist, không phải source of truth nghiệp vụ.
- Azure Blob dùng cho binary object, còn metadata vẫn ở PostgreSQL.
- Consul KV dùng cho config, không thay thế database nghiệp vụ.
- RabbitMQ là message broker có durable queue, nhưng không dùng như query database.

Vì vậy, cách diễn đạt tốt là:

> Hệ thống áp dụng polyglot persistence ở mức thực dụng: PostgreSQL/Neon cho dữ liệu nghiệp vụ, Redis cho cache/token blacklist, Azure Blob cho media object, Consul KV cho cấu hình, RabbitMQ cho message durability và ELK cho log search. Hệ thống chưa dùng nhiều database engine domain như MongoDB/Cassandra vì bài toán hiện tại vẫn phù hợp với PostgreSQL và DDD aggregate.

## 9. Một số flow tổng hợp để demo/phản biện

### 9.1. Flow tạo học viên

```text
Admin UI
  -> Kong Gateway
  -> identity-service
  -> Keycloak + identity_db
  -> publish identity.user.created
  -> user-service creates UserProfile in user_db
  -> notification-service sends welcome notification
  -> analytics-service updates dashboard projection
```

Pattern thể hiện:

- Database per service: identity và user không cùng ghi một DB.
- Eventual consistency: profile xuất hiện sau khi event được consume.
- Choreography: service phản ứng theo event.
- CQRS projection: analytics dashboard cập nhật read model riêng.

### 9.2. Flow gán hạng bằng lái

```text
Admin assigns license
  -> user-service validates and updates user_db
  -> write audit outbox in same transaction
  -> publish user.student.license-assigned
  -> course-service updates student_license_profiles read model
  -> analytics-service updates dashboard projection
  -> audit outbox relay publishes security.audit.recorded
  -> audit-service stores audit_db.audit_logs
```

Pattern thể hiện:

- Local ACID transaction trong `user_db`.
- Outbox Pattern cho audit event.
- Eventual consistency sang `course_db` và `analytics_db`.
- Không cross-database join.

### 9.3. Flow hoàn thành bài thi

```text
Student submits exam
  -> exam-service commits ExamSession result in exam_db
  -> publish exam.session.completed
  -> analytics-service updates learning progress and dashboard projections
  -> notification-service sends pass/fail notification
```

Pattern thể hiện:

- `exam_db` là source of truth của kết quả thi.
- Dashboard là read model, có thể cập nhật trễ.
- Notification là async side effect.
- Submit exam không phụ thuộc dashboard phải cập nhật ngay.

## 10. Các câu hỏi phản biện thường gặp

### 10.1. Nếu dùng Neon chung thì có còn Database per Service không?

Có, nếu xét theo ownership và logical database/schema. Trong đồ án, mỗi service vẫn có Prisma schema, migration và database name riêng. Service không truy vấn trực tiếp database của service khác. Việc dùng chung Neon project/instance là tối ưu chi phí cho demo và Azure Student, không phải shared database theo nghĩa nhiều service dùng chung bảng.

Nếu production scale lớn hơn, có thể tách tiếp thành:

- Database instance riêng cho từng bounded context quan trọng.
- Credential riêng theo service.
- Network/private endpoint riêng.
- Backup/retention riêng theo criticality.

### 10.2. Vì sao không dùng foreign key giữa `course_db.studentId` và `user_db.users.id`?

Vì foreign key cross-service làm phá vỡ ownership. Nếu `course-service` phụ thuộc trực tiếp vào bảng user, khi `user-service` đổi schema hoặc migration, `course-service` có thể vỡ theo. Hệ thống chỉ lưu `studentId` dạng identifier và đồng bộ thông tin cần thiết qua event hoặc API.

### 10.3. Có phải hệ thống đã triển khai Saga đầy đủ chưa?

Chưa theo nghĩa orchestrated saga đầy đủ. Hệ thống hiện dùng choreography qua event RabbitMQ. Đây là một cách tiếp cận saga nhẹ, phù hợp với đồ án và các flow hiện tại. Nếu cần xử lý payment/enrollment/refund nhiều bước, nên bổ sung Saga Orchestrator có persisted state và compensation.

### 10.4. Outbox đã áp dụng cho mọi event chưa?

Chưa. Outbox hiện tập trung cho audit-critical events trong `user-service`, `course-service`, `exam-service`. Đây là phần đã làm đúng và có giá trị. Roadmap là mở rộng Outbox cho các domain event quan trọng như exam completed, enrollment created/completed, hoặc dùng CDC/Debezium để stream outbox hiệu quả hơn.

### 10.5. CQRS ở đây có phải Event Sourcing không?

Không. CQRS là tách command và query; Event Sourcing là lưu event làm source of truth. DriveMate có projection/read model trong `analytics-service`, nhưng source of truth vẫn là PostgreSQL tables của từng service, không phải event store.

### 10.6. Polyglot Persistence có bắt buộc phải dùng nhiều database engine cho domain không?

Không bắt buộc. Polyglot Persistence nghĩa là chọn storage phù hợp theo nhu cầu. Với DriveMate, PostgreSQL đủ tốt cho dữ liệu nghiệp vụ có quan hệ và cần transaction. Redis, Azure Blob, Consul KV, RabbitMQ và ELK được dùng cho các loại dữ liệu/hạ tầng khác nhau.

## 11. Hạn chế hiện tại và hướng phát triển

### 11.1. Durable Inbox Pattern

Consumer hiện có nhiều handler idempotent/upsert và có retry/DLQ qua RabbitMQ, nhưng chưa thấy một Inbox Pattern chuẩn hóa ở mọi service. Inbox Pattern sẽ lưu event đã xử lý vào database consumer để chống duplicate ở mức bền vững hơn.

Roadmap:

- Thêm bảng `inbox_messages` hoặc `processed_events` cho các consumer quan trọng.
- Dùng `eventId` unique để đảm bảo exactly-once effect ở tầng business.
- Có job cleanup event cũ.

### 11.2. Mở rộng Outbox

Outbox nên được mở rộng cho các domain event quan trọng hơn:

- `exam.session.completed`.
- `course.enrollment.created`.
- `course.enrollment.completed`.
- `identity.user.created/updated/deleted` nếu cần đảm bảo không mất event đồng bộ user/profile.

Với quy mô lớn hơn, có thể dùng CDC/Debezium để đọc outbox table thay vì relay polling trong app.

### 11.3. Saga Orchestrator cho flow phức tạp

Nếu hệ thống có thanh toán hoặc cấp chứng chỉ, nên thiết kế Saga Orchestrator:

```text
Create enrollment
  -> reserve seat
  -> charge payment
  -> activate enrollment
  -> send confirmation
```

Nếu một bước lỗi, orchestrator điều phối compensation:

- Release seat.
- Refund payment.
- Mark enrollment failed/cancelled.
- Notify user/admin.

### 11.4. Tách managed database production

Production tương lai có thể nâng cấp từ logical database chung sang:

- Managed PostgreSQL instance riêng cho các bounded context quan trọng.
- Separate credentials per service.
- Private networking.
- Backup/restore policy riêng.
- Read replica cho analytics/reporting nếu cần.

## 12. Kết luận

DriveMate đã áp dụng các nguyên tắc thiết kế dữ liệu quan trọng của microservices ở mức phù hợp với đồ án:

- Mỗi service sở hữu dữ liệu và migration riêng.
- Không dùng cross-service join hoặc foreign key xuyên database.
- Dữ liệu liên service đồng bộ qua RabbitMQ theo eventual consistency.
- `analytics-service` xây dựng projection/read model cho dashboard thay vì query trực tiếp nhiều database.
- Transactional Outbox đã được triển khai cho các audit-critical flows.
- Hệ thống dùng nhiều loại persistence đúng mục đích: PostgreSQL/Neon, Redis, Azure Blob, Consul KV, RabbitMQ và ELK local.

Các điểm cần nói trung thực:

- Saga hiện là choreography-style, chưa phải orchestrator đầy đủ.
- Outbox chưa áp dụng cho mọi domain event.
- CQRS hiện là CQRS-lite/projection read model, chưa phải Event Sourcing.
- Polyglot Persistence chủ yếu ở tầng phụ trợ/storage specialized, còn domain transactional data vẫn dùng PostgreSQL.

Cách thiết kế này tạo cân bằng tốt giữa học thuật và khả năng vận hành: đủ thể hiện các pattern quan trọng của microservices, nhưng vẫn giữ hệ thống trong phạm vi có thể triển khai, demo và bảo trì với nguồn lực đồ án.
