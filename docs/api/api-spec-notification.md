# Notification Service API Specification

- **Base URL qua Kong:** `http://localhost:8000`
- **Service paths:** `/notifications`, `/admin/academic-warnings`
- **Realtime Socket.IO namespace:** `/notifications`
- **Realtime Socket.IO path:** `/notifications/socket.io`
- **Direct local:** `http://localhost:3006`
- **Swagger UI:** `http://localhost:3006/docs`
- **Swagger UI qua Kong:** `http://localhost:8000/notification-service/docs`
- **OpenAPI JSON:** `http://localhost:3006/docs-json`
- **OpenAPI JSON qua Kong:** `http://localhost:8000/notification-service/docs-json`
- **Version:** `1.0.0`

In-app notifications also support realtime delivery over Socket.IO. The client connects to namespace `/notifications` using Engine.IO path `/notifications/socket.io`. The same Keycloak access token is sent in `auth.token` or `Authorization: Bearer <access_token>` during the socket handshake.

Notification-service lưu in-app notifications, gửi email qua SMTP, gửi push qua Firebase Cloud Messaging, và consume RabbitMQ events từ các service khác. Frontend gọi các API được bảo vệ bằng `Authorization: Bearer <access_token>`; current user id được đọc từ JWT `sub`.

SMTP dùng các biến `KEYCLOAK_SMTP_*` trong root `.env`. Push dùng `FCM_CREDENTIALS`; nếu biến này trống thì push delivery sẽ bị skip nhưng service vẫn chạy. File `apps/notification-service/.env` có thể dùng để override các biến chạy riêng của service như `CONSUL_URL`, `DATABASE_URL`, `RABBITMQ_URL`, nhưng SMTP/FCM nên giữ ở root `.env` để Consul seed đồng bộ.

---

## Authentication

| Endpoint                               | Role                                               |
| -------------------------------------- | -------------------------------------------------- |
| `POST /admin/academic-warnings`        | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`            |
| `GET /notifications/me`                | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `PATCH /notifications/:id/read`        | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `POST /notifications/devices`          | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `DELETE /notifications/devices/:token` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| Socket.IO `/notifications`             | Valid Keycloak access token                        |

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

## Error Codes

| HTTP | Code                                  | Cause                                                             |
| ---: | ------------------------------------- | ----------------------------------------------------------------- |
|  400 | `VALIDATION_ERROR`                    | Invalid body/query/path parameter                                 |
|  400 | `ACADEMIC_WARNING_RECIPIENT_REQUIRED` | Academic warning request has neither `studentId` nor `studentIds` |
|  400 | `UNSUPPORTED_DELIVERY_CHANNEL`        | Academic warning request includes a channel other than `IN_APP`   |
|  401 | `UNAUTHORIZED`                        | Missing, invalid, expired, or revoked access token                |
|  403 | `FORBIDDEN`                           | Token is valid but role is not allowed                            |
|  404 | `NOTIFICATION_NOT_FOUND`              | Notification not found or does not belong to caller               |
|  500 | `INTERNAL_ERROR`                      | Database, RabbitMQ, SMTP, FCM, or server error                    |

---

## Enums

`NotificationType`: `IN_APP` | `EMAIL` | `PUSH` | `SMS`

`NotificationStatus`: `QUEUED` | `DELIVERED` | `FAILED`

Academic warning delivery status values: `PENDING`, `QUEUED`, `PENDING_RETRY`, `FAILED`, `SENT`.

---

## Shared Schemas

### `Notification`

| Field          | Type                 | Description                                |
| -------------- | -------------------- | ------------------------------------------ |
| `id`           | `uuid`               | Notification id                            |
| `userId`       | `uuid`               | Recipient user id                          |
| `type`         | `NotificationType`   | Bản ghi theo kênh delivery                 |
| `eventType`    | `string` or `null`   | Event nguồn, ví dụ `identity.user.created` |
| `title`        | `string`             | Tiêu đề notification                       |
| `body`         | `string`             | Nội dung notification                      |
| `data`         | `object`             | Metadata bổ sung                           |
| `status`       | `NotificationStatus` | Delivery status của bản ghi theo kênh      |
| `retryCount`   | `number`             | Số lần retry từ RabbitMQ headers/payload   |
| `errorMessage` | `string` or `null`   | Lỗi delivery gần nhất                      |
| `isRead`       | `boolean`            | Recipient đã đọc hay chưa                  |
| `readAt`       | `string` or `null`   | Thời điểm đọc                              |
| `sentAt`       | `string` or `null`   | Legacy/send timestamp field                |
| `deliveredAt`  | `string` or `null`   | Thời điểm delivery thành công              |
| `createdAt`    | `string`             | Thời điểm tạo                              |
| `updatedAt`    | `string`             | Thời điểm cập nhật cuối                    |

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

| Field              | Required    | Rule                                                          |
| ------------------ | ----------- | ------------------------------------------------------------- |
| `studentId`        | conditional | UUID. Field single recipient giữ để backward-compatible       |
| `studentIds`       | conditional | Non-empty UUID array. Bắt buộc khi không gửi `studentId`      |
| `deliveryChannels` | no          | Non-empty enum array. Endpoint này chỉ chấp nhận `IN_APP`     |
| `reason`           | yes         | Non-empty string                                              |
| `severity`         | yes         | Non-empty string, recommended values: `LOW`, `MEDIUM`, `HIGH` |
| `message`          | yes         | Non-empty string                                              |

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

**Common errors:** `VALIDATION_ERROR`, `ACADEMIC_WARNING_RECIPIENT_REQUIRED`, `UNSUPPORTED_DELIVERY_CHANNEL`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/notifications/me`

