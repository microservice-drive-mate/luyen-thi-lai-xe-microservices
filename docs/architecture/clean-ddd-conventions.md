
<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# DDD + Clean Architecture — Conventions & Templates

> Tài liệu này là **nguồn tham chiếu duy nhất** khi implement các service mới trong monorepo này.
> `user-service` là **reference implementation** — mọi service khác phải follow cùng pattern.

---

## Mục lục

1. [Cấu trúc thư mục chuẩn](#1-cấu-trúc-thư-mục-chuẩn)
2. [Quy tắc đặt tên](#2-quy-tắc-đặt-tên)
3. [Layer rules — Ai phụ thuộc vào ai](#3-layer-rules--ai-phụ-thuộc-vào-ai)
4. [Template: Domain Layer](#4-template-domain-layer)
5. [Template: Application Layer](#5-template-application-layer)
6. [Template: Infrastructure Layer](#6-template-infrastructure-layer)
7. [Template: Presentation Layer](#7-template-presentation-layer)
8. [Template: Module & Bootstrap](#8-template-module--bootstrap)
9. [Template: Prisma Schema](#9-template-prisma-schema)
10. [Checklist khi thêm use case mới](#10-checklist-khi-thêm-use-case-mới)
11. [Checklist khi tạo service mới từ đầu](#11-checklist-khi-tạo-service-mới-từ-đầu)
12. [Những gì KHÔNG được làm](#12-những-gì-không-được-làm)

---

## 1. Cấu trúc thư mục chuẩn

```
apps/<service-name>/
├── prisma/
│   ├── schema.prisma           # Prisma schema (models của service này)
│   └── migrations/             # Auto-generated migrations
│
├── src/
│   ├── domain/                 # ← Layer trong cùng. ZERO dependencies ngoài @repo/common
│   │   ├── aggregates/
│   │   │   └── <root-name>/
│   │   │       ├── <root-name>.aggregate.ts       # extends AggregateRoot<string>
│   │   │       ├── <root-name>.types.ts           # Enums, interfaces Props
│   │   │       └── <child-entity>.entity.ts       # extends Entity<string> (nếu có)
│   │   ├── value-objects/
│   │   │   └── <name>.vo.ts                       # extends ValueObject<{...}>
│   │   ├── events/
│   │   │   └── <name>.event.ts                    # extends DomainEvent
│   │   ├── exceptions/
│   │   │   └── <name>.exception.ts                # extends DomainException
│   │   └── repositories/
│   │       └── <root-name>.repository.ts          # abstract class (interface contract)
│   │
│   ├── application/            # ← Orchestration. Depends on domain only
│   │   ├── ports/
│   │   │   └── event-publisher.port.ts            # abstract class cho external services
│   │   └── use-cases/
│   │       └── <use-case-name>/
│   │           ├── <use-case-name>.command.ts     # hoặc .query.ts
│   │           ├── <use-case-name>.result.ts      # (tách riêng nếu phức tạp)
│   │           └── <use-case-name>.use-case.ts    # implements IUseCase<TInput, TOutput>
│   │
│   ├── infrastructure/         # ← Details. Implements application ports
│   │   ├── persistence/
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.service.ts
│   │   │   │   └── prisma-<root-name>.repository.ts  # extends abstract repo
│   │   │   └── mappers/
│   │   │       └── <root-name>.mapper.ts          # Prisma raw → Domain aggregate
│   │   ├── messaging/
│   │   │   └── rabbitmq-event-publisher.service.ts
│   │   └── filters/
│   │       └── domain-exception.filter.ts
│   │
│   ├── presentation/           # ← Interface adapters
│   │   ├── http/
│   │   │   └── <root-name>.controller.ts
│   │   ├── messaging/
│   │   │   └── messaging.controller.ts            # @EventPattern handlers
│   │   └── dtos/
│   │       ├── create-<root-name>.request.dto.ts
│   │       ├── update-<root-name>.request.dto.ts
│   │       └── <root-name>.response.dto.ts
│   │
│   ├── <service-name>.module.ts    # Feature module (providers, controllers)
│   ├── app.module.ts               # Root module (ConfigModule only)
│   └── main.ts                     # Bootstrap
│
├── Dockerfile
└── package.json
```

---

## 2. Quy tắc đặt tên

### Files

| Loại                         | Suffix             | Ví dụ                          |
| ---------------------------- | ------------------ | ------------------------------ |
| Aggregate root               | `.aggregate.ts`    | `exam-session.aggregate.ts`    |
| Child entity                 | `.entity.ts`       | `exam-answer.entity.ts`        |
| Value Object                 | `.vo.ts`           | `score.vo.ts`                  |
| Domain Event                 | `.event.ts`        | `exam-completed.event.ts`      |
| Domain Exception             | `.exception.ts`    | `exam-not-found.exception.ts`  |
| Abstract Repository          | `.repository.ts`   | `exam-session.repository.ts`   |
| Abstract Port                | `.port.ts`         | `notification.port.ts`         |
| Command                      | `.command.ts`      | `submit-exam.command.ts`       |
| Query                        | `.query.ts`        | `get-exam-result.query.ts`     |
| Result (output của use case) | `.result.ts`       | `get-exam-result.result.ts`    |
| Use Case                     | `.use-case.ts`     | `submit-exam.use-case.ts`      |
| Mapper                       | `.mapper.ts`       | `exam-session.mapper.ts`       |
| Request DTO                  | `.request.dto.ts`  | `create-exam.request.dto.ts`   |
| Response DTO                 | `.response.dto.ts` | `exam-session.response.dto.ts` |

### Classes

| Loại         | Suffix        | Ví dụ                                                                    |
| ------------ | ------------- | ------------------------------------------------------------------------ |
| Aggregate    | `[none]`      | `ExamSession`                                                            |
| Entity       | `[none]`      | `ExamAnswer`                                                             |
| Value Object | `[none]`      | `Score`                                                                  |
| Domain Event | `Event`       | `ExamCompletedEvent`                                                     |
| Exception    | `Exception`   | `ExamNotFoundException`                                                  |
| Use Case     | `UseCase`     | `SubmitExamUseCase`                                                      |
| Command      | `Command`     | `SubmitExamCommand`                                                      |
| Query        | `Query`       | `GetExamResultQuery`                                                     |
| Result       | `Result`      | `GetExamResultResult`                                                    |
| Repository   | `Repository`  | `ExamSessionRepository` (abstract), `PrismaExamSessionRepository` (impl) |
| Mapper       | `Mapper`      | `ExamSessionMapper`                                                      |
| Request DTO  | `RequestDto`  | `CreateExamRequestDto`                                                   |
| Response DTO | `ResponseDto` | `ExamSessionResponseDto`                                                 |

### Domain Event names

Format: `<service>.<aggregate>.<past-tense-verb>`

```
exam.session.completed
exam.session.started
course.enrollment.created
course.lesson.completed
notification.sent
```

### Exception codes

Format: `SCREAMING_SNAKE_CASE`, mô tả ngắn gọn trạng thái sai.

```
EXAM_SESSION_NOT_FOUND
EXAM_SESSION_ALREADY_SUBMITTED
EXAM_NOT_AVAILABLE
ENROLLMENT_NOT_FOUND
QUESTION_NOT_FOUND
```

---

## 3. Layer rules — Ai phụ thuộc vào ai

```
domain       ← không import từ đâu (ngoài @repo/common)
application  ← import từ domain
infrastructure ← import từ domain + application
presentation ← import từ application (use cases, commands, queries, results)
              ← KHÔNG import trực tiếp từ infrastructure hoặc domain aggregate
```

### Kiểm tra vi phạm nhanh

```bash
# Nếu domain import NestJS → SAI
grep -r "from '@nestjs" apps/<service>/src/domain/

# Nếu domain import prisma → SAI
grep -r "from '@prisma" apps/<service>/src/domain/

# Nếu presentation import repository impl → SAI
grep -r "PrismaExam" apps/<service>/src/presentation/
```

---

## 4. Template: Domain Layer

### 4.1 Aggregate Root

```typescript
// src/domain/aggregates/<name>/<name>.aggregate.ts
import { AggregateRoot } from "@repo/common";
import { SomeChildEntity } from "./<child>.entity";
import { SomeEvent } from "../../events/some.event";
import { SomeException } from "../../exceptions/some.exception";
import { CreateProps, ReconstituteProps, UpdateProps } from "./<name>.types";

export class ExamSession extends AggregateRoot<string> {
  private _status: ExamStatus;
  private _answers: ExamAnswer[];
  // ...

  private constructor(id: string, status: ExamStatus, answers: ExamAnswer[]) {
    super(id);
    this._status = status;
    this._answers = answers;
  }

  // Factory: tạo mới từ đầu (business rules)
  static create(props: CreateExamSessionProps): ExamSession {
    // Validate invariants tại đây, throw DomainException nếu vi phạm
    return new ExamSession(props.id, ExamStatus.IN_PROGRESS, []);
  }

  // Factory: tái tạo từ persistence (không validate lại)
  static reconstitute(props: ReconstituteExamSessionProps): ExamSession {
    const session = new ExamSession(props.id, props.status, []);
    // restore children...
    return session;
  }

  // Domain methods — mang business logic
  submit(answers: SubmitAnswerProps[]): void {
    if (this._status !== ExamStatus.IN_PROGRESS) {
      throw new ExamAlreadySubmittedException(this._id);
    }
    this._status = ExamStatus.SUBMITTED;
    // Calculate score...
    this.addDomainEvent(new ExamCompletedEvent(this._id, score));
  }

  // Getters — readonly access
  get status(): ExamStatus {
    return this._status;
  }
  get answers(): ExamAnswer[] {
    return [...this._answers];
  }
}
```

### 4.2 Types file (Props interfaces)

```typescript
// src/domain/aggregates/<name>/<name>.types.ts
export enum ExamStatus {
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  GRADED = "GRADED",
}

// Props cho create() factory
export interface CreateExamSessionProps {
  id: string;
  studentId: string;
  examId: string;
  startedAt: Date;
}

// Props cho reconstitute() factory
export interface ReconstituteExamSessionProps {
  id: string;
  studentId: string;
  examId: string;
  status: ExamStatus;
  score: number | null;
  startedAt: Date;
  submittedAt: Date | null;
}

// Props cho domain methods
export interface SubmitAnswerProps {
  questionId: string;
  selectedOptionId: string;
}
```

### 4.3 Child Entity

```typescript
// src/domain/aggregates/<name>/<child>.entity.ts
import { Entity } from "@repo/common";

export class ExamAnswer extends Entity<string> {
  private _isCorrect: boolean | null;

  constructor(
    id: string,
    readonly questionId: string,
    readonly selectedOptionId: string,
    isCorrect: boolean | null,
  ) {
    super(id);
    this._isCorrect = isCorrect;
  }

  markCorrect(): void {
    this._isCorrect = true;
  }
  markIncorrect(): void {
    this._isCorrect = false;
  }

  get isCorrect(): boolean | null {
    return this._isCorrect;
  }
}
```

### 4.4 Value Object

```typescript
// src/domain/value-objects/<name>.vo.ts
import { ValueObject, DomainException } from "@repo/common";

export class InvalidScoreException extends DomainException {
  readonly code = "INVALID_SCORE";
}

export class Score extends ValueObject<{ value: number }> {
  private constructor(props: { value: number }) {
    super(props);
  }

  static create(value: number): Score {
    if (value < 0 || value > 40) {
      throw new InvalidScoreException(
        `Score ${value} must be between 0 and 40`,
      );
    }
    return new Score({ value });
  }

  get value(): number {
    return this.props.value;
  }

  isPassing(): boolean {
    return this.props.value >= 28;
  }
}
```

### 4.5 Domain Event

```typescript
// src/domain/events/<name>.event.ts
import { DomainEvent } from "@repo/common";

export class ExamCompletedEvent extends DomainEvent {
  get eventName(): string {
    return "exam.session.completed";
  }

  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly score: number,
    readonly isPassed: boolean,
    readonly licenseCategory: string,
  ) {
    super();
  }
}
```

### 4.6 Domain Exception

```typescript
// src/domain/exceptions/<name>.exception.ts
import { DomainException } from "@repo/common";

export class ExamSessionNotFoundException extends DomainException {
  readonly code = "EXAM_SESSION_NOT_FOUND";

  constructor(sessionId: string) {
    super(`Exam session not found: ${sessionId}`);
  }
}

export class ExamAlreadySubmittedException extends DomainException {
  readonly code = "EXAM_ALREADY_SUBMITTED";

  constructor(sessionId: string) {
    super(`Exam session ${sessionId} has already been submitted`);
  }
}
```

### 4.7 Abstract Repository

```typescript
// src/domain/repositories/<name>.repository.ts
import { ExamSession } from "../aggregates/exam-session/exam-session.aggregate";

export interface ListExamSessionsFilter {
  studentId?: string;
  status?: ExamStatus;
  page: number;
  size: number;
}

export interface ListExamSessionsPage {
  items: ExamSession[];
  total: number;
}

export abstract class ExamSessionRepository {
  abstract findById(id: string): Promise<ExamSession | null>;
  abstract existsById(id: string): Promise<boolean>;
  abstract save(session: ExamSession): Promise<void>;
  abstract list(filter: ListExamSessionsFilter): Promise<ListExamSessionsPage>;
}
```

---

## 5. Template: Application Layer

### 5.1 Command (Write Operation)

```typescript
// src/application/use-cases/submit-exam/submit-exam.command.ts
export class SubmitExamCommand {
  constructor(
    readonly sessionId: string,
    readonly studentId: string, // từ JWT.sub qua @AuthenticatedUser()
    readonly answers: Array<{
      questionId: string;
      selectedOptionId: string;
    }>,
  ) {}
}
```

### 5.2 Query (Read Operation)

```typescript
// src/application/use-cases/get-exam-result/get-exam-result.query.ts
export class GetExamResultQuery {
  constructor(
    readonly sessionId: string,
    readonly requesterId: string, // từ JWT.sub qua @AuthenticatedUser() để check ownership
  ) {}
}
```

### 5.3 Result

```typescript
// src/application/use-cases/get-exam-result/get-exam-result.result.ts
export class GetExamResultResult {
  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly score: number,
    readonly isPassed: boolean,
    readonly submittedAt: Date,
    readonly answers: Array<{
      questionId: string;
      selectedOptionId: string;
      isCorrect: boolean | null;
    }>,
  ) {}
}
```

### 5.4 Use Case — Command

```typescript
// src/application/use-cases/submit-exam/submit-exam.use-case.ts
import { Injectable } from "@nestjs/common";
import { IUseCase } from "@repo/common";
import { ExamSessionRepository } from "../../../domain/repositories/exam-session.repository";
import { EventPublisher } from "../../ports/event-publisher.port";
import { ExamSessionNotFoundException } from "../../../domain/exceptions/exam-session-not-found.exception";
import { SubmitExamCommand } from "./submit-exam.command";

@Injectable()
export class SubmitExamUseCase implements IUseCase<SubmitExamCommand, void> {
  constructor(
    private readonly examSessionRepository: ExamSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: SubmitExamCommand): Promise<void> {
    const session = await this.examSessionRepository.findById(
      command.sessionId,
    );
    if (!session) {
      throw new ExamSessionNotFoundException(command.sessionId);
    }

    session.submit(command.answers); // domain logic

    await this.examSessionRepository.save(session); // persist

    const events = session.getDomainEvents();
    session.clearDomainEvents();
    await this.eventPublisher.publishAll(events); // publish sau khi save thành công
  }
}
```

### 5.5 Use Case — Query

```typescript
// src/application/use-cases/get-exam-result/get-exam-result.use-case.ts
import { Injectable } from "@nestjs/common";
import { IUseCase } from "@repo/common";
import { ExamSessionRepository } from "../../../domain/repositories/exam-session.repository";
import { ExamSessionNotFoundException } from "../../../domain/exceptions/exam-session-not-found.exception";
import { GetExamResultQuery } from "./get-exam-result.query";
import { GetExamResultResult } from "./get-exam-result.result";

@Injectable()
export class GetExamResultUseCase implements IUseCase<
  GetExamResultQuery,
  GetExamResultResult
> {
  constructor(private readonly examSessionRepository: ExamSessionRepository) {}

  async execute(query: GetExamResultQuery): Promise<GetExamResultResult> {
    const session = await this.examSessionRepository.findById(query.sessionId);
    if (!session) {
      throw new ExamSessionNotFoundException(query.sessionId);
    }

    return new GetExamResultResult(
      session.id,
      session.studentId,
      session.score,
      session.isPassed,
      session.submittedAt!,
      session.answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        isCorrect: a.isCorrect,
      })),
    );
  }
}
```

### 5.6 Event Publisher Port

```typescript
// src/application/ports/event-publisher.port.ts
import { DomainEvent } from "@repo/common";

export abstract class EventPublisher {
  abstract publish(event: DomainEvent): Promise<void>;

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
```

---

## 6. Template: Infrastructure Layer

### 6.1 Prisma Service

```typescript
// src/infrastructure/persistence/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/<service>-client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### 6.2 Mapper

```typescript
// src/infrastructure/persistence/mappers/exam-session.mapper.ts
import { ExamSession } from "../../../domain/aggregates/exam-session/exam-session.aggregate";

type PrismaExamSessionWithRelations = {
  id: string;
  studentId: string;
  status: string;
  score: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  answers: Array<{
    id: string;
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean | null;
  }>;
};

export class ExamSessionMapper {
  static toDomain(raw: PrismaExamSessionWithRelations): ExamSession {
    return ExamSession.reconstitute({
      id: raw.id,
      studentId: raw.studentId,
      status: raw.status as ExamStatus,
      score: raw.score,
      startedAt: raw.startedAt,
      submittedAt: raw.submittedAt,
      answers: raw.answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        isCorrect: a.isCorrect,
      })),
    });
  }
}
```

### 6.3 Repository Implementation

```typescript
// src/infrastructure/persistence/prisma/prisma-exam-session.repository.ts
import { Injectable } from "@nestjs/common";
import { ExamSession } from "../../../domain/aggregates/exam-session/exam-session.aggregate";
import {
  ExamSessionRepository,
  ListExamSessionsFilter,
  ListExamSessionsPage,
} from "../../../domain/repositories/exam-session.repository";
import { ExamSessionMapper } from "../mappers/exam-session.mapper";
import { PrismaService } from "./prisma.service";

@Injectable()
export class PrismaExamSessionRepository extends ExamSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<ExamSession | null> {
    const raw = await this.prisma.examSession.findUnique({
      where: { id },
      include: { answers: true },
    });
    return raw ? ExamSessionMapper.toDomain(raw) : null;
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.prisma.examSession.count({ where: { id } });
    return count > 0;
  }

  async save(session: ExamSession): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.examSession.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          studentId: session.studentId,
          status: session.status,
          score: session.score,
          startedAt: session.startedAt,
          submittedAt: session.submittedAt,
        },
        update: {
          status: session.status,
          score: session.score,
          submittedAt: session.submittedAt,
        },
      });

      // Upsert children trong cùng transaction
      for (const answer of session.answers) {
        await tx.examAnswer.upsert({
          where: { id: answer.id },
          create: {
            id: answer.id,
            sessionId: session.id,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId,
            isCorrect: answer.isCorrect,
          },
          update: { isCorrect: answer.isCorrect },
        });
      }
    });
  }

  async list(filter: ListExamSessionsFilter): Promise<ListExamSessionsPage> {
    const where = {
      ...(filter.studentId && { studentId: filter.studentId }),
      ...(filter.status && { status: filter.status }),
    };

    const skip = (filter.page - 1) * filter.size;
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.examSession.findMany({
        where,
        include: { answers: true },
        skip,
        take: filter.size,
        orderBy: { startedAt: "desc" },
      }),
      this.prisma.examSession.count({ where }),
    ]);

    return {
      items: rawItems.map(ExamSessionMapper.toDomain),
      total,
    };
  }
}
```

### 6.4 RabbitMQ Event Publisher

```typescript
// src/infrastructure/messaging/rabbitmq-event-publisher.service.ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { DomainEvent } from "@repo/common";
import { lastValueFrom } from "rxjs";
import { EventPublisher } from "../../application/ports/event-publisher.port";

