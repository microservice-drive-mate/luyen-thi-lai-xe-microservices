# Notification Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths qua Kong:** `/notifications`, `/admin/academic-warnings`, `/notification-service/docs`  
**Direct local:** `http://localhost:3006`  
**Swagger UI:** `http://localhost:3006/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/notification-service/docs`  
**OpenAPI JSON:** `http://localhost:3006/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/notification-service/docs-json`  
**Version:** 1.0.0

Notification-service lưu thông báo in-app, audit cảnh báo học tập và device token dùng cho push notification. Frontend gọi các HTTP API bằng `Authorization: Bearer <access_token>`. User hiện tại được lấy từ JWT `sub`; client không gửi `x-user-id`.

Gửi thông báo nội bộ là luồng bất đồng bộ. Các service khác emit RabbitMQ event vào queue `notification_service_events`; notification-service consume event, tạo bản ghi `Notification`, gửi qua `IN_APP`, `EMAIL` hoặc `PUSH`, retry khi lỗi và đưa message vào DLQ khi vượt số lần retry.

## Authentication

Tất cả endpoint dưới đây dùng `ApiBearerAuth` và Keycloak role guard.

| Endpoint | Role |
| --- | --- |
| `POST /admin/academic-warnings` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /notifications/me` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `PATCH /notifications/:id/read` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `POST /notifications/devices` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `DELETE /notifications/devices/:token` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |

## Response Format

Service dùng `ApiResponseInterceptor` từ `@repo/common`, nên response thành công được bọc dạng:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/notifications/me",
  "data": {}
}
```

Response lỗi thường có dạng:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/admin/academic-warnings"
}
```

## Error Codes

| HTTP | Code | Nguyên nhân |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Body/query/path không hợp lệ |
| 401 | `UNAUTHORIZED` | Thiếu hoặc sai access token |
| 403 | `FORBIDDEN` | Token hợp lệ nhưng role không được phép |
| 404 | `NOT_FOUND` | Notification không tồn tại hoặc không thuộc user hiện tại |
| 500 | `INTERNAL_ERROR` | Lỗi database, RabbitMQ hoặc provider gửi thông báo |

## Enums

`NotificationType`: `IN_APP` | `EMAIL` | `PUSH` | `SMS`

`NotificationStatus`: `PENDING` | `QUEUED` | `DELIVERED` | `FAILED`

Code hiện tại dispatch các kênh `IN_APP`, `EMAIL`, `PUSH`. `SMS` chỉ là enum giữ chỗ trong schema Prisma.

## Shared Schemas

### `Notification`

| Field | Type | Mô tả |
| --- | --- | --- |
| `id` | `uuid` | ID thông báo |
| `userId` | `string` | ID người nhận, lấy theo user id nội bộ/JWT `sub` |
| `type` | `NotificationType` | Kênh gửi |
| `eventType` | `string | null` | Event nguồn, ví dụ `identity.user.created` |
| `title` | `string` | Tiêu đề |
| `body` | `string` | Nội dung |
| `data` | `object` | Metadata bổ sung |
| `status` | `NotificationStatus` | Trạng thái gửi |
| `retryCount` | `number` | Số lần retry ở message/event hiện tại |
| `errorMessage` | `string | null` | Lỗi gửi gần nhất, nếu có |
| `isRead` | `boolean` | User đã đọc hay chưa |
| `readAt` | `string | null` | ISO datetime lúc đọc |
| `sentAt` | `string | null` | ISO datetime lúc gửi/đánh dấu delivered |
| `deliveredAt` | `string | null` | ISO datetime lúc gửi thành công |
| `createdAt` | `string` | ISO datetime lúc tạo |
| `updatedAt` | `string` | ISO datetime lúc cập nhật |

### `DeviceToken`

| Field | Type | Mô tả |
| --- | --- | --- |
| `id` | `uuid` | ID bản ghi |
| `userId` | `string` | User sở hữu token |
| `token` | `string` | Device token FCM/APNs |
| `platform` | `ios | android` | Nền tảng client gửi lên |
| `createdAt` | `string` | ISO datetime lúc tạo |
| `updatedAt` | `string` | ISO datetime lúc cập nhật |

## Endpoints

### POST `/admin/academic-warnings`

Đưa một cảnh báo học tập vào hàng đợi. Controller publish event `notification.academic-warning.queued` vào RabbitMQ rồi trả `202 Accepted`. Worker của notification-service consume event này, tạo `AcademicWarning`, tạo thông báo `IN_APP`, gửi `PUSH`, và gửi `EMAIL` nếu payload event có `studentEmail`.

Lưu ý theo code hiện tại: HTTP request body chưa có field `studentEmail`, nên luồng tạo cảnh báo qua endpoint này chỉ có `IN_APP` và `PUSH`; muốn có email cần publish event trực tiếp với `studentEmail`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Headers**

```http
Authorization: Bearer <admin_or_instructor_access_token>
```

**Body**

```json
{
  "studentId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
  "reason": "LOW_EXAM_SCORE",
  "severity": "HIGH",
  "message": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp."
}
```

**Validation**

| Field | Bắt buộc | Quy tắc |
| --- | --- | --- |
| `studentId` | có | UUID |
| `reason` | có | string không rỗng |
| `severity` | có | string không rỗng. Khuyến nghị: `LOW`, `MEDIUM`, `HIGH` |
| `message` | có | string không rỗng |

**Response `202 Accepted`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/admin/academic-warnings",
  "data": {
    "status": "ACCEPTED",
    "message": "Cảnh báo học tập đã được đưa vào hàng đợi; học viên sẽ nhận thông báo bất đồng bộ."
  }
}
```

