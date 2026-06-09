# Simulation Service API Specification

**Base URL qua Kong:** `http://localhost:8000`  
**Service path:** `/simulation`  
**Direct local:** `http://localhost:3008`  
**Swagger UI:** `http://localhost:3008/docs`  
**Swagger UI qua Kong:** `http://localhost:8000/simulation-service/docs`  
**OpenAPI JSON:** `http://localhost:3008/docs-json`  
**OpenAPI JSON qua Kong:** `http://localhost:8000/simulation-service/docs-json`  
**Version:** 1.0.0

Simulation-service exposes maneuver/checkpoint learning content and a backend state machine for driving-practice sessions. Frontend calls protected APIs with `Authorization: Bearer <access_token>`; the service reads current student id from JWT `sub`. Do not send `x-user-id`.

Maneuver error lists use Redis cache-aside. If Redis is unavailable, the service falls back to PostgreSQL and keeps response shape unchanged.

---

## Authentication

| Endpoint | Role |
| --- | --- |
| `GET /simulation/maneuvers` | `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER` |
| `GET /simulation/maneuvers/:id` | `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER` |
| `GET /simulation/maneuver-errors` | `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER` |
| `POST /simulation/sessions` | `STUDENT` |
| `PATCH /simulation/sessions/:id/answers` | `STUDENT` |
| `POST /simulation/sessions/:id/submit` | `STUDENT` |

---

## Response Format

All successful responses are wrapped by the global `ApiResponseInterceptor`.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/maneuvers?licenseCategory=B1",
  "data": []
}
```

Error responses:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/sessions"
}
```

---

## Error Codes

| HTTP | Code | Cause |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid body/query/path parameter |
| 400 | `BAD_REQUEST` | Session is already finished |
| 401 | `UNAUTHORIZED` | Missing or invalid access token |
| 403 | `FORBIDDEN` | Token is valid but role is not allowed |
| 404 | `NOT_FOUND` | Maneuver/session not found, or session does not belong to caller |
| 500 | `INTERNAL_ERROR` | Database/cache error |

---

## Enums

`LicenseCategory`: `A1` | `A2` | `B1` | `B2` | `C` | `D` | `E` | `F`  
`SimulationSessionStatus`: `IN_PROGRESS` | `COMPLETED` | `ABANDONED`

---

## Shared Schemas

### `Maneuver`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `uuid` | Maneuver id |
| `title` | `string` | Maneuver title |
| `description` | `string` | Learning description |
| `licenseCategory` | `LicenseCategory` | License category |
| `displayOrder` | `number` | Ordering within category |
| `checkpoints` | `ManeuverCheckpoint[]` | Ordered checkpoint list |

### `ManeuverCheckpoint`

```json
{
  "id": "20423b6d-00d7-4d23-a1d4-189c39185e9d",
  "title": "Chuẩn bị trước vạch xuất phát",
  "instruction": "Dừng xe đúng vị trí, kiểm tra gương và tín hiệu trước khi khởi hành.",
  "penalty": "Trừ điểm nếu xe cán vạch hoặc không bật tín hiệu đúng thời điểm.",
  "displayOrder": 1
}
```

### `ManeuverError`

```json
{
  "id": "12f7d0e7-c010-4e49-bcda-036219772cce",
  "licenseCategory": "B1",
  "code": "B1-SA-HINH-001",
  "description": "Không thắt dây an toàn trước khi xuất phát.",
  "severity": "MAJOR"
}
```

### `SimulationSession`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `uuid` | Session id |
| `studentId` | `uuid` | Student id from JWT `sub` |
| `licenseCategory` | `LicenseCategory` | Session category |
| `status` | `SimulationSessionStatus` | Current session state |
| `totalScenarios` | `number` | Number of answered scenarios at submit time |
| `correctCount` | `number` | Number of correct answers at submit time |
| `score` | `number | null` | Rounded percentage score after submit |
| `isPassed` | `boolean | null` | `true` when score is at least 80 |
| `startedAt` | `string` | Start timestamp |
| `completedAt` | `string | null` | Submit timestamp |

---

## Endpoints

### GET `/simulation/maneuvers`

Returns active maneuver checkpoint groups for a license category, ordered by `displayOrder`.

