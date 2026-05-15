# CLAUDE.md - Luyen Thi Lai Xe Microservices

This repository is a NestJS monorepo for a driving-license exam learning platform. It uses DDD + Clean Architecture, Prisma, Consul, RabbitMQ, Kong, Keycloak, Redis, and ELK.

Use this file as the compact project map. For detailed behavior, read the relevant files in `guides/` before changing code.

## Reusable Implementation Prompt

Dung prompt nay moi khi yeu cau AI agent implement feature trong repo:

```text
Ban dang lam viec trong NestJS microservices monorepo "luyen-thi-lai-xe-microservices".

Truoc khi implement, hay doc va su dung context tu:
- CLAUDE.md
- guides/ddd+clean/CONVENTIONS.md
- guides/ddd+clean/DATABASE_DESIGN.md
- guides/consul/WORKFLOW.md
- guides/api/*.md lien quan den service can sua
- guides/testing/*.md lien quan den service can sua
- apps/user-service nhu reference implementation
- code hien co cua service can sua

Hay implement theo DDD + Clean Architecture, convention Consul config, Prisma custom client output, Kong/Keycloak integration, RabbitMQ event, va style hien co cua repo. Giu thay doi dung pham vi yeu cau. Khong hardcode secrets; dung root .env, Docker Compose env interpolation, va Consul env seeding. Neu them/sua endpoint, DTO, event, config, hoac behavior public, hay cap nhat API spec va test guide tuong ung. Sau khi sua, chay check hep nhat co ich truoc, roi chay check rong hon neu can.
```

## Key Commands

```bash
# Hybrid dev: Docker infra + local services
npm run infra:up
npm run dev
npm run infra:down

# Full Docker
npm run docker:build
npm run docker:up
npm run docker:migrate
npm run docker:down

# Consul
npm run consul:seed
npm run consul:seed:local
npm run consul:list -- config/development-local/<service-name>
npm run consul:get -- config/development-local/<service-name>/<key>

# Prisma migrations for all Prisma services
npm run db:migrate
npm run db:deploy

# Quality gates
npm run build
npm run check-types
npm run check
```

## Services

`apps/`

- `identity-service`: auth-facing service, Keycloak admin integration, identity users, token blacklist.
- `user-service`: user profiles and student details. This is the main reference implementation.
- `course-service`: courses, lessons, enrollments, lesson progress.
- `question-service`: question bank and question topics.
- `media-service`: media metadata, Azure Blob compatible storage.
- `exam-service`, `notification-service`, `analytics-service`, `simulation-service`, `docs-service`: existing bounded contexts.

`packages/`

- `@repo/common`: DDD base classes, Consul config loader, HTTP response/error helpers, Swagger helpers.
- `@repo/eslint-config`, `@repo/typescript-config`: shared tooling.

## Architecture Rules

Layer dependency direction:

```text
domain -> only domain code and @repo/common DDD primitives
application -> domain only, use cases, ports, commands/results
infrastructure -> application + domain + framework/db/messaging implementations
presentation -> controllers, DTOs, guards; calls application use cases
```

Do not import NestJS, Prisma, HTTP, RabbitMQ, or Keycloak APIs into `domain/`.
Do not import Prisma into `application/`.
Do not put business rules in repositories, mappers, controllers, or Prisma services.

## DDD Conventions

- Aggregates extend `AggregateRoot<string>`.
- Entities extend `Entity<string>`.
- Value objects extend `ValueObject<T>`.
- Business methods live on aggregates/entities and may call `addDomainEvent()`.
- Use cases implement `IUseCase<Input, Output>` where practical.
- Repositories are application ports; Prisma repositories are infrastructure adapters.
- Use `static create()` for new aggregates and `static reconstitute()` for DB-loaded aggregates.
- Save aggregate changes before publishing events, then clear domain events.
- Cross-service relationships store UUID references only. Do not create Prisma foreign keys across services.

## Service Template

For a new or expanded service, prefer this structure:

```text
apps/<service>/src/
  domain/
    aggregates/
    events/
    exceptions/
    value-objects/
  application/
    ports/
    use-cases/
  infrastructure/
    persistence/prisma/
    messaging/
    filters/
  presentation/
    http/
    messaging/
    dtos/
  app.module.ts
  main.ts
```

Use `apps/user-service` as the first reference for DDD structure, module wiring, HTTP controllers, messaging controllers, Prisma repositories, and domain exception filters.

## Prisma Conventions

- Each Prisma service has `prisma.config.ts`.
- Generated Prisma clients use custom package outputs under root `node_modules`, for example:
  - `@prisma/identity-client`
  - `@prisma/user-client`
  - `@prisma/course-client`
  - `@prisma/question-client`
  - `@prisma/media-client`
