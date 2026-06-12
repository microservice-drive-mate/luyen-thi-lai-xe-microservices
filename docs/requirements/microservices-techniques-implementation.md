# Tổng hợp khái niệm và cách triển khai các nhóm kỹ thuật Microservices

> Tài liệu này tổng hợp các nhóm kỹ thuật được nhắc trong đề cương môn **Phát triển Phần mềm theo Kiến trúc Microservices (SE361)**, đồng thời diễn giải thêm khái niệm, mục đích sử dụng, cách triển khai và sản phẩm đầu ra nên có trong đồ án.

---

## 0. Cách đọc tài liệu này

Mỗi nhóm kỹ thuật được trình bày theo cấu trúc:

- **Khái niệm**: kỹ thuật đó là gì.
- **Dùng để làm gì**: vì sao cần nó trong hệ thống microservices.
- **Cách triển khai**: các bước hoặc thành phần cần làm trong đồ án.
- **Sản phẩm nên có trong báo cáo**: phần nên đưa vào tài liệu/báo cáo để chứng minh đã áp dụng.
- **Lỗi thường gặp**: các điểm dễ bị sai khi triển khai.

---

# 1. Nhóm kỹ thuật về kiến trúc phần mềm

## 1.1. Monolithic vs Microservices

### Khái niệm

**Monolithic architecture** là kiến trúc trong đó các chức năng chính của hệ thống được đóng gói trong một ứng dụng duy nhất. Ví dụ: user, product, order, payment, notification đều nằm trong cùng một backend app và thường dùng chung database.

**Microservices architecture** là kiến trúc chia hệ thống thành nhiều dịch vụ nhỏ, mỗi dịch vụ phụ trách một nghiệp vụ rõ ràng, có thể phát triển, triển khai, mở rộng và bảo trì độc lập.

### So sánh nhanh

| Tiêu chí | Monolithic | Microservices |
|---|---|---|
| Cấu trúc | Một ứng dụng lớn | Nhiều service nhỏ |
| Deploy | Deploy toàn hệ thống | Deploy từng service |
| Scale | Scale cả app | Scale service cần thiết |
| Database | Thường dùng chung DB | Mỗi service nên có DB/schema riêng |
| Giao tiếp nội bộ | Gọi hàm/module trực tiếp | API/message broker |
| Debug | Dễ hơn vì tập trung | Khó hơn vì phân tán |
| Vận hành | Đơn giản hơn | Cần Docker, gateway, monitoring, tracing |
| Phù hợp | Dự án nhỏ/vừa, team nhỏ | Dự án lớn, domain rõ, team chia độc lập |

### Dùng để làm gì trong đồ án

Phần này thường dùng để giải thích **vì sao hệ thống chọn microservices hoặc kiến trúc gần microservices**.

Nên trả lời được các câu hỏi:

- Hệ thống có những domain/nghiệp vụ nào?
- Domain nào cần tách riêng thành service?
- Service nào cần scale độc lập?
- Các team/service có thể phát triển độc lập không?
- Chi phí vận hành microservices có đáng không?

### Cách triển khai

1. **Liệt kê các nghiệp vụ chính** của hệ thống.
   - Ví dụ: User, Product, Order, Payment, Notification.

2. **Xác định ranh giới service**.
   - Mỗi service phụ trách một nhóm nghiệp vụ.
   - Tránh service quá nhỏ khiến hệ thống bị phân mảnh.
   - Tránh service quá lớn khiến nó trở thành monolith trá hình.

3. **Vẽ kiến trúc tổng quan**.
   - Client gọi API Gateway.
   - API Gateway route đến các service.
   - Service giao tiếp với nhau qua REST/gRPC hoặc message broker.
   - Mỗi service có database/schema riêng.
   - Monitoring/logging/tracing thu thập dữ liệu vận hành.

4. **So sánh với monolithic**.
   - Nêu lý do không dùng monolithic.
   - Nêu trade-off: microservices mạnh nhưng phức tạp hơn.

### Sản phẩm nên có trong báo cáo

- Bảng so sánh Monolithic vs Microservices.
- Sơ đồ kiến trúc tổng quan.
- Bảng mapping nghiệp vụ → service.
- Lý do chọn microservices.
- Các trade-off: độ phức tạp, network latency, consistency, monitoring.

### Lỗi thường gặp

- Tách service theo bảng database thay vì theo nghiệp vụ.
- Service nào cũng gọi trực tiếp database của service khác.
- Chưa có API Gateway nhưng gọi service lộn xộn từ frontend.
- Tách quá nhiều service dù domain còn nhỏ.
- Không giải thích được vì sao cần microservices.

---

## 1.2. Domain-Driven Design (DDD)

### Khái niệm

**Domain-Driven Design (DDD)** là phương pháp thiết kế phần mềm xoay quanh nghiệp vụ. Thay vì thiết kế theo database trước, DDD bắt đầu bằng việc hiểu domain, ngôn ngữ nghiệp vụ, quy trình và ranh giới trách nhiệm.

Các khái niệm chính:

| Khái niệm | Ý nghĩa |
|---|---|
| Domain | Lĩnh vực/nghiệp vụ mà hệ thống xử lý |
| Ubiquitous Language | Ngôn ngữ thống nhất giữa dev và business |
| Entity | Đối tượng có định danh riêng |
| Value Object | Đối tượng không có định danh riêng, so sánh bằng giá trị |
| Aggregate | Cụm entity/value object được quản lý nhất quán |
| Repository | Lớp/trừu tượng để truy xuất aggregate |
| Bounded Context | Ranh giới ngữ cảnh nghiệp vụ |

### Ví dụ

Trong hệ thống bán hàng:

- **User Context**: quản lý tài khoản, vai trò, đăng nhập.
- **Product Context**: quản lý sản phẩm, tồn kho, danh mục.
- **Order Context**: quản lý đơn hàng.
- **Payment Context**: quản lý thanh toán.

Một khái niệm như `Customer` có thể có ý nghĩa khác nhau ở từng context:

- Trong User Context: là tài khoản đăng nhập.
- Trong Order Context: là người đặt hàng.
- Trong Payment Context: là người thanh toán.

### Dùng để làm gì trong microservices

DDD giúp xác định ranh giới service. Thông thường:

```text
1 Bounded Context ≈ 1 Microservice
```

Không phải lúc nào cũng tuyệt đối, nhưng đây là cách tách phổ biến.

### Cách triển khai

1. **Phân tích nghiệp vụ**
   - Liệt kê actor.
   - Liệt kê use case.
   - Liệt kê object nghiệp vụ.

2. **Tìm Ubiquitous Language**
   - Dùng cùng một thuật ngữ trong tài liệu, code, API.
   - Ví dụ không dùng lẫn lộn `Order`, `Purchase`, `Transaction` nếu chúng cùng chỉ một thứ.

3. **Xác định Bounded Context**
   - Nhóm các use case có liên quan.
   - Tách những phần có rule khác nhau ra context riêng.

4. **Thiết kế Aggregate**
   - Ví dụ trong Order Service:
     - `Order` là aggregate root.
     - `OrderItem` nằm trong aggregate `Order`.
     - Không cho service khác sửa trực tiếp `OrderItem`.

5. **Thiết kế Repository**
   - Repository chỉ thao tác với aggregate root.
   - Không để controller gọi trực tiếp ORM lung tung.

6. **Mapping sang service**
   - User Context → User Service.
   - Product Context → Product Service.
   - Order Context → Order Service.
   - Payment Context → Payment Service.

### Ví dụ cấu trúc service theo DDD

```text
order-service/
├── domain/
│   ├── order.entity.ts
│   ├── order-item.value-object.ts
│   ├── order-status.enum.ts
│   └── order.repository.interface.ts
├── application/
│   ├── create-order.usecase.ts
│   ├── cancel-order.usecase.ts
│   └── pay-order.usecase.ts
├── infrastructure/
│   ├── prisma-order.repository.ts
│   └── order-message-publisher.ts
└── presentation/
    └── order.controller.ts
```

### Sản phẩm nên có trong báo cáo

- Bảng Bounded Context.
- Bảng Entity/Value Object/Aggregate.
- Sơ đồ context map.
- Giải thích vì sao tách service như vậy.
- Ví dụ một aggregate quan trọng.

### Lỗi thường gặp

- DDD chỉ viết cho có nhưng code vẫn CRUD thuần.
- Entity chỉ là bản sao của table database.
- Không có ranh giới context rõ ràng.
- Service này sửa database của service khác.
- Repository bị hiểu nhầm là nơi chứa toàn bộ business logic.

