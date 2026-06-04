# Notification Service API Specification

- **Base URL qua Kong:** `http://localhost:8000`
- **Service paths:** `/notifications`, `/admin/academic-warnings`
- **Direct local:** `http://localhost:3006`
- **Swagger UI:** `http://localhost:3006/docs`
- **Swagger UI qua Kong:** `http://localhost:8000/notification-service/docs`
- **OpenAPI JSON:** `http://localhost:3006/docs-json`
- **OpenAPI JSON qua Kong:** `http://localhost:8000/notification-service/docs-json`
- **Version:** `1.0.0`

Notification-service lưu in-app notifications, gửi email qua SMTP, gửi push qua Firebase Cloud Messaging, và consume RabbitMQ events từ các service khác. Frontend gọi các API được bảo vệ bằng `Authorization: Bearer <access_token>`; current user id được đọc từ JWT `sub`.

SMTP dùng các biến `KEYCLOAK_SMTP_*` trong root `.env`. Push dùng `FCM_CREDENTIALS`; nếu biến này trống thì push delivery sẽ bị skip nhưng service vẫn chạy.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `POST /admin/academic-warnings` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /notifications/me` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `PATCH /notifications/:id/read` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `POST /notifications/devices` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `DELETE /notifications/devices/:token` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |

---

## Response Format

HTTP response thành công được wrap bởi global `ApiResponseInterceptor`.

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

Error response:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/admin/academic-warnings"
}
```

---

## Enums

`NotificationType`: `IN_APP` | `EMAIL` | `PUSH` | `SMS`

`NotificationStatus`: `QUEUED` | `DELIVERED` | `FAILED`

Academic warning delivery status values: `PENDING`, `QUEUED`, `PENDING_RETRY`, `FAILED`, `SENT`.

---

## Shared Schemas

### `Notification`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `uuid` | Notification id |
| `userId` | `uuid` | Recipient user id |
| `type` | `NotificationType` | Bản ghi theo kênh delivery |
| `eventType` | `string | null` | Event nguồn, ví dụ `identity.user.created` |
| `title` | `string` | Tiêu đề notification |
| `body` | `string` | Nội dung notification |
| `data` | `object` | Metadata bổ sung |
| `status` | `NotificationStatus` | Delivery status của bản ghi theo kênh |
| `retryCount` | `number` | Số lần retry từ RabbitMQ headers/payload |
| `errorMessage` | `string | null` | Lỗi delivery gần nhất |
| `isRead` | `boolean` | Recipient đã đọc hay chưa |
| `readAt` | `string | null` | Thời điểm đọc |
| `sentAt` | `string | null` | Legacy/send timestamp field |
| `deliveredAt` | `string | null` | Thời điểm delivery thành công |
| `createdAt` | `string` | Thời điểm tạo |
| `updatedAt` | `string` | Thời điểm cập nhật cuối |

### `ListNotificationsResponse`