**Lỗi thường gặp:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/notifications/me`

Trả về danh sách thông báo của người dùng hiện tại, mới nhất trước. User id lấy từ JWT `sub`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Query Parameters**

| Tên | Type | Bắt buộc | Mặc định | Xử lý trong code |
| --- | --- | --- | --- | --- |
| `page` | `number` | không | `1` | `Math.max(page, 1)` |
| `size` | `number` | không | `20` | clamp trong khoảng `1..100` |

DTO hiện tại chỉ dùng `@IsOptional()`, chưa có `@IsInt()`, `@Min()` hoặc `@Max()`. `ValidationPipe({ transform: true })` sẽ cố transform query primitive, sau đó use case tự clamp giá trị.

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/notifications/me?page=1&size=20",
  "data": {
    "items": [
      {
        "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
        "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
        "type": "IN_APP",
        "eventType": "exam.session.passed",
        "title": "Bạn đã vượt qua bài thi",
        "body": "Chúc mừng! Bạn đã hoàn thành bài thi B2. Điểm: 28.",
        "data": {
          "sessionId": "7976cf6d-5aab-4a6d-bd34-3e97bdade9cd",
          "licenseCategory": "B2",
          "score": 28,
          "passed": true
        },
        "status": "DELIVERED",
        "retryCount": 0,
        "errorMessage": null,
        "isRead": false,
        "readAt": null,
        "sentAt": "2026-05-21T10:00:00.000Z",
        "deliveredAt": "2026-05-21T10:00:00.000Z",
        "createdAt": "2026-05-21T10:00:00.000Z",
        "updatedAt": "2026-05-21T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

**Lỗi thường gặp:** `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### PATCH `/notifications/:id/read`

Đánh dấu một thông báo là đã đọc. Repository tìm theo `{ id, userId }`, nên user không thể đánh dấu thông báo của user khác.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Path Parameters**