---

## 1.3. SRP, High Cohesion, Low Coupling và Independent Deployment

### Khái niệm

**SRP – Single Responsibility Principle** nghĩa là mỗi module/service nên có một trách nhiệm chính.

**High Cohesion** nghĩa là các thành phần bên trong service liên quan chặt với cùng một nghiệp vụ.

**Low Coupling** nghĩa là service ít phụ thuộc trực tiếp vào service khác.

**Independent Deployment** nghĩa là mỗi service có thể build, test, deploy, scale, rollback riêng.

### Cách triển khai

1. **Thiết kế service theo nghiệp vụ**
   - Không tạo `CommonService` chứa mọi thứ.
   - Không nhét user, order, product vào cùng một service nếu đã chọn microservices.

2. **Định nghĩa public API rõ ràng**
   - Service khác chỉ gọi qua API hoặc message.
   - Không import code nội bộ của service khác.

3. **Tránh coupling qua database**
   - Không join trực tiếp table của service khác.
   - Nếu cần dữ liệu, gọi API hoặc dùng event để đồng bộ read model.

4. **Build/deploy độc lập**
   - Mỗi service có Dockerfile riêng.
   - Mỗi service có pipeline hoặc job build riêng.
   - Có tag image riêng.

5. **Rollback độc lập**
   - Nếu Order Service lỗi, rollback Order Service.
   - Không cần rollback toàn hệ thống.

### Sản phẩm nên có trong báo cáo

- Bảng service responsibility.
- Sơ đồ dependency giữa service.
- Mô tả cách deploy từng service.
- Minh họa rollback hoặc scale một service riêng.

---

# 2. Nhóm kỹ thuật giao tiếp giữa các dịch vụ

## 2.1. Giao tiếp đồng bộ: REST/HTTP, RPC, gRPC

### Khái niệm

**Giao tiếp đồng bộ** nghĩa là service A gọi service B và chờ phản hồi. Nếu B chậm hoặc lỗi, A bị ảnh hưởng ngay.

Các kỹ thuật:

- **REST/HTTP**: phổ biến, dễ debug, phù hợp API công khai.
- **RPC**: gọi hàm từ xa, thường tập trung vào action.
- **gRPC**: RPC hiệu năng cao, dùng Protocol Buffers, phù hợp service-to-service.

### Khi nào dùng

Nên dùng khi:

- Cần phản hồi ngay.
- Dữ liệu cần đọc trực tiếp.
- Flow đơn giản.
- Request không cần xử lý nền.

Ví dụ:

```text
Order Service gọi User Service để kiểm tra user có tồn tại hay không.
API Gateway gọi Product Service để lấy danh sách sản phẩm.
```

### Cách triển khai REST service-to-service

1. Service provider định nghĩa endpoint rõ ràng.
2. Service consumer dùng HTTP client để gọi.
3. Thiết lập timeout.
4. Có retry hợp lý.
5. Có circuit breaker nếu service hay lỗi.
6. Log correlation ID để trace request.

Ví dụ flow:

```text
Client → API Gateway → Order Service → Product Service
```

### Những thứ cần có

- API contract rõ ràng.
- Timeout, ví dụ 2–5 giây.
- Error format thống nhất.
- Retry có giới hạn.
- Circuit breaker cho dependency quan trọng.
- Correlation ID truyền qua header.

### Lỗi thường gặp

- Không set timeout.
- Gọi service dây chuyền quá dài.
- Service A gọi B, B gọi C, C gọi D làm latency tăng.
- Retry vô hạn gây overload.
- Không có fallback khi service phụ bị lỗi.

---

## 2.2. Giao tiếp bất đồng bộ: Messaging, RabbitMQ, Kafka

### Khái niệm

**Giao tiếp bất đồng bộ** nghĩa là service gửi message/event vào message broker, service nhận xử lý sau. Service gửi không cần chờ service nhận xử lý xong.

Công cụ phổ biến:

- **RabbitMQ**: mạnh về queue, routing, command/task.
- **Kafka**: mạnh về event streaming, log sự kiện, throughput cao.

### Khi nào dùng

Nên dùng khi:

- Không cần phản hồi ngay.
- Xử lý nền.
- Muốn giảm coupling.
- Cần retry/dead-letter.
- Cần event-driven architecture.

Ví dụ:

```text
Order Service tạo đơn hàng
→ publish event order-created
→ Payment Service nhận event để tạo payment
→ Notification Service nhận event để gửi email/thông báo
```

### Cách triển khai với RabbitMQ

1. Tạo exchange.
2. Tạo queue cho từng consumer.
3. Bind queue với routing key.
4. Producer publish event.
5. Consumer nhận event và xử lý.
6. Nếu lỗi thì retry hoặc đưa vào dead-letter queue.
7. Message nên có `eventId`, `eventType`, `occurredAt`, `correlationId`.

Ví dụ event:

```json
{
  "eventId": "evt_001",
  "eventType": "order-created",
  "occurredAt": "2026-06-12T10:00:00Z",
  "correlationId": "req_abc",
  "payload": {
    "orderId": "ord_123",
    "userId": "usr_001",
    "totalAmount": 250000
  }
}
```

### Cách triển khai với Kafka

1. Tạo topic, ví dụ `order.events`.
2. Producer gửi event vào topic.
3. Consumer group đọc event.
4. Có thể replay event nếu cần.
5. Dùng partition key như `orderId` để giữ thứ tự theo đơn hàng.

### Lỗi thường gặp

- Message không có version.
- Consumer xử lý không idempotent.
- Không có dead-letter queue.
- Không trace được event.
- Event payload thay đổi làm service khác lỗi.
- Dùng Kafka/RabbitMQ nhưng vẫn gọi chéo DB.

---

## 2.3. Event-Driven Architecture (EDA)

### Khái niệm

**Event-Driven Architecture** là kiến trúc trong đó các service phản ứng với sự kiện. Một service phát event khi có thay đổi nghiệp vụ, các service khác subscribe và xử lý.

Ví dụ:

```text
OrderCreated
PaymentCompleted
InventoryReserved
OrderCancelled
EmailSent
```

### Lợi ích

- Giảm phụ thuộc trực tiếp giữa service.
- Dễ mở rộng thêm consumer mới.
- Phù hợp xử lý nền.
- Tăng khả năng scale độc lập.

### Khó khăn

- Debug khó hơn.
- Dữ liệu có thể eventual consistency.
- Cần xử lý duplicate message.
- Cần quan tâm thứ tự event.
- Cần tracking/tracing tốt.

### Cách triển khai

1. Xác định các event nghiệp vụ chính.
2. Chuẩn hóa event schema.
3. Thiết kế producer/consumer.
4. Thêm outbox pattern để tránh mất event.
5. Thêm retry và dead-letter.
6. Thêm correlation ID.
7. Viết integration test cho event flow.

### Sản phẩm nên có trong báo cáo

- Sơ đồ event flow.
- Bảng event name, producer, consumer.
- Mô tả message broker.
- Mô tả retry/dead-letter/idempotency.
- Demo một flow event cụ thể.

---

# 3. Nhóm kỹ thuật REST API và tài liệu API

## 3.1. RESTful API

### Khái niệm

RESTful API là cách thiết kế API dựa trên resource. Thay vì đặt endpoint theo hành động tùy tiện, API nên xoay quanh tài nguyên.

Ví dụ tốt:

```http
GET /orders
GET /orders/{id}
POST /orders
PATCH /orders/{id}/status
DELETE /orders/{id}
```

Ví dụ chưa tốt:

```http
POST /createOrder
GET /getOrderById
POST /changeOrderStatus
```

### HTTP methods

| Method | Ý nghĩa |
|---|---|
| GET | Lấy dữ liệu |
| POST | Tạo mới hoặc thực hiện action phức tạp |
| PUT | Cập nhật toàn bộ |
| PATCH | Cập nhật một phần |
| DELETE | Xóa |

### HTTP status code

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 204 | Thành công nhưng không trả body |
| 400 | Request sai |
| 401 | Chưa xác thực |
| 403 | Không có quyền |
| 404 | Không tìm thấy |
| 409 | Xung đột dữ liệu |
| 422 | Dữ liệu không hợp lệ về nghiệp vụ |
| 500 | Lỗi server |

### Cách triển khai

