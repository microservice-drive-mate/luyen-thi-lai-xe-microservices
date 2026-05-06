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
    readonly studentId: string, // từ x-user-id header
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
    readonly requesterId: string, // từ x-user-id header (để check ownership)
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
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("Exams")
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
  @ApiHeader({
    name: "x-user-id",
    description: "Injected by Kong after JWT validation",
  })
  async startExam(
    @Headers("x-user-id") studentId: string,
    @Body() dto: CreateExamRequestDto,
  ): Promise<ExamSessionResponseDto> {
    const result = await this.startExamUseCase.execute(
      new StartExamCommand(dto.examId, studentId),
    );
    return ExamSessionResponseDto.fromResult(result);
  }

  @Post(":sessionId/submit")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Submit exam answers" })
  @ApiHeader({
    name: "x-user-id",
    description: "Injected by Kong after JWT validation",
  })
  async submitExam(
    @Param("sessionId") sessionId: string,
    @Headers("x-user-id") studentId: string,
    @Body() dto: SubmitExamRequestDto,
  ): Promise<void> {
    await this.submitExamUseCase.execute(
      new SubmitExamCommand(sessionId, studentId, dto.answers),
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
      □ Thêm @ApiHeader({ name: 'x-user-id' }) CHỈ ở endpoint cần header này

□ 5. Module
      □ Register use case trong providers[]

□ 6. API Spec
      □ Cập nhật guides/api/api-spec-<service>.md
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
□ 15. Viết API spec tại guides/api/api-spec-<service>.md
□ 16. Viết test guide tại guides/testing/<service>-test-guide.md
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