```json
{
  "items": [
    {
      "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
      "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
      "type": "IN_APP",
      "eventType": "notification.academic-warning.created",
      "title": "Academic warning: HIGH",
      "body": "Ôn lại các nhóm câu hỏi còn yếu trước khi thi tiếp.",
      "data": {
        "warningId": "48c7047d-3db9-4dc0-bb75-b68735ab51ea",
        "reason": "LOW_EXAM_SCORE",
        "severity": "HIGH"
      },
      "status": "DELIVERED",
      "retryCount": 0,
      "errorMessage": null,
      "isRead": false,
      "readAt": null,
      "sentAt": null,
      "deliveredAt": "2026-05-21T10:00:00.000Z",
      "createdAt": "2026-05-21T10:00:00.000Z",
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

---

## Endpoints

### POST `/admin/academic-warnings`

Tạo academic warning records cho một hoặc nhiều học viên, publish event `notification.academic-warning.queued` vào RabbitMQ, rồi trả `202 Accepted`. `createdById` được lấy từ JWT `sub` của caller.

HTTP API chỉ chấp nhận requested channel `IN_APP`. Email và push được resolve bởi notification-service config và event payload; admin endpoint hiện chưa nhận `studentEmail`, nên academic warning được tạo từ endpoint này sẽ dispatch `IN_APP` và `PUSH`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Body**

```json
{
  "studentIds": ["89ea9a17-1cce-4fff-855c-d32a081648cd"],
  "deliveryChannels": ["IN_APP"],
  "reason": "LOW_EXAM_SCORE",
  "severity": "HIGH",
  "message": "Ôn lại các nhóm câu hỏi còn yếu trước khi thi tiếp."
}
```

**Validation**

| Field | Required | Rule |
| --- | --- | --- |
| `studentId` | conditional | UUID. Field single recipient giữ để backward-compatible |
| `studentIds` | conditional | Non-empty UUID array. Bắt buộc khi không gửi `studentId` |
| `deliveryChannels` | no | Non-empty enum array. Endpoint này chỉ chấp nhận `IN_APP` |
| `reason` | yes | Non-empty string |
| `severity` | yes | Non-empty string, recommended values: `LOW`, `MEDIUM`, `HIGH` |
| `message` | yes | Non-empty string |

**Response `202`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/admin/academic-warnings",
  "data": {
    "status": "ACCEPTED",
    "accepted": 1,
    "studentIds": ["89ea9a17-1cce-4fff-855c-d32a081648cd"],
    "message": "Academic warning notifications were queued for asynchronous delivery."
  }
}
```

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/notifications/me`

Trả về notifications của current user theo thứ tự mới nhất trước.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Query Parameters**

| Name | Type | Required | Default | Rule |
| --- | --- | --- | --- | --- |
| `page` | `number` | no | `1` | Minimum 1 |
| `size` | `number` | no | `20` | Minimum 1, maximum 100 |

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/notifications/me?page=1&size=20",
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "size": 20
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### PATCH `/notifications/:id/read`

Đánh dấu một notification là đã đọc. Service kiểm tra ownership bằng JWT `sub`; user không thể mark notification của người khác.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Notification id |

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
    "title": "Academic warning: HIGH",
    "body": "Ôn lại các nhóm câu hỏi còn yếu trước khi thi tiếp.",
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
    "sentAt": null,
    "deliveredAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:03:00.000Z"
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`.

---

### POST `/notifications/devices`

Đăng ký hoặc cập nhật device token của current user để gửi FCM push.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Body**

```json
{
  "token": "fcm-device-token",
  "platform": "android"
}
```

| Field | Required | Rule |
| --- | --- | --- |
| `token` | yes | Non-empty string |
| `platform` | yes | `ios` hoặc `android` |

**Response `201`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/notifications/devices",
  "data": {
    "id": "bd4d6107-04a8-4480-9314-cf844063adf7",
    "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "token": "fcm-device-token",
    "platform": "android",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:00:00.000Z"
  }
}
```

---

### DELETE `/notifications/devices/:token`

Xóa một device token registration.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Response:** `204 No Content`

---

## Events

Notification-service consume RabbitMQ messages từ queue `notification_service_events`.

| Event | Required payload | Effect |
| --- | --- | --- |
| `identity.user.created` | `userId`, `email`, `fullName?` | Gửi welcome `IN_APP` và `EMAIL` |
| `identity.user.password-reset-requested` | `userId`, `email`, `resetUrl` | Gửi password reset `EMAIL` khi có publisher emit event này |
| `exam.session.passed` | `studentId` hoặc `userId`; optional `email`, `sessionId`, `licenseCategory`, `score` | Gửi kết quả `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `email` |
| `exam.session.failed` | Giống `exam.session.passed` | Gửi kết quả `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `email` |
| `notification.academic-warning.queued` | `studentId`, `reason`, `severity`, `message`, `createdById`, optional `warningId`, `studentEmail` | Gửi academic warning `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `studentEmail` |
| `course.updated` | `recipientId`, `courseId`, `courseTitle`, `updateSummary`, optional `recipientEmail` | Gửi course update `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `recipientEmail` |

Invalid payload sẽ được skip khi handler có thể xác định thiếu recipient một cách an toàn. Delivery failures sẽ throw lên common RabbitMQ retry interceptor.

---

## Retry Và DLQ

RabbitMQ resilience được cung cấp bởi `@repo/common`:

- Main queue: `notification_service_events`
- Retry queues: `notification_service_events.retry.1`, `notification_service_events.retry.2`, ...
- DLQ: `notification_service_events.dlq`

`retry.maxAttempts` quyết định số retry queues được tạo. `retry.intervalMs` quyết định TTL của mỗi retry queue, default là `300000`.