1. Đặt endpoint theo resource.
2. Dùng method đúng ý nghĩa.
3. Chuẩn hóa request DTO.
4. Validate input.
5. Chuẩn hóa response.
6. Chuẩn hóa error response.
7. Có pagination/filtering/sorting.
8. Có API versioning nếu cần.

### Ví dụ pagination/filtering

```http
GET /products?page=1&limit=20&keyword=phone&sort=createdAt:desc
```

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "totalPages": 7
  }
}
```

### Chuẩn hóa error format

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "details": {
      "orderId": "ord_123"
    },
    "traceId": "req_abc"
  }
}
```

---

## 3.2. API Versioning

### Khái niệm

API versioning dùng để quản lý thay đổi API mà không làm hỏng client cũ.

Các cách phổ biến:

```http
/api/v1/orders
/api/v2/orders
```

Hoặc qua header:

```http
Accept: application/vnd.example.v1+json
```

### Cách triển khai

- Với đồ án, cách đơn giản nhất là dùng URL versioning: `/api/v1`.
- Khi thay đổi response lớn, tạo version mới.
- Không phá contract cũ nếu client vẫn dùng version cũ.

---

## 3.3. HATEOAS

### Khái niệm

HATEOAS là kiểu REST trong đó response chứa thêm link hướng dẫn client có thể làm gì tiếp theo.

Ví dụ:

```json
{
  "id": "ord_123",
  "status": "PENDING",
  "links": [
    { "rel": "self", "href": "/orders/ord_123" },
    { "rel": "cancel", "href": "/orders/ord_123/cancel" },
    { "rel": "pay", "href": "/orders/ord_123/payment" }
  ]
}
```

### Có cần triển khai không?

Không bắt buộc trong đồ án nếu thời gian ít. Có thể chỉ nhắc ở phần lý thuyết hoặc áp dụng nhẹ ở một vài resource chính.

---

## 3.4. Swagger/OpenAPI/Swagger UI

### Khái niệm

**OpenAPI** là chuẩn mô tả API.  
**Swagger UI** là giao diện hiển thị tài liệu API và cho phép test endpoint trực tiếp.

### Cách triển khai

1. Cài thư viện Swagger/OpenAPI theo framework.
2. Annotate controller/DTO.
3. Tự sinh docs.
4. Expose docs tại endpoint như `/docs` hoặc `/swagger`.
5. Thêm mô tả auth bearer token.
6. Thêm ví dụ request/response.

### Sản phẩm nên có trong báo cáo

- Ảnh Swagger UI.
- Link local docs.
- Ví dụ một endpoint có request/response/schema.
- Mô tả dùng Swagger để test endpoint.

---

# 4. Nhóm kỹ thuật quản lý dữ liệu trong microservices

## 4.1. Database per Service

### Khái niệm

Mỗi service sở hữu database hoặc schema riêng. Service khác không được truy cập trực tiếp database đó.

Ví dụ:

```text
User Service    → user_db
Product Service → product_db
Order Service   → order_db
Payment Service → payment_db
```

Hoặc nếu dùng một PostgreSQL instance:

```text
PostgreSQL
├── user_schema
├── product_schema
├── order_schema
└── payment_schema
```

### Lý do cần dùng

- Giảm coupling.
- Mỗi service tự quản lý dữ liệu.
- Dễ deploy và thay đổi schema độc lập.
- Phù hợp DDD bounded context.

### Cách triển khai

1. Mỗi service có migration riêng.
2. Mỗi service chỉ có connection đến DB/schema của mình.
3. Không join table xuyên service.
4. Nếu cần dữ liệu service khác:
   - gọi API,
   - nghe event,
   - hoặc tạo read model riêng.
5. Document rõ ownership dữ liệu.

### Lỗi thường gặp

- Dùng chung một database rồi service nào cũng query mọi table.
- Cập nhật data của service khác trực tiếp.
- Thiếu event hoặc API để đồng bộ dữ liệu.
- Không có migration riêng cho từng service.

---

## 4.2. Eventual Consistency và CAP Theorem

### Khái niệm

Trong hệ phân tán, không phải lúc nào dữ liệu giữa các service cũng đồng bộ ngay lập tức. **Eventual consistency** nghĩa là dữ liệu có thể lệch tạm thời nhưng cuối cùng sẽ nhất quán.

Ví dụ:

```text
Order Service đã tạo order
Payment Service chưa nhận event ngay
→ trong vài giây, payment chưa xuất hiện
→ sau khi consumer xử lý, dữ liệu nhất quán lại
```

**CAP Theorem** nói rằng hệ phân tán khó đảm bảo đồng thời 3 yếu tố:

- Consistency: nhất quán
- Availability: luôn sẵn sàng
- Partition tolerance: chịu được lỗi mạng/phân vùng

### Cách triển khai

- Chấp nhận eventual consistency ở các flow không cần đồng bộ ngay.
- Dùng Saga/Outbox để quản lý transaction phân tán.
- Có trạng thái trung gian như `PENDING`, `PROCESSING`, `FAILED`.
- Có cơ chế retry/compensation.

---

## 4.3. Saga Pattern

### Khái niệm

Saga Pattern dùng để xử lý một quy trình nghiệp vụ trải qua nhiều service mà không dùng distributed transaction kiểu 2PC.

Ví dụ flow Order → Payment:

```text
1. Order Service tạo order PENDING
2. Payment Service xử lý thanh toán
3. Nếu thanh toán thành công → Order PAID
4. Nếu thanh toán thất bại → Order PAYMENT_FAILED hoặc CANCELLED
```

### Hai kiểu Saga

#### Choreography

Các service giao tiếp qua event, không có service điều phối trung tâm.

```text
OrderCreated → PaymentRequested → PaymentCompleted → OrderPaid
```

Ưu điểm:

- Ít phụ thuộc trung tâm.
- Tự nhiên với event-driven.

Nhược điểm:

- Khó theo dõi flow.
- Logic phân tán.

#### Orchestration

Có một orchestrator điều phối các bước.

```text
Order Saga Orchestrator
→ gọi Payment
→ gọi Inventory
→ cập nhật Order
```

Ưu điểm:

- Dễ nhìn flow.
- Dễ quản lý rollback/compensation.

Nhược điểm:

- Orchestrator có thể thành điểm phụ thuộc lớn.

### Cách triển khai

1. Xác định transaction nghiệp vụ.
2. Chia thành các bước nhỏ.
3. Mỗi bước có action và compensation.
4. Lưu trạng thái saga.
5. Publish event hoặc gọi command.
6. Có retry và timeout.
7. Có log/tracing theo sagaId.

### Ví dụ compensation

```text
Nếu Payment thành công nhưng Inventory giữ hàng thất bại
→ refund payment
→ cancel order
```

---

## 4.4. Outbox Pattern

### Khái niệm

Outbox Pattern giải quyết vấn đề: cập nhật database thành công nhưng publish event thất bại.

Thay vì publish event trực tiếp sau khi lưu DB, service lưu event vào bảng `outbox` trong cùng transaction với nghiệp vụ.

### Flow

```text
1. Begin transaction
2. Insert order vào orders table
3. Insert event OrderCreated vào outbox table
4. Commit transaction
5. Outbox worker đọc outbox
6. Publish event lên RabbitMQ/Kafka
7. Mark event as published
```

### Cách triển khai

Bảng outbox mẫu:

```sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  aggregate_type VARCHAR(100),
  aggregate_id VARCHAR(100),
  event_type VARCHAR(100),
  payload JSONB,
  status VARCHAR(30),
  created_at TIMESTAMP,
  published_at TIMESTAMP
);
```

Worker xử lý:

```text
every 5 seconds:
  lấy event status = PENDING
  publish lên broker
  nếu thành công → status = PUBLISHED
  nếu lỗi → tăng retry_count
```

### Dùng Debezium

Debezium có thể đọc thay đổi từ database transaction log rồi publish event sang Kafka. Cách này giảm việc tự viết polling worker.

### Lỗi thường gặp

- Không idempotent ở consumer.
- Publish trùng nhưng consumer không xử lý trùng.
- Không có retry limit.
- Không có dead-letter.
- Outbox table tăng quá lớn nhưng không cleanup.

---

## 4.5. CQRS

### Khái niệm

**CQRS – Command Query Responsibility Segregation** là tách phần ghi dữ liệu và đọc dữ liệu.

- **Command side**: xử lý tạo/sửa/xóa, đảm bảo business rule.
- **Query side**: tối ưu đọc dữ liệu, có thể dùng read model riêng.