export const RABBITMQ_CLIENT = "RABBITMQ_CLIENT";

@Injectable()
export class RabbitMqEventPublisher extends EventPublisher {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {
    super();
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      await lastValueFrom(this.client.emit(event.eventName, event));
      this.logger.log(`Published event: ${event.eventName}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.eventName}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
```

### 6.5 DomainExceptionFilter

```typescript
// src/infrastructure/filters/domain-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { DomainException } from "@repo/common";
import { Request, Response } from "express";

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Map exception codes → HTTP status
    const statusMap: Record<string, number> = {
      EXAM_SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
      EXAM_ALREADY_SUBMITTED: HttpStatus.CONFLICT,
      EXAM_NOT_AVAILABLE: HttpStatus.UNPROCESSABLE_ENTITY,
      // Thêm tất cả exception codes của service vào đây
    };

    const status = statusMap[exception.code] ?? HttpStatus.BAD_REQUEST;

    response.status(status).json({
      success: false,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

---

## 7. Template: Presentation Layer

### 7.1 Request DTOs

```typescript
// src/presentation/dtos/create-exam.request.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateExamRequestDto {
  @ApiProperty()
  @IsUUID()
  examId: string;

  @ApiPropertyOptional({ enum: LicenseCategory })
  @IsOptional()
  @IsEnum(LicenseCategory)
  licenseCategory?: LicenseCategory;
}
```

### 7.2 Response DTOs

```typescript
// src/presentation/dtos/exam-session.response.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { GetExamResultResult } from "../../application/use-cases/get-exam-result/get-exam-result.result";

export class ExamSessionResponseDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  isPassed!: boolean;

  @ApiProperty()
  submittedAt!: Date;

  static fromResult(result: GetExamResultResult): ExamSessionResponseDto {
    const dto = new ExamSessionResponseDto();
    dto.sessionId = result.sessionId;
    dto.score = result.score;
    dto.isPassed = result.isPassed;
    dto.submittedAt = result.submittedAt;
    return dto;
  }
}
```

### 7.3 HTTP Controller

```typescript
// src/presentation/http/exam.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "@repo/common";

@ApiTags("Exams")
@ApiBearerAuth()
@Controller("exams")
export class ExamController {
  constructor(
    private readonly startExamUseCase: StartExamUseCase,
    private readonly submitExamUseCase: SubmitExamUseCase,
    private readonly getExamResultUseCase: GetExamResultUseCase,
  ) {}

  @Post("start")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Start a new exam session" })
  async startExam(
    @AuthenticatedUser() user: { sub: string },
    @Body() dto: CreateExamRequestDto,
  ): Promise<ExamSessionResponseDto> {
    const result = await this.startExamUseCase.execute(
      new StartExamCommand(dto.examId, user.sub),
    );
    return ExamSessionResponseDto.fromResult(result);
  }

  @Post(":sessionId/submit")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Submit exam answers" })
  async submitExam(
    @Param("sessionId") sessionId: string,
    @AuthenticatedUser() user: { sub: string },
    @Body() dto: SubmitExamRequestDto,
  ): Promise<void> {
    await this.submitExamUseCase.execute(
      new SubmitExamCommand(sessionId, user.sub, dto.answers),
    );
  }

  @Get(":sessionId/result")
  @ApiOperation({ summary: "Get exam result" })
  async getExamResult(
    @Param("sessionId") sessionId: string,
  ): Promise<ExamSessionResponseDto> {
    const result = await this.getExamResultUseCase.execute(
      new GetExamResultQuery(sessionId),
    );
    return ExamSessionResponseDto.fromResult(result);
  }
}
```

### 7.4 Messaging Controller

```typescript
// src/presentation/messaging/messaging.controller.ts
import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";

interface UserLicenseTierAssignedPayload {
  studentId: string;
  studentEmail: string;
  newLicenseTier: string;
  changedById: string;
  occurredAt: string;
}

@Controller()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(private readonly someUseCase: SomeUseCase) {}