**Auth:** `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER`

**Query Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `licenseCategory` | `LicenseCategory` | yes | License category to load |

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/maneuvers?licenseCategory=B1",
  "data": [
    {
      "id": "1e2fe09b-a746-42ce-b592-fb8800512d33",
      "title": "Xuất phát",
      "description": "Thực hành quy trình xuất phát đúng kỹ thuật trong bài sa hình.",
      "licenseCategory": "B1",
      "displayOrder": 1,
      "checkpoints": [
        {
          "id": "20423b6d-00d7-4d23-a1d4-189c39185e9d",
          "title": "Chuẩn bị trước vạch xuất phát",
          "instruction": "Dừng xe đúng vị trí, kiểm tra gương và tín hiệu trước khi khởi hành.",
          "penalty": "Trừ điểm nếu xe cán vạch hoặc không bật tín hiệu đúng thời điểm.",
          "displayOrder": 1
        }
      ]
    }
  ]
}
```

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### GET `/simulation/maneuvers/:id`

Returns one active maneuver with ordered checkpoints.

**Auth:** `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Maneuver id |

**Response `200`**

Same `Maneuver` shape as list item.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/maneuvers/1e2fe09b-a746-42ce-b592-fb8800512d33",
  "data": {
    "id": "1e2fe09b-a746-42ce-b592-fb8800512d33",
    "title": "Xuất phát",
    "description": "Thực hành quy trình xuất phát đúng kỹ thuật trong bài sa hình.",
    "licenseCategory": "B1",
    "displayOrder": 1,
    "checkpoints": []
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`.

---

### GET `/simulation/maneuver-errors`

Returns general maneuver errors for a license category. The response is cached by `licenseCategory`.

**Auth:** `STUDENT`, `INSTRUCTOR`, `ADMIN`, `CENTER_MANAGER`

**Query Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `licenseCategory` | `LicenseCategory` | yes | License category to load |

**Response `200`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/maneuver-errors?licenseCategory=B1",
  "data": [
    {
      "id": "12f7d0e7-c010-4e49-bcda-036219772cce",
      "licenseCategory": "B1",
      "code": "B1-SA-HINH-001",
      "description": "Không thắt dây an toàn trước khi xuất phát.",
      "severity": "MAJOR"
    }
  ]
}
```

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### POST `/simulation/sessions`

Starts a driving-practice simulation session for the current student. The new session starts in `IN_PROGRESS`.

**Auth:** `STUDENT`

**Body**

```json
{
  "licenseCategory": "B1"
}
```

**Response `201`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/sessions",
  "data": {
    "id": "62d03f43-6245-4bd1-bf6e-675e3695f6d9",
    "studentId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "licenseCategory": "B1",
    "status": "IN_PROGRESS",
    "totalScenarios": 0,
    "correctCount": 0,
    "score": null,
    "isPassed": null,
    "startedAt": "2026-05-21T10:00:00.000Z",
    "completedAt": null
  }
}
```

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`.

---

### PATCH `/simulation/sessions/:id/answers`

Saves or updates one scenario answer while the session is `IN_PROGRESS`. The session must belong to the current student.

For the current demo scope, `isCorrect` is accepted from the caller and persisted with the answer. A later production hardening step should calculate correctness server-side from seeded scenario/options data.

**Auth:** `STUDENT`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Simulation session id |

**Body**

```json
{
  "scenarioId": "83c1f15e-d15c-4ae8-a6c7-4d2207bbf422",
  "selectedOptionId": "turn-signal-before-start",
  "isCorrect": true
}
```

**Validation**

| Field | Required | Rule |
| --- | --- | --- |
| `scenarioId` | yes | UUID |
| `selectedOptionId` | no | string or null |
| `isCorrect` | no | boolean or null |

**Response `200`**

Returns the current session state. Score fields remain unchanged until submit.

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:02:00.000Z",
  "path": "/simulation/sessions/62d03f43-6245-4bd1-bf6e-675e3695f6d9/answers",
  "data": {
    "id": "62d03f43-6245-4bd1-bf6e-675e3695f6d9",
    "studentId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "licenseCategory": "B1",
    "status": "IN_PROGRESS",
    "totalScenarios": 0,
    "correctCount": 0,
    "score": null,
    "isPassed": null,
    "startedAt": "2026-05-21T10:00:00.000Z",
    "completedAt": null
  }
}
```

**Common errors:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_ERROR`.