| Tên | Type | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `id` | `string` | có | ID thông báo. Code hiện tại chưa validate UUID ở decorator |

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:03:00.000Z",
  "path": "/notifications/0b9cb629-4f43-4f4f-a936-7dc664a7351e/read",
  "data": {
    "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
    "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "type": "IN_APP",
    "eventType": "notification.academic-warning.created",
    "title": "Cảnh báo học tập: HIGH",
    "body": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp.",
    "data": {
      "warningId": "48c7047d-3db9-4dc0-bb75-b68735ab51ea",
      "reason": "LOW_EXAM_SCORE",
      "severity": "HIGH"
    },
    "status": "DELIVERED",
    "retryCount": 0,
    "errorMessage": null,
    "isRead": true,
    "readAt": "2026-05-21T10:03:00.000Z",
    "sentAt": "2026-05-21T10:00:00.000Z",
    "deliveredAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:03:00.000Z"
  }
}
```

**Lỗi thường gặp:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`.

---

### POST `/notifications/devices`

Đăng ký mới hoặc refresh device token FCM/APNs cho user hiện tại. Token là unique. Nếu token đã tồn tại, repository update lại `userId` và `platform`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Headers**

```http
Authorization: Bearer <access_token>
```

**Body**

```json
{
  "token": "fcm-device-token",
  "platform": "android"
}
```

**Validation**

| Field | Bắt buộc | Quy tắc |
| --- | --- | --- |
| `token` | có | string không rỗng |
| `platform` | có | `ios` hoặc `android` |

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/notifications/devices",
  "data": {
    "id": "5ccf8781-1bbd-4d55-9a95-9e51d0b2fdf6",
    "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "token": "fcm-device-token",
    "platform": "android",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Lỗi thường gặp:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### DELETE `/notifications/devices/:token`

Hủy đăng ký một device token. Code hiện tại xóa theo `token` và không lọc thêm `userId`; nếu token không tồn tại thì repository bỏ qua và vẫn trả `204 No Content`.

Token cũng có thể bị xóa tự động khi FCM báo token không hợp lệ.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Path Parameters**

| Tên | Type | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `token` | `string` | có | Device token cần hủy |

**Response `204 No Content`**

Không có body.

**Lỗi thường gặp:** `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

## Events Consumed

Notification-service bind vào queue `notification_service_events`.

| Event pattern | Payload chính | Kênh gửi |
| --- | --- | --- |
| `identity.user.created` | `userId`, `email`, `fullName?` | `IN_APP`, `EMAIL` |
| `identity.user.password-reset-requested` | `userId`, `email`, `resetUrl` | `EMAIL` |
| `exam.session.passed` | `studentId` hoặc `userId`, `email?`, `sessionId?`, `licenseCategory?`, `score?` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có `email` |
| `exam.session.failed` | giống `exam.session.passed` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có `email` |
| `notification.academic-warning.queued` | `studentId`, `reason`, `severity`, `message`, `createdById`, `studentEmail?`, `warningId?` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có `studentEmail` |
| `course.updated` | `recipientId`, `recipientEmail?`, `courseId`, `courseTitle`, `updateSummary` | `IN_APP`, `PUSH`, thêm `EMAIL` nếu có `recipientEmail` |

Mỗi payload có thể kèm `retryCount`; field này do retry publisher set khi replay message.

## RabbitMQ Retry và DLQ

| Thành phần | Tên |
| --- | --- |
| Queue chính | `notification_service_events` |
| Retry exchange | `notification.retry` |
| Retry queue | `notification_service_retry` |
| DLQ exchange | `notification.dlx` |
| DLQ | `notification_service_dlq` |

Khi handler lỗi:

1. Nếu chưa vượt `retry.maxAttempts`, service ack message gốc và publish lại vào retry exchange.
2. Retry queue giữ message theo TTL `retry.intervalMs`.
3. Hết TTL, RabbitMQ route message lại queue chính.
4. Nếu vượt `retry.maxAttempts`, service nack message để dead-letter sang `notification_service_dlq`.

Chi tiết chạy local, config Consul, Firebase/SMTP và ví dụ service-to-service nằm ở [`apps/notification-service/README.md`](../../apps/notification-service/README.md).