  @EventPattern("user.student.license-assigned")
  async handleLicenseTierAssigned(
    @Payload() payload: UserLicenseTierAssignedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received user.student.license-assigned for studentId=${payload.studentId}`,
    );
    try {
      await this.someUseCase.execute(/* ... */);
    } catch (error) {
      this.logger.error(`Failed to handle event: ${(error as Error).message}`);
    }
  }
}
```

---

## 8. Template: Module & Bootstrap

### 8.1 Feature Module

```typescript
// src/<service-name>.module.ts
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EventPublisher } from "./application/ports/event-publisher.port";
import {
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from "./infrastructure/messaging/rabbitmq-event-publisher.service";
import { ExamSessionRepository } from "./domain/repositories/exam-session.repository";
import { PrismaExamSessionRepository } from "./infrastructure/persistence/prisma/prisma-exam-session.repository";
import { PrismaService } from "./infrastructure/persistence/prisma/prisma.service";
import { DomainExceptionFilter } from "./infrastructure/filters/domain-exception.filter";
import { ExamController } from "./presentation/http/exam.controller";
import { MessagingController } from "./presentation/messaging/messaging.controller";
import { StartExamUseCase } from "./application/use-cases/start-exam/start-exam.use-case";
import { SubmitExamUseCase } from "./application/use-cases/submit-exam/submit-exam.use-case";
import { GetExamResultUseCase } from "./application/use-cases/get-exam-result/get-exam-result.use-case";

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>("rabbitmq.url") ?? "amqp://localhost:5672",
            ],
            queue: "<service>_service_publish",
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [ExamController, MessagingController],
  providers: [
    // Infrastructure
    PrismaService,
    DomainExceptionFilter,

    // Dependency Inversion bindings
    { provide: ExamSessionRepository, useClass: PrismaExamSessionRepository },
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },

    // Use Cases
    StartExamUseCase,
    SubmitExamUseCase,
    GetExamResultUseCase,
  ],
})
export class ExamModule {}
```

### 8.2 App Module (Root)

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConsulConfigFactory } from "@repo/common";
import Joi from "joi";
import { ExamModule } from "./exam.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [
        ConsulConfigFactory.create(
          Joi.object({
            nodeEnv: Joi.string()
              .valid(
                "development",
                "development-local",
                "staging",
                "production",
              )
              .default("development"),
            port: Joi.number().default(3000),
            database: Joi.object({ url: Joi.string().required() }).optional(),
            rabbitmq: Joi.object({ url: Joi.string().required() }).optional(),
          }).unknown(true),
          "exam-service",
        ),
      ],
      isGlobal: true,
    }),
    ExamModule,
  ],
})
export class AppModule {}
```

### 8.3 Main Bootstrap

```typescript
// src/main.ts
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ValidationPipe } from "@nestjs/common";
import {
  ApiExceptionFilter,
  ApiResponseInterceptor,
  setupMicroserviceSwagger,
} from "@repo/common";
import { AppModule } from "./app.module";
import { DomainExceptionFilter } from "./infrastructure/filters/domain-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const rabbitmqUrl =
    configService.get<string>("rabbitmq.url") ?? "amqp://localhost:5672";

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: "<service>_service_events", // Queue này service CONSUME
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  // DomainExceptionFilter PHẢI đứng sau ApiExceptionFilter
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: "<Service Name> API",
    description: "...",
  });

  const port = configService.get<number>("port") ?? 3000;
  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`✓ <Service> Service listening on port ${port}`);
}
void bootstrap();
```

---

## 9. Template: Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../../../node_modules/@prisma/<service>-client"  // QUAN TRỌNG: output riêng
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Khai báo enums trước models
enum ExamStatus {
  IN_PROGRESS
  SUBMITTED
  GRADED
}

enum LicenseCategory {
  A1
  A2
  B1
  B2
  C
  D
  E
  F
}

// Aggregate Root table
model ExamSession {
  id          String     @id
  studentId   String                // Reference UUID từ user-service (KHÔNG có FK cross-service)
  examId      String                // Reference UUID từ exam config
  status      ExamStatus @default(IN_PROGRESS)
  score       Int?
  isPassed    Boolean?
  startedAt   DateTime
  submittedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  answers ExamAnswer[]  // Owned entity — FK trong service này

  @@map("exam_sessions")
}

// Child entity table
model ExamAnswer {
  id               String   @id @default(uuid())
  sessionId        String
  questionId       String   // Reference UUID từ question-service (KHÔNG có FK cross-service)
  selectedOptionId String
  isCorrect        Boolean?

  session ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@map("exam_answers")
}
```

**Quy tắc Prisma:**

- `output` phải là `@prisma/<service>-client` — mỗi service có Prisma client riêng
- Không dùng FK cross-service — chỉ store UUID
- Dùng `onDelete: Cascade` cho owned entities
- Table names dùng `@@map("snake_case")`, column names dùng camelCase trong model nhưng Prisma tự map

---

## 10. Checklist khi thêm use case mới

Khi thêm một use case mới (ví dụ: `grade-exam`):

```
□ 1. Domain
      □ Thêm domain method vào aggregate nếu cần (GradeExam là business logic → vào aggregate)
      □ Thêm domain exception mới nếu cần
      □ Thêm domain event mới nếu cần

□ 2. Application
      □ Tạo command/query: src/application/use-cases/grade-exam/grade-exam.command.ts
      □ Tạo result (nếu phức tạp): src/application/use-cases/grade-exam/grade-exam.result.ts
      □ Tạo use case: src/application/use-cases/grade-exam/grade-exam.use-case.ts
        □ implements IUseCase<GradeExamCommand, void>
        □ inject repository + eventPublisher (nếu emit event)
        □ Publish events SAU KHI save thành công

□ 3. Infrastructure
      □ Thêm vào DomainExceptionFilter.statusMap nếu có exception mới

□ 4. Presentation
      □ Thêm endpoint vào controller (HTTP hoặc @EventPattern)
      □ Thêm/cập nhật request DTO
      □ Thêm/cập nhật response DTO (có static fromResult())
      □ Thêm @ApiBearerAuth() cho endpoint protected; actor id lấy từ JWT.sub qua @AuthenticatedUser()

□ 5. Module
      □ Register use case trong providers[]

□ 6. API Spec
      □ Cập nhật docs/api/api-spec-<service>.md
```

---

## 11. Checklist khi tạo service mới từ đầu

```
□ 1. Scaffold cấu trúc thư mục (copy từ user-service)
□ 2. Cập nhật package.json (name, scripts)
□ 3. Tạo Prisma schema (output = @prisma/<service>-client)
□ 4. Chạy prisma generate
□ 5. Implement domain layer (aggregate, entities, VOs, events, exceptions, repository interface)
□ 6. Implement application layer (ports, use cases)
□ 7. Implement infrastructure layer (PrismaService, Mapper, Repository impl, EventPublisher)
□ 8. Implement presentation layer (DTOs, HTTP controller, Messaging controller)
□ 9. Wire up module (feature module + app module)
□ 10. Bootstrap (main.ts — copy và thay service name)
□ 11. Dockerfile (copy từ user-service, thay tên)
□ 12. Cập nhật consul-seed-development-local.json (thêm port, database.url)
□ 13. Cập nhật docker-compose.yaml (thêm service + db)
□ 14. Cập nhật kong/kong.yaml (thêm route với JWT plugin)
□ 15. Viết API spec tại docs/api/api-spec-<service>.md
□ 16. Viết test guide tại docs/testing/services-test-guide.md
```

---

## 12. Những gì KHÔNG được làm

### Domain layer

- ❌ Import `@nestjs/*` vào domain — domain phải framework-agnostic
- ❌ Import `@prisma/*` vào domain — domain không biết về persistence
- ❌ Gọi repository trực tiếp từ domain method — domain chỉ call `addDomainEvent()`
- ❌ `public` constructor cho aggregate — phải dùng `private constructor` + factory methods
- ❌ Trả về mutable internal array — phải return `[...this._array]` (copy)

### Application layer

- ❌ Gọi `prisma.xxx` trực tiếp từ use case — phải qua repository interface
- ❌ Import Prisma type vào use case
- ❌ Publish events TRƯỚC KHI save — luôn save trước, publish sau
- ❌ Không clear domain events sau khi publish (`profile.clearDomainEvents()` bắt buộc)

### Infrastructure layer

- ❌ Business logic trong repository — chỉ persistence/query
- ❌ Business logic trong mapper — chỉ type conversion

### Presentation layer

- ❌ `@ApiHeader` ở class level cho tất cả endpoints — chỉ đặt ở method cụ thể cần header đó
- ❌ Import aggregate trực tiếp vào controller — phải qua use case result → DTO
- ❌ Gọi 2 use case liên tiếp để workaround (double query) — use case nên trả kết quả đầy đủ
- ❌ Business logic trong controller — controller chỉ parse request → command → use case → DTO

### Response format

- ❌ Response format không nhất quán giữa `DomainExceptionFilter` và `ApiExceptionFilter`
- ❌ Anonymous return type trong controller method — phải dùng DTO class cụ thể



<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# Database Design — Luyện Thi Lái Xe Microservices

## Nguyên tắc cốt lõi

- **Database per Service** — mỗi service có PostgreSQL database riêng, không share schema
- **Không foreign key cross-service** — chỉ reference bằng UUID
- **Mỗi Aggregate Root có 1 Repository** — transaction boundary là aggregate
- **Domain Events** cho eventual consistency giữa services
- **Denormalize khi cần** — lưu display data ở nhiều service là bình thường trong microservices

## Hạng bằng lái được hỗ trợ

```
A1 | A2 | B1 | B2 | C | D | E | F
```

Trường `licenseCategory` (enum) xuất hiện ở question-service, exam-service, course-service, simulation-service.

---

## Service 1: identity-service → Keycloak ✅ (dùng Keycloak, không tự implement)

**Bounded Context:** Authentication & Authorization

> Hệ thống sử dụng **Keycloak** làm Identity Provider. Không có `identity_db` riêng dùng cho business logic.
> Keycloak quản lý: credentials, login/logout, forgot password, JWT issuance, brute-force lock.
> Các service khác verify JWT do Keycloak cấp (via JWKS endpoint).
>
> **Lưu ý:** `apps/identity-service/prisma/schema.prisma` hiện có model placeholder `IdentityUser` (id, email, name) — đây là artifact tooling, **không dùng** cho business logic. Keycloak vẫn là nguồn dữ liệu thật.

**Roles được cấu hình trong Keycloak:**

```
ADMIN | CENTER_MANAGER | INSTRUCTOR | STUDENT
```

### Domain Events phát ra (Keycloak Event Listener / Webhook)

| Event                        | Trigger                                | Payload                       |
| ---------------------------- | -------------------------------------- | ----------------------------- |
| `identity.user.created`      | Admin/Center Manager tạo tài khoản mới | userId, email, fullName, role |
| `identity.user.locked`       | Brute-force lock                       | userId                        |
| `identity.user.role-changed` | Admin đổi role                         | userId, oldRole, newRole      |

> Events được publish từ Keycloak Event Listener → RabbitMQ khi có thay đổi tài khoản.

---

## Service 2: user-service → `user_db`

**Bounded Context:** User Profile Management

> Hệ thống quản lý **1 trung tâm duy nhất** — không có khái niệm đa trung tâm.
> Keycloak (identity) biết "ai đang đăng nhập". user-service biết "người dùng là ai" (profile, hạng bằng được giao).
> 4 role: ADMIN, CENTER_MANAGER, INSTRUCTOR, STUDENT — tất cả đều có profile ở đây.

### Aggregate Root: `UserProfile`

> Profile cơ bản cho tất cả các role. `id` bằng với `userId` từ Keycloak — nhận qua event khi tạo tài khoản.

```
user_profiles
├── id              UUID PK          ← = Keycloak userId
├── fullName        TEXT NOT NULL
├── email           TEXT NOT NULL    ← denormalized để search/display, không dùng làm auth
├── phoneNumber     TEXT UNIQUE NULLABLE
├── dateOfBirth     DATE NULLABLE
├── avatarUrl       TEXT NULLABLE
├── mediaFileId     UUID NULLABLE    ← ref → media-service FileObject (UUID only, không có FK)
├── gender          ENUM(MALE, FEMALE, OTHER) NULLABLE
├── address         TEXT NULLABLE
├── role            ENUM(ADMIN, CENTER_MANAGER, INSTRUCTOR, STUDENT) NOT NULL  ← sync từ Keycloak
├── isActive        BOOLEAN DEFAULT true   ← admin có thể deactivate độc lập với lock
├── createdAt       TIMESTAMPTZ
└── updatedAt       TIMESTAMPTZ
```