### Khi nào dùng

Nên dùng khi:

- Read/write có nhu cầu khác nhau.
- Query phức tạp.
- Dữ liệu đọc cần tổng hợp từ nhiều service.
- Hệ thống event-driven.

### Cách triển khai

1. Command API ghi vào database chính.
2. Publish event sau khi ghi.
3. Query service/read model nhận event.
4. Cập nhật bảng read model.
5. Client query từ read model.

Ví dụ:

```text
Order Service publish OrderCreated
→ Reporting Service cập nhật order_summary
→ Dashboard đọc order_summary
```

### Lưu ý

CQRS làm hệ thống phức tạp hơn. Nếu đồ án nhỏ, chỉ nên áp dụng ở một use case cụ thể.

---

## 4.6. Polyglot Persistence

### Khái niệm

Polyglot Persistence nghĩa là mỗi service có thể dùng loại database phù hợp với nghiệp vụ.

Ví dụ:

| Service | Database phù hợp |
|---|---|
| User Service | PostgreSQL/MySQL |
| Product Search | Elasticsearch |
| Order Service | PostgreSQL |
| Cache | Redis |
| Logging | Elasticsearch |
| Time-series metrics | Prometheus/TimescaleDB |

### Cách triển khai trong đồ án

Không nhất thiết phải dùng quá nhiều DB. Có thể trình bày ở mức:

- Service chính dùng PostgreSQL/MySQL.
- Cache dùng Redis.
- Search/log dùng Elasticsearch nếu có.
- Monitoring dùng Prometheus.

---

## 4.7. Spring Data / JPA

### Khái niệm

Spring Data/JPA là công cụ giúp thao tác database trong Spring Boot thông qua entity/repository.

### Cách triển khai

- Tạo Entity.
- Tạo Repository interface.
- Tạo Service xử lý business.
- Controller gọi Service, không gọi Repository trực tiếp.
- Migration nên dùng Flyway/Liquibase nếu có.

Ví dụ:

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(Long userId);
}
```

---

# 5. Nhóm kỹ thuật Docker, container và Kubernetes

## 5.1. Docker

### Khái niệm

Docker dùng để đóng gói ứng dụng cùng runtime/dependency thành container. Container giúp app chạy nhất quán giữa máy dev, CI và server.

### Các kỹ thuật được nhắc

- Dockerfile.
- Tối ưu Dockerfile.
- Layer cache.
- Multi-stage build.
- Đóng gói từng service thành image.

### Cách triển khai Dockerfile

Ví dụ multi-stage build:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/main.js"]
```

### Nguyên tắc tối ưu

- Copy package file trước để tận dụng cache.
- Không copy `node_modules` từ máy host.
- Dùng `.dockerignore`.
- Dùng image nhẹ như alpine/slim nếu phù hợp.
- Không để secrets trong image.
- Tách build stage và runtime stage.

---

## 5.2. Docker Compose

### Khái niệm

Docker Compose dùng để chạy nhiều container cùng nhau bằng một file YAML.

Ví dụ hệ thống gồm:

- API service.
- PostgreSQL.
- Redis.
- RabbitMQ.
- Prometheus.
- Grafana.

### Cách triển khai

File `docker-compose.yml` thường có:

```yaml
services:
  order-service:
    build: ./order-service
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: postgres://user:pass@order-db:5432/order_db
    depends_on:
      - order-db

  order-db:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: order_db
    volumes:
      - order-db-data:/var/lib/postgresql/data

volumes:
  order-db-data:
```

### Những thứ cần thể hiện

- Network giữa service.
- Volume cho database.
- Environment variables.
- Port mapping.
- Healthcheck nếu có.
- depends_on hoặc wait-for strategy.

---

## 5.3. Kubernetes

### Khái niệm

Kubernetes là nền tảng orchestration dùng để quản lý container ở quy mô lớn.

Các khái niệm chính:

| Khái niệm | Ý nghĩa |
|---|---|
| Pod | Đơn vị chạy container nhỏ nhất |
| Deployment | Quản lý số lượng pod và rollout |
| Service | Cung cấp địa chỉ ổn định để truy cập pod |
| ConfigMap | Lưu cấu hình không nhạy cảm |
| Secret | Lưu thông tin nhạy cảm |
| Ingress | Route HTTP từ ngoài vào cluster |

### Cách triển khai Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: order-service:1.0.0
          ports:
            - containerPort: 3000
```

### Cách triển khai Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

### Lệnh kubectl cơ bản

```bash
kubectl apply -f k8s/
kubectl get pods
kubectl get services
kubectl logs deploy/order-service
kubectl rollout status deployment/order-service
kubectl rollout undo deployment/order-service
```

### Local Kubernetes

Có thể dùng:

- **Minikube**
- **Kind**

### Sản phẩm nên có trong báo cáo

- File YAML Deployment/Service.
- Ảnh `kubectl get pods`.
- Ảnh service chạy trong cluster.
- Mô tả self-healing, scaling, rolling update.

---

## 5.4. Helm

### Khái niệm

Helm là package manager cho Kubernetes. Helm giúp gom nhiều YAML thành chart, dễ cấu hình theo môi trường.

### Cách triển khai

Cấu trúc chart:

```text
order-service-chart/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

Cài đặt:

```bash
helm install order-service ./order-service-chart
helm upgrade order-service ./order-service-chart
helm rollback order-service 1
```

### Khi nào nên dùng

- Khi có nhiều service.
- Khi cần deploy nhiều môi trường: dev/staging/prod.
- Khi cần rollback dễ hơn.

---

# 6. Nhóm kỹ thuật Service Discovery và Load Balancing

## 6.1. Service Discovery

### Khái niệm

Service Discovery giúp service tìm địa chỉ của service khác mà không hard-code IP/port.

Công cụ:

- Eureka.
- Consul.
- Kubernetes Service DNS.

### Cách hoạt động

```text
1. Service khởi động.
2. Service tự đăng ký với registry.
3. Service khác hỏi registry để lấy địa chỉ.
4. Registry cập nhật khi service chết hoặc scale thêm instance.
```

### Cách triển khai với Eureka

- Tạo Eureka Server.
- Các service cấu hình Eureka Client.
- Service đăng ký tên như `order-service`, `payment-service`.
- Consumer gọi theo service name.

### Cách triển khai với Consul

- Chạy Consul agent/server.
- Service đăng ký health check.
- Service lookup qua DNS/API của Consul.

### Trong Kubernetes

Kubernetes đã có service discovery bằng DNS:

```text
http://order-service.default.svc.cluster.local
```

Hoặc trong cùng namespace:

```text
http://order-service
```

### Lỗi thường gặp

- Hard-code IP container.
- Không có health check.
- Registry còn giữ instance đã chết.
- Service name không thống nhất.

---

## 6.2. Load Balancing

### Khái niệm

Load balancing phân phối request đến nhiều instance để tăng khả năng chịu tải và sẵn sàng.

### Các kiểu

#### Client-side load balancing

Client tự chọn instance để gọi.

Ví dụ:

- Ribbon.
- Spring Cloud LoadBalancer.

#### Server-side load balancing

Client gọi vào load balancer, load balancer chọn backend.

Ví dụ:

- Nginx.
- Kubernetes Service.
- Cloud Load Balancer.

### Kubernetes Service types

| Type | Ý nghĩa |
|---|---|
| ClusterIP | Chỉ truy cập trong cluster |
| NodePort | Mở port trên node |
| LoadBalancer | Tạo load balancer bên ngoài nếu cloud hỗ trợ |

### Cách triển khai

- Chạy nhiều replicas của service.
- Tạo Kubernetes Service trỏ đến các pod.
- Test bằng cách gọi nhiều request và xem request phân phối qua nhiều pod.
- Kết hợp readiness/liveness probe.

---

# 7. Nhóm kỹ thuật API Gateway và Networking

## 7.1. API Gateway

### Khái niệm

API Gateway là điểm vào tập trung của hệ thống. Client không gọi trực tiếp từng service mà gọi qua gateway.

Công cụ:

- Spring Cloud Gateway.
- Kong.
- Nginx.
- Traefik.

### Vai trò

- Routing request.
- Authentication filter.
- Authorization check.
- Rate limiting.
- Rewrite path.
- Request/response transformation.
- Logging.
- CORS.
- TLS termination.

### Cách triển khai route

Ví dụ với Kong hoặc gateway tương tự:

```text
/client request
GET /api/orders
→ API Gateway
→ route đến Order Service
```

### Các rule nên có

| Path | Service |
|---|---|
| `/api/users/**` | User Service |
| `/api/products/**` | Product Service |
| `/api/orders/**` | Order Service |
| `/api/payments/**` | Payment Service |

### Rate limiting

Ví dụ:

```text
Mỗi IP/user chỉ được gọi 100 request/phút.
Nếu vượt quá → HTTP 429 Too Many Requests.
```

### Authentication filter

Gateway kiểm tra JWT trước khi route request vào service nội bộ.

```text
Client → Gateway kiểm JWT → Service
```

### Lỗi thường gặp

- Frontend gọi thẳng internal service.
- Auth check lặp lung tung ở nhiều nơi nhưng không rõ trách nhiệm.
- Gateway trở thành nơi chứa business logic.
- Không log request tại gateway.

---

## 7.2. Kubernetes Ingress

### Khái niệm

Ingress định nghĩa rule HTTP/HTTPS để route traffic từ ngoài cluster vào service bên trong.

Công cụ thường dùng:

- NGINX Ingress Controller.
- Traefik Ingress.
- Kong Ingress Controller.

### Ví dụ Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
spec:
  rules:
    - host: api.example.local
      http:
        paths:
          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
```

### Khi nào dùng Ingress

- Khi deploy trên Kubernetes.
- Khi muốn route nhiều service qua một domain.
- Khi cần TLS, path-based routing, host-based routing.

---

# 8. Nhóm kỹ thuật bảo mật, authentication và authorization

## 8.1. Authentication với JWT/OAuth2/Keycloak

### Khái niệm

**Authentication** là xác thực người dùng là ai.

**JWT** là token chứa thông tin user/role/permission và được ký số.

**OAuth2** là framework ủy quyền. Trong hệ thống hiện đại, OAuth2 thường kết hợp với OpenID Connect để đăng nhập.

**Keycloak** là Identity Provider mã nguồn mở, hỗ trợ realm, client, role, user, token.

### Flow phổ biến

```text
1. User đăng nhập qua Keycloak.
2. Keycloak trả access token.
3. Client gửi request kèm Authorization: Bearer <token>.
4. API Gateway hoặc service verify token.
5. Nếu hợp lệ → xử lý request.
6. Nếu không hợp lệ → 401.
```

### Cách triển khai Keycloak

1. Tạo realm.
2. Tạo client.
3. Tạo user.
4. Tạo role.
5. Gán role cho user.
6. Cấu hình redirect URI nếu có frontend.
7. Lấy public key/JWKS để service verify JWT.

### Cách triển khai trong service

- Cài Spring Security/NestJS guard/.NET authentication middleware.
- Verify JWT signature.
- Check expiration.
- Extract user id, role, scopes.
- Gắn user context vào request.
- Dùng decorator/middleware để bảo vệ endpoint.

### Ví dụ header

```http
Authorization: Bearer eyJhbGciOi...
```

---

## 8.2. Authorization: RBAC, scopes, introspection

### Khái niệm

**Authorization** là kiểm tra người dùng được phép làm gì.

**RBAC – Role-Based Access Control** phân quyền theo vai trò.

Ví dụ:

| Role | Quyền |
|---|---|
| ADMIN | Quản lý toàn hệ thống |
| STAFF | Tạo/sửa nghiệp vụ |
| USER | Xem và tạo dữ liệu cá nhân |

**Scopes** là quyền chi tiết hơn, ví dụ:

```text
order:read
order:create
order:update
payment:refund
```

**Token introspection** là việc service/gateway hỏi identity server xem token còn hợp lệ không.

### Cách triển khai

1. Xác định role.
2. Xác định permission/scope.
3. Gán role/scope cho user.
4. Bảo vệ endpoint theo role/scope.
5. Test 401/403.

Ví dụ:

```text
GET /admin/users → chỉ ADMIN
POST /orders → USER hoặc STAFF
PATCH /orders/{id}/status → STAFF hoặc ADMIN
```

### Test bảo mật nên có

- Không có token → 401.
- Token sai/hết hạn → 401.
- Token hợp lệ nhưng thiếu quyền → 403.
- Role đúng → 200/201.
- Endpoint admin không cho user thường truy cập.

---

# 9. Nhóm kỹ thuật cấu hình tập trung và quản lý secrets

## 9.1. Centralized Config

### Khái niệm

Centralized Config là quản lý cấu hình ở một nơi tập trung thay vì hard-code hoặc để rải rác trong từng service.

Công cụ:

- Spring Cloud Config.
- Git backend.
- Consul KV store.

### Dùng để quản lý

- Database URL.
- Broker URL.
- Feature flags.
- Timeout.
- Rate limit.
- External API endpoints.

### Cách triển khai với Spring Cloud Config

```text
config-repo/
├── order-service.yml
├── payment-service.yml
└── application.yml
```

Service khi khởi động sẽ lấy config từ Config Server.

### Refresh runtime

Một số hệ thống cho phép refresh config mà không restart service. Tuy nhiên cần kiểm soát kỹ để tránh config thay đổi gây lỗi runtime.

---

## 9.2. Secrets Management

### Khái niệm

Secrets là thông tin nhạy cảm:

- DB password.
- API key.
- JWT secret.
- OAuth client secret.
- Private key.

Công cụ:

- HashiCorp Vault.
- Kubernetes Secret.
- Cloud Secret Manager.

### Cách triển khai với Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: order-secret
type: Opaque
stringData:
  DATABASE_PASSWORD: "secret-password"
```

Deployment đọc secret:

```yaml
env:
  - name: DATABASE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: order-secret
        key: DATABASE_PASSWORD
```

### Cách triển khai với Vault

1. Chạy Vault.
2. Tạo policy.
3. Tạo token/role.
4. Lưu secret vào Vault.
5. Service lấy secret khi khởi động hoặc qua sidecar/agent.

### Lỗi thường gặp

- Commit `.env` chứa password lên Git.
- Hard-code secret trong Dockerfile.
- Dùng ConfigMap cho dữ liệu nhạy cảm.
- Không rotate secret.
- Log ra token/password.

---

# 10. Nhóm kỹ thuật logging, monitoring, tracing

## 10.1. Centralized Logging: ELK/Filebeat

### Khái niệm

Centralized logging gom log từ nhiều service về một nơi để tìm kiếm và phân tích.

Công cụ:

- Filebeat.
- Logstash.
- Elasticsearch.
- Kibana.
- ELK stack.

### Flow

```text
Service logs
→ Filebeat/Logstash
→ Elasticsearch
→ Kibana dashboard/search
```

### Cách triển khai

1. Service log theo JSON.
2. Log có timestamp, level, serviceName, traceId/correlationId.
3. Filebeat đọc log container.
4. Gửi về Logstash/Elasticsearch.
5. Kibana dùng để search.

### Log format gợi ý

```json
{
  "timestamp": "2026-06-12T10:00:00Z",
  "level": "INFO",
  "service": "order-service",
  "message": "Order created",
  "correlationId": "req_abc",
  "userId": "usr_001",
  "orderId": "ord_123"
}
```

---

## 10.2. Monitoring: Prometheus/Grafana

### Khái niệm

Monitoring dùng để đo sức khỏe và hiệu năng hệ thống.

Công cụ:

- Prometheus thu thập metrics.
- Grafana hiển thị dashboard.

### Metrics nên có

- Request count.
- Error rate.
- Request duration.
- p95/p99 latency.
- CPU/RAM.
- DB connections.
- Queue depth.
- Message processing time.

### Cách triển khai

1. Service expose `/metrics`.
2. Prometheus scrape endpoint.
3. Grafana kết nối Prometheus.
4. Tạo dashboard.
5. Đặt alert nếu cần.

Prometheus config mẫu:

```yaml
scrape_configs:
  - job_name: "order-service"
    static_configs:
      - targets: ["order-service:3000"]
```

### Dashboard nên có

- Tổng request theo service.
- Tỷ lệ lỗi HTTP 4xx/5xx.
- p95/p99 latency.
- CPU/RAM container.
- RabbitMQ queue depth nếu có.
- Database connection count.

---

## 10.3. Distributed Tracing: Zipkin/OpenTelemetry

### Khái niệm

Distributed tracing theo dõi một request đi qua nhiều service.

Ví dụ:

```text
Client
→ API Gateway
→ Order Service
→ Payment Service
→ Notification Service
```