---

### POST `/simulation/sessions/:id/submit`

Finalizes the session. The repository counts saved answers, calculates `score = round(correctCount / totalScenarios * 100)`, marks the session `COMPLETED`, and sets `isPassed = score >= 80`. Re-submitting an already completed session returns the stored final state.

**Auth:** `STUDENT`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Simulation session id |

**Response `200` or `201`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:05:00.000Z",
  "path": "/simulation/sessions/62d03f43-6245-4bd1-bf6e-675e3695f6d9/submit",
  "data": {
    "id": "62d03f43-6245-4bd1-bf6e-675e3695f6d9",
    "studentId": "89ea9a17-1cce-4fff-855c-d32a081648cd",
    "licenseCategory": "B1",
    "status": "COMPLETED",
    "totalScenarios": 5,
    "correctCount": 4,
    "score": 80,
    "isPassed": true,
    "startedAt": "2026-05-21T10:00:00.000Z",
    "completedAt": "2026-05-21T10:05:00.000Z"
  }
}
```

**Common errors:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`.

---

## Data Requirement

The API depends on seeded maneuver content:

- `maneuvers`
- `maneuver_checkpoints`
- `maneuver_errors`

Run the root seed before frontend demo:

```powershell
npm.cmd run db:seed
```

The simulation seed inserts deterministic maneuver/checkpoint/error content for demo license categories. Without seed data, `GET /simulation/maneuvers` and `GET /simulation/maneuver-errors` correctly return empty arrays, so the frontend should treat an empty list as “no content seeded yet”, not as an API failure.
## SRS Alignment Additions: UC35/UC36 (2D Driving Practice)

### POST `/simulation/practice2d/sessions`

Starts a 2D practice session for the current student. The session begins in `IN_PROGRESS`.

**Auth:** `STUDENT`

**Body**

```json
{
  "licenseCategory": "B1",
  "clientCapabilities": {
    "canvas": true,
    "webgl": true,
    "keyboard": true,
    "touch": false
  },
  "persistTelemetry": true
}
```

**Validation**

*   `licenseCategory`: Required `LicenseCategory`.
*   `clientCapabilities`: Required object. Must have (`canvas` or `webgl`) = `true`, and (`keyboard` or `touch`) = `true`. Otherwise, returns `MSG131` (HTTP 400).
*   `persistTelemetry`: Optional boolean (default `false`). If `true`, the last ingested telemetry event will be stored in the session.

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:00.000Z",
  "path": "/simulation/practice2d/sessions",
  "data": {
    "id": "session-uuid",
    "studentId": "student-uuid",
    "licenseCategory": "B1",
    "status": "IN_PROGRESS",
    "clientCapabilities": {
      "canvas": true,
      "webgl": true,
      "keyboard": true,
      "touch": false
    },
    "persistTelemetry": true,
    "totalEvents": 0,
    "errorCount": 0,
    "totalPenalty": 0,
    "score": null,
    "summary": {},
    "startedAt": "2026-05-21T10:00:00.000Z",
    "endedAt": null
  }
}
```

---

### POST `/simulation/practice2d/sessions/:id/telemetry`

Ingests live telemetry packet from the 2D simulator client, runs the error detection rules engine (overspeed, off-lane, collision), and returns immediate color-coded error feedback.

**Auth:** `STUDENT`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | 2D practice session id |

**Body**

```json
{
  "type": "LANE_KEEPING",
  "speedKmh": 65,
  "laneOffset": 1.2,
  "collision": false,
  "signal": "LEFT",
  "payload": {
    "x": 105.4,
    "y": 204.2,
    "heading": 90
  }
}
```

**Validation**

*   `type`: Required string (telemetry type e.g., `LANE_KEEPING`, `STEERING`).
*   `collision`: Optional boolean.
*   `speedKmh`: Optional number.
*   `laneOffset`: Optional number.

**Response `201 Created`**

If a rule is violated, it returns the generated warning/fatal feedback:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:00:01.000Z",
  "path": "/simulation/practice2d/sessions/session-uuid/telemetry",
  "data": {
    "id": "feedback-event-uuid",
    "telemetryType": "LANE_KEEPING",
    "errorCode": "OVERSPEED",
    "severity": "WARNING",
    "penalty": 10,
    "message": "Speed exceeded the configured practice threshold.",
    "hint": "Slow down before entering the next checkpoint.",
    "occurredAt": "2026-05-21T10:00:01.000Z"
  }
}
```