### Entity (thuộc UserProfile aggregate): `StudentDetail`

> Chỉ tồn tại khi `role = STUDENT`. Lưu hạng bằng được giao và các thông tin học viên.

```
student_details
├── id              UUID PK
├── studentId       UUID NOT NULL UNIQUE FK → user_profiles.id
├── licenseTier     ENUM(A1, A2, B1, B2, C, D, E, F) NULLABLE  ← hạng bằng đang học
├── enrolledAt      TIMESTAMPTZ NULLABLE   ← ngày bắt đầu học tại trung tâm
└── notes           TEXT NULLABLE          ← ghi chú của center manager / instructor
```

### Entity (thuộc UserProfile aggregate): `LicenseAssignmentAudit`

> Audit trail bắt buộc theo UC06 — mỗi lần đổi hạng bằng đều ghi lại.

```
license_assignment_audits
├── id              UUID PK
├── studentId       UUID NOT NULL FK → user_profiles.id
├── oldLicenseTier  ENUM(A1, A2, B1, B2, C, D, E, F) NULLABLE  ← null nếu là lần gán đầu tiên
├── newLicenseTier  ENUM(A1, A2, B1, B2, C, D, E, F) NOT NULL
├── changedById     UUID NOT NULL  ← ref → Keycloak userId (ADMIN hoặc CENTER_MANAGER)
└── changedAt       TIMESTAMPTZ NOT NULL
```

### Value Objects (domain layer)

- `PhoneNumber` — validate định dạng 10-11 số VN
- `DateOfBirth` — validate tuổi ≥ 18
- `LicenseTier` — validate thuộc tập hợp hợp lệ (A1..F)

### Domain Events

| Direction | Event                           | Trigger                  | Payload                                            |
| --------- | ------------------------------- | ------------------------ | -------------------------------------------------- |
| Subscribe | `identity.user.created`         | Keycloak tạo tài khoản   | Tạo UserProfile + StudentDetail (nếu role=STUDENT) |
| Subscribe | `identity.user.role-changed`    | Admin đổi role           | Sync lại `role` trên UserProfile                   |
| Publish   | `user.student.license-assigned` | Gán/đổi hạng bằng (UC06) | studentId, oldTier, newTier, changedById           |

---

## Service 2.5: media-service → `media_db`

**Bounded Context:** File Storage & Media Management

> Service lưu trữ metadata file sau khi upload lên Azure Blob Storage. Các service khác (user, course) tham chiếu `mediaFileId` để hiển thị file mà không gọi cross-service.

### Aggregate Root: `FileObject`

```
file_objects
├── id            UUID PK
├── storage_key   TEXT NOT NULL UNIQUE  ← đường dẫn trong Azure Blob (e.g. uploads/2026/05/file.jpg)
├── original_name TEXT NOT NULL
├── mime_type     TEXT NOT NULL
├── file_size     INT NOT NULL          ← bytes
├── bucket_name   TEXT NOT NULL
├── uploaded_by_id UUID NOT NULL        ← ref → Keycloak userId (UUID only, không có FK)
├── is_public     BOOLEAN DEFAULT false
├── status        ENUM(UNLINKED, LINKED) DEFAULT UNLINKED
├── created_at    TIMESTAMPTZ
└── updated_at    TIMESTAMPTZ
```

> **`status`**: `UNLINKED` — file vừa upload, chưa được gắn vào entity nào. `LINKED` — đã được user/course xác nhận dùng (qua event `user.avatar.linked` hoặc `course.material.linked`).

### Domain Events

| Direction | Event | Trigger | Payload |
| --------- | --- | --- | --- |
| Publish | `media.file.uploaded` | Upload file thành công | fileId, storageKey, originalName, mimeType, fileSize, uploadedById |
| Publish | `media.file.deleted` | Xóa file | fileId, storageKey, deletedById |
| Subscribe | `user.avatar.linked` | User gắn avatar | mediaFileId → mark LINKED |
| Subscribe | `course.material.linked` | Course gắn tài liệu | mediaFileId → mark LINKED |

---

## Service 3: question-service → `question_db` ✅ (implemented)

**Bounded Context:** Question Bank Management

### Aggregate Root: `QuestionTopic`

> Phân loại câu hỏi theo chủ đề (Luật giao thông, Biển báo, Kỹ thuật lái, Đạo đức người lái...)

```
question_topics
├── id          UUID PK
├── name        TEXT NOT NULL
├── description TEXT
├── parentId    UUID NULLABLE FK → question_topics.id  ← phân cấp
└── createdAt   TIMESTAMPTZ
```

### Aggregate Root: `Question`

```
questions
├── id               UUID PK
├── content          TEXT NOT NULL          ← max 2000 ký tự
├── type             ENUM(THEORY, TRAFFIC_SIGN, SCENARIO_RELATED)
├── licenseCategory  TEXT[]                 ← array enum A1..F, 1 câu dùng được nhiều hạng
├── difficulty       ENUM(EASY, MEDIUM, HARD)
├── explanation      TEXT                   ← giải thích đáp án đúng
├── imageUrl         TEXT NULLABLE          ← biển báo hoặc tình huống
├── isCritical       BOOLEAN DEFAULT false  ← câu điểm liệt: sai = tự động trượt
├── isActive         BOOLEAN DEFAULT true
├── topicId          UUID NOT NULL FK → question_topics.id
├── createdById      UUID NOT NULL  ← ref → identity_users.id
├── createdAt        TIMESTAMPTZ
└── updatedAt        TIMESTAMPTZ
```

> **`isCritical`**: Câu hỏi về nồng độ cồn, tốc độ tối đa — sai 1 câu là trượt dù tổng điểm đủ.

### Entity (thuộc Question): `QuestionOption`

```
question_options
├── id            UUID PK
├── questionId    UUID NOT NULL FK → questions.id
├── content       TEXT NOT NULL  ← max 500 ký tự
├── isCorrect     BOOLEAN NOT NULL
└── displayOrder  INT NOT NULL
```

### Domain Events phát ra

| Event                  | Trigger          | Payload                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `question.created`     | Thêm câu hỏi mới | questionId, licenseCategory[], isCritical |
| `question.deactivated` | Tắt câu hỏi      | questionId                                |

---

## Service 4: exam-service → `exam_db` ✅ (implemented)

**Bounded Context:** Exam Scheduling & Session Management

### Aggregate Root: `ExamTemplate`

> Blueprint của một đề thi — cấu hình số câu, thời gian, điểm đậu theo hạng bằng.

```
exam_templates
├── id                UUID PK
├── name              TEXT NOT NULL
├── licenseCategory   ENUM(A1, A2, B1, B2, C, D, E, F)
├── totalQuestions    INT NOT NULL
├── passingScore      INT NOT NULL     ← điểm tối thiểu để đậu
├── durationMinutes   INT NOT NULL
├── isActive          BOOLEAN DEFAULT true
├── createdById       UUID NOT NULL
└── createdAt         TIMESTAMPTZ
```

### Aggregate Root: `ExamSession`

> Một lần thi của student. Quản lý toàn bộ trạng thái phiên thi.

```
exam_sessions
├── id                UUID PK
├── studentId         UUID NOT NULL  ← ref → identity_users.id
├── templateId        UUID NOT NULL FK → exam_templates.id
├── status            ENUM(PENDING, IN_PROGRESS, COMPLETED, TIMED_OUT, CANCELLED)
├── score             INT NULLABLE          ← null khi chưa hoàn thành
├── isPassed          BOOLEAN NULLABLE
├── failedByCritical  BOOLEAN DEFAULT false ← trượt do câu điểm liệt
├── startedAt         TIMESTAMPTZ NULLABLE
├── finishedAt        TIMESTAMPTZ NULLABLE
├── expiresAt         TIMESTAMPTZ NOT NULL  ← startedAt + durationMinutes
└── createdAt         TIMESTAMPTZ
```

### Entity (thuộc ExamSession): `ExamSessionQuestion`

> Snapshot câu hỏi tại thời điểm thi — tránh bị ảnh hưởng khi question-service cập nhật sau.

```
exam_session_questions
├── id               UUID PK
├── sessionId        UUID NOT NULL FK → exam_sessions.id
├── questionId       UUID NOT NULL        ← ref → question_db (UUID only, NO FK)
├── questionContent  TEXT NOT NULL        ← snapshot nội dung câu hỏi
├── optionsSnapshot  JSONB NOT NULL       ← snapshot toàn bộ options
├── isCritical       BOOLEAN NOT NULL
├── displayOrder     INT NOT NULL
├── selectedOptionId UUID NULLABLE        ← null = chưa trả lời
├── isCorrect        BOOLEAN NULLABLE
└── answeredAt       TIMESTAMPTZ NULLABLE
```

### Aggregate Root: `ExamSchedule`

> Lịch thi được tạo bởi CENTER_MANAGER hoặc ADMIN.

```
exam_schedules
├── id               UUID PK
├── templateId       UUID NOT NULL FK → exam_templates.id
├── centerId         UUID NULLABLE  ← ref → user-service (UUID only)
├── scheduledAt      TIMESTAMPTZ NOT NULL
├── location         TEXT
├── maxParticipants  INT
├── createdById      UUID NOT NULL
└── createdAt        TIMESTAMPTZ
```

### Value Objects

- `Score` — 0 ≤ value ≤ totalQuestions
- `ExamDuration` — > 0, ≤ 180 phút

### Domain Events phát ra

| Event                    | Trigger                  | Payload                                                |
| ------------------------ | ------------------------ | ------------------------------------------------------ |
| `exam.session.completed` | Thi xong (kể cả timeout) | sessionId, studentId, score, isPassed, licenseCategory |
| `exam.session.passed`    | Thi đậu                  | sessionId, studentId, licenseCategory                  |
| `exam.session.failed`    | Thi rớt                  | sessionId, studentId, failedByCritical                 |

---

## Service 5: course-service → `course_db`

**Bounded Context:** Learning Content & Enrollment

### Aggregate Root: `Course`

```
courses
├── id               UUID PK
├── title            TEXT NOT NULL
├── description      TEXT NULLABLE
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── totalLessons     INT DEFAULT 0
├── duration         TEXT NULLABLE    ← e.g. "3 tháng"
├── tuitionFee       DECIMAL(12,2) DEFAULT 0
├── capacity         INT NULLABLE
├── status           ENUM(DRAFT, ACTIVE) DEFAULT DRAFT
├── createdById      UUID NOT NULL    ← ref → Keycloak userId (INSTRUCTOR/ADMIN)
├── createdAt        TIMESTAMPTZ
└── updatedAt        TIMESTAMPTZ
```

> **Scope simplification:** Không có thumbnailUrl, không có video — khóa học chỉ cần text content. `ARCHIVED` không có trong enum hiện tại.

### Entity (thuộc Course): `Lesson`

```
lessons
├── id        UUID PK
├── courseId  UUID NOT NULL FK → courses.id (onDelete: Cascade)
├── title     TEXT NOT NULL
├── content   TEXT NULLABLE  ← markdown text
├── order     INT NOT NULL
└── createdAt TIMESTAMPTZ
```

> Lesson gắn trực tiếp vào Course (không qua CourseModule). Không có `videoUrl` hay `durationMinutes`.

### Entity (thuộc Course): `CourseInstructor`

> Junction table cho quan hệ many-to-many giữa Course và Instructor.

```
course_instructors
├── id           UUID PK
├── courseId     UUID NOT NULL FK → courses.id (onDelete: Cascade)
└── instructorId UUID NOT NULL    ← ref → Keycloak userId
    UNIQUE(courseId, instructorId)
```

### Entity (thuộc Course): `CourseRequirement`

> Điều kiện tham gia khóa học — quan hệ 1-1 với Course.

```
course_requirements
├── id             UUID PK
├── courseId       UUID NOT NULL UNIQUE FK → courses.id (onDelete: Cascade)
├── minAge         INT NULLABLE
├── prerequisites  TEXT NULLABLE
├── attendanceRate INT DEFAULT 80
├── minPassScore   INT DEFAULT 80
└── requiredExams  INT DEFAULT 0
```

