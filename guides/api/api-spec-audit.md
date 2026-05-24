# Audit Service API Specification

**Service:** `audit-service`  
**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/admin/audit-logs`  
**Direct local:** `http://localhost:3011`  
**Swagger UI:** `http://localhost:3011/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/audit-service/docs`  
**OpenAPI JSON:** `http://localhost:3011/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/audit-service/docs-json`

Audit-service là source of truth cho centralized audit trail. Service này không ghi access log thay cho ELK; nó chỉ lưu các hành động security/business quan trọng dưới dạng append-only.

Frontend/admin client chỉ gửi:

```http
Authorization: Bearer <access_token>
```

Không gửi `x-user-id` hoặc `x-user-role`. Service lấy actor từ JWT/Keycloak guard giống các service khác.

---

## What Was Implemented

Security tactic hiện tại gồm 3 phần:

| Layer | Triển khai ở đâu | Mục đích |
| --- | --- | --- |
| Access logging | `@repo/common` interceptor/middleware, mọi NestJS service | Ghi metadata mọi HTTP request vào Winston/Logstash/Elasticsearch. |
| Transactional outbox | `user-service`, `course-service`, `exam-service` | Ghi audit event cùng transaction với business mutation để không mất event khi RabbitMQ lỗi. |
| Centralized audit trail | `audit-service` | Consume `security.audit.recorded` và lưu immutable/idempotent vào `audit_db.audit_logs`. |

Phase hiện tại audit các mutation quan trọng:

| Producer service | Audited actions |
| --- | --- |
| `user-service` | `USER_LICENSE_ASSIGNED` |
| `course-service` | `COURSE_CREATED`, `COURSE_UPDATED`, `COURSE_ARCHIVED`, `COURSE_ACTIVATED`, `COURSE_LESSON_ADDED`, `COURSE_LESSON_REMOVED`, `COURSE_MATERIAL_ADDED`, `ENROLLMENT_PROGRESS_RESET` |
| `exam-service` | `EXAM_TEMPLATE_CREATED`, `EXAM_TEMPLATE_UPDATED`, `EXAM_TEMPLATE_DELETED` |

---

## Security Model

| Endpoint | Roles | Notes |
| --- | --- | --- |
| `GET /admin/audit-logs` | `ADMIN`, `CENTER_MANAGER` | Search/paginate audit records. |
| `GET /admin/audit-logs/:id` | `ADMIN`, `CENTER_MANAGER` | Get one audit record detail. |

Audit log is append-only:

- Không có create API public. Audit record đến từ RabbitMQ event `security.audit.recorded`.
- Không có update/delete API.
- Duplicate event được xử lý idempotent bằng unique `eventId`.

---

## Response Format

Tất cả HTTP success response được bọc bởi `ApiResponseInterceptor`:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-24T10:00:00.000Z",
  "path": "/admin/audit-logs",
  "data": {}
}
```

Lỗi dùng format chung:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "2026-05-24T10:00:00.000Z",
  "path": "/admin/audit-logs?size=200"
}
```

---

## Error Codes

| HTTP | Code | Khi nào |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Query sai kiểu, `page < 1`, `size > 100`, `from/to` không phải ISO date. |
| 401 | `UNAUTHORIZED` | Thiếu/sai JWT. |
| 403 | `FORBIDDEN` | Role không phải `ADMIN` hoặc `CENTER_MANAGER`. |
| 404 | `AUDIT_LOG_NOT_FOUND` hoặc `NOT_FOUND` | Không tìm thấy audit log id. |

---

## Shared Shapes

### Audit Log Record

```json
{
  "id": "1c3f8bc9-b6b1-4374-94a0-583d21fe04c8",
  "eventId": "cdb3c3a5-c30e-49a0-9960-d9714c015cec",
  "serviceName": "user-service",
  "actorId": "admin-keycloak-sub",
  "actorRole": "ADMIN",
  "action": "USER_LICENSE_ASSIGNED",
  "resourceType": "USER_PROFILE",
  "resourceId": "student-user-id",
  "outcome": "SUCCESS",
  "occurredAt": "2026-05-24T10:30:00.000Z",
  "correlationId": "f4f08b8b-2f5d-4b8a-8a96-e278528802cb",
  "ipAddress": "127.0.0.1",
  "userAgent": "Mozilla/5.0",
  "requestPath": "/admin/users/student-user-id/license-tier",
  "httpMethod": "PATCH",
  "metadata": {
    "newLicenseTier": "B1"
  },
  "createdAt": "2026-05-24T10:30:01.000Z"
}
```

Field meaning:

| Field | Meaning |
| --- | --- |
| `id` | Primary key trong `audit_db.audit_logs`. |
| `eventId` | Idempotency key từ producer outbox. Duplicate eventId chỉ lưu 1 row. |
| `serviceName` | Service phát sinh hành động, ví dụ `course-service`. |
| `actorId` | Keycloak `sub` của actor. |
| `actorRole` | Role tại thời điểm request nếu lấy được. |
| `action` | Action business/security chuẩn hóa. |
| `resourceType` | Loại resource bị tác động. |
| `resourceId` | ID resource bị tác động. |
| `outcome` | Phase hiện tại chủ yếu là `SUCCESS`. |
| `occurredAt` | Thời điểm producer tạo audit event. |
| `correlationId` | Dùng để join audit log với access/application log trong ELK. |
| `metadata` | JSON đã sanitize, không chứa token/password/secret. |

Metadata không được chứa `password`, token, Authorization header, client secret, storage key hoặc raw request body nhạy cảm.

---

## Endpoints

### GET `/admin/audit-logs`

Search centralized audit logs.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Query**

| Query | Type | Required | Default | Validation/Notes |
| --- | --- | --- | --- | --- |
| `actorId` | string | No | - | Keycloak `sub` của người thực hiện. |
| `action` | string | No | - | Ví dụ `USER_LICENSE_ASSIGNED`. |
| `resourceType` | string | No | - | Ví dụ `COURSE`, `EXAM_TEMPLATE`. |
| `resourceId` | string | No | - | UUID/id resource. |
| `serviceName` | string | No | - | Ví dụ `course-service`. |
| `from` | ISO date string | No | - | Filter `occurredAt >= from`. |
| `to` | ISO date string | No | - | Filter `occurredAt <= to`. |
| `page` | number | No | `1` | Min `1`. |
| `size` | number | No | `20` | Min `1`, max `100`. |

**Example**

```http
GET /admin/audit-logs?action=USER_LICENSE_ASSIGNED&page=1&size=20
Authorization: Bearer <admin_access_token>
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-24T10:31:00.000Z",
  "path": "/admin/audit-logs?action=USER_LICENSE_ASSIGNED&page=1&size=20",
  "data": {
    "items": [
      {
        "id": "1c3f8bc9-b6b1-4374-94a0-583d21fe04c8",
        "eventId": "cdb3c3a5-c30e-49a0-9960-d9714c015cec",
        "serviceName": "user-service",
        "actorId": "admin-keycloak-sub",
        "actorRole": "ADMIN",
        "action": "USER_LICENSE_ASSIGNED",
        "resourceType": "USER_PROFILE",
        "resourceId": "student-user-id",
        "outcome": "SUCCESS",
        "occurredAt": "2026-05-24T10:30:00.000Z",
        "correlationId": "f4f08b8b-2f5d-4b8a-8a96-e278528802cb",
        "ipAddress": "127.0.0.1",
        "userAgent": "curl/8.0.0",
        "requestPath": "/admin/users/student-user-id/license-tier",
        "httpMethod": "PATCH",
        "metadata": {
          "newLicenseTier": "B1"
        },
        "createdAt": "2026-05-24T10:30:01.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

**Useful filters**

```http
GET /admin/audit-logs?serviceName=course-service&action=COURSE_ARCHIVED
GET /admin/audit-logs?resourceType=COURSE&resourceId=<course-id>
GET /admin/audit-logs?actorId=<admin-sub>&from=2026-05-24T00:00:00.000Z&to=2026-05-24T23:59:59.999Z
```

`correlationId` hiện có trong response và DB index để điều tra, nhưng API filter phase này chưa expose query `correlationId`.

---

### GET `/admin/audit-logs/:id`

Get one audit record detail.

**Auth:** `ADMIN`, `CENTER_MANAGER`

**Example**

```http
GET /admin/audit-logs/1c3f8bc9-b6b1-4374-94a0-583d21fe04c8
Authorization: Bearer <admin_access_token>
```

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-24T10:32:00.000Z",
  "path": "/admin/audit-logs/1c3f8bc9-b6b1-4374-94a0-583d21fe04c8",
  "data": {
    "id": "1c3f8bc9-b6b1-4374-94a0-583d21fe04c8",
    "eventId": "cdb3c3a5-c30e-49a0-9960-d9714c015cec",
    "serviceName": "user-service",
    "actorId": "admin-keycloak-sub",
    "actorRole": "ADMIN",
    "action": "USER_LICENSE_ASSIGNED",
    "resourceType": "USER_PROFILE",
    "resourceId": "student-user-id",
    "outcome": "SUCCESS",
    "occurredAt": "2026-05-24T10:30:00.000Z",
    "correlationId": "f4f08b8b-2f5d-4b8a-8a96-e278528802cb",
    "ipAddress": "127.0.0.1",
    "userAgent": "curl/8.0.0",
    "requestPath": "/admin/users/student-user-id/license-tier",
    "httpMethod": "PATCH",
    "metadata": {
      "newLicenseTier": "B1"
    },
    "createdAt": "2026-05-24T10:30:01.000Z"
  }
}
```

