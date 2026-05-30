# Notification Service Test Guide

## Setup

```powershell
docker compose up -d db-notification rabbitmq consul consul-init
npm --workspace=apps/notification-service run db:deploy
npm run db:seed
npm --workspace=apps/notification-service run start:dev
```

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

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