### Entity (thuộc Course): `CourseMaterial`

> Tài liệu đính kèm khóa học (PDF, video, link...).

```
course_materials
├── id          UUID PK
├── courseId    UUID NOT NULL FK → courses.id (onDelete: Cascade)
├── title       TEXT NOT NULL
├── fileUrl     TEXT NULLABLE    ← URL trực tiếp (nếu không dùng media-service)
├── mediaFileId UUID NULLABLE    ← ref → media-service FileObject (UUID only, không có FK)
├── type        TEXT NULLABLE    ← e.g. "PDF", "VIDEO", "LINK"
└── createdAt   TIMESTAMPTZ
```

### Aggregate Root: `CourseEnrollment`

> Quản lý tiến trình học của 1 student trong 1 khóa học.

```
course_enrollments
├── id          UUID PK
├── courseId    UUID NOT NULL FK → courses.id (onDelete: Cascade)
├── studentId   UUID NOT NULL  ← ref → Keycloak userId
├── status      ENUM(ACTIVE, COMPLETED, DROPPED) DEFAULT ACTIVE
├── progress    INT DEFAULT 0  ← 0-100%, tự tính khi completeLesson
├── enrolledAt  TIMESTAMPTZ
└── completedAt TIMESTAMPTZ NULLABLE
    UNIQUE(courseId, studentId)
```

> **Không có `lesson_progress` table.** Mỗi lần `completeLesson` gọi, progress tăng `100/totalLessons`. Không track per-lesson trạng thái đã hoàn thành.

### Domain Events phát ra

| Event                         | Trigger                  | Payload                           |
| ----------------------------- | ------------------------ | --------------------------------- |
| `course.enrollment.created`   | Student đăng ký khóa học | enrollmentId, studentId, courseId |
| `course.enrollment.completed` | Hoàn thành khóa học      | enrollmentId, studentId, courseId |
| `course.lesson.completed`     | Hoàn thành 1 bài học     | lessonId, studentId, courseId     |

---

## Service 6: simulation-service → `simulation_db` ✅ (MVP implemented)

**Bounded Context:** Driving Scenario Simulation (Sa hình)

> Sa hình: student xem video/ảnh tình huống thực tế và chọn hành động đúng. Có 120 tình huống theo quy định.

### Aggregate Root: `Maneuver`

> Content tĩnh, do ADMIN/INSTRUCTOR tạo.

```
maneuvers
├── id               UUID PK
├── title            TEXT NOT NULL
├── description      TEXT NOT NULL
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── displayOrder     INT NOT NULL
├── isActive         BOOLEAN DEFAULT true
├── createdAt        TIMESTAMPTZ
└── updatedAt        TIMESTAMPTZ
```

### Entity (thuộc Maneuver): `ManeuverCheckpoint`

```
maneuver_checkpoints
├── id            UUID PK
├── maneuverId    UUID NOT NULL FK → maneuvers.id
├── title         TEXT NOT NULL
├── instruction   TEXT NOT NULL
├── penalty       TEXT NULLABLE
└── displayOrder  INT NOT NULL
```

### Entity: `ManeuverError`

```
maneuver_errors
├── id               UUID PK
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── code             TEXT NOT NULL
├── description      TEXT NOT NULL
├── severity         TEXT NOT NULL
└── createdAt        TIMESTAMPTZ
```

### Aggregate Root: `SimulationSession`

> Một lần luyện tập sa hình của student.

```
simulation_sessions
├── id               UUID PK
├── studentId        UUID NOT NULL  ← ref → identity_users.id
├── licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
├── status           ENUM(IN_PROGRESS, COMPLETED, ABANDONED)
├── totalScenarios   INT NOT NULL
├── correctCount     INT DEFAULT 0
├── score            INT NULLABLE   ← 0-100
├── isPassed         BOOLEAN NULLABLE
├── startedAt        TIMESTAMPTZ NOT NULL
└── completedAt      TIMESTAMPTZ NULLABLE
```

### Entity (thuộc SimulationSession): `SimulationAnswer`

```
simulation_answers
├── id                UUID PK
├── sessionId         UUID NOT NULL FK → simulation_sessions.id
├── scenarioId        UUID NOT NULL FK → scenarios.id
├── selectedOptionId  UUID NULLABLE   ← null = bỏ qua
├── isCorrect         BOOLEAN NULLABLE
└── answeredAt        TIMESTAMPTZ
```

### Domain Events phát ra

| Event                          | Trigger            | Payload                                                |
| ------------------------------ | ------------------ | ------------------------------------------------------ |
| `simulation.session.completed` | Hoàn thành sa hình | sessionId, studentId, score, isPassed, licenseCategory |

---

## Service 7: notification-service → `notification_db` ✅ (MVP implemented)

**Bounded Context:** Notification Delivery

### Current MVP scope

Notification-service persists in-app notifications and academic warning audit records. Template/preference/channel delivery tables are extension points, not part of the current schema.

### Aggregate Root: `AcademicWarning`

```
academic_warnings
├── id          UUID PK
├── studentId   UUID NOT NULL
├── reason      TEXT NOT NULL
├── severity    TEXT NOT NULL
├── message     TEXT NOT NULL
├── createdById UUID NOT NULL
└── createdAt   TIMESTAMPTZ
```

### Aggregate Root: `Notification`

```
notifications
├── id        UUID PK
├── userId    UUID NOT NULL  ← ref → identity_users.id
├── type      ENUM(IN_APP, EMAIL, PUSH, SMS)
├── title     TEXT NOT NULL
├── body      TEXT NOT NULL
├── data      JSONB DEFAULT '{}'  ← metadata tùy loại thông báo
├── isRead    BOOLEAN DEFAULT false
├── readAt    TIMESTAMPTZ NULLABLE
├── sentAt    TIMESTAMPTZ NULLABLE
└── createdAt TIMESTAMPTZ
```

### Future extension: `NotificationPreference`

```
notification_preferences
├── id           UUID PK
├── userId       UUID NOT NULL UNIQUE  ← ref → identity_users.id
├── emailEnabled BOOLEAN DEFAULT true
├── pushEnabled  BOOLEAN DEFAULT true
├── smsEnabled   BOOLEAN DEFAULT false
├── inAppEnabled BOOLEAN DEFAULT true
└── updatedAt    TIMESTAMPTZ
```

### Domain Events subscribe

| Event                          | Hành động                                             |
| ------------------------------ | ----------------------------------------------------- |
| `identity.user.created`        | Gửi welcome notification + tạo NotificationPreference |
| `identity.user.locked`         | Cảnh báo tài khoản bị khóa                            |
| `exam.session.passed`          | Thông báo đậu thi                                     |
| `exam.session.failed`          | Thông báo rớt thi, gợi ý ôn thêm                      |
| `course.enrollment.completed`  | Chúc mừng hoàn thành khóa học                         |
| `simulation.session.completed` | Thông báo kết quả sa hình                             |

---

## Service 8: analytics-service → `analytics_db` ✅ (MVP implemented)

**Bounded Context:** Learning Analytics & Progress Tracking

> Analytics service là **CQRS read model** — nghe events từ các service khác, tổng hợp view để query nhanh.

### Aggregate Root: `StudentLearningProfile`

> Thống kê tổng hợp học tập của student — cập nhật dần theo events.

```
student_learning_profiles
├── id                UUID PK  ← bằng studentId
├── studentId         UUID NOT NULL UNIQUE
├── totalStudyMinutes INT DEFAULT 0
├── totalExamAttempts INT DEFAULT 0
├── passedExams       INT DEFAULT 0
├── avgExamScore      FLOAT DEFAULT 0
├── coursesEnrolled   INT DEFAULT 0
├── coursesCompleted  INT DEFAULT 0
├── lastActivityAt    TIMESTAMPTZ
├── resetAt           TIMESTAMPTZ NULLABLE
├── createdAt         TIMESTAMPTZ
└── updatedAt         TIMESTAMPTZ
```

### Entity (thuộc StudentLearningProfile): `DailyActivity`

```
daily_activities
├── id                UUID PK
├── studentId         UUID NOT NULL
├── date              DATE NOT NULL
├── studyMinutes      INT DEFAULT 0
├── questionsAnswered INT DEFAULT 0
├── correctAnswers    INT DEFAULT 0
├── examsAttempted    INT DEFAULT 0
├── simSessions       INT DEFAULT 0
└── UNIQUE(studentId, date)
```

### Aggregate Root: `QuestionAccuracyTracker`

> Track tỷ lệ đúng/sai theo từng câu hỏi — dùng để gợi ý ôn câu yếu.

```
question_accuracy_trackers
├── id              UUID PK
├── studentId       UUID NOT NULL
├── questionId      UUID NOT NULL  ← ref → question_db (UUID only)
├── totalAttempts   INT DEFAULT 0
├── correctAttempts INT DEFAULT 0
├── lastAttemptAt   TIMESTAMPTZ
└── UNIQUE(studentId, questionId)
```

### Aggregate Root: `WeakAreaReport`

> Chủ đề yếu của student — computed từ QuestionAccuracy, grouped by topic.

```
weak_area_reports
├── id            UUID PK
├── studentId     UUID NOT NULL
├── topicId       UUID NOT NULL  ← ref → question_db.question_topics (UUID only)
├── topicName     TEXT NOT NULL  ← denormalized để tránh cross-service call
├── accuracyRate  FLOAT NOT NULL ← 0.0 - 1.0
├── questionCount INT NOT NULL
├── needsReview   BOOLEAN DEFAULT false
├── updatedAt     TIMESTAMPTZ
└── UNIQUE(studentId, topicId)
```

### Domain Events subscribe

| Event                          | Hành động                                                 |
| ------------------------------ | --------------------------------------------------------- |
| `identity.user.created`        | Tạo StudentLearningProfile                                |
| `exam.session.completed`       | Update LearningProfile + DailyActivity + QuestionAccuracy |
| `simulation.session.completed` | Update LearningProfile + DailyActivity                    |
| `course.lesson.completed`      | Update studyMinutes trong DailyActivity                   |
| `course.enrollment.completed`  | Increment coursesCompleted                                |

---

## Cross-Service Event Flow

```
[Keycloak → RabbitMQ via Event Listener]
    ├── identity.user.created ──► user-service        (tạo UserProfile + StudentDetail)
    │                         ──► analytics-service   (tạo StudentLearningProfile)
    │                         ──► notification-service (gửi welcome notification)
    └── identity.user.locked  ──► notification-service (cảnh báo tài khoản bị khóa)

[user-service]
    └── user.student.license-assigned ──► analytics-service   (reset scope theo hạng bằng mới)
                                      ──► notification-service (thông báo đổi hạng bằng)

[exam-service]
    ├── exam.session.completed ──► analytics-service   (cập nhật stats + question accuracy)
    ├── exam.session.passed    ──► notification-service (thông báo đậu)
    └── exam.session.failed    ──► notification-service (thông báo rớt)

[simulation-service]
    └── simulation.session.completed ──► analytics-service   (cập nhật sim stats)
                                     ──► notification-service (thông báo kết quả)

[course-service]
    ├── course.lesson.completed     ──► analytics-service   (cập nhật study time)
    └── course.enrollment.completed ──► notification-service (chúc mừng hoàn thành)
                                    ──► analytics-service   (increment coursesCompleted)
```

---

## Tóm tắt

| Service | Database | Aggregate Roots | Ghi chú |
| --- | --- | --- | --- |
| identity-service | identity_db + **Keycloak** | IdentityUser | Keycloak là source of truth auth; identity_db giữ audit/read model demo |
| user-service | user_db | UserProfile | ✅ Có StudentDetail + LicenseAssignmentAudit |
| media-service | media_db | FileObject | ✅ Azure Blob metadata, UNLINKED/LINKED status |
| question-service | question_db | Question, QuestionTopic, QuestionVersion | ✅ Có soft delete/versioning |
| exam-service | exam_db | ExamTemplate, ExamSession, ExamSchedule | ✅ Có immutable snapshot câu hỏi/template |
| course-service | course_db | Course, CourseEnrollment | ✅ Có CourseInstructor, CourseRequirement, CourseMaterial |
| simulation-service | simulation_db | Maneuver, SimulationSession | ✅ Maneuver/checkpoint/error + state machine MVP |
| notification-service | notification_db | Notification, AcademicWarning | ✅ In-app notification + academic warning |
| analytics-service | analytics_db | StudentLearningProfile, DailyActivity, QuestionAccuracyTracker | ✅ CQRS read model + Redis cache |

