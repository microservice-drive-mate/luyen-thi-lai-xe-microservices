# Analytics Service Test Guide

## Setup

```powershell
docker compose up -d db-analytics redis rabbitmq consul consul-init
npm --workspace=apps/analytics-service run db:deploy
npm run db:seed
npm --workspace=apps/analytics-service run start:dev
```

Use a real Keycloak token. Frontend and Swagger calls should send `Authorization: Bearer <access_token>`; do not send `x-user-id`.

## Demo Flow

1. Complete an exam in `exam-service`.
2. Complete a course lesson in `course-service`.
3. Call:

```http
GET http://localhost:3007/analytics/me/progress
Authorization: Bearer <student_token>
```

Expected: dashboard returns `attemptCount`, `passRate`, study minutes, trend, and weak topics.

## Cache Check

Use Redis CLI and verify key:

```powershell
docker exec -it luyen-thi-lai-xe-microservices-redis-1 redis-cli keys "analytics:progress:*"
```

After `POST /enrollments/{id}/reset-progress`, the student's analytics key should be invalidated and rebuilt on next read.
## SRS UC34 Cache Scope Tests

1. Owner-only:
   call `GET /analytics/me/progress` as student and verify response `studentId` equals JWT `sub`.
2. Cache miss/hit:
   first call builds from PostgreSQL projection; second call should use Redis key `analytics:progress:{studentId}:{licenseTier|default}`.
3. Reset invalidation:
   after `course.enrollment.progress-reset`, verify all `analytics:progress:{studentId}:*` keys are invalidated and rebuilt on next read.
4. Weak topics:
   after wrong exam answers are projected, verify top weak topics are ranked by incorrect count.