*   **Error Detection Logic:**
    *   `collision` = `true` ➔ `errorCode` = `"COLLISION"`, `severity` = `"FATAL"`, `penalty` = `100`.
    *   `speedKmh` > `60` ➔ `errorCode` = `"OVERSPEED"`, `severity` = `"WARNING"`, `penalty` = `10`.
    *   `abs(laneOffset)` > `1.0` ➔ `errorCode` = `"LANE_DEPARTURE"`, `severity` = `"WARNING"`, `penalty` = `5`.

---

### POST `/simulation/practice2d/sessions/:id/end`

Ends or abandons the active 2D practice session. It calculates the final score = `max(0, 100 - totalPenalty)`, updates status to `COMPLETED` (or `ABANDONED`), and publishes `practice2d.session.completed` asynchronously via RabbitMQ (consumed by `analytics-service` to update progress).

**Auth:** `STUDENT`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | 2D practice session id |

**Body**

```json
{
  "abandoned": false
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:15:00.000Z",
  "path": "/simulation/practice2d/sessions/session-uuid/end",
  "data": {
    "id": "session-uuid",
    "studentId": "student-uuid",
    "licenseCategory": "B1",
    "status": "COMPLETED",
    "clientCapabilities": {
      "canvas": true,
      "webgl": true,
      "keyboard": true,
      "touch": false
    },
    "persistTelemetry": true,
    "totalEvents": 150,
    "errorCount": 2,
    "totalPenalty": 15,
    "score": 85,
    "summary": {
      "totalEvents": 150,
      "errorCount": 2,
      "totalPenalty": 15,
      "score": 85,
      "status": "COMPLETED"
    },
    "startedAt": "2026-05-21T10:00:00.000Z",
    "endedAt": "2026-05-21T10:15:00.000Z"
  }
}
```

---

### GET `/simulation/practice2d/sessions/:id`

Retrieves a detailed summary of a 2D practice session including all feedback events triggered.

**Auth:** `STUDENT`

**Path Parameters**

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | 2D practice session id |

**Response `200 OK`**

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "OK",
  "timestamp": "2026-05-21T10:20:00.000Z",
  "path": "/simulation/practice2d/sessions/session-uuid",
  "data": {
    "id": "session-uuid",
    "studentId": "student-uuid",
    "licenseCategory": "B1",
    "status": "COMPLETED",
    "clientCapabilities": {
      "canvas": true,
      "webgl": true,
      "keyboard": true,
      "touch": false
    },
    "persistTelemetry": true,
    "totalEvents": 150,
    "errorCount": 2,
    "totalPenalty": 15,
    "score": 85,
    "summary": {
      "totalEvents": 150,
      "errorCount": 2,
      "totalPenalty": 15,
      "score": 85,
      "status": "COMPLETED"
    },
    "startedAt": "2026-05-21T10:00:00.000Z",
    "endedAt": "2026-05-21T10:15:00.000Z",
    "feedbackEvents": [
      {
        "id": "feedback-event-uuid-1",
        "telemetryType": "LANE_KEEPING",
        "errorCode": "OVERSPEED",
        "severity": "WARNING",
        "penalty": 10,
        "message": "Speed exceeded the configured practice threshold.",
        "hint": "Slow down before entering the next checkpoint.",
        "occurredAt": "2026-05-21T10:00:01.000Z"
      }
    ]
  }
}
```

---

### Maneuver Metadata

`ManeuverCheckpoint` supports coordinates `x`, `y` and `visualColor`. `ManeuverError` supports `pointsDeducted`, `isFatal`, `isGeneral`, `isActive`, `visualColor`, and `icon`; `GET /simulation/maneuver-errors` returns active general errors only.