Trả về notifications của current user theo thứ tự mới nhất trước.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Query Parameters**

| Name   | Type     | Required | Default | Rule                   |
| ------ | -------- | -------- | ------- | ---------------------- |
| `page` | `number` | no       | `1`     | Minimum 1              |
| `size` | `number` | no       | `20`    | Minimum 1, maximum 100 |

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

| Name | Type   | Required | Description     |
| ---- | ------ | -------- | --------------- |
| `id` | `uuid` | yes      | Notification id |

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

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `NOTIFICATION_NOT_FOUND`, `INTERNAL_ERROR`.

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

| Field      | Required | Rule                 |
| ---------- | -------- | -------------------- |
| `token`    | yes      | Non-empty string     |
| `platform` | yes      | `ios` hoặc `android` |

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

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### DELETE `/notifications/devices/:token`

Token trong path nên được URL-encode từ frontend vì FCM registration token có thể chứa ký tự đặc biệt. Backend chỉ xóa token thuộc current user đọc từ JWT `sub`.

Xóa một device token registration.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

**Response:** `204 No Content`

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

## Frontend Push Notification Integration

Frontend/mobile không gửi push trực tiếp. App lấy FCM registration token từ Firebase Messaging SDK, sau đó đăng ký token với notification-service bằng JWT của user hiện tại.

### Register token

```http
POST /notifications/devices
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "<fcm_registration_token>",
  "platform": "android"
}
```

`platform` hiện chấp nhận `android` hoặc `ios`. Endpoint upsert theo token, nên frontend có thể gọi lại sau login, app start, hoặc khi Firebase refresh token.

### Unregister token

```http
DELETE /notifications/devices/<url_encoded_fcm_registration_token>
Authorization: Bearer <access_token>
```

Backend chỉ xóa token thuộc current user đọc từ JWT `sub`.

### Frontend requirements

- Cài Firebase SDK đúng platform.
- Android app cần `google-services.json`; iOS app cần `GoogleService-Info.plist` và APNs key/certificate đã bật trong Firebase Console.
- Xin quyền notification trước khi lấy token trên các platform yêu cầu runtime permission.
- Gửi token lên backend sau login/app start và gửi lại khi token refresh.
- Khi logout hoặc user tắt push, gọi DELETE với token đã URL-encode.
- Khi app foreground, frontend nên tự hiển thị local notification nếu muốn user thấy banner ngay.
- Khi app background/quit, notification payload từ backend sẽ được OS/Firebase đưa vào system tray nếu app đã cấu hình đúng.

Nếu `FCM_CREDENTIALS` trống, notification-service skip PUSH có kiểm soát và không đưa message vào retry/DLQ chỉ vì local/dev chưa có Firebase credential. Nếu đã cấu hình credential nhưng Firebase Admin init/send lỗi retryable, RabbitMQ retry/DLQ xử lý như các lỗi delivery khác.