---

## Event Contracts (packages/common)

Nên tạo shared event types để tất cả services dùng chung, tránh drift:

```
packages/common/src/events/
├── identity/
│   ├── user-created.event.ts
│   └── user-locked.event.ts
├── exam/
│   ├── session-completed.event.ts
│   └── session-passed.event.ts
├── course/
│   ├── enrollment-completed.event.ts
│   └── lesson-completed.event.ts
└── simulation/
    └── session-completed.event.ts
```

---

## Thứ tự implement đề xuất

1. **question-service** — foundation, các service khác tham chiếu questionId
2. **exam-service** — call question-service (sync HTTP) để lấy câu hỏi khi tạo session
3. **course-service** — độc lập, có thể implement song song với exam
4. **simulation-service** — độc lập
5. **user-service** — subscribe `identity.user.created`
6. **analytics-service** — subscribe nhiều events nhất, nên implement sau
7. **notification-service** — implement sau khi có đủ events để test



<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# Clean Architecture

![image.png](image.png)

![image.png](image%201.png)

## 1. Entities

- Có thể gọi là **domain layer**, thuộc về **core business logic**
- Là các object (model) chứa các business logic
- Trong Clean Architecture, 1 entity có thể là 1 object hoặc 1 cụm object.
- Mapping qua DDD, entities có thể bao gồm aggregate, entity, value object

## 2. Use case

- Có thể gọi là **application layer**, chứa application business logic, thuộc về core business logic
- Logic bao gồm: flow chương trình, tương tác với entities (layer trong) như load entities, save entities, … ⇒ như 1 `orchestrator` điều phối request
- Entities (domain layer) và use case (application layer) là 2 thành phần quan trọng và được cô lập ở **core business logic ⇒** không phụ thuộc các thành phần ngoài: framework, UI, database, …

## 3. Interface Adapters

- Có thể gọi là Presentation
- Chứa các adapter để convert data từ bên ngoài (web, database) vào bên trong (application, domain) và ngược lại.

## 4. Frameworks and Drivers

- Có thể gọi là **infrastructure layer**
- Chứa các detail implement của database, external service hay các driver, framework

Ví dụ: Ở use case chỉ thao tác với các interface của database thông qua repository pattern thôi, hoặc muốn giao tiếp với external service cũng phải thông qua interface. Ở layer đó hoàn toàn không thấy được implement chi tiết của chúng. Và những implement chi tiết đó sẽ nằm ở infrastructure layer này.

## 5. Dependency rule

- Chiều của dependency từ ngoài vào trong, hướng dẫn các thành phần tương tác, phụ thuộc lẫn nhau.
- Các thành phần bên trong không được phép **phụ thuộc trực tiếp** vào các thành phần ở lớp bên ngoài.
- Sự tương tác diễn ra thông qua các abstraction và dependency inversion

Ví dụ: Trong các use case, không được import các dependency ở ngoài như database (thuộc layer ngoài cùng).

```java

// Ví dụ ở đây là một file Use case.
// Các implementation của các repositories trong này thuộc về infra layer.
// Nhưng ở đây nếu import trực tiếp implementation chi tiết của các repo
// thì sẽ vi phạm dependency rule.
// Cho nên ở đây UserRepository phải là một interface
// (abstraction với layer bên ngoài) mới thỏa mãn dependency rule
public class CreateUserUseCaseImpl implements CreateUserUseCase {
    private UserRepository userRepository;
    private RoleRepository roleRepository;
    private UserDomainService userDomainService;
    private UserEventPublisher publisher;
  // ...

```

Lưu ý:

- Dependency rule không cấm hoàn toàn sự phụ thuộc giữa các thành phần.
- Mục tiêu là giảm thiểu phụ thuộc trực tiếp và khuyến khích sử dụng abstraction.

## 6. Usecase thực tế

- **Use case**: use case sẽ là tạo một author user. author user chính là người có thể tạo và quản lý bài post của họ. Sau khi tạo user xong, sẽ có một event UserCreatedEvent bắn và sync user qua một Redis server khác. Event này sẽ được bắn lên Kafka cluster
- Folder structure
  - `domain folder`: là domain layer, application chính là application layer. Hai ông này chính là core của software
  - `controller folder`: thuộc về presentation layer
  - `infra layer`: thuộc về infrastructure layer
  - `dto folder` ⇒ có 2 cách đặt
    - gom hết vào folder dto
    - `dto` phục vụ cho layer nào thì đặt tại layer đó.

```
application/
├── eventpublisher/
├── exception/
├── service/
├── repository/
│   ├── UserRepository.java
│   └── ...
└── usecase/
domain/
├── exception/
│   ├── UserNotFoundExeption.java
│   └── ...
├── valueobject/
│   ├── UserName.java
│   └── ...
├── entity/
│   ├── User.java
│   └── ...
└── service/
dto/
infra/
├── persistence/
│   ├── UserRepositoryImpl.java
│   └── ...
└── messaging/
controller/
├── UserController.java
└── ...
```

Flow của request

- Request đi tới controller `UserController` - interface adapters layer hay presentation layer ⇒ data sẽ được transform sang dạng thích hợp nhất với các layer ở trong - domain layer và application layer ⇒ dùng `UserDto` để chứa dữ liệu từ request nha.
- Request đi tiếp vào application layer thông qua use case `CreateUserUseCase` interface, chịu trách nhiệm
  - Điều phối flow của chương trình - business flow như thao tác với `UserRepository` để kiểm tra xem email có tồn tại chưa. Thao tác với `RoleRepository` để kiểm tra role có tồn tại hay không.
  - Sau đó sẽ tương tác với domain layer để tạo `User` entity (hay `User` aggregate).
  - Sau đó sẽ dùng Repository để save `User` xuống database và bắn event lên Kafka.
- Khi use case thao tác với domain layer thì các business logics của use case này sẽ được đảm bảo trong domain layer (trong các model và service).
- Và khi thao tác với các thành phần như repository, event publisher (những thành phần bên ngoài) thì use case chỉ thao tác với interface (không bao giờ use case nhìn thấy được implement chi tiết của infra).
- Và cuối cùng các implement chi tiết của database hay event publisher sẽ nằm ở infrastructure layer.

### 6.1. Layer Domain

```java

// User.java
@Getter
@Builder
public class User extends AggregateRoot<Id> {
    private UserName name;
    private Email email;
    private MobilePhone mobilePhone;
    private String password;
    UserActivated isActive;
    UserDeleted isDeleted;

    // Relationship with Role aggregate via id
    private List<Id> roleIds;

    public void updateName(UserName name) {
        this.name = name;
    }

    public void updateEmail(Email email) {
        this.email = email;
    }

    public void updateMobilePhone(MobilePhone mobilePhone) {
        this.mobilePhone = mobilePhone;
    }

    public void addRole(Id roleId) {
        if (roleIds.contains(roleId)) {
            return;
        }

        roleIds.add(roleId);
    }

    public void removeRole(Id roleId) {
        roleIds.remove(roleId);
    }

    public void activate() {
        if (isActive == UserActivated.TRUE) {
            throw new UserAlreadyActivatedException();
        }

        isActive = UserActivated.TRUE;
    }

    public void deactivate() {
        if (isActive == UserActivated.FALSE) {
            throw new UserAlreadyDeactivatedException();
        }

        isActive = UserActivated.FALSE;
    }

    public void markAsDeleted() {
        if (isDeleted == UserDeleted.TRUE) {
            throw new UserAlreadyDeletedException();
        }

        isDeleted = UserDeleted.TRUE;
    }
}
```

`User` entity ⇒ entity chính, trong DDD được xem là `aggregate root` của `User aggregate`

```java

// User.java
@Getter
@Builder
public class User extends AggregateRoot<Id> {
    private UserName name;
    private Email email;
    private MobilePhone mobilePhone;
    private String password;
    UserActivated isActive;
    UserDeleted isDeleted;

    // Relationship with Role aggregate via id
    private List<Id> roleIds;

    public void updateName(UserName name) {
        this.name = name;
    }

    public void updateEmail(Email email) {
        this.email = email;
    }

    public void updateMobilePhone(MobilePhone mobilePhone) {
        this.mobilePhone = mobilePhone;
    }

    public void addRole(Id roleId) {
        if (roleIds.contains(roleId)) {
            return;
        }

        roleIds.add(roleId);
    }

    public void removeRole(Id roleId) {
        roleIds.remove(roleId);
    }

    public void activate() {
        if (isActive == UserActivated.TRUE) {
            throw new UserAlreadyActivatedException();
        }

        isActive = UserActivated.TRUE;
    }

    public void deactivate() {
        if (isActive == UserActivated.FALSE) {
            throw new UserAlreadyDeactivatedException();
        }

        isActive = UserActivated.FALSE;
    }

    public void markAsDeleted() {
        if (isDeleted == UserDeleted.TRUE) {
            throw new UserAlreadyDeletedException();
        }

        isDeleted = UserDeleted.TRUE;
    }
}

```

- `User` entity chứa các public method để thao tác + các business logic
- Các business logic có thể kể đến:
  - Xóa user (markAsDeleted)
  - Active hay deactive user
  - Grant một role nào đó vào user
  - …

`UserName` là value object

```java

// UserName.java
@Getter
public class UserName {
    private static final int MIN_LENGTH = 3;
    private static final int MAX_LENGTH = 50;

    private String value;

    public UserName(String value) {
        setValue(value);
    }

    private void setValue(String value) {
        if (value.length() < MIN_LENGTH || value.length() > MAX_LENGTH) {
            throw new InvalidUserNameException();
        }

        this.value = value;
    }
}

```

Để đăng ký UserCreatedEvent trong domain layer ⇒ tạo một domain service để tạo User entity, handle business logic và register domain event

```java

// UserDomainServiceImpl.java implements UserDomainService.java
@Service
public class UserDomainServiceImpl implements UserDomainService {
    @Override
    public User createNewUser(UserDto userDto) {
        User user = User.builder()
                .name(new UserName(userDto.getName()))
                .email(new Email(userDto.getEmail()))
                .mobilePhone(new MobilePhone(userDto.getMobilePhone()))
                .password(userDto.getPassword())
                .isActive(UserActivated.TRUE)
                .isDeleted(UserDeleted.FALSE)
                .roleIds(userDto.getRoleIds().stream().map(Id::new).toList())
                .build();
        user.setId(new Id(UniqueIdGenerator.create()));
        user.setAggregateVersion(CONCURRENCY_CHECKING_INITIAL_VERSION);

        user.registerEvent(new UserCreatedEvent(user));
        return user;
    }
}
```

Ngoài ra, có thể dùng factory method bên trong domain object

```java

// User.java
@Getter
@Builder
public class User extends AggregateRoot<Id> {
    // ...

    // Có thể dùng Factory method ở đây để tạo User instance
    public static User createUser() {
         User user = User.builder()
                .name(new UserName(userDto.getName()))
                // ...

         user.registerEvent(new UserCreatedEvent(user));
         return user;
    }
}
```

**Lưu ý:**

- Đảm bảo business logics: nghiệp vụ cần design cẩn thận, tập trung tại layer domain (và layer application)
- Nghiệp vụ liên quan đến model nào thì nên nằm trên model ấy. Nghiệp vụ kết hợp nhiều model (entity) thì nên tạo domain service, không thì chuyển về các service ở layer application

### 6.2. Application

Usecase `CreateUserUseCase`

