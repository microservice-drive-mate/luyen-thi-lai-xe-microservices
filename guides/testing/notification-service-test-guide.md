# Notification Service Test Guide

## Setup

```powershell
docker compose up -d db-notification rabbitmq redis consul consul-init
npm --workspace=apps/notification-service run db:deploy
npm run db:seed
npm --workspace=apps/notification-service run start:dev
```

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

Redis is required because notification-service uses the Socket.IO Redis adapter. In hybrid dev, Consul should expose `config/development-local/notification-service/redis.url=redis://localhost:6379`.

## Firebase Push Setup

Root `.env` cần có `FCM_CREDENTIALS` là Firebase service-account JSON trên một dòng. Không commit file JSON credential rời vào repo.

Sau khi cập nhật `.env`, seed lại Consul rồi restart notification-service:

```powershell
npm run consul:seed:local
npm --workspace=apps/notification-service run start:dev
```

Nếu `FCM_CREDENTIALS` trống, service vẫn chạy và PUSH sẽ được skip có kiểm soát. In-app/email không bị ảnh hưởng.

## Frontend Device Token Flow

Trên thiết bị thật hoặc emulator có Firebase Messaging:

1. Cấu hình Firebase app:
   - Android: thêm `google-services.json`.
   - iOS: thêm `GoogleService-Info.plist` và cấu hình APNs key/certificate trong Firebase Console.
2. Xin quyền notification từ hệ điều hành.
3. Lấy FCM registration token từ Firebase Messaging SDK.
4. Đăng ký token với backend:

```http
POST http://localhost:3006/notifications/devices
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "token": "<fcm_registration_token>",
  "platform": "android"
}
```

5. Khi Firebase refresh token, gọi lại endpoint trên với token mới.
6. Khi logout hoặc tắt push, URL-encode token rồi hủy đăng ký:

```http
DELETE http://localhost:3006/notifications/devices/<url_encoded_fcm_registration_token>
Authorization: Bearer <student_token>
```

Foreground test: app cần tự hiển thị local notification nếu muốn thấy banner khi đang mở app. Background/quit test: đưa app xuống background, trigger event có kênh PUSH, rồi kiểm tra system tray của thiết bị.

## Send Academic Warning

```http
POST http://localhost:3006/admin/academic-warnings
Authorization: Bearer <admin_or_instructor_token>
Content-Type: application/json

{
  "studentId": "<studentId>",
  "reason": "LOW_EXAM_SCORE",
  "severity": "HIGH",
  "message": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp."
}
```

Expected: response is an in-app notification for the student.

## Realtime In-App Notification Test

Install a temporary Socket.IO client if your frontend is not ready yet:

```powershell
npm install --no-save socket.io-client
```

Create a short local script outside tracked source or run the equivalent in the frontend:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3006/notifications', {
  path: '/notifications/socket.io',
  auth: { token: process.env.STUDENT_TOKEN },
});

socket.on('notification.connected', console.log);
socket.on('notification.created', console.log);
socket.on('notification.unread_count.updated', console.log);
socket.on('notification.auth_failed', console.error);
```

With the socket connected, call `POST /admin/academic-warnings`. Expected realtime events:

- `notification.created` with the new `IN_APP` notification and `unreadCount`.
- `notification.unread_count.updated` with the latest unread count.

Then call `PATCH /notifications/{notificationId}/read`. Expected realtime event:

- `notification.unread_count.updated` with the unread count after marking the notification as read.

## Student Reads Notifications

```http
GET http://localhost:3006/notifications/me?page=1&size=20
Authorization: Bearer <student_token>
```

Then mark read:

```http
PATCH http://localhost:3006/notifications/{notificationId}/read
Authorization: Bearer <student_token>
```
## SRS UC29 Retry Test Scenarios

1. Happy path:
   call `POST /admin/academic-warnings`; expect `persisted=1`, `queued=1`, `pendingRetry=0`, and an in-app notification for the student.
2. Retry path:
   simulate repository/notification creation failure during dispatch; warning remains persisted with `deliveryStatus=PENDING_RETRY`.
3. Retry worker:
   set `nextRetryAt` in the past, wait for `notification.warningRetryIntervalMs`, and verify the worker creates the notification and marks warning `QUEUED`.
4. Failure cap:
   after 3 failed retry attempts, expect `deliveryStatus=FAILED`.