---

## Realtime In-App Notifications

Socket.IO is used only for realtime fan-out. REST APIs remain the source for listing notifications and marking them as read.

### Connect

Direct local:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3006/notifications", {
  path: "/notifications/socket.io",
  auth: { token: accessToken },
});
```

Through Kong:

```ts
const socket = io("http://localhost:8000/notifications", {
  path: "/notifications/socket.io",
  auth: { token: accessToken },
});
```

The service verifies the JWT signature with the Keycloak realm public key and rejects revoked tokens from the shared Redis token blacklist. After authentication succeeds, the socket joins room `user:{sub}`.

### Server Events

| Event                               | Payload                                                                 | When emitted                                              |
| ----------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `notification.connected`            | `{ "userId": "<keycloak-sub>" }`                                        | Socket authentication succeeds                            |
| `notification.auth_failed`          | `{ "reason": "missing_token" \| "missing_subject" \| "invalid_token" }` | Socket authentication fails before disconnect             |
| `notification.created`              | `{ "notification": Notification, "unreadCount": number }`               | A new `IN_APP` notification is delivered for current user |
| `notification.unread_count.updated` | `{ "unreadCount": number }`                                             | A new `IN_APP` notification is delivered or marked read   |

Realtime events are best-effort. If Socket.IO emit fails, the notification remains persisted and RabbitMQ delivery is not retried only because realtime fan-out failed.

Redis is required for the Socket.IO adapter in multi-instance deployments. Use `REDIS_URL` or Consul key `config/<env>/notification-service/redis.url`.

---

## Events

Notification-service consume RabbitMQ messages từ queue `notification_service_events`.

| Event                                    | Required payload                                                                                  | Effect                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `identity.user.created`                  | `userId`, `email`, `fullName?`                                                                    | Gửi welcome `IN_APP` và `EMAIL`                                              |
| `identity.user.password-reset-requested` | `userId`, `email`, `resetUrl`                                                                     | Gửi password reset `EMAIL` khi có publisher emit event này                   |
| `exam.session.passed`                    | `studentId` hoặc `userId`; optional `email`, `sessionId`, `licenseCategory`, `score`              | Gửi kết quả `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `email`                 |
| `exam.session.failed`                    | Giống `exam.session.passed`                                                                       | Gửi kết quả `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `email`                 |
| `notification.academic-warning.queued`   | `studentId`, `reason`, `severity`, `message`, `createdById`, optional `warningId`, `studentEmail` | Gửi academic warning `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `studentEmail` |
| `course.updated`                         | `recipientId`, `courseId`, `courseTitle`, `updateSummary`, optional `recipientEmail`              | Gửi course update `IN_APP`, `PUSH`, và thêm `EMAIL` nếu có `recipientEmail`  |

Invalid payload sẽ được skip khi handler có thể xác định thiếu recipient một cách an toàn. Delivery failures sẽ throw lên common RabbitMQ retry interceptor.

---

## Retry Và DLQ

RabbitMQ resilience được cung cấp bởi `@repo/common`:

- Main queue: `notification_service_events`
- Retry queues: `notification_service_events.retry.1`, `notification_service_events.retry.2`, ...
- DLQ: `notification_service_events.dlq`

`retry.maxAttempts` quyết định số retry queues được tạo. Khi không override, các retry queue dùng default TTL `5000`, `60000`, `300000` ms. `retry.delaysMs` cho phép cấu hình backoff theo từng lần retry; `retry.intervalMs` chỉ dùng khi muốn mọi retry queue dùng cùng một TTL custom.
## Endpoint Gap Batch Additions

### PATCH `/notifications/mark-all-read`

Marks all unread notifications of the current user as read and emits the websocket unread-count update.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

Response:

```json
{
  "updated": 3
}
```

### GET `/notifications/preferences/me`

Returns current user notification preferences. If no row exists, service creates a default preference row.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

### PATCH `/notifications/preferences/me`

Updates current user notification preferences.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT`

```json
{
  "inAppEnabled": true,
  "emailEnabled": true,
  "pushEnabled": false,
  "smsEnabled": false,
  "studyReminderEnabled": true,
  "examReminderEnabled": true,
  "courseUpdateEnabled": true,
  "academicWarningEnabled": true
}
```