```java

// CreateUserUseCaseImpl.java
@Service
@AllArgsConstructor
public class CreateUserUseCaseImpl implements CreateUserUseCase {
    private UserRepository userRepository;
    private RoleRepository roleRepository;
    private UserDomainService userDomainService;
    private PasswordEncoder passwordEncoder;
    private UserEventPublisher publisher;

    // Đây là flow chính của request.
    public void execute(UserDto userDto) {
        rolesExistOrError(userDto.getRoleIds());
        userDoesNotExistOrError(userDto);
        userDto.setPassword(passwordEncoder.encode(userDto.getPassword()));
        User user = userDomainService.createNewUser(userDto);
        userRepository.save(user);
        publishDomainEvents(user);
    }

    private void userDoesNotExistOrError(UserDto userDto) {
        Optional<User> user
          = userRepository.findByEmail(userDto.getEmail());
        if (user.isPresent()) {
            throw new UserAlreadyExistsException();
        }
    }

    private void rolesExistOrError(List<String> roleIds) {
        List<Role> roles = roleRepository.findByIds(roleIds);
        if (roles.size() != roleIds.size()) {
            throw new RoleNotFoundException();
        }
    }

    private void publishDomainEvents(User user) {
        user.getDomainEvents().forEach(event -> publisher.publish(event));
    }
}
```

- Use case điều khiển flow của chương trình
- Use case dùng các libs bên ngoài để tương tác domain objects như: database, 3rd services, message brokers, … ⇒ tuân thủ dependency rule
- Để thao tác database, nếu gọi thẳng MySqlUserRepository ⇒ vi phạm

⇒ Sử dụng **Dependency inversion principle,** thay vì layer application phụ thuộc layer ngoài thì các layer ngoài phải **phụ thuộc qui định** ở layer application

```java

// Tầng application sẽ quy định những interface trong UserRepositry
// Những layer ở ngoài phải implement interface này
public interface UserRepository {
    void save(User user);
    Optional<User> findById(String id);
    Optional<User> findByEmail(String email);
    void delete(User user);
}

```

### 6.3. Controller

```java

// UserController.java
@AllArgsConstructor
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private CreateUserUseCase createUserUseCase;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public void createUser(@RequestBody UserDto user) {
        createUserUseCase.execute(user);
    }
}
```

### 6.4. Infrastructure

Tầng này chính là tầng bên ngoài, sẽ là các implement chi tiết mà các tầng bên trong quy định bằng interface.

```java
@Component
@AllArgsConstructor
public class UserRepositoryImpl implements UserRepository {
    private UserJpaRepository userJpaRepository;

    @Override
    public void save(User user) {
        UserEntity userEntity = UserEntity.fromDomainModel(user);
        userJpaRepository.save(userEntity);
    }

    @Override
    public Optional<User> findById(String id) {
        Optional<UserEntity> userEntity = userJpaRepository.findById(id);

        return userEntity.map(UserEntity::toDomainModel);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        Optional<UserEntity> userEntity
          = userJpaRepository.findByEmail(email);

        return userEntity.map(UserEntity::toDomainModel);
    }

    @Override
    public void delete(User user) {
        userJpaRepository.deleteById(user.getId().toString());
    }
}

```

```java

@Repository
public interface UserJpaRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByEmail(String email);
}
```



<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# Domain Driven Design

## 1. Khái niệm

**- Domain-Driven Design (DDD)** là phương pháp thiết kế phần mềm tập trung vào:

> Hiểu nghiệp vụ thật sâu → rồi mới thiết kế code theo nghiệp vụ đó.

- DDD giúp tránh tình trạng: Code **chạy được** nhưng không phản ánh **nghiệp vụ**
- DDD hướng tới: **Code** == **nghiệp vụ**

- DDD có 2 thành phần chính:

- **Strategic Design**
  - Tìm hiểu, phân tích, design `high level - view` của domain doanh nghiệp
  - Không có dòng code nào
  - Dựa trên các công cụ, thuật ngữ: `subdomain`, `bounded context`, `event storming`, `context map`
- **Tactical Design**
  - Dựa trên kết quả của Strategic Design ⇒ design các thứ `low-level`
  - Design ra các `business logics`, `building blocks` như: `Value object`, `Entity`, `Aggregate`, `Service`, …

## 2. Domain

- Domain = lĩnh vực nghiệp vụ hệ thống giải quyết

| System          | Domain             |
| --------------- | ------------------ |
| Shopee          | thương mại điện tử |
| Galaxy Cinema   | đặt vé             |
| Restaurant app  | đặt món            |
| Hospital system | y tế               |

- Một domain lớn ⇒ có thể thành các subdomain
- Subdomain có thể chia làm 3 loại:
  - Core subdomains
  - Generic subdomains
  - Supporting subdomains

## 3. Business logic

Ví dụ!

Team bạn nhận một dự án từ khách hàng (một công ty truyền thông ở Đông Lào).

Và yêu cầu của họ là tạo `một trang báo điện tử` (giống 24h hay vnexpress ấy các bạn). Và khi khách hàng truyền tải `requirement` về cho các bạn. Họ sẽ có một số lời nói khá quen thuộc như sau (mình nói về context User):

- Mỗi user chỉ có 1 email duy nhất và không trùng với user khác
- Khi tạo user thì mặc định sẽ có role là Subscriber.
- Có 3 system roles: Admin, Author, Subscriber.
- User admin có thể tạo được Role.
- User admin có quyền tạo thêm roles.
- Role thì không được trùng tên (unique) với nhau.
- Không được chỉnh sửa system role.
- Role name chỉ được chứa ký tự a-z, A-Z, 0-9 và \_.
- Role name chỉ có độ dài tối thiểu là 3 ký tự, tối đa 100 ký tự.
- …

Hoặc trong một ứng dụng `Food Ordering`:

- Khi mới tạo một đơn hàng (order) thì trạng thái (status) của nó sẽ là `pending`.
- Total price của một đơn hàng không được nhỏ hơn 0.
- Khi payment (thanh toán) thất bại, trạng thái cuối cùng của đơn hàng sẽ là `canceled`.
- Khi payment thành công và hàng trong kho còn đủ số lượng cho đơn hàng thì trạng thái đơn hàng sẽ là `approved`.

Đấy, tất cả các gạch đầu dòng trên, là `business logics`! Dễ hiểu phải không các bạn.

Và có một điều các bạn phải lưu ý:

- Business logics là cái thử rất `dễ thay đổi và mở rộng`. Vì sản phẩm của các bạn phải đáp ứng được nhu cầu của khách hàng (khách hàng là thượng đế lại còn khó tính). Càng phát triển thì nhu cầu của khách hàng càng thay đổi và mở rộng nhiều hơn.

⇒ **Trong DDD, các business logic sẽ được đặt trong `core domain layer`. Cụ thể là trong các value object, entity, aggregate, domain service**.

- Tất cả business logic đều tập trung vào core domain của nó. Hiểu đơn giản là có một layer là domain, tất cả logic nghiệp vụ sẽ được viết trong layer này. Khi kết hợp với hexagonal, onion hay clean architecture, nó thường nằm ở layer `domain`. Tách biệt hoàn toàn so với các layer khác và không phụ thuộc vào bất cứ layer hay công nghệ nào ví dụ database, message queue, UI, API, ... Mà các layer khác phải `implement` layer `domain` này. Đây là đảo ngược sự phụ thuộc.

## 4. Ubiquitous Language

- Ngôn ngữ chung giữa **domain expert team**, **devs team** và các team liên quan

Ví dụ:

Không dùng:

`createOrder()`

Dùng:

`placeOrder()`

## 5. Bounded Context

Phân chia các domain logics, ubiquitous language thành các `context` nhỏ hơn

Ví dụ: Trang báo điện tử

- `User bounded context`: Nơi chứa logic nghiệp vụ liên quan tới users, các từ ngữ liên quan tới users, roles.
- `Post bounded context`: Chứa logic nghiệp vụ liên quan tới các bài post, …
- Số lượng `user` xem bài post abc này trong một tháng 100 users. Thì ý nghĩa của `user trong post context` sẽ khác với `user trong user context`. Rõ ràng user trong user context thì nó đang đề cập tới, user admin, author, subscriber, hay có role là gì, ... Còn user trong post context đơn giản là user đã xem bài post ở ngoài thôi.

⇒ Đó chính là **`bounded context`**

![image.png](image.png)

## 6. Layer architecture

- Sơ khai: 1 đống code vào 1 hoặc 1 vài file (1 file làm tất cả từ controller, business logic, persist data, view, …) ⇒ Ông cha phát minh ra layer architecture bằng cách chia nhỏ nhiều layer nhỏ hơn. Mỗi layer làm một việc duy nhất như: UI layer, application layer, domain layer, infrastructure layer, …

⇒ Sự ra đời của các architecture: hexagonal, onion hay clean architecture

- DDD tập trung hết core business logic vào 1 “nơi” duy nhất ⇒ DDD sẽ kết hợp với các layer architecture để triển khai

## 7. Event sourcing

## 8. Modeling skill

**Modeling skill = khả năng biến nghiệp vụ ngoài đời thành object trong code đúng cách.**

Ví dụ:

❌ Primitive style

```
String email
String phone
int money
```

✅ DDD style

```
Email
PhoneNumber
Money
```

Model đúng giúp:

- code dễ đọc
- logic rõ ràng
- validation nằm đúng chỗ
- domain express rõ business meaning

## 9. Data transfer object (DTO)

- Object dùng để chuyển data đi qua các layer trong vòng đời của 1 business flow

```java

// UserDto.java
// Object đơn giản thôi chứ thực tế nhiều fields hơn nha.
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserDto {
    private String name;
    private String email;
    private String password;
}
```

## 10. Value Object

- **`Value object`** là 1 object, dùng để chứa dữ liệu
- **`Immutable` -** bất biến ⇒ khởi tạo value obj thì không thể thay đổi data bên trong ⇒ dữ liệu toàn vẹn - không thay đổi trong vòng đời 1 business flow
- Không có các public **setter**, các **properties** là read-only
- 2 value obj có dữ liệu giống nhau ⇒ bằng nhau
- Các business logic liên quan ⇒ đặt bên trong các value obj

```java

// UserName.java
@Getter
public class UserName {
    private static final int MIN_LENGTH = 3;
    private static final int MAX_LENGTH = 50;

    private String value;

    public UserName(String value) {
        setValue(value);
    }

    private void setValue(String value) {
        if (value.length() < MIN_LENGTH || value.length() > MAX_LENGTH) {
            throw new InvalidUserNameException();
        }

        // Ngoài ra còn các business logic khác như:
        // username không được chứa các ký tự đặc biệt
        // ...

        this.value = value;
    }
}
```

Khi muốn dùng value obj UserName

```java

// Khởi tạo một value object
UserName userName = new UserName("lenhatthanh20");

// Bạn không thể thay đổi data bên trong nó nữa
userName.setValue("admin"); // Điều này không cho phép
```

⇒ Khi 1 value obj được tạo thành công ⇒ tất cả business logic liên quan tới obj đó đã được thỏa mãn ⇒ dữ liệu trong value obj không được thay đổi được nữa ⇒ **`data consistency`**

## 11. Entity

- Cũng là object y như value object
- Có **định danh** (ID)
- Có setter
- Thường dùng để chứa dữ liệu và lưu xuống DB
- Business logic liên quan ⇒ đặt bên trong entity

```java

// Mình có một file Entity.java để dùng chung cho tất cả các entity
// Base class Entity.java
@Getter
@AllArgsConstructor
public class Entity<Type> {
    private Type id;
}

// Và đây là một entity trong DDD
// Role.java
@Getter
public class Role extends Entity<Id> {
    private RoleName name;
    private RoleDescription description;

    public Role(
            Id id,
            RoleName name,
            RoleDescription description
    ) {
        super(id);
        this.name = name;
        this.description = description;
    }

    public void updateRoleName(RoleName name) {
        // Một số business logic có thể nằm ở đây
        this.name = name;
    }

    public void updateRoleDescription(RoleDescription name) {
        // Một số business logic có thể nằm ở đây
        this.description = description;
    }

    public static Role create(
            Id id,
            RoleName name,
            RoleDescription description
    ) {
        // Một số business logic có thể nằm ở đây
        Role role = new Role(id, name, description);

        return role;
    }
}
```

- Khi tạo thành công 1 entity ⇒ tất cả **business logic** liên quan được thỏa mạn ⇒ **`data consistency`**

## 12. Domain service