Mỗi bước là một span. Toàn bộ request là một trace.

### Công cụ

- OpenTelemetry.
- Zipkin.
- Jaeger.

### Cách triển khai

1. Gắn OpenTelemetry SDK vào service.
2. Gateway tạo hoặc nhận trace ID.
3. Truyền trace context qua HTTP header/message.
4. Export trace sang Zipkin/Jaeger.
5. Xem timeline request.

### Correlation ID

Correlation ID là mã dùng để liên kết log của cùng một request.

Header ví dụ:

```http
X-Correlation-Id: req_abc
```

Nếu dùng tracing chuẩn W3C:

```http
traceparent: 00-...
```

### Sản phẩm nên có trong báo cáo

- Ảnh dashboard Grafana.
- Ảnh log tập trung Kibana.
- Ảnh trace request qua nhiều service.
- Mô tả metrics/log/tracing thu thập.

---

# 11. Nhóm kỹ thuật resilience và design patterns chịu lỗi

## 11.1. Resilience4j và các pattern chịu lỗi

### Khái niệm

Resilience là khả năng hệ thống tiếp tục hoạt động khi một phần bị lỗi.

Công cụ được nhắc:

- Resilience4j.

Các kỹ thuật:

- Retry.
- Timeout.
- Circuit breaker.
- Bulkhead.
- Fallback.
- Degrade.
- Rate limiter.

---

## 11.2. Timeout

### Khái niệm

Timeout giới hạn thời gian chờ khi gọi service khác.

### Cách triển khai

- Đặt timeout cho HTTP client.
- Ví dụ 2–5 giây tùy endpoint.
- Không để request treo vô hạn.

```text
Order Service gọi Payment Service
Nếu quá 3 giây không phản hồi → timeout
```

---

## 11.3. Retry

### Khái niệm

Retry là thử lại khi lỗi tạm thời.

### Cách triển khai

- Chỉ retry lỗi tạm thời: timeout, 503.
- Không retry lỗi 400/401/403.
- Có giới hạn số lần retry.
- Dùng exponential backoff.

Ví dụ:

```text
Retry tối đa 3 lần:
lần 1 sau 200ms
lần 2 sau 500ms
lần 3 sau 1000ms
```

---

## 11.4. Circuit Breaker

### Khái niệm

Circuit breaker ngắt tạm thời việc gọi service đang lỗi nhiều để tránh kéo sập hệ thống.

Trạng thái:

- Closed: gọi bình thường.
- Open: chặn request, trả fallback nhanh.
- Half-open: thử lại một số request.

### Ví dụ

```text
Payment Service lỗi 50% request trong 1 phút
→ circuit mở
→ Order Service không gọi Payment nữa
→ trả trạng thái Payment Pending hoặc thông báo thử lại sau
```

---

## 11.5. Bulkhead

### Khái niệm

Bulkhead cô lập tài nguyên để lỗi ở một phần không làm sập toàn bộ hệ thống.

Ví dụ:

- Giới hạn thread pool cho Payment.
- Giới hạn connection pool cho external API.
- Tách queue high/low priority.

---

## 11.6. Fallback và Degrade

### Khái niệm

Fallback là phương án thay thế khi service phụ lỗi.

Degrade là giảm chức năng để hệ thống vẫn chạy.

Ví dụ:

```text
Recommendation Service lỗi
→ hiển thị danh sách sản phẩm phổ biến thay vì cá nhân hóa.
```

---

## 11.7. Rate Limiter

### Khái niệm

Rate limiter giới hạn số request trong một khoảng thời gian.

Ví dụ:

```text
100 request/phút/user
```

Nếu vượt quá:

```http
429 Too Many Requests
```

### Nên đặt ở đâu

- API Gateway.
- Service quan trọng.
- Endpoint nhạy cảm như login.

---

## 11.8. Anti-pattern cần tránh

- Shared database giữa các service.
- Hard-code endpoint.
- Service coupling quá chặt.
- Chatty communication: gọi quá nhiều request nhỏ.
- Retry storm: retry quá nhiều làm hệ thống lỗi nặng hơn.
- Không có timeout.
- Không có monitoring nên lỗi không biết từ đâu.

---

# 12. Nhóm kỹ thuật CI/CD và triển khai cloud

## 12.1. CI/CD Pipeline

### Khái niệm

CI/CD là tự động hóa quy trình build, test và deploy.

Công cụ:

- Jenkins.
- GitHub Actions.
- GitLab CI.

### Pipeline cơ bản

```text
Push code
→ Install dependencies
→ Lint
→ Unit test
→ Integration test
→ Build Docker image
→ Scan image nếu có
→ Push image lên registry
→ Deploy staging
→ Smoke test
```

### GitHub Actions mẫu

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: npm ci
      - name: Test
        run: npm test
      - name: Build Docker image
        run: docker build -t my-service:${{ github.sha }} .
