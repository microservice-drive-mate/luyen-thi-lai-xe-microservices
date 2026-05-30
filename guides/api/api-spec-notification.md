# Notification Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service paths:** `/notifications`, `/admin/academic-warnings`  
**Direct local:** `http://localhost:3006`  
**Swagger UI:** `http://localhost:3006/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/notification-service/docs`  
**OpenAPI JSON:** `http://localhost:3006/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/notification-service/docs-json`  
**Version:** 1.0.0

Notification-service stores in-app notifications and academic warnings. Frontend calls protected APIs with `Authorization: Bearer <access_token>`; current user id is read from JWT `sub`. Do not send `x-user-id`.

Academic warning creation is synchronous for auditability. Delivery is represented as an in-app notification and can be extended later with email/push workers.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `POST /admin/academic-warnings` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR` |
| `GET /notifications/me` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |
| `PATCH /notifications/:id/read` | `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`, `STUDENT` |

---

## Response Format

All successful responses are wrapped by the global `ApiResponseInterceptor`.

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

Error responses:

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

| HTTP | Code | Cause |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid body/query/path parameter |
| 401 | `UNAUTHORIZED` | Missing or invalid access token |
| 403 | `FORBIDDEN` | Token is valid but role is not allowed |
| 404 | `NOT_FOUND` | Notification does not exist or does not belong to caller |
| 500 | `INTERNAL_ERROR` | Database/event handling error |

---

## Enums

`NotificationType`: `IN_APP` | `EMAIL` | `PUSH` | `SMS`

The current implementation creates `IN_APP` notifications. Other enum values are reserved for delivery-channel extensions.

---

## Shared Schemas

### `Notification`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `uuid` | Notification id |
| `userId` | `uuid` | Recipient user id |
| `type` | `NotificationType` | Delivery type |
| `title` | `string` | Short notification title |
| `body` | `string` | Notification message |
| `data` | `object` | Extra metadata, for example warning id or exam session id |
| `isRead` | `boolean` | Whether current recipient has read it |
| `readAt` | `string | null` | Read timestamp |
| `sentAt` | `string | null` | Delivery timestamp |
| `createdAt` | `string` | Creation timestamp |

### `ListNotificationsResponse`

```json
{
  "items": [
    {
      "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
      "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
      "type": "IN_APP",
      "title": "Academic warning: HIGH",
      "body": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp.",
      "data": {
        "warningId": "48c7047d-3db9-4dc0-bb75-b68735ab51ea",
        "reason": "LOW_EXAM_SCORE",
        "severity": "HIGH"
      },
      "isRead": false,
      "readAt": null,
      "sentAt": "2026-05-21T10:00:00.000Z",
      "createdAt": "2026-05-21T10:00:00.000Z"
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

Creates academic warning records and in-app notifications for one or more students. `createdById` is taken from the caller JWT `sub`.

**Auth:** `ADMIN`, `CENTER_MANAGER`, `INSTRUCTOR`

**Headers**

```http
Authorization: Bearer <admin_or_instructor_access_token>
```

**Body**

```json
{
  "studentIds": ["89ea9a17-1cce-4fff-855c-d32a081648cd"],
  "deliveryChannels": ["IN_APP"],
  "reason": "LOW_EXAM_SCORE",
  "severity": "HIGH",
  "message": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp."
}
```

**Validation**

| Field | Required | Rule |
| --- | --- | --- |
| `studentId` | conditional | UUID. Backward-compatible single recipient field |
| `studentIds` | conditional | Non-empty UUID array. Required when `studentId` is omitted |
| `deliveryChannels` | no | Non-empty enum array. Current implementation accepts `IN_APP` only |
| `reason` | yes | non-empty string |
| `severity` | yes | non-empty string, recommended values: `LOW`, `MEDIUM`, `HIGH` |
| `message` | yes | non-empty string |

**Response `201`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/admin/academic-warnings",
  "data": {
    "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
    "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "type": "IN_APP",
    "title": "Academic warning: HIGH",
    "body": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp.",
    "data": {
      "warningId": "48c7047d-3db9-4dc0-bb75-b68735ab51ea",
      "reason": "LOW_EXAM_SCORE",
      "severity": "HIGH"
    },
    "isRead": false,
    "readAt": null,
    "sentAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/notifications/me`

Returns the current user's notifications in newest-first order.

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
    "items": [
      {
        "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
        "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
        "type": "IN_APP",
        "title": "Exam completed",
        "body": "Bạn đã hoàn thành bài thi mô phỏng.",
        "data": {
          "sessionId": "7976cf6d-5aab-4a6d-bd34-3e97bdade9cd"
        },
        "isRead": false,
        "readAt": null,
        "sentAt": "2026-05-21T10:00:00.000Z",
        "createdAt": "2026-05-21T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### PATCH `/notifications/:id/read`

Marks one notification as read. The service checks ownership with the caller JWT `sub`; users cannot mark another user's notification.

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
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/notifications/0b9cb629-4f43-4f4f-a936-7dc664a7351e/read",
  "data": {
    "id": "0b9cb629-4f43-4f4f-a936-7dc664a7351e",
    "userId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "type": "IN_APP",
    "title": "Academic warning: HIGH",
    "body": "Bạn cần ôn lại nhóm câu hỏi thường sai trước khi thi tiếp.",
    "data": {
      "warningId": "48c7047d-3db9-4dc0-bb75-b68735ab51ea",
      "reason": "LOW_EXAM_SCORE",
      "severity": "HIGH"
    },
    "isRead": true,
    "readAt": "2026-05-21T10:03:00.000Z",
    "sentAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`.

---

## Events

Notification-service consumes these event types:

| Event | Effect |
| --- | --- |
| `exam.session.passed` | Creates a non-blocking in-app notification for the student |
| `exam.session.failed` | Creates a non-blocking in-app notification for the student |

Event consumers log and skip invalid payloads so notification delivery does not block exam completion.
## SRS Alignment Additions: UC29 Warning Retry

`POST /admin/academic-warnings` now persists the warning before notification dispatch. The response contains a delivery summary:

```json
{
  "warningId": "uuid",
  "warningIds": ["uuid"],
  "notification": {},
  "notifications": [{}],
  "deliveryStatus": "QUEUED",
  "persisted": 1,
  "queued": 1,
  "pendingRetry": 0
}
```

Delivery status values: `PENDING`, `QUEUED`, `PENDING_RETRY`, `FAILED`, `SENT`.

If notification enqueue/create fails, the API still returns success with `pendingRetry = 1`; a background retry worker retries due warnings up to 3 attempts. Retry interval is configured by `notification.warningRetryIntervalMs` with default `300000`.
