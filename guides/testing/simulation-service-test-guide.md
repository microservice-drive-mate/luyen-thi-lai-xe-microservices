# Simulation Service Test Guide

## Setup

```powershell
docker compose up -d db-simulation redis consul consul-init
npm --workspace=apps/simulation-service run db:deploy
npm run db:seed
npm --workspace=apps/simulation-service run start:dev
```

The root seed creates deterministic maneuver/checkpoint/error data. If this guide is run against an empty database without seed data, read APIs return empty arrays by design.

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

## Maneuver Read APIs

```http
GET http://localhost:3008/simulation/maneuvers?licenseCategory=B1
GET http://localhost:3008/simulation/maneuver-errors?licenseCategory=B1
```

Expected: errors endpoint is cacheable. Verify Redis key:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "simulation:maneuver-errors:*"
```

## Session State Machine

```http
POST http://localhost:3008/simulation/sessions
Authorization: Bearer <student_token>
Content-Type: application/json

{ "licenseCategory": "B1" }
```

Save answer while `IN_PROGRESS`, then submit. A later answer save should fail because the backend owns the state transition.
## SRS UC35/UC36 Test Scenarios

1. Start 2D practice:
   `POST /simulation/practice2d/sessions` as `STUDENT` with `licenseCategory` and `clientCapabilities` containing either `canvas` or `webgl`, plus `keyboard` or `touch`.
2. Unsupported client:
   send capabilities without rendering/input support and expect `PRACTICE2D_UNSUPPORTED_CLIENT`.
3. Telemetry feedback:
   send `POST /simulation/practice2d/sessions/{id}/telemetry` with `collision=true`, `speedKmh > 60`, or `laneOffset > 1`; expect feedback severity/penalty and persisted event.
4. Owner mismatch:
   call telemetry/get/end with a different student token; expect forbidden.
5. End session:
   `POST /simulation/practice2d/sessions/{id}/end`; expect summary with `score`, `errorCount`, and `totalPenalty`.
