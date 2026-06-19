# Contract Testing — DriveMate

DriveMate dùng Consumer-Driven Contract Testing với Pact V4 cho các API có rủi ro frontend-backend drift cao nhất. P1 tập trung vào `identity-service` và `exam-service`, vì hai service này giữ auth flow, admin CRUD và exam session lifecycle.

## Scope P1

| Consumer | Provider | Mục tiêu |
| --- | --- | --- |
| `drivemate-mobile` | `identity-service` | Login, refresh, logout, change password và auth error shape. |
| `drivemate-mobile` | `exam-service` | Available exams, start session, save answer, submit, result và missed-review shape. |
| `drivemate-admin` | `identity-service` | Identity user CRUD, role, lock, reset password và duplicate/not-found errors. |
| `drivemate-admin` | `exam-service` | Exam template CRUD, admin sessions và version-conflict error. |

`course-service` và `user-service` là P2 sau khi P1 chạy ổn định trong CI.

## Repo Files

| Path | Vai trò |
| --- | --- |
| `packages/pact-matchers/` | Shared Pact V4 matcher builders dùng chung giữa consumer và provider state. |
| `apps/identity-service/test/pact/identity.pact.provider.ts` | Provider verifier cho pact của mobile/admin với `identity-service`. |
| `apps/exam-service/test/pact/exam.pact.provider.ts` | Provider verifier cho pact của mobile/admin với `exam-service`. |
| `.github/workflows/contract-tests.yml` | Backend workflow nhận pact artifact → verify song song identity và exam. |
| `DriveMate-FE/.github/workflows/contract-tests.yml` | Consumer workflow: generate pact → upload artifact → trigger backend verify. |
| `DriveMate-Admin/.github/workflows/contract-tests.yml` | Consumer workflow: tương tự cho admin (Vitest). |

Provider harness là HTTP/controller-level Nest app. Nó verify route, validation pipe, shared response envelope, DTO mapper và error envelope — bao gồm cả `DomainExceptionFilter` để error shape khớp đúng production. Keycloak/Prisma thật không được spin up; integration/e2e tests vẫn chịu trách nhiệm kiểm tra DB, Keycloak và event side effect.

Consumer repos import `@repo/pact-matchers` bằng local `file:` dependency khi phát triển cùng workspace. Trong CI, consumer workflow tự checkout backend repo, build package, rồi override `file:` dep bằng path tuyệt đối.

## Commands

Build và test shared matcher package:

```powershell
pnpm --filter @repo/pact-matchers run check-types
pnpm --filter @repo/pact-matchers run test
pnpm --filter @repo/pact-matchers run build
```

Dry-run provider harness khi chưa có pact files:

```powershell
$env:PACT_SKIP_MISSING="true"
pnpm run test:pact:provider
```

Verify pact files thật:

```powershell
$env:PACT_DIR="D:\path\to\pacts"
pnpm run test:pact:provider # Chạy tất cả services cùng lúc (turbo, concurrency=1 để tránh port conflict)

# hoặc chạy từng service riêng
pnpm run test:pact:provider:identity
pnpm run test:pact:provider:exam
```

Nếu `PACT_DIR` không set, backend tìm pact files trong `./pacts`.

## Pact File Convention

Consumer pipeline upload artifact chứa các file sau. Provider scripts cũng tự discover mọi `*.json` có tên chứa provider name:

```text
pacts/
  drivemate-mobile-identity-service.json
  drivemate-mobile-exam-service.json
  drivemate-admin-identity-service.json
  drivemate-admin-exam-service.json
```

Nếu artifact dùng tên khác, set `PACT_URLS` bằng danh sách path ngăn cách bởi dấu phẩy.

## Shared Matchers

Consumer tests nên import matcher từ `@repo/pact-matchers` thay vì hardcode value. Dùng `uuid`, `integer`, `regex`, `eachLike`, `timestamp` để tránh fixture brittle:

```typescript
import {
  loginResponseMatcher,
  successEnvelopeMatcher,
  successStatusMatcher,
} from "@repo/pact-matchers";

await pact
  .addInteraction()
  .given("a valid identity login exists")
  .uponReceiving("mobile login succeeds")
  .withRequest("POST", "/auth/login", (builder) => {
    builder.headers({ "content-type": "application/json" });
    builder.jsonBody({ username: "student@example.com", password: "Password@123" });
  })
  .willRespondWith(successStatusMatcher(201), (builder) => {
    builder.headers({ "content-type": "application/json; charset=utf-8" });
    builder.jsonBody(successEnvelopeMatcher(loginResponseMatcher(), "Created"));
  })
  .executeTest(async (mockServer) => {
    // call real client code against mockServer.url
  });
```

## Provider States

### Thiết kế harness

Provider harness dùng **controller-level Nest app với mocked use cases** — không cần DB hay Keycloak thật. Mỗi state handler gán lại return value (hoặc throw exception) cho use case mock tương ứng trước khi Pact gửi request:

```typescript
// Pattern cho success state
const stateHandlers = {
  'an exam template exists': async () => {
    arrangeDefaultProviderState();  // reset tất cả mocks về happy path
    return providerValues();        // trả stable IDs cho consumer dùng
  },

  // Pattern cho error state — throw ĐÚNG domain exception như production
  'an exam template version conflict exists': async () => {
    arrangeDefaultProviderState();
    updateTemplateUseCase.rejects(new ExamTemplateVersionConflictException());
    return providerValues();
  },
};
```

**Quan trọng**: Error states phải throw **domain exception thật** (không phải NestJS `ConflictException` hay `NotFoundException` trực tiếp) để `DomainExceptionFilter` được exercise đúng filter chain như production. Exception nào chưa có domain class tương ứng (ví dụ lỗi từ Keycloak) thì mới dùng NestJS exception.

### Filter chain trong harness

```
Use Case Mock throw DomainException
  → DomainExceptionFilter.catch()   ← được register trong harness
  → HTTP status map (EXAM_TEMPLATE_VERSION_CONFLICT → 409)
  → { success: false, code: '...', message: '...', errorCode: '...', ... }
```

So sánh với nếu dùng NestJS exception trực tiếp:

```
Use Case Mock throw ConflictException
  → ApiExceptionFilter.catch()      ← filter khác, không exercise DomainExceptionFilter
  → HTTP 409 với shape khác (thiếu errorCode)
```

### Stable provider IDs

Tất cả state handlers trả cùng bộ ID ổn định để consumer có thể dùng trong URL path:

```typescript
const pactTemplateId = '550e8400-e29b-41d4-a716-446655440000';
const pactSessionId  = '550e8400-e29b-41d4-a716-446655440200';
const pactStudentId  = '550e8400-e29b-41d4-a716-446655440010';
// ...
```

Consumer import `pactExamples` từ `@repo/pact-matchers` để dùng cùng bộ ID:

```typescript
import { pactExamples } from '@repo/pact-matchers';

.withRequest('GET', `/exams/sessions/${pactExamples.sessionId}/result`, ...)
```

### Supported states

| Provider | State | Loại |
| --- | --- | --- |
| identity-service | `a valid identity login exists` | success |
| identity-service | `a valid refresh token exists` | success |
| identity-service | `a logout token exists` | success |
| identity-service | `an identity user can be created` | success |
| identity-service | `identity users exist` | success |
| identity-service | `an identity user exists` | success |
| identity-service | `an identity user can be updated` | success |
| identity-service | `an identity user can change role` | success |
| identity-service | `an identity user can be locked` | success |
| identity-service | `an identity user can be deleted` | success |
| identity-service | `a password reset target exists` | success |
| identity-service | `the current user can change password` | success |
| identity-service | `identity login is rejected` | error — UnauthorizedException (từ Keycloak) |
| identity-service | `an identity user already exists` | error — ConflictException (từ Keycloak) |
| identity-service | `an identity user does not exist` | error — IdentityUserNotFoundException (DomainException) |
| exam-service | `a student with matching license has available exams` | success |
| exam-service | `an active exam template exists` | success |
| exam-service | `an exam template exists` | success |
| exam-service | `an in-progress exam session exists for the student` | success |
| exam-service | `a completed exam session exists for the student` | success |
| exam-service | `exam sessions exist` | success |
| exam-service | `missed question history exists for the student` | success |
| exam-service | `an exam template version conflict exists` | error — ExamTemplateVersionConflictException (DomainException) |
| exam-service | `an exam template does not exist` | error — ExamTemplateNotFoundException (DomainException) |