```

### Sản phẩm nên có trong báo cáo

- Ảnh pipeline pass.
- File workflow.
- Bảng các bước CI/CD.
- Mô tả image registry.
- Mô tả deploy staging.

---

## 12.2. Docker Registry

### Khái niệm

Registry là nơi lưu Docker image.

Ví dụ:

- Docker Hub.
- GitHub Container Registry.
- GitLab Container Registry.
- AWS ECR.
- GCP Artifact Registry.
- Azure Container Registry.

### Cách triển khai

1. Build image.
2. Tag image theo version/commit SHA.
3. Login registry.
4. Push image.
5. Kubernetes/Server pull image để deploy.

Ví dụ:

```bash
docker build -t my-org/order-service:1.0.0 .
docker push my-org/order-service:1.0.0
```

---

## 12.3. Cloud Deployment

### Nền tảng được nhắc

- AWS ECS.
- GCP GKE.
- Azure AKS.
- AWS EKS.
- GKE.
- AKS.

### Cách triển khai mức đồ án

Không nhất thiết phải deploy cloud thật nếu giới hạn chi phí. Có thể:

- Deploy local bằng Docker Compose.
- Deploy local Kubernetes bằng Minikube/Kind.
- Mô tả phương án deploy cloud.
- Nếu có điều kiện, deploy staging lên cloud.

### Sản phẩm nên có

- Sơ đồ deployment.
- File Kubernetes YAML/Helm chart.
- Ảnh pod/service chạy.
- Ảnh API truy cập qua gateway/ingress.

---

## 12.4. Deployment Strategy

### Rolling update

Cập nhật dần pod cũ sang pod mới. Đây là mặc định phổ biến trong Kubernetes.

### Blue-Green Deployment

Chạy song song hai môi trường:

- Blue: version đang chạy.
- Green: version mới.

Sau khi test Green ổn thì chuyển traffic sang Green.

### Canary Deployment

Chỉ cho một phần nhỏ traffic vào version mới, ví dụ 5%, rồi tăng dần.

### Rollback

Quay lại version trước khi version mới lỗi.

Kubernetes:

```bash
kubectl rollout undo deployment/order-service
```

Helm:

```bash
helm rollback order-service 1
```

---

# 13. Các loại test và cách triển khai

## 13.1. Endpoint/API Testing

### Khái niệm

Kiểm thử endpoint/API là kiểm tra request/response của API.

Có thể dùng:

- Swagger UI.
- Postman.
- Newman.
- curl.
- k6 ở mức basic.

### Cách triển khai

Test các case:

- Request hợp lệ.
- Request thiếu field.
- Request sai format.
- Không có token.
- Không đủ quyền.
- Resource không tồn tại.
- Business rule sai.

Ví dụ:

```http
POST /orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "productId": "p1", "quantity": 2 }
  ]
}
```

Expected:

```http
201 Created
```

---

## 13.2. Unit Test

### Khái niệm

Unit test kiểm tra một đơn vị nhỏ của code, thường là function/class/service method.

### Nên test gì

- Business rule.
- Validate trạng thái.
- Tính toán.
- Mapper.
- Permission logic.
- Function xử lý lỗi.

### Ví dụ case

Với Order Service:

- Tạo order thành công.
- Không cho tạo order nếu cart rỗng.
- Không cho hủy order đã shipped.
- Pending có thể chuyển sang Paid.
- Completed không được đổi trạng thái.

### Công cụ

- Java: JUnit.
- JavaScript/TypeScript: Jest/Vitest.
- .NET: xUnit/NUnit.
- Python: pytest.

### Sản phẩm nên có

- Bảng số test pass/fail.
- Ảnh coverage nếu có.
- Mô tả các nhóm unit test.

---

## 13.3. Integration Test

### Khái niệm

Integration test kiểm tra nhiều thành phần phối hợp với nhau.

Ví dụ:

- API + database.
- Service + RabbitMQ.
- Repository + database.
- Auth middleware + endpoint.
- Outbox worker + broker.

### Công cụ

- JUnit + Testcontainers.
- Jest + test DB/container.
- Docker Compose test environment.
- Supertest cho API.

### Cách triển khai với Testcontainers

Flow:

```text
1. Test khởi động PostgreSQL/RabbitMQ container.
2. App kết nối vào container đó.
3. Test gọi API/service.
4. Kiểm tra dữ liệu trong DB hoặc message trong queue.
5. Container bị dọn sau test.
```

### Nên test gì

- Tạo order thật vào test DB.
- Publish event sau khi tạo order.
- Consumer nhận event và cập nhật trạng thái.
- Login bằng Keycloak/test auth.
- Repository query đúng.

---

## 13.4. Contract Test

### Khái niệm

Contract test kiểm tra hợp đồng giữa service consumer và service provider.

Công cụ được nhắc:

- Pact.

### Vì sao cần

Trong microservices, service A có thể gọi service B. Nếu B đổi response mà A không biết, hệ thống lỗi. Contract test giúp phát hiện sớm.

### Ví dụ

Consumer Order Service kỳ vọng Product Service trả:

```json
{
  "id": "p1",
  "name": "Product 1",
  "price": 100000,
  "available": true
}
```

Provider Product Service phải đảm bảo API vẫn đáp ứng contract đó.

### Cách triển khai

1. Consumer định nghĩa contract.
2. Chạy consumer test để sinh pact file.
3. Provider chạy test xác nhận mình đáp ứng pact file.
4. Đưa contract test vào CI.

### Khi nào nên làm

Nên làm khi:

- Có nhiều service gọi nhau.
- API giữa service thay đổi thường xuyên.
- Muốn chứng minh hệ thống microservices bài bản.

Nếu đồ án nhỏ, có thể làm 1 contract test mẫu cho một cặp service.

---

## 13.5. Multi-level Testing

### Khái niệm

Multi-level testing là kiểm thử nhiều tầng:

```text
Unit test
→ Integration test
→ Contract test
→ E2E test
→ Performance/Security scenario
```

### Cách trình bày trong báo cáo

Nên có bảng:

| Loại test | Mục tiêu | Công cụ | Phạm vi |
|---|---|---|---|
| Unit | Test logic nhỏ | JUnit/Jest/xUnit | Service/use case |
| Integration | Test service với DB/broker | Testcontainers | API + infra |
| Contract | Test hợp đồng service | Pact | Consumer-provider |
| E2E | Test flow người dùng | Playwright/Postman/Supertest | Toàn hệ thống |
| k6 Load | Test hiệu năng | k6 | API Gateway/service |
| Security scenario | Test auth/rate limit | k6/Postman | API security |

---

## 13.6. CI/CD Automated Testing

### Khái niệm

Automated testing trong CI/CD nghĩa là test tự chạy khi push code hoặc mở pull request.

### Cách triển khai

Pipeline nên có:

```text
install
→ lint
→ unit test
→ integration test
→ build
→ docker build
→ smoke test
→ deploy staging
```

### Lưu ý

- Unit test nên chạy nhanh.
- Integration test có thể chạy khi pull request hoặc trước merge.
- E2E/k6 có thể chạy theo lịch hoặc trước release.
- Không nên chạy soak test dài trong mọi commit.

---

## 13.7. Independent Service Testing

### Khái niệm

Mỗi service nên test được độc lập, không bắt buộc bật toàn bộ hệ thống.

### Cách triển khai

- Mock service phụ.
- Dùng Testcontainers cho DB/broker.
- Dùng contract test thay cho gọi service thật.
- Dùng fake auth token trong môi trường test.
- Có seed data riêng cho test.

### Lợi ích

- Test nhanh hơn.
- Dễ debug hơn.
- Không phụ thuộc service khác đang sống hay chết.

---

## 13.8. E2E Test

### Khái niệm

E2E test kiểm tra một flow hoàn chỉnh từ góc nhìn người dùng hoặc client.

### Ví dụ flow

```text
1. Login
2. Tạo product
3. Tạo order
4. Thanh toán
5. Kiểm tra trạng thái order
6. Kiểm tra notification/event
```

### Công cụ

- Postman/Newman.
- Playwright nếu có frontend.
- Cypress nếu có frontend.
- Supertest nếu test API.
- k6 cũng có thể dùng cho E2E API đơn giản.

### Nên có không?

Nên có. Dù đề cương nhắc rõ unit/integration/contract hơn, E2E giúp chứng minh hệ thống chạy thật từ đầu đến cuối.

---

## 13.9. Smoke Test

### Khái niệm

Smoke test là kiểm tra nhanh sau khi deploy để biết hệ thống có sống không.

### Nên test gì

- `/health`.
- API Gateway route được không.
- Login được không.
- Một endpoint đọc dữ liệu.
- Một endpoint ghi dữ liệu đơn giản.
- DB/Redis/RabbitMQ connection.

### Khi nào chạy

- Sau `docker compose up`.
- Sau deploy staging.
- Sau deploy Kubernetes.
- Trong pipeline trước khi báo deploy thành công.

### Công cụ

- curl script.
- Postman/Newman.
- k6.
- Shell script.

Ví dụ:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/products
```

---

## 13.10. k6 Load Test

### Khái niệm

Load test kiểm tra hệ thống dưới mức tải dự kiến/bình thường.

### Mục tiêu

- Đo throughput.
- Đo latency.
- Đo p95/p99.
- Đo error rate.
- Xem hệ thống có đáp ứng NFR không.

### Kịch bản mẫu

```text
10 virtual users trong 5 phút
50 virtual users trong 10 phút
```

### Endpoint nên test

- Login.
- Search/list product.
- Create order.
- Get order detail.
- Update order status.
- API qua Gateway.

### Chỉ số nên báo cáo

| Chỉ số | Ý nghĩa |
|---|---|
| http_reqs | Tổng số HTTP request |
| http_req_failed | Tỷ lệ request lỗi |
| http_req_duration | Thời gian phản hồi |
| p95 | 95% request nhanh hơn giá trị này |
| p99 | 99% request nhanh hơn giá trị này |
| checks | Số kiểm tra pass/fail |
| iterations | Số vòng lặp hoàn thành |