- Các business logic tập trung vào `domain layer` , cụ thể: `value object`, `entity`, `aggregate`, `domain service`
- Trong layer architecture, mỗi layer sẽ có các service của layer đó ⇒ `domain service` chứa các logic phục vụ `layer domain` ⇒ **Logic ở đây là business logic**
- Khi các business logic không biết đặt ở đâu (value object, entity, aggregate) ⇒ đặt ở domain service

Ví dụ: Use case tạo một role có 1 business logic sau: Khi tạo mới một role, tên của role mới này bắt buộc không được trùng tên với bất kì role nào trong hệ thống.

```java

// CreateRoleService.java
@Service
@AllArgsConstructor
public class CreateRoleService implements CreateRoleServiceInterface{
    RoleRepositoryInterface roleRepository;

    public void create(RoleDto roleDto) {
        this.roleNameDoesNotExistOrError(roleDto.getName());

        Role role = Role.create(
                new Id(UniqueIdGenerator.create()),
                new RoleName(roleDto.getName()),
                new RoleDescription(roleDto.getDescription())
        );

        roleRepository.save(role);
    }

    // Đây là business logic mình vừa đề cập
    // Và mình đặt logic này trong domain service.
    private void roleNameDoesNotExistOrError(String name) {
        Optional<Role> role = roleRepository.findByName(name);
        if (role.isPresent()) {
            throw new RoleAlreadyExistException();
        }
    }
}
```

## 13. Aggregate

Xét usecase: **Tạo comment của 1 bài báo (post)**

Một số business logic:

- Khi tạo comment, nếu user không tồn tại thì sẽ báo lỗi cho người dùng.
- Khi xóa bài báo thì tất cả comment sẽ bị xóa theo.
- Tổng số lượng comment trong 1 bài báo là 100 (lưu ý đây chỉ là logic ví dụ - không phải logic trong production application). Nếu quá 100 thì sẽ báo lỗi cho người dùng

```java

// CHƯA ÁP DỤNG DDD
// Ở TRONG MỘT FILE SERVICE NÀO ĐÓ CỦA BẠN
// commentDto: userId, postId, content

// Dưới đây sẽ là các step các bạn hay làm:

// STEP 1. Kiểm tra xem user có tại hay không.
this.checkingUserExistOrError(userId);

// Còn nhiều business logic khác ở đây: quyền, ...

// STEP 2. Kiểm tra POST có tồn tại hay không.
Post post = getPostOrError(postId);

// STEP 3. Kiểm tra số lượng comments của POST
// Hoặc ở đây bạn hay đếm số lượng comments từ database
if (post.getComments().size() >= 100) {
    throw new PostCommentLimitException();
}
// Check một số business logic khác nữa.

// STEP 4. Save comment xuống:
Comment comment = new CommentEntity(...);
commentRepository.save(comment); // Lưu xuống DB
```

Khi có 1 usecase khác `add comment` khác usecase ở trên ⇒ dev thao tác với `Post model` và quên logic ở step 3 (làm sai), `add comment` trực tiếp, lưu lại ở step 5 ⇒ vi phạm business logic 101 comment ⇒ **`data inconsistency`**

- Aggregate giúp cho data nhất quán. Khi 1 aggregate tạo thành công ⇒ thỏa mãn tất cả business logic liên quan tới nó ⇒ consistency
- Aggregate ra đời ⇒ handle inconsistency data trong business flow của app

```java
// Post.java
// `Post` chính là aggregate root.
// Để thao tác với các thành phần bên trong như entity `Comment`
// thì tất cả phải thông qua aggregate root.
// Ví dụ thao tác `add comment`
public class Post extends AggregateRoot<Id> {

    // Đây là property `comments` để chứa comment trong aggregate.
    // Nó thể hiện mối quan hệ - object relationship.
    // Mỗi post sẽ có nhiều comments ở bên trong nó.
    // Và `Comment` chính là một entity
    private List<Comment> comments = new ArrayList<>();

    // Method này nằm bên trong aggregate root
    public void addComment(String content, String userId) {
        // True invariants here (đây là logic buộc phải thõa mãn)
        // Tất cả comment phải nhỏ hơn hoặc bằng 100.
        if (this.comments.size() > MAX_COMMENT) {
            throw new CommentLimitExceededException();
        }

        // Ví dụ còn một số business logic khác phải thỏa như:
        // Khi bài post ở trạng thái DRAFT, không thể add comment
        // Ví dụ:
        if (this.status != 'DRAFT') {
            throw new CommentPermissionException();
        }

        // ... và nhiều logic ở đây nữa

        Comment comment = new Comment(
            newId(UniqueIdGenerator.create()),
            content,
            new Id(userId)
        );
        this.comments.add(comment);
}

// Domain service AddCommentService.java (hoặc application service)
// Và ở ngoài domain service chúng ta sẽ làm như sau:
// 1. Kiểm tra xem user có tại hay không.
this.checkingUserExistOrError(userId);

// 2. Kiểm tra post có tồn tại hay không.
Post post = getPostOrError(postId); // Load aggregate

// 3. Thêm comment vào post:
post.addComment(
    commentDto.getContent(),
    user.get().getId().toString()
);

// Sau khi trãi qua step 3, toàn bộ business logic sẽ được thỏa mãn.

// 4. Lưu post:
postRepository.save(post); // Lưu xuống DB
```

Các **tính chất** và **rule** của Aggregate:

- Aggregate là tập hợp nhiều entity, value object có liên quan tới nhau.
- Trong aggregate sẽ có một `aggregate root`. (Aggregate root cũng là một entity).
- Aggregate sẽ có một ID (gọi là `global ID`).
- Các aggregate giao tiếp với bên ngoài chỉ thông qua global ID.
- Các object bên trong aggregate tuyệt được không được giao tiếp với bên ngoài. Tất cả phải thông qua aggregate root.
- **Dữ liệu bên trong aggregate sẽ được toàn vẹn và nhất quán (consistency)**.
- Khi save Aggregate phải theo cơ chế Atomic: Tất cả thông tin trong aggregate phải được save xuống thành công tất cả hoặc tất cả thất bại. Và khi có các request đồng thời, phải xử lý cho chuẩn - `concurrency requests`. Chổ này liên quan tới xử lý `concurrency requests` theo các cơ chế như `optimistic locks` hay `pessimist lock` và `transaction`
- Khi làm việc với aggregate, đừng nghĩ tới database relationship. Mà hãy nghĩ tới object relationship.

![image.png](image%201.png)

```java

// Post.java
// Đây là Aggregate root
@Getter
@Setter
public class Post extends AggregateRoot<Id> {
    private Title title;
    private PostContent content;
    private Id userId;
    private Summary summary;
    private Slug slug;
    private List<Comment> comments = new ArrayList<>();
    // Thật ra còn nhiều properties khác ở đây nữa

    public Post(
            Id id,
            Title title,
            PostContent content,
            Id userId,
            Summary summary,
            Slug slug
    ) {
        super(id);
        this.setTitle(title);
        this.setContent(content);
        this.userId = userId;
        this.summary = summary;
        this.setSlug(slug);
    }

    public void updateTitle(Title title) {
        this.title = title;
    }

    public void updateContent(PostContent content) {
        this.content = content;
    }

    private void updateSlug(Slug slug) {
        this.slug = slug;
    }

    public static Post create(
            Id id,
            Title title,
            PostContent content,
            Id userId,
            Summary summary,
            Slug slug
        ) {
        return new Post(
            id, title, content, userId, summary, thumbnail, slug
        );
    }

    public void addComment(String content, String userId) {
        // True invariants here, example
        // Total of comments must be less than 100
        // When the status of the post is DRAFT, can not add comment
        if (this.comments.size() > MAX_COMMENT) {
            throw new CommentsLimitExceededException();
        }

        // ...

        Comment comment = new Comment(
            new Id(UniqueIdGenerator.create()),
            content,
            new Id(userId)
        );
        this.comments.add(comment);
    }
}
```

**Rule design aggregate:**

- Rule 1: Dựa trên các business logic luôn đúng - `True Invariants`
- Rule 2: Aggregate nên nhỏ nhất có thể
- Rule 3: Giao tiếp với Aggregate khác bằng global ID

![image.png](image%202.png)

- Rule 4: Nên dùng `Eventual consistency`

## 14. Domain event

- Là sự thể hiện của một việc **đã xảy ra** trong Domain Layer (Ví dụ: tạo User thành công sinh ra event `UserCreatedEvent`)
- **Cơ chế hoạt động:** Bắn event ra và không cần quan tâm ai xử lý. Một Aggregate hoặc Bounded Context khác sẽ đóng vai trò "hứng" (Subscribe/Listen) event đó để xử lý nghiệp vụ tiếp theo.
- Eventual Consistency: sự đánh đổi khi dùng xử lý bất đồng bộ (async), thường thông qua **Message Queue** (như Kafka). Dữ liệu không nhất quán ngay lập tức mà sẽ "nhất quán sau một lúc nữa”
  - **Ví dụ 1 (Xóa Bài):** Nhấn xóa `Post` -> Trả response thành công ngay lập tức -> Bắn `PostDeletedEvent` -> `Comment` aggregate hứng event và tiến hành xóa comment ngầm ở background.
  - **Ví dụ 2 (Microservices):** `Order Service` tạo đơn thành công -> Bắn `OrderCreatedEvent` -> `Payment Service` (và các service khác) hứng event để tiếp tục quy trình.
- Domain Event thường được đăng ký (register) ngay bên trong **Aggregate Root**.
- Tùy thuộc vào thiết kế cụ thể, cũng có thể đăng ký bên trong **Domain Service** miễn sao hợp lý với luồng nghiệp vụ.

```java

// Hàm này bên trong Post.java (aggregate root)
public static Post create(
        Id id,
        Title title,
        PostContent content,
        Id userId,
        Summary summary,
        String thumbnail,
        Slug slug
) {
    // True invariants here
    Post post = new Post(
        id,
        title,
        content,
        userId,
        summary,
        thumbnail,
        slug
    );

    // Khi tạo post thì sẽ đăng ký một event
    post.registerEvent(new PostCreatedEvent(post));

    return post;
}

// Và ở đâu đó trong layer repository
// Khi persist DB xong event sẽ được tự động bắn đi
// Hoặc bạn có thể bắn event trong Domain service (tùy bạn)
// Nâng cao hơn thì việc commit DB
//     + publish event nó còn dính tới transaction.
// Bạn tự tìm hiểu thêm nha
// Mình ví dụ nếu save DB không thành công thì không được bắn event đi nha.
// Khi bắn event đi thất bại thì phải xử lý như thế nào?
// vân vân mây mây
public class PostRepository implements PostRepositoryInterface {
    private PostJpaRepository postJpaRepository;
    ...

    @Override
    public void save(Post post) {
        // Build PostEntity here

        this.postJpaRepository.save(postEntity);
        // Publish domain events
        user.publishEvents(domainEventPublisher);
    }
}

// Và đây là nơi nhận được event.
// Mình bắn event vào Kafka để sync data qua redis
// Ở đây sẽ là ngoài phạm vi của domain layer nha.
// Domain layer chỉ có nhiệm vụ bắn domain event đi thôi.
@Service
@AllArgsConstructor
public class PostEventHandler {
    @EventListener(PostCreatedEvent.class)
    public void handlePostCreatedEvent(PostCreatedEvent event) {
        sendMessageToKafkaBroker(event);
    }

    private void sendMessageToKafkaBroker(DomainEventInterface event) {
        Post post = (Post) event.getEventData();
        ProducerRecord<String, PostEventDto> record
            = new ProducerRecord...

        // send data to kafka
        this.kafkaTemplate.send(record);
    }
}
```

- Khi làm việc với DDD thông thường sẽ kết hợp với các layer architected.
- Business logic sẽ tập trung ở duy nhất một nơi gọi là `core domain layer`.
- Unit test riêng biệt cho domain layer luôn để verify các business logic vì domain layer không phụ thuộc vào các layer khác.
- Và các layer khác phải dựa trên domain layer để mà implement. Ví dụ trong hexagonal architecture, bạn sẽ thiết kế các input ports và output ports. Cụ thể nó có thể là các interface của domain layer. Và các layer khác muốn giao tiếp với domain layers sẽ phải implement các interfaces này. Đây là đảo ngược sự phụ thuộc (Inversion of control).