## CI Gate

### Flow đầy đủ

```
Consumer PR (DriveMate-FE hoặc DriveMate-Admin)
  │
  ├── generate-pacts job
  │     ├── checkout backend (sparse: packages/pact-matchers)
  │     ├── build @repo/pact-matchers
  │     ├── npm run test:pact  ← generate pact JSON files
  │     └── upload-artifact: drivemate-{mobile|admin}-pacts
  │
  └── trigger-provider-verify job
        └── gh workflow run contract-tests.yml (backend repo)
              │
              ├── build-shared      ← L3 cache: shared dist
              ├── download-pacts    ← download artifact từ consumer run
              │
              ├── provider-verify: identity-service  ─┐ chạy song song
              └── provider-verify: exam-service      ─┘ (matrix strategy)
                    └── PASS / FAIL → block hoặc allow PR
```

### Stratified caching

| Layer | Nội dung | Cache key |
| --- | --- | --- |
| L1 | pnpm store | `pnpm-lock.yaml` hash |
| L3 | `packages/common/dist` + `packages/pact-matchers/dist` | source hash của packages |

L3 cache đảm bảo provider-verify jobs không rebuild shared packages nếu source không thay đổi.

### Workflow inputs (backend `contract-tests.yml`)

| Input | Ý nghĩa |
| --- | --- |
| `pact_artifact_repo` | Repo chứa artifact, ví dụ `org/DriveMate-FE`. |
| `pact_artifact_run_id` | GitHub Actions run id đã upload pact artifact. |
| `pact_artifact_name` | Tên artifact, mặc định `drivemate-pacts`. |

### Secrets/vars cần setup

| Secret/Var | Repo | Ý nghĩa |
| --- | --- | --- |
| `secrets.BACKEND_DISPATCH_TOKEN` | DriveMate-FE, DriveMate-Admin | PAT hoặc GitHub App token có quyền `workflow` trên backend repo. |
| `vars.BACKEND_REPO` | DriveMate-FE, DriveMate-Admin | Tên backend repo, ví dụ `org/luyen-thi-lai-xe-microservices`. |

Provider verification fail thì PR bị chặn. Nếu consumer thêm interaction mới mà provider chưa đáp ứng, provider team phải sửa backend hoặc thống nhất lại contract trước khi merge.

## Quality Checklist

- Consumer pact không phụ thuộc vào message text — frontend chỉ nên map theo `code`.
- `POST /login` không có `@HttpCode` decorator → NestJS default là `201 Created`. Consumer dùng `successStatusMatcher(201)` là đúng; `matchStatus` accept cả `200` và `201` để tránh brittle.
- Contract chỉ chứa public/frontend fields. Không đưa answer key như `options[].isCorrect` hoặc token thật vào pact.
- Error states phải dùng domain exception thật (không phải NestJS exception trực tiếp) để DomainExceptionFilter được test đúng.
- Khi đổi endpoint/DTO, cập nhật API spec tương ứng trong `docs/api/` và matcher package nếu shape thuộc P1.
- Khi thêm state mới vào consumer, kiểm tra bảng trên — state phải được khai báo trong `stateHandlers` của provider harness trước khi consumer test chạy trong CI.