- Import from the generated package, not from `@prisma/client`, inside services and seed files.
- Prisma v7 uses `@prisma/adapter-pg` and `PrismaPg`; do not use removed options such as `datasourceUrl`.
- Migrations are run from root scripts:
  - `npm run db:migrate` for local dev migration creation.
  - `npm run db:deploy` or `npm run docker:migrate` for deploy-style migration.

## Consul Conventions

Config loading priority is env vars over Consul over defaults. The common loader is in `packages/common/src/consul/`.

Key format:

```text
config/<environment>/<service-name>/<path>
config/development-local/question-service/database.url
config/development/media-service/storage.accountKey
```

Environments:

- `development-local`: services run on host, infra in Docker.
- `development`: all services run inside Docker network.

Root `npm run dev` forces `NODE_ENV=development-local` and `CONSUL_URL=http://127.0.0.1:8500`.

When adding config:

- Add env mapping in `ConsulConfigFactory.loadFromEnv()` if services need env fallback.
- Add Docker seed values in `docker/consul/init.sh`.
- Add local seed values in `consul-seed-development-local.json` if that file is present locally.
- Do not print secret values in logs.

## Secrets

Never hardcode real secrets, access keys, client secrets, tokens, or connection strings with passwords in tracked files.

Use:

- root `.env` for local secret values; it is ignored by Git.
- `.env.example` for placeholders only.
- Docker Compose interpolation, for example `${STORAGE_ACCOUNT_KEY:-}`.
- `docker/consul/init.sh` to seed Consul from env vars.

Tracked config may use placeholders such as `change-me`, empty string defaults, or local-only dummy passwords for throwaway Docker databases.

## Kong And Keycloak

Kong is the gateway. Keycloak validates identity/auth flows.

- `kong/kong.dev.yaml`: hybrid dev, routes to host services.
- `kong/kong.yaml`: full Docker, routes through Docker DNS.
- Kong should validate JWT where configured and inject user identity headers.
- Expected headers:
  - `x-user-id`: Keycloak `sub`
  - `x-user-role`: effective role

Keycloak config lives in:

- `docker/keycloak/realm-export.json`
- service config under `keycloak.*`

Do not commit real Keycloak client secrets in realm exports or guides.

## RabbitMQ Events

- Use durable queues where the existing service does so.
- Consumers should use `noAck: false` unless a service has a documented reason not to.
- Publish domain events only after database save succeeds.
- Keep event names stable and explicit, for example `identity.user.created`.

## HTTP And DTO Conventions

- All HTTP success responses go through `ApiResponseInterceptor`.
- HTTP and domain errors should share the common response shape.
- Use DTO classes for controller input/output. Avoid anonymous return object types in controller signatures.
- Update endpoints should return the updated result from the use case; avoid unnecessary double-query.
- Put `@ApiHeader` only on methods that need a header, not at controller class level.

## Docker Notes

- `docker-compose.yaml`: full stack.
- `docker-compose.infra.yml`: infra-only hybrid dev.
- RabbitMQ uses a bootstrap command to fix `.erlang.cookie` permissions on Docker Desktop/Windows.
- `docker/consul/init.sh` must use LF line endings. CRLF breaks Alpine `sh`.

## Important References

- `guides/ddd+clean/CONVENTIONS.md`: detailed DDD/Clean code templates and checklist.
- `guides/ddd+clean/DATABASE_DESIGN.md`: database design by bounded context.
- `guides/consul/WORKFLOW.md`: Consul config workflow.
- `guides/api/api-spec-*.md`: API behavior by service.
- `guides/testing/*-test-guide.md`: testing flows.
- `packages/common/src/consul/consul.factory.ts`: config merge rules.
- `packages/common/src/http-api.ts`: response/error format.
- `apps/user-service`: reference implementation.

## Before Finishing A Change

Run the narrowest checks that prove the change:

```bash
npm --workspace=apps/<service> run check-types
npm --workspace=apps/<service> run build
npx turbo run check-types
docker compose config --quiet
```

For Docker/Consul changes, also check:

```bash
docker compose up -d consul consul-init
docker compose ps -a consul-init
docker logs --tail 120 luyen-thi-lai-xe-microservices-consul-init-1
```

For Prisma changes, run the relevant `prisma:generate`, `db:migrate`, or `db:deploy` command.

Documentation checklist:

- If API behavior changes, update `guides/api/api-spec-<service>.md`.
- If request/response DTO changes, update the API spec examples.
- If auth, role, Kong, or Keycloak behavior changes, update relevant API and testing guides.
- If a workflow changes, update `guides/testing/<service>-test-guide.md`.
- If Consul config keys change, update `guides/consul/WORKFLOW.md` or the relevant setup notes.