**Response `404 Not Found`**

```json
{
  "success": false,
  "code": "AUDIT_LOG_NOT_FOUND",
  "message": "Audit log not found: 1c3f8bc9-b6b1-4374-94a0-583d21fe04c8",
  "timestamp": "2026-05-24T10:32:00.000Z",
  "path": "/admin/audit-logs/1c3f8bc9-b6b1-4374-94a0-583d21fe04c8"
}
```

---

## Messaging Contract

Audit-service consumes RabbitMQ event:

```text
security.audit.recorded
```

Queue:

```text
audit_service_events
```

Producer outbox payload:

```json
{
  "eventId": "cdb3c3a5-c30e-49a0-9960-d9714c015cec",
  "eventName": "security.audit.recorded",
  "schemaVersion": 1,
  "serviceName": "course-service",
  "actorId": "admin-keycloak-sub",
  "actorRole": "ADMIN",
  "action": "COURSE_ARCHIVED",
  "resourceType": "COURSE",
  "resourceId": "course-id",
  "outcome": "SUCCESS",
  "occurredAt": "2026-05-24T10:30:00.000Z",
  "correlationId": "f4f08b8b-2f5d-4b8a-8a96-e278528802cb",
  "ipAddress": "127.0.0.1",
  "userAgent": "curl/8.0.0",
  "requestPath": "/admin/courses/course-id",
  "httpMethod": "DELETE",
  "metadata": {
    "status": "ARCHIVED"
  }
}
```

Idempotency rule:

- `audit_logs.eventId` is unique.
- Receiving the same event twice must keep one row only.

---

## Producer Audit Matrix

### `user-service`

| Endpoint | Action | Resource | Metadata |
| --- | --- | --- | --- |
| `PATCH /admin/users/:id/license-tier` | `USER_LICENSE_ASSIGNED` | `USER_PROFILE/:id` | `{ "newLicenseTier": "B1" }` |

### `course-service`

| Endpoint | Action | Resource | Metadata |
| --- | --- | --- | --- |
| `POST /admin/courses` | `COURSE_CREATED` | `COURSE/:id` | `{ "title": "...", "licenseCategory": "B2" }` |
| `PATCH /admin/courses/:id` | `COURSE_UPDATED` | `COURSE/:id` | `{ "title": "..." }` |
| `PATCH /admin/courses/:id/activate` | `COURSE_ACTIVATED` | `COURSE/:id` | `{ "status": "ACTIVE" }` |
| `DELETE /admin/courses/:id` | `COURSE_ARCHIVED` | `COURSE/:id` | `{ "status": "ARCHIVED" }` |
| `POST /admin/courses/:id/lessons` | `COURSE_LESSON_ADDED` | `COURSE/:id` | `{ "title": "...", "order": 1 }` |
| `DELETE /admin/courses/:id/lessons/:lessonId` | `COURSE_LESSON_REMOVED` | `COURSE/:id` | `{ "lessonId": "..." }` |
| `POST /admin/courses/:id/materials` | `COURSE_MATERIAL_ADDED` | `COURSE/:id` | `{ "title": "...", "mediaFileId": "..." }` |
| `POST /enrollments/:id/reset-progress` | `ENROLLMENT_PROGRESS_RESET` | `COURSE_ENROLLMENT/:id` | `{ "courseId": "..." }` |

### `exam-service`

| Endpoint | Action | Resource | Metadata |
| --- | --- | --- | --- |
| `POST /admin/exams/templates` | `EXAM_TEMPLATE_CREATED` | `EXAM_TEMPLATE/:id` | `{ "name": "...", "licenseCategory": "B1" }` |
| `PATCH /admin/exams/templates/:id` | `EXAM_TEMPLATE_UPDATED` | `EXAM_TEMPLATE/:id` | `{ "name": "...", "version": 2 }` |
| `DELETE /admin/exams/templates/:id` | `EXAM_TEMPLATE_DELETED` | `EXAM_TEMPLATE/:id` | `{ "name": "...", "version": 3 }` |

---

## Database Notes

Main table:

```sql
audit_logs
```

Important indexes:

```text
eventId unique
(actorId, occurredAt)
(action, occurredAt)
(resourceType, resourceId)
(serviceName, occurredAt)
correlationId
```

Producer outbox table exists in:

```text
user_db.outbox_messages
course_db.outbox_messages
exam_db.outbox_messages
```

Outbox relay behavior:

- Flush interval: about 5 seconds.
- Batch size: 20 pending messages.
- Retry status: `PENDING` until attempts reach 10.
- Terminal failure: `FAILED`.
- Successful publish: `PUBLISHED`, `publishedAt` set.