### k6 script mẫu

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('http://localhost:8000/api/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

---

## 13.11. k6 Stress Test

### Khái niệm

Stress test kiểm tra hệ thống khi tải vượt mức bình thường để xem ngưỡng chịu tải.

### Mục tiêu

- Tìm điểm bắt đầu lỗi.
- Xem latency tăng thế nào.
- Xem service nào nghẽn.
- Kiểm tra khả năng phục hồi sau tải cao.

### Kịch bản mẫu

```text
10 users → 50 users → 100 users → 200 users → giảm về 0
```

### Nên kết hợp với

- Prometheus/Grafana.
- Log tập trung.
- Metrics DB/CPU/RAM.
- Queue depth.

---

## 13.12. k6 Spike Test

### Khái niệm

Spike test kiểm tra tải tăng đột ngột.

### Ví dụ

```text
10 users trong 1 phút
tăng lên 200 users trong 10 giây
giữ 1 phút
giảm về 10 users
```

### Mục tiêu

- Xem hệ thống có bị sập khi traffic tăng đột ngột không.
- Kiểm tra rate limiter.
- Kiểm tra autoscaling nếu có.
- Kiểm tra circuit breaker/fallback.

---

## 13.13. k6 Soak Test

### Khái niệm

Soak test chạy tải vừa phải trong thời gian dài để phát hiện lỗi tích tụ.

### Ví dụ

```text
20 users trong 30 phút hoặc 1 giờ
```

### Mục tiêu

- Memory leak.
- Connection leak.
- Queue backlog.
- Latency tăng theo thời gian.
- Log/error tăng bất thường.

### Có cần làm không?

Nếu thời gian ít, không bắt buộc. Load test và stress test quan trọng hơn với đồ án môn học.

---

## 13.14. Security Scenario Test

### Khái niệm

Security scenario test là kiểm tra các hành vi bảo mật ở tầng API. Đây không phải pentest chuyên sâu.

### Nên test gì

- Không có token → 401.
- Token sai → 401.
- Token hết hạn → 401.
- User không đủ quyền → 403.
- Admin endpoint không cho user thường.
- Rate limit login/API → 429.
- Input sai không làm server lỗi 500.
- Không lộ thông tin nhạy cảm trong error response.

### Công cụ

- k6.
- Postman/Newman.
- OWASP ZAP nếu muốn nâng cao.
- Script tự viết.

### k6 security scenario mẫu

```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const noToken = http.get('http://localhost:8000/api/admin/users');
  check(noToken, {
    'no token returns 401': (r) => r.status === 401,
  });

  const badToken = http.get('http://localhost:8000/api/admin/users', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  check(badToken, {
    'bad token returns 401': (r) => r.status === 401,
  });
}
```

### Cách ghi trong báo cáo

Nên ghi:

> Security scenario test tập trung kiểm tra authentication, authorization, token validation và rate limiting ở tầng API. Phần này không thay thế kiểm thử xâm nhập chuyên sâu.

---

# 14. Gợi ý cách triển khai đồ án theo mức độ

## 14.1. Mức cơ bản

Phù hợp nếu thời gian ít.

Nên có:

- 3 service: User, Product, Order.
- REST API.
- Swagger/OpenAPI.
- Dockerfile từng service.
- Docker Compose.
- Database/schema riêng.
- Unit test.
- Integration test cơ bản.
- Smoke test.
- CI build/test.

## 14.2. Mức khá

Nên có thêm:

- API Gateway.
- JWT/OAuth2/Keycloak.
- RabbitMQ/Kafka cho một flow event.
- Saga hoặc Outbox cho Order → Payment.
- Prometheus/Grafana.
- k6 load test.
- E2E API test.
- Deploy Kubernetes local bằng Minikube/Kind.

## 14.3. Mức tốt

Nên có thêm:

- Service discovery.
- Centralized config.
- ConfigMap/Secret.
- ELK hoặc logging tập trung.
- OpenTelemetry/Zipkin.
- Contract test với Pact.
- CI/CD push Docker image.
- Deploy staging.
- k6 stress/security scenario test.

## 14.4. Mức rất tốt

Nên có thêm:

- Helm chart.
- Canary/blue-green hoặc rollback demo.
- Vault.
- Outbox + Debezium.
- CQRS read model.
- Autoscaling/HPA.
- Observability dashboard đầy đủ.
- Spike/soak test.
- Báo cáo trade-off rõ ràng.

---

# 15. Checklist tổng hợp cho báo cáo

## Kiến trúc

- [ ] Có so sánh Monolithic vs Microservices.
- [ ] Có lý do chọn microservices.
- [ ] Có bảng mapping Bounded Context → Service.
- [ ] Có sơ đồ kiến trúc tổng quan.
- [ ] Có giải thích SRP, high cohesion, low coupling.

## API và giao tiếp

- [ ] Có REST API chuẩn resource.
- [ ] Có Swagger/OpenAPI.
- [ ] Có chuẩn error response.
- [ ] Có pagination/filtering.
- [ ] Có giao tiếp sync hoặc async giữa service.
- [ ] Có event flow nếu dùng messaging.

## Dữ liệu

- [ ] Mỗi service có DB/schema riêng.
- [ ] Không truy cập trực tiếp DB service khác.
- [ ] Có migration/seed.
- [ ] Có xử lý consistency.
- [ ] Có Saga/Outbox nếu có flow phân tán.

## Container/Kubernetes

- [ ] Có Dockerfile.
- [ ] Có Docker Compose.
- [ ] Có Kubernetes Deployment/Service.
- [ ] Có ConfigMap/Secret.
- [ ] Có Minikube/Kind hoặc môi trường tương đương.
- [ ] Có lệnh/ảnh minh chứng chạy được.

## Security

- [ ] Có JWT/OAuth2.
- [ ] Có Keycloak hoặc auth server tương đương.
- [ ] Có RBAC/scopes.
- [ ] Có test 401/403.
- [ ] Không lộ secret trong Git/image/log.

## Observability

- [ ] Có log có correlation ID.
- [ ] Có Prometheus metrics.
- [ ] Có Grafana dashboard.
- [ ] Có tracing nếu nâng cao.
- [ ] Có ảnh minh chứng dashboard/log/trace.

## Resilience

- [ ] Có timeout.
- [ ] Có retry hợp lý.
- [ ] Có circuit breaker nếu gọi service ngoài.
- [ ] Có fallback/degrade nếu phù hợp.
- [ ] Có rate limiting ở gateway/API.

## CI/CD

- [ ] Có workflow CI.
- [ ] Có build/test tự động.
- [ ] Có build Docker image.
- [ ] Có push image registry nếu triển khai.
- [ ] Có deploy staging hoặc mô phỏng deploy.
- [ ] Có smoke test sau deploy.

## Testing

- [ ] Có unit test.
- [ ] Có integration test.
- [ ] Có contract test nếu có nhiều service gọi nhau.
- [ ] Có E2E test.
- [ ] Có smoke test.
- [ ] Có k6 load test nếu đánh giá hiệu năng.
- [ ] Có k6 stress/security scenario nếu muốn nâng cao.
- [ ] Có bảng kết quả test trong báo cáo.

---

# 16. Bộ test khuyến nghị cho đồ án

Nếu cần chọn bộ test vừa đủ, nên làm:

```text
Unit test
+ Integration test
+ E2E test
+ Smoke test
+ k6 Load test
+ Security scenario test
```

Nếu muốn bài mạnh hơn:

```text
Unit test
+ Integration test
+ Contract test
+ E2E test
+ Smoke test
+ k6 Load test
+ k6 Stress test
+ k6 Security scenario
+ CI/CD automated test
```

Nếu không đủ thời gian, tối thiểu nên có:

```text
Unit test
+ Integration test
+ Smoke test
+ k6 Load test đơn giản
```

---

# 17. Cách viết phần “Kỹ thuật đã áp dụng” trong báo cáo

Có thể viết theo mẫu:

```text
Hệ thống được thiết kế theo định hướng microservices, trong đó mỗi service đảm nhiệm một nhóm nghiệp vụ riêng dựa trên nguyên tắc DDD và Bounded Context. Các service giao tiếp với nhau thông qua REST API và cơ chế bất đồng bộ qua message broker cho các nghiệp vụ không yêu cầu phản hồi tức thời.

Về dữ liệu, hệ thống áp dụng nguyên tắc Database per Service nhằm giảm phụ thuộc giữa các dịch vụ. Đối với các nghiệp vụ trải qua nhiều service, hệ thống sử dụng Saga/Outbox Pattern để đảm bảo tính nhất quán cuối cùng và hạn chế mất event khi cập nhật dữ liệu.

Hệ thống được container hóa bằng Docker, chạy cục bộ bằng Docker Compose và có thể triển khai lên Kubernetes thông qua Deployment, Service, ConfigMap và Secret. API Gateway được sử dụng làm điểm vào tập trung, hỗ trợ routing, authentication filter và rate limiting.

Về bảo mật, hệ thống sử dụng JWT/OAuth2 kết hợp RBAC để xác thực và phân quyền. Về quan sát hệ thống, Prometheus và Grafana được sử dụng để thu thập và trực quan hóa metrics; log được chuẩn hóa với correlation ID để hỗ trợ truy vết request.

Quy trình kiểm thử bao gồm unit test, integration test, E2E/smoke test và kiểm thử hiệu năng bằng k6. Các kịch bản k6 tập trung vào load test, stress test và security scenario nhằm đánh giá latency, error rate, khả năng chịu tải và hành vi bảo mật của hệ thống.
```

---

# 18. Kết luận

Các kỹ thuật trong đề cương không chỉ là danh sách công nghệ rời rạc mà tạo thành một chuỗi triển khai hoàn chỉnh cho hệ thống microservices:

```text
DDD
→ tách service
→ REST/message communication
→ database per service
→ Saga/Outbox/CQRS nếu cần
→ Docker/Kubernetes
→ API Gateway/Service Discovery
→ Security
→ Config/Secrets
→ Logging/Monitoring/Tracing
→ Resilience
→ CI/CD
→ Testing đa tầng
```

Với đồ án môn học, không cần triển khai tất cả ở mức production. Quan trọng nhất là chọn một tập kỹ thuật hợp lý, triển khai chạy được, có test, có minh chứng và giải thích rõ trade-off.
