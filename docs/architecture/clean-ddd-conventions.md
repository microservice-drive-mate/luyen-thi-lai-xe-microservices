
<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# DDD + Clean Architecture â€” Conventions & Templates

> TÃ i liá»‡u nÃ y lÃ  **nguá»“n tham chiáº¿u duy nháº¥t** khi implement cÃ¡c service má»›i trong monorepo nÃ y.
> `user-service` lÃ  **reference implementation** â€” má»i service khÃ¡c pháº£i follow cÃ¹ng pattern.

---

## Má»¥c lá»¥c

1. [Cáº¥u trÃºc thÆ° má»¥c chuáº©n](#1-cáº¥u-trÃºc-thÆ°-má»¥c-chuáº©n)
2. [Quy táº¯c Ä‘áº·t tÃªn](#2-quy-táº¯c-Ä‘áº·t-tÃªn)
3. [Layer rules â€” Ai phá»¥ thuá»™c vÃ o ai](#3-layer-rules--ai-phá»¥-thuá»™c-vÃ o-ai)
4. [Template: Domain Layer](#4-template-domain-layer)
5. [Template: Application Layer](#5-template-application-layer)
6. [Template: Infrastructure Layer](#6-template-infrastructure-layer)
7. [Template: Presentation Layer](#7-template-presentation-layer)
8. [Template: Module & Bootstrap](#8-template-module--bootstrap)
9. [Template: Prisma Schema](#9-template-prisma-schema)
10. [Checklist khi thÃªm use case má»›i](#10-checklist-khi-thÃªm-use-case-má»›i)
11. [Checklist khi táº¡o service má»›i tá»« Ä‘áº§u](#11-checklist-khi-táº¡o-service-má»›i-tá»«-Ä‘áº§u)
12. [Nhá»¯ng gÃ¬ KHÃ”NG Ä‘Æ°á»£c lÃ m](#12-nhá»¯ng-gÃ¬-khÃ´ng-Ä‘Æ°á»£c-lÃ m)

---

## 1. Cáº¥u trÃºc thÆ° má»¥c chuáº©n

```
apps/<service-name>/
â”œâ”€â”€ prisma/
â”‚   â”œâ”€â”€ schema.prisma           # Prisma schema (models cá»§a service nÃ y)
â”‚   â””â”€â”€ migrations/             # Auto-generated migrations
â”‚
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ domain/                 # â† Layer trong cÃ¹ng. ZERO dependencies ngoÃ i @repo/common
â”‚   â”‚   â”œâ”€â”€ aggregates/
â”‚   â”‚   â”‚   â””â”€â”€ <root-name>/
â”‚   â”‚   â”‚       â”œâ”€â”€ <root-name>.aggregate.ts       # extends AggregateRoot<string>
â”‚   â”‚   â”‚       â”œâ”€â”€ <root-name>.types.ts           # Enums, interfaces Props
â”‚   â”‚   â”‚       â””â”€â”€ <child-entity>.entity.ts       # extends Entity<string> (náº¿u cÃ³)
â”‚   â”‚   â”œâ”€â”€ value-objects/
â”‚   â”‚   â”‚   â””â”€â”€ <name>.vo.ts                       # extends ValueObject<{...}>
â”‚   â”‚   â”œâ”€â”€ events/
â”‚   â”‚   â”‚   â””â”€â”€ <name>.event.ts                    # extends DomainEvent
â”‚   â”‚   â”œâ”€â”€ exceptions/
â”‚   â”‚   â”‚   â””â”€â”€ <name>.exception.ts                # extends DomainException
â”‚   â”‚   â””â”€â”€ repositories/
â”‚   â”‚       â””â”€â”€ <root-name>.repository.ts          # abstract class (interface contract)
â”‚   â”‚
â”‚   â”œâ”€â”€ application/            # â† Orchestration. Depends on domain only
â”‚   â”‚   â”œâ”€â”€ ports/
â”‚   â”‚   â”‚   â””â”€â”€ event-publisher.port.ts            # abstract class cho external services
â”‚   â”‚   â””â”€â”€ use-cases/
â”‚   â”‚       â””â”€â”€ <use-case-name>/
â”‚   â”‚           â”œâ”€â”€ <use-case-name>.command.ts     # hoáº·c .query.ts
â”‚   â”‚           â”œâ”€â”€ <use-case-name>.result.ts      # (tÃ¡ch riÃªng náº¿u phá»©c táº¡p)
â”‚   â”‚           â””â”€â”€ <use-case-name>.use-case.ts    # implements IUseCase<TInput, TOutput>
â”‚   â”‚
â”‚   â”œâ”€â”€ infrastructure/         # â† Details. Implements application ports
â”‚   â”‚   â”œâ”€â”€ persistence/
â”‚   â”‚   â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ prisma.service.ts
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ prisma-<root-name>.repository.ts  # extends abstract repo
â”‚   â”‚   â”‚   â””â”€â”€ mappers/
â”‚   â”‚   â”‚       â””â”€â”€ <root-name>.mapper.ts          # Prisma raw â†’ Domain aggregate
â”‚   â”‚   â”œâ”€â”€ messaging/
â”‚   â”‚   â”‚   â””â”€â”€ rabbitmq-event-publisher.service.ts
â”‚   â”‚   â””â”€â”€ filters/
â”‚   â”‚       â””â”€â”€ domain-exception.filter.ts
â”‚   â”‚
â”‚   â”œâ”€â”€ presentation/           # â† Interface adapters
â”‚   â”‚   â”œâ”€â”€ http/
â”‚   â”‚   â”‚   â””â”€â”€ <root-name>.controller.ts
â”‚   â”‚   â”œâ”€â”€ messaging/
â”‚   â”‚   â”‚   â””â”€â”€ messaging.controller.ts            # @EventPattern handlers
â”‚   â”‚   â””â”€â”€ dtos/
â”‚   â”‚       â”œâ”€â”€ create-<root-name>.request.dto.ts
â”‚   â”‚       â”œâ”€â”€ update-<root-name>.request.dto.ts
â”‚   â”‚       â””â”€â”€ <root-name>.response.dto.ts
â”‚   â”‚
â”‚   â”œâ”€â”€ <service-name>.module.ts    # Feature module (providers, controllers)
â”‚   â”œâ”€â”€ app.module.ts               # Root module (ConfigModule only)
â”‚   â””â”€â”€ main.ts                     # Bootstrap
â”‚
â”œâ”€â”€ Dockerfile
â””â”€â”€ package.json
```

---

## 2. Quy táº¯c Ä‘áº·t tÃªn

### Files

| Loáº¡i                         | Suffix             | VÃ­ dá»¥                          |
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
| Result (output cá»§a use case) | `.result.ts`       | `get-exam-result.result.ts`    |
| Use Case                     | `.use-case.ts`     | `submit-exam.use-case.ts`      |
| Mapper                       | `.mapper.ts`       | `exam-session.mapper.ts`       |
| Request DTO                  | `.request.dto.ts`  | `create-exam.request.dto.ts`   |
| Response DTO                 | `.response.dto.ts` | `exam-session.response.dto.ts` |

### Classes

| Loáº¡i         | Suffix        | VÃ­ dá»¥                                                                    |
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

Format: `SCREAMING_SNAKE_CASE`, mÃ´ táº£ ngáº¯n gá»n tráº¡ng thÃ¡i sai.

```
EXAM_SESSION_NOT_FOUND
EXAM_SESSION_ALREADY_SUBMITTED
EXAM_NOT_AVAILABLE
ENROLLMENT_NOT_FOUND
QUESTION_NOT_FOUND
```

---

## 3. Layer rules â€” Ai phá»¥ thuá»™c vÃ o ai

```
domain       â† khÃ´ng import tá»« Ä‘Ã¢u (ngoÃ i @repo/common)
application  â† import tá»« domain
infrastructure â† import tá»« domain + application
presentation â† import tá»« application (use cases, commands, queries, results)
              â† KHÃ”NG import trá»±c tiáº¿p tá»« infrastructure hoáº·c domain aggregate
```

### Kiá»ƒm tra vi pháº¡m nhanh

```bash
# Náº¿u domain import NestJS â†’ SAI
grep -r "from '@nestjs" apps/<service>/src/domain/

# Náº¿u domain import prisma â†’ SAI
grep -r "from '@prisma" apps/<service>/src/domain/

# Náº¿u presentation import repository impl â†’ SAI
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

  // Factory: táº¡o má»›i tá»« Ä‘áº§u (business rules)
  static create(props: CreateExamSessionProps): ExamSession {
    // Validate invariants táº¡i Ä‘Ã¢y, throw DomainException náº¿u vi pháº¡m
    return new ExamSession(props.id, ExamStatus.IN_PROGRESS, []);
  }

  // Factory: tÃ¡i táº¡o tá»« persistence (khÃ´ng validate láº¡i)
  static reconstitute(props: ReconstituteExamSessionProps): ExamSession {
    const session = new ExamSession(props.id, props.status, []);
    // restore children...
    return session;
  }

  // Domain methods â€” mang business logic
  submit(answers: SubmitAnswerProps[]): void {
    if (this._status !== ExamStatus.IN_PROGRESS) {
      throw new ExamAlreadySubmittedException(this._id);
    }
    this._status = ExamStatus.SUBMITTED;
    // Calculate score...
    this.addDomainEvent(new ExamCompletedEvent(this._id, score));
  }

  // Getters â€” readonly access
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
    readonly studentId: string, // tá»« JWT.sub qua @AuthenticatedUser()
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
    readonly requesterId: string, // tá»« JWT.sub qua @AuthenticatedUser() Ä‘á»ƒ check ownership
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

### 5.4 Use Case â€” Command

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
    await this.eventPublisher.publishAll(events); // publish sau khi save thÃ nh cÃ´ng
  }
}
```

### 5.5 Use Case â€” Query

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

      // Upsert children trong cÃ¹ng transaction
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

    // Map exception codes â†’ HTTP status
    const statusMap: Record<string, number> = {
      EXAM_SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
      EXAM_ALREADY_SUBMITTED: HttpStatus.CONFLICT,
      EXAM_NOT_AVAILABLE: HttpStatus.UNPROCESSABLE_ENTITY,
      // ThÃªm táº¥t cáº£ exception codes cá»§a service vÃ o Ä‘Ã¢y
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
      queue: "<service>_service_events", // Queue nÃ y service CONSUME
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  // DomainExceptionFilter PHáº¢I Ä‘á»©ng sau ApiExceptionFilter
  app.useGlobalFilters(new ApiExceptionFilter(), new DomainExceptionFilter());

  setupMicroserviceSwagger(app, {
    title: "<Service Name> API",
    description: "...",
  });

  const port = configService.get<number>("port") ?? 3000;
  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`âœ“ <Service> Service listening on port ${port}`);
}
void bootstrap();
```

---

## 9. Template: Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider      = "prisma-client-js"
  output        = "../../../node_modules/@prisma/<service>-client"  // QUAN TRá»ŒNG: output riÃªng
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Khai bÃ¡o enums trÆ°á»›c models
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
  studentId   String                // Reference UUID tá»« user-service (KHÃ”NG cÃ³ FK cross-service)
  examId      String                // Reference UUID tá»« exam config
  status      ExamStatus @default(IN_PROGRESS)
  score       Int?
  isPassed    Boolean?
  startedAt   DateTime
  submittedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  answers ExamAnswer[]  // Owned entity â€” FK trong service nÃ y

  @@map("exam_sessions")
}

// Child entity table
model ExamAnswer {
  id               String   @id @default(uuid())
  sessionId        String
  questionId       String   // Reference UUID tá»« question-service (KHÃ”NG cÃ³ FK cross-service)
  selectedOptionId String
  isCorrect        Boolean?

  session ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@map("exam_answers")
}
```

**Quy táº¯c Prisma:**

- `output` pháº£i lÃ  `@prisma/<service>-client` â€” má»—i service cÃ³ Prisma client riÃªng
- KhÃ´ng dÃ¹ng FK cross-service â€” chá»‰ store UUID
- DÃ¹ng `onDelete: Cascade` cho owned entities
- Table names dÃ¹ng `@@map("snake_case")`, column names dÃ¹ng camelCase trong model nhÆ°ng Prisma tá»± map

---

## 10. Checklist khi thÃªm use case má»›i

Khi thÃªm má»™t use case má»›i (vÃ­ dá»¥: `grade-exam`):

```
â–¡ 1. Domain
      â–¡ ThÃªm domain method vÃ o aggregate náº¿u cáº§n (GradeExam lÃ  business logic â†’ vÃ o aggregate)
      â–¡ ThÃªm domain exception má»›i náº¿u cáº§n
      â–¡ ThÃªm domain event má»›i náº¿u cáº§n

â–¡ 2. Application
      â–¡ Táº¡o command/query: src/application/use-cases/grade-exam/grade-exam.command.ts
      â–¡ Táº¡o result (náº¿u phá»©c táº¡p): src/application/use-cases/grade-exam/grade-exam.result.ts
      â–¡ Táº¡o use case: src/application/use-cases/grade-exam/grade-exam.use-case.ts
        â–¡ implements IUseCase<GradeExamCommand, void>
        â–¡ inject repository + eventPublisher (náº¿u emit event)
        â–¡ Publish events SAU KHI save thÃ nh cÃ´ng

â–¡ 3. Infrastructure
      â–¡ ThÃªm vÃ o DomainExceptionFilter.statusMap náº¿u cÃ³ exception má»›i

â–¡ 4. Presentation
      â–¡ ThÃªm endpoint vÃ o controller (HTTP hoáº·c @EventPattern)
      â–¡ ThÃªm/cáº­p nháº­t request DTO
      â–¡ ThÃªm/cáº­p nháº­t response DTO (cÃ³ static fromResult())
      â–¡ ThÃªm @ApiBearerAuth() cho endpoint protected; actor id láº¥y tá»« JWT.sub qua @AuthenticatedUser()

â–¡ 5. Module
      â–¡ Register use case trong providers[]

â–¡ 6. API Spec
      â–¡ Cáº­p nháº­t docs/api/api-spec-<service>.md
```

---

## 11. Checklist khi táº¡o service má»›i tá»« Ä‘áº§u

```
â–¡ 1. Scaffold cáº¥u trÃºc thÆ° má»¥c (copy tá»« user-service)
â–¡ 2. Cáº­p nháº­t package.json (name, scripts)
â–¡ 3. Táº¡o Prisma schema (output = @prisma/<service>-client)
â–¡ 4. Cháº¡y prisma generate
â–¡ 5. Implement domain layer (aggregate, entities, VOs, events, exceptions, repository interface)
â–¡ 6. Implement application layer (ports, use cases)
â–¡ 7. Implement infrastructure layer (PrismaService, Mapper, Repository impl, EventPublisher)
â–¡ 8. Implement presentation layer (DTOs, HTTP controller, Messaging controller)
â–¡ 9. Wire up module (feature module + app module)
â–¡ 10. Bootstrap (main.ts â€” copy vÃ  thay service name)
â–¡ 11. Dockerfile (copy tá»« user-service, thay tÃªn)
â–¡ 12. Cáº­p nháº­t consul-seed-development-local.json (thÃªm port, database.url)
â–¡ 13. Cáº­p nháº­t docker-compose.yaml (thÃªm service + db)
â–¡ 14. Cáº­p nháº­t kong/kong.yaml (thÃªm route vá»›i JWT plugin)
â–¡ 15. Viáº¿t API spec táº¡i docs/api/api-spec-<service>.md
â–¡ 16. Viáº¿t test guide táº¡i docs/testing/services-test-guide.md
```

---

## 12. Nhá»¯ng gÃ¬ KHÃ”NG Ä‘Æ°á»£c lÃ m

### Domain layer

- âŒ Import `@nestjs/*` vÃ o domain â€” domain pháº£i framework-agnostic
- âŒ Import `@prisma/*` vÃ o domain â€” domain khÃ´ng biáº¿t vá» persistence
- âŒ Gá»i repository trá»±c tiáº¿p tá»« domain method â€” domain chá»‰ call `addDomainEvent()`
- âŒ `public` constructor cho aggregate â€” pháº£i dÃ¹ng `private constructor` + factory methods
- âŒ Tráº£ vá» mutable internal array â€” pháº£i return `[...this._array]` (copy)

### Application layer

- âŒ Gá»i `prisma.xxx` trá»±c tiáº¿p tá»« use case â€” pháº£i qua repository interface
- âŒ Import Prisma type vÃ o use case
- âŒ Publish events TRÆ¯á»šC KHI save â€” luÃ´n save trÆ°á»›c, publish sau
- âŒ KhÃ´ng clear domain events sau khi publish (`profile.clearDomainEvents()` báº¯t buá»™c)

### Infrastructure layer

- âŒ Business logic trong repository â€” chá»‰ persistence/query
- âŒ Business logic trong mapper â€” chá»‰ type conversion

### Presentation layer

- âŒ `@ApiHeader` á»Ÿ class level cho táº¥t cáº£ endpoints â€” chá»‰ Ä‘áº·t á»Ÿ method cá»¥ thá»ƒ cáº§n header Ä‘Ã³
- âŒ Import aggregate trá»±c tiáº¿p vÃ o controller â€” pháº£i qua use case result â†’ DTO
- âŒ Gá»i 2 use case liÃªn tiáº¿p Ä‘á»ƒ workaround (double query) â€” use case nÃªn tráº£ káº¿t quáº£ Ä‘áº§y Ä‘á»§
- âŒ Business logic trong controller â€” controller chá»‰ parse request â†’ command â†’ use case â†’ DTO

### Response format

- âŒ Response format khÃ´ng nháº¥t quÃ¡n giá»¯a `DomainExceptionFilter` vÃ  `ApiExceptionFilter`
- âŒ Anonymous return type trong controller method â€” pháº£i dÃ¹ng DTO class cá»¥ thá»ƒ



<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# Database Design â€” Luyá»‡n Thi LÃ¡i Xe Microservices

## NguyÃªn táº¯c cá»‘t lÃµi

- **Database per Service** â€” má»—i service cÃ³ PostgreSQL database riÃªng, khÃ´ng share schema
- **KhÃ´ng foreign key cross-service** â€” chá»‰ reference báº±ng UUID
- **Má»—i Aggregate Root cÃ³ 1 Repository** â€” transaction boundary lÃ  aggregate
- **Domain Events** cho eventual consistency giá»¯a services
- **Denormalize khi cáº§n** â€” lÆ°u display data á»Ÿ nhiá»u service lÃ  bÃ¬nh thÆ°á»ng trong microservices

## Háº¡ng báº±ng lÃ¡i Ä‘Æ°á»£c há»— trá»£

```
A1 | A2 | B1 | B2 | C | D | E | F
```

TrÆ°á»ng `licenseCategory` (enum) xuáº¥t hiá»‡n á»Ÿ question-service, exam-service, course-service, simulation-service.

---

## Service 1: identity-service â†’ Keycloak âœ… (dÃ¹ng Keycloak, khÃ´ng tá»± implement)

**Bounded Context:** Authentication & Authorization

> Há»‡ thá»‘ng sá»­ dá»¥ng **Keycloak** lÃ m Identity Provider. KhÃ´ng cÃ³ `identity_db` riÃªng dÃ¹ng cho business logic.
> Keycloak quáº£n lÃ½: credentials, login/logout, forgot password, JWT issuance, brute-force lock.
> CÃ¡c service khÃ¡c verify JWT do Keycloak cáº¥p (via JWKS endpoint).
>
> **LÆ°u Ã½:** `apps/identity-service/prisma/schema.prisma` hiá»‡n cÃ³ model placeholder `IdentityUser` (id, email, name) â€” Ä‘Ã¢y lÃ  artifact tooling, **khÃ´ng dÃ¹ng** cho business logic. Keycloak váº«n lÃ  nguá»“n dá»¯ liá»‡u tháº­t.

**Roles Ä‘Æ°á»£c cáº¥u hÃ¬nh trong Keycloak:**

```
ADMIN | CENTER_MANAGER | INSTRUCTOR | STUDENT
```

### Domain Events phÃ¡t ra (Keycloak Event Listener / Webhook)

| Event                        | Trigger                                | Payload                       |
| ---------------------------- | -------------------------------------- | ----------------------------- |
| `identity.user.created`      | Admin/Center Manager táº¡o tÃ i khoáº£n má»›i | userId, email, fullName, role |
| `identity.user.locked`       | Brute-force lock                       | userId                        |
| `identity.user.role-changed` | Admin Ä‘á»•i role                         | userId, oldRole, newRole      |

> Events Ä‘Æ°á»£c publish tá»« Keycloak Event Listener â†’ RabbitMQ khi cÃ³ thay Ä‘á»•i tÃ i khoáº£n.

---

## Service 2: user-service â†’ `user_db`

**Bounded Context:** User Profile Management

> Há»‡ thá»‘ng quáº£n lÃ½ **1 trung tÃ¢m duy nháº¥t** â€” khÃ´ng cÃ³ khÃ¡i niá»‡m Ä‘a trung tÃ¢m.
> Keycloak (identity) biáº¿t "ai Ä‘ang Ä‘Äƒng nháº­p". user-service biáº¿t "ngÆ°á»i dÃ¹ng lÃ  ai" (profile, háº¡ng báº±ng Ä‘Æ°á»£c giao).
> 4 role: ADMIN, CENTER_MANAGER, INSTRUCTOR, STUDENT â€” táº¥t cáº£ Ä‘á»u cÃ³ profile á»Ÿ Ä‘Ã¢y.

### Aggregate Root: `UserProfile`

> Profile cÆ¡ báº£n cho táº¥t cáº£ cÃ¡c role. `id` báº±ng vá»›i `userId` tá»« Keycloak â€” nháº­n qua event khi táº¡o tÃ i khoáº£n.

```
user_profiles
â”œâ”€â”€ id              UUID PK          â† = Keycloak userId
â”œâ”€â”€ fullName        TEXT NOT NULL
â”œâ”€â”€ email           TEXT NOT NULL    â† denormalized Ä‘á»ƒ search/display, khÃ´ng dÃ¹ng lÃ m auth
â”œâ”€â”€ phoneNumber     TEXT UNIQUE NULLABLE
â”œâ”€â”€ dateOfBirth     DATE NULLABLE
â”œâ”€â”€ avatarUrl       TEXT NULLABLE
â”œâ”€â”€ mediaFileId     UUID NULLABLE    â† ref â†’ media-service FileObject (UUID only, khÃ´ng cÃ³ FK)
â”œâ”€â”€ gender          ENUM(MALE, FEMALE, OTHER) NULLABLE
â”œâ”€â”€ address         TEXT NULLABLE
â”œâ”€â”€ role            ENUM(ADMIN, CENTER_MANAGER, INSTRUCTOR, STUDENT) NOT NULL  â† sync tá»« Keycloak
â”œâ”€â”€ isActive        BOOLEAN DEFAULT true   â† admin cÃ³ thá»ƒ deactivate Ä‘á»™c láº­p vá»›i lock
â”œâ”€â”€ createdAt       TIMESTAMPTZ
â””â”€â”€ updatedAt       TIMESTAMPTZ
```

### Entity (thuá»™c UserProfile aggregate): `StudentDetail`

> Chá»‰ tá»“n táº¡i khi `role = STUDENT`. LÆ°u háº¡ng báº±ng Ä‘Æ°á»£c giao vÃ  cÃ¡c thÃ´ng tin há»c viÃªn.

```
student_details
â”œâ”€â”€ id              UUID PK
â”œâ”€â”€ studentId       UUID NOT NULL UNIQUE FK â†’ user_profiles.id
â”œâ”€â”€ licenseTier     ENUM(A1, A2, B1, B2, C, D, E, F) NULLABLE  â† háº¡ng báº±ng Ä‘ang há»c
â”œâ”€â”€ enrolledAt      TIMESTAMPTZ NULLABLE   â† ngÃ y báº¯t Ä‘áº§u há»c táº¡i trung tÃ¢m
â””â”€â”€ notes           TEXT NULLABLE          â† ghi chÃº cá»§a center manager / instructor
```

### Entity (thuá»™c UserProfile aggregate): `LicenseAssignmentAudit`

> Audit trail báº¯t buá»™c theo UC06 â€” má»—i láº§n Ä‘á»•i háº¡ng báº±ng Ä‘á»u ghi láº¡i.

```
license_assignment_audits
â”œâ”€â”€ id              UUID PK
â”œâ”€â”€ studentId       UUID NOT NULL FK â†’ user_profiles.id
â”œâ”€â”€ oldLicenseTier  ENUM(A1, A2, B1, B2, C, D, E, F) NULLABLE  â† null náº¿u lÃ  láº§n gÃ¡n Ä‘áº§u tiÃªn
â”œâ”€â”€ newLicenseTier  ENUM(A1, A2, B1, B2, C, D, E, F) NOT NULL
â”œâ”€â”€ changedById     UUID NOT NULL  â† ref â†’ Keycloak userId (ADMIN hoáº·c CENTER_MANAGER)
â””â”€â”€ changedAt       TIMESTAMPTZ NOT NULL
```

### Value Objects (domain layer)

- `PhoneNumber` â€” validate Ä‘á»‹nh dáº¡ng 10-11 sá»‘ VN
- `DateOfBirth` â€” validate tuá»•i â‰¥ 18
- `LicenseTier` â€” validate thuá»™c táº­p há»£p há»£p lá»‡ (A1..F)

### Domain Events

| Direction | Event                           | Trigger                  | Payload                                            |
| --------- | ------------------------------- | ------------------------ | -------------------------------------------------- |
| Subscribe | `identity.user.created`         | Keycloak táº¡o tÃ i khoáº£n   | Táº¡o UserProfile + StudentDetail (náº¿u role=STUDENT) |
| Subscribe | `identity.user.role-changed`    | Admin Ä‘á»•i role           | Sync láº¡i `role` trÃªn UserProfile                   |
| Publish   | `user.student.license-assigned` | GÃ¡n/Ä‘á»•i háº¡ng báº±ng (UC06) | studentId, oldTier, newTier, changedById           |

---

## Service 2.5: media-service â†’ `media_db`

**Bounded Context:** File Storage & Media Management

> Service lÆ°u trá»¯ metadata file sau khi upload lÃªn Azure Blob Storage. CÃ¡c service khÃ¡c (user, course) tham chiáº¿u `mediaFileId` Ä‘á»ƒ hiá»ƒn thá»‹ file mÃ  khÃ´ng gá»i cross-service.

### Aggregate Root: `FileObject`

```
file_objects
â”œâ”€â”€ id            UUID PK
â”œâ”€â”€ storage_key   TEXT NOT NULL UNIQUE  â† Ä‘Æ°á»ng dáº«n trong Azure Blob (e.g. uploads/2026/05/file.jpg)
â”œâ”€â”€ original_name TEXT NOT NULL
â”œâ”€â”€ mime_type     TEXT NOT NULL
â”œâ”€â”€ file_size     INT NOT NULL          â† bytes
â”œâ”€â”€ bucket_name   TEXT NOT NULL
â”œâ”€â”€ uploaded_by_id UUID NOT NULL        â† ref â†’ Keycloak userId (UUID only, khÃ´ng cÃ³ FK)
â”œâ”€â”€ is_public     BOOLEAN DEFAULT false
â”œâ”€â”€ status        ENUM(UNLINKED, LINKED) DEFAULT UNLINKED
â”œâ”€â”€ created_at    TIMESTAMPTZ
â””â”€â”€ updated_at    TIMESTAMPTZ
```

> **`status`**: `UNLINKED` â€” file vá»«a upload, chÆ°a Ä‘Æ°á»£c gáº¯n vÃ o entity nÃ o. `LINKED` â€” Ä‘Ã£ Ä‘Æ°á»£c user/course xÃ¡c nháº­n dÃ¹ng (qua event `user.avatar.linked` hoáº·c `course.material.linked`).

### Domain Events

| Direction | Event | Trigger | Payload |
| --------- | --- | --- | --- |
| Publish | `media.file.uploaded` | Upload file thÃ nh cÃ´ng | fileId, storageKey, originalName, mimeType, fileSize, uploadedById |
| Publish | `media.file.deleted` | XÃ³a file | fileId, storageKey, deletedById |
| Subscribe | `user.avatar.linked` | User gáº¯n avatar | mediaFileId â†’ mark LINKED |
| Subscribe | `course.material.linked` | Course gáº¯n tÃ i liá»‡u | mediaFileId â†’ mark LINKED |

---

## Service 3: question-service â†’ `question_db` âœ… (implemented)

**Bounded Context:** Question Bank Management

### Aggregate Root: `QuestionTopic`

> PhÃ¢n loáº¡i cÃ¢u há»i theo chá»§ Ä‘á» (Luáº­t giao thÃ´ng, Biá»ƒn bÃ¡o, Ká»¹ thuáº­t lÃ¡i, Äáº¡o Ä‘á»©c ngÆ°á»i lÃ¡i...)

```
question_topics
â”œâ”€â”€ id          UUID PK
â”œâ”€â”€ name        TEXT NOT NULL
â”œâ”€â”€ description TEXT
â”œâ”€â”€ parentId    UUID NULLABLE FK â†’ question_topics.id  â† phÃ¢n cáº¥p
â””â”€â”€ createdAt   TIMESTAMPTZ
```

### Aggregate Root: `Question`

```
questions
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ content          TEXT NOT NULL          â† max 2000 kÃ½ tá»±
â”œâ”€â”€ type             ENUM(THEORY, TRAFFIC_SIGN, SCENARIO_RELATED)
â”œâ”€â”€ licenseCategory  TEXT[]                 â† array enum A1..F, 1 cÃ¢u dÃ¹ng Ä‘Æ°á»£c nhiá»u háº¡ng
â”œâ”€â”€ difficulty       ENUM(EASY, MEDIUM, HARD)
â”œâ”€â”€ explanation      TEXT                   â† giáº£i thÃ­ch Ä‘Ã¡p Ã¡n Ä‘Ãºng
â”œâ”€â”€ imageUrl         TEXT NULLABLE          â† biá»ƒn bÃ¡o hoáº·c tÃ¬nh huá»‘ng
â”œâ”€â”€ isCritical       BOOLEAN DEFAULT false  â† cÃ¢u Ä‘iá»ƒm liá»‡t: sai = tá»± Ä‘á»™ng trÆ°á»£t
â”œâ”€â”€ isActive         BOOLEAN DEFAULT true
â”œâ”€â”€ topicId          UUID NOT NULL FK â†’ question_topics.id
â”œâ”€â”€ createdById      UUID NOT NULL  â† ref â†’ identity_users.id
â”œâ”€â”€ createdAt        TIMESTAMPTZ
â””â”€â”€ updatedAt        TIMESTAMPTZ
```

> **`isCritical`**: CÃ¢u há»i vá» ná»“ng Ä‘á»™ cá»“n, tá»‘c Ä‘á»™ tá»‘i Ä‘a â€” sai 1 cÃ¢u lÃ  trÆ°á»£t dÃ¹ tá»•ng Ä‘iá»ƒm Ä‘á»§.

### Entity (thuá»™c Question): `QuestionOption`

```
question_options
â”œâ”€â”€ id            UUID PK
â”œâ”€â”€ questionId    UUID NOT NULL FK â†’ questions.id
â”œâ”€â”€ content       TEXT NOT NULL  â† max 500 kÃ½ tá»±
â”œâ”€â”€ isCorrect     BOOLEAN NOT NULL
â””â”€â”€ displayOrder  INT NOT NULL
```

### Domain Events phÃ¡t ra

| Event                  | Trigger          | Payload                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `question.created`     | ThÃªm cÃ¢u há»i má»›i | questionId, licenseCategory[], isCritical |
| `question.deactivated` | Táº¯t cÃ¢u há»i      | questionId                                |

---

## Service 4: exam-service â†’ `exam_db` âœ… (implemented)

**Bounded Context:** Exam Scheduling & Session Management

### Aggregate Root: `ExamTemplate`

> Blueprint cá»§a má»™t Ä‘á» thi â€” cáº¥u hÃ¬nh sá»‘ cÃ¢u, thá»i gian, Ä‘iá»ƒm Ä‘áº­u theo háº¡ng báº±ng.

```
exam_templates
â”œâ”€â”€ id                UUID PK
â”œâ”€â”€ name              TEXT NOT NULL
â”œâ”€â”€ licenseCategory   ENUM(A1, A2, B1, B2, C, D, E, F)
â”œâ”€â”€ totalQuestions    INT NOT NULL
â”œâ”€â”€ passingScore      INT NOT NULL     â† Ä‘iá»ƒm tá»‘i thiá»ƒu Ä‘á»ƒ Ä‘áº­u
â”œâ”€â”€ durationMinutes   INT NOT NULL
â”œâ”€â”€ isActive          BOOLEAN DEFAULT true
â”œâ”€â”€ createdById       UUID NOT NULL
â””â”€â”€ createdAt         TIMESTAMPTZ
```

### Aggregate Root: `ExamSession`

> Má»™t láº§n thi cá»§a student. Quáº£n lÃ½ toÃ n bá»™ tráº¡ng thÃ¡i phiÃªn thi.

```
exam_sessions
â”œâ”€â”€ id                UUID PK
â”œâ”€â”€ studentId         UUID NOT NULL  â† ref â†’ identity_users.id
â”œâ”€â”€ templateId        UUID NOT NULL FK â†’ exam_templates.id
â”œâ”€â”€ status            ENUM(PENDING, IN_PROGRESS, COMPLETED, TIMED_OUT, CANCELLED)
â”œâ”€â”€ score             INT NULLABLE          â† null khi chÆ°a hoÃ n thÃ nh
â”œâ”€â”€ isPassed          BOOLEAN NULLABLE
â”œâ”€â”€ failedByCritical  BOOLEAN DEFAULT false â† trÆ°á»£t do cÃ¢u Ä‘iá»ƒm liá»‡t
â”œâ”€â”€ startedAt         TIMESTAMPTZ NULLABLE
â”œâ”€â”€ finishedAt        TIMESTAMPTZ NULLABLE
â”œâ”€â”€ expiresAt         TIMESTAMPTZ NOT NULL  â† startedAt + durationMinutes
â””â”€â”€ createdAt         TIMESTAMPTZ
```

### Entity (thuá»™c ExamSession): `ExamSessionQuestion`

> Snapshot cÃ¢u há»i táº¡i thá»i Ä‘iá»ƒm thi â€” trÃ¡nh bá»‹ áº£nh hÆ°á»Ÿng khi question-service cáº­p nháº­t sau.

```
exam_session_questions
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ sessionId        UUID NOT NULL FK â†’ exam_sessions.id
â”œâ”€â”€ questionId       UUID NOT NULL        â† ref â†’ question_db (UUID only, NO FK)
â”œâ”€â”€ questionContent  TEXT NOT NULL        â† snapshot ná»™i dung cÃ¢u há»i
â”œâ”€â”€ optionsSnapshot  JSONB NOT NULL       â† snapshot toÃ n bá»™ options
â”œâ”€â”€ isCritical       BOOLEAN NOT NULL
â”œâ”€â”€ displayOrder     INT NOT NULL
â”œâ”€â”€ selectedOptionId UUID NULLABLE        â† null = chÆ°a tráº£ lá»i
â”œâ”€â”€ isCorrect        BOOLEAN NULLABLE
â””â”€â”€ answeredAt       TIMESTAMPTZ NULLABLE
```

### Aggregate Root: `ExamSchedule`

> Lá»‹ch thi Ä‘Æ°á»£c táº¡o bá»Ÿi CENTER_MANAGER hoáº·c ADMIN.

```
exam_schedules
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ templateId       UUID NOT NULL FK â†’ exam_templates.id
â”œâ”€â”€ centerId         UUID NULLABLE  â† ref â†’ user-service (UUID only)
â”œâ”€â”€ scheduledAt      TIMESTAMPTZ NOT NULL
â”œâ”€â”€ location         TEXT
â”œâ”€â”€ maxParticipants  INT
â”œâ”€â”€ createdById      UUID NOT NULL
â””â”€â”€ createdAt        TIMESTAMPTZ
```

### Value Objects

- `Score` â€” 0 â‰¤ value â‰¤ totalQuestions
- `ExamDuration` â€” > 0, â‰¤ 180 phÃºt

### Domain Events phÃ¡t ra

| Event                    | Trigger                  | Payload                                                |
| ------------------------ | ------------------------ | ------------------------------------------------------ |
| `exam.session.completed` | Thi xong (ká»ƒ cáº£ timeout) | sessionId, studentId, score, isPassed, licenseCategory |
| `exam.session.passed`    | Thi Ä‘áº­u                  | sessionId, studentId, licenseCategory                  |
| `exam.session.failed`    | Thi rá»›t                  | sessionId, studentId, failedByCritical                 |

---

## Service 5: course-service â†’ `course_db`

**Bounded Context:** Learning Content & Enrollment

### Aggregate Root: `Course`

```
courses
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ title            TEXT NOT NULL
â”œâ”€â”€ description      TEXT NULLABLE
â”œâ”€â”€ licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
â”œâ”€â”€ totalLessons     INT DEFAULT 0
â”œâ”€â”€ duration         TEXT NULLABLE    â† e.g. "3 thÃ¡ng"
â”œâ”€â”€ tuitionFee       DECIMAL(12,2) DEFAULT 0
â”œâ”€â”€ capacity         INT NULLABLE
â”œâ”€â”€ status           ENUM(DRAFT, ACTIVE) DEFAULT DRAFT
â”œâ”€â”€ createdById      UUID NOT NULL    â† ref â†’ Keycloak userId (INSTRUCTOR/ADMIN)
â”œâ”€â”€ createdAt        TIMESTAMPTZ
â””â”€â”€ updatedAt        TIMESTAMPTZ
```

> **Scope simplification:** KhÃ´ng cÃ³ thumbnailUrl, khÃ´ng cÃ³ video â€” khÃ³a há»c chá»‰ cáº§n text content. `ARCHIVED` khÃ´ng cÃ³ trong enum hiá»‡n táº¡i.

### Entity (thuá»™c Course): `Lesson`

```
lessons
â”œâ”€â”€ id        UUID PK
â”œâ”€â”€ courseId  UUID NOT NULL FK â†’ courses.id (onDelete: Cascade)
â”œâ”€â”€ title     TEXT NOT NULL
â”œâ”€â”€ content   TEXT NULLABLE  â† markdown text
â”œâ”€â”€ order     INT NOT NULL
â””â”€â”€ createdAt TIMESTAMPTZ
```

> Lesson gáº¯n trá»±c tiáº¿p vÃ o Course (khÃ´ng qua CourseModule). KhÃ´ng cÃ³ `videoUrl` hay `durationMinutes`.

### Entity (thuá»™c Course): `CourseInstructor`

> Junction table cho quan há»‡ many-to-many giá»¯a Course vÃ  Instructor.

```
course_instructors
â”œâ”€â”€ id           UUID PK
â”œâ”€â”€ courseId     UUID NOT NULL FK â†’ courses.id (onDelete: Cascade)
â””â”€â”€ instructorId UUID NOT NULL    â† ref â†’ Keycloak userId
    UNIQUE(courseId, instructorId)
```

### Entity (thuá»™c Course): `CourseRequirement`

> Äiá»u kiá»‡n tham gia khÃ³a há»c â€” quan há»‡ 1-1 vá»›i Course.

```
course_requirements
â”œâ”€â”€ id             UUID PK
â”œâ”€â”€ courseId       UUID NOT NULL UNIQUE FK â†’ courses.id (onDelete: Cascade)
â”œâ”€â”€ minAge         INT NULLABLE
â”œâ”€â”€ prerequisites  TEXT NULLABLE
â”œâ”€â”€ attendanceRate INT DEFAULT 80
â”œâ”€â”€ minPassScore   INT DEFAULT 80
â””â”€â”€ requiredExams  INT DEFAULT 0
```

### Entity (thuá»™c Course): `CourseMaterial`

> TÃ i liá»‡u Ä‘Ã­nh kÃ¨m khÃ³a há»c (PDF, video, link...).

```
course_materials
â”œâ”€â”€ id          UUID PK
â”œâ”€â”€ courseId    UUID NOT NULL FK â†’ courses.id (onDelete: Cascade)
â”œâ”€â”€ title       TEXT NOT NULL
â”œâ”€â”€ fileUrl     TEXT NULLABLE    â† URL trá»±c tiáº¿p (náº¿u khÃ´ng dÃ¹ng media-service)
â”œâ”€â”€ mediaFileId UUID NULLABLE    â† ref â†’ media-service FileObject (UUID only, khÃ´ng cÃ³ FK)
â”œâ”€â”€ type        TEXT NULLABLE    â† e.g. "PDF", "VIDEO", "LINK"
â””â”€â”€ createdAt   TIMESTAMPTZ
```

### Aggregate Root: `CourseEnrollment`

> Quáº£n lÃ½ tiáº¿n trÃ¬nh há»c cá»§a 1 student trong 1 khÃ³a há»c.

```
course_enrollments
â”œâ”€â”€ id          UUID PK
â”œâ”€â”€ courseId    UUID NOT NULL FK â†’ courses.id (onDelete: Cascade)
â”œâ”€â”€ studentId   UUID NOT NULL  â† ref â†’ Keycloak userId
â”œâ”€â”€ status      ENUM(ACTIVE, COMPLETED, DROPPED) DEFAULT ACTIVE
â”œâ”€â”€ progress    INT DEFAULT 0  â† 0-100%, tá»± tÃ­nh khi completeLesson
â”œâ”€â”€ enrolledAt  TIMESTAMPTZ
â””â”€â”€ completedAt TIMESTAMPTZ NULLABLE
    UNIQUE(courseId, studentId)
```

> **KhÃ´ng cÃ³ `lesson_progress` table.** Má»—i láº§n `completeLesson` gá»i, progress tÄƒng `100/totalLessons`. KhÃ´ng track per-lesson tráº¡ng thÃ¡i Ä‘Ã£ hoÃ n thÃ nh.

### Domain Events phÃ¡t ra

| Event                         | Trigger                  | Payload                           |
| ----------------------------- | ------------------------ | --------------------------------- |
| `course.enrollment.created`   | Student Ä‘Äƒng kÃ½ khÃ³a há»c | enrollmentId, studentId, courseId |
| `course.enrollment.completed` | HoÃ n thÃ nh khÃ³a há»c      | enrollmentId, studentId, courseId |
| `course.lesson.completed`     | HoÃ n thÃ nh 1 bÃ i há»c     | lessonId, studentId, courseId     |

---

## Service 6: simulation-service â†’ `simulation_db` âœ… (MVP implemented)

**Bounded Context:** Driving Scenario Simulation (Sa hÃ¬nh)

> Sa hÃ¬nh: student xem video/áº£nh tÃ¬nh huá»‘ng thá»±c táº¿ vÃ  chá»n hÃ nh Ä‘á»™ng Ä‘Ãºng. CÃ³ 120 tÃ¬nh huá»‘ng theo quy Ä‘á»‹nh.

### Aggregate Root: `Maneuver`

> Content tÄ©nh, do ADMIN/INSTRUCTOR táº¡o.

```
maneuvers
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ title            TEXT NOT NULL
â”œâ”€â”€ description      TEXT NOT NULL
â”œâ”€â”€ licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
â”œâ”€â”€ displayOrder     INT NOT NULL
â”œâ”€â”€ isActive         BOOLEAN DEFAULT true
â”œâ”€â”€ createdAt        TIMESTAMPTZ
â””â”€â”€ updatedAt        TIMESTAMPTZ
```

### Entity (thuá»™c Maneuver): `ManeuverCheckpoint`

```
maneuver_checkpoints
â”œâ”€â”€ id            UUID PK
â”œâ”€â”€ maneuverId    UUID NOT NULL FK â†’ maneuvers.id
â”œâ”€â”€ title         TEXT NOT NULL
â”œâ”€â”€ instruction   TEXT NOT NULL
â”œâ”€â”€ penalty       TEXT NULLABLE
â””â”€â”€ displayOrder  INT NOT NULL
```

### Entity: `ManeuverError`

```
maneuver_errors
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
â”œâ”€â”€ code             TEXT NOT NULL
â”œâ”€â”€ description      TEXT NOT NULL
â”œâ”€â”€ severity         TEXT NOT NULL
â””â”€â”€ createdAt        TIMESTAMPTZ
```

### Aggregate Root: `SimulationSession`

> Má»™t láº§n luyá»‡n táº­p sa hÃ¬nh cá»§a student.

```
simulation_sessions
â”œâ”€â”€ id               UUID PK
â”œâ”€â”€ studentId        UUID NOT NULL  â† ref â†’ identity_users.id
â”œâ”€â”€ licenseCategory  ENUM(A1, A2, B1, B2, C, D, E, F)
â”œâ”€â”€ status           ENUM(IN_PROGRESS, COMPLETED, ABANDONED)
â”œâ”€â”€ totalScenarios   INT NOT NULL
â”œâ”€â”€ correctCount     INT DEFAULT 0
â”œâ”€â”€ score            INT NULLABLE   â† 0-100
â”œâ”€â”€ isPassed         BOOLEAN NULLABLE
â”œâ”€â”€ startedAt        TIMESTAMPTZ NOT NULL
â””â”€â”€ completedAt      TIMESTAMPTZ NULLABLE
```

### Entity (thuá»™c SimulationSession): `SimulationAnswer`

```
simulation_answers
â”œâ”€â”€ id                UUID PK
â”œâ”€â”€ sessionId         UUID NOT NULL FK â†’ simulation_sessions.id
â”œâ”€â”€ scenarioId        UUID NOT NULL FK â†’ scenarios.id
â”œâ”€â”€ selectedOptionId  UUID NULLABLE   â† null = bá» qua
â”œâ”€â”€ isCorrect         BOOLEAN NULLABLE
â””â”€â”€ answeredAt        TIMESTAMPTZ
```

### Domain Events phÃ¡t ra

| Event                          | Trigger            | Payload                                                |
| ------------------------------ | ------------------ | ------------------------------------------------------ |
| `simulation.session.completed` | HoÃ n thÃ nh sa hÃ¬nh | sessionId, studentId, score, isPassed, licenseCategory |

---

## Service 7: notification-service â†’ `notification_db` âœ… (MVP implemented)

**Bounded Context:** Notification Delivery

### Current MVP scope

Notification-service persists in-app notifications and academic warning audit records. Template/preference/channel delivery tables are extension points, not part of the current schema.

### Aggregate Root: `AcademicWarning`

```
academic_warnings
â”œâ”€â”€ id          UUID PK
â”œâ”€â”€ studentId   UUID NOT NULL
â”œâ”€â”€ reason      TEXT NOT NULL
â”œâ”€â”€ severity    TEXT NOT NULL
â”œâ”€â”€ message     TEXT NOT NULL
â”œâ”€â”€ createdById UUID NOT NULL
â””â”€â”€ createdAt   TIMESTAMPTZ
```

### Aggregate Root: `Notification`

```
notifications
â”œâ”€â”€ id        UUID PK
â”œâ”€â”€ userId    UUID NOT NULL  â† ref â†’ identity_users.id
â”œâ”€â”€ type      ENUM(IN_APP, EMAIL, PUSH, SMS)
â”œâ”€â”€ title     TEXT NOT NULL
â”œâ”€â”€ body      TEXT NOT NULL
â”œâ”€â”€ data      JSONB DEFAULT '{}'  â† metadata tÃ¹y loáº¡i thÃ´ng bÃ¡o
â”œâ”€â”€ isRead    BOOLEAN DEFAULT false
â”œâ”€â”€ readAt    TIMESTAMPTZ NULLABLE
â”œâ”€â”€ sentAt    TIMESTAMPTZ NULLABLE
â””â”€â”€ createdAt TIMESTAMPTZ
```

### Future extension: `NotificationPreference`

```
notification_preferences
â”œâ”€â”€ id           UUID PK
â”œâ”€â”€ userId       UUID NOT NULL UNIQUE  â† ref â†’ identity_users.id
â”œâ”€â”€ emailEnabled BOOLEAN DEFAULT true
â”œâ”€â”€ pushEnabled  BOOLEAN DEFAULT true
â”œâ”€â”€ smsEnabled   BOOLEAN DEFAULT false
â”œâ”€â”€ inAppEnabled BOOLEAN DEFAULT true
â””â”€â”€ updatedAt    TIMESTAMPTZ
```

### Domain Events subscribe

| Event                          | HÃ nh Ä‘á»™ng                                             |
| ------------------------------ | ----------------------------------------------------- |
| `identity.user.created`        | Gá»­i welcome notification + táº¡o NotificationPreference |
| `identity.user.locked`         | Cáº£nh bÃ¡o tÃ i khoáº£n bá»‹ khÃ³a                            |
| `exam.session.passed`          | ThÃ´ng bÃ¡o Ä‘áº­u thi                                     |
| `exam.session.failed`          | ThÃ´ng bÃ¡o rá»›t thi, gá»£i Ã½ Ã´n thÃªm                      |
| `course.enrollment.completed`  | ChÃºc má»«ng hoÃ n thÃ nh khÃ³a há»c                         |
| `simulation.session.completed` | ThÃ´ng bÃ¡o káº¿t quáº£ sa hÃ¬nh                             |

---

## Service 8: analytics-service â†’ `analytics_db` âœ… (MVP implemented)

**Bounded Context:** Learning Analytics & Progress Tracking

> Analytics service lÃ  **CQRS read model** â€” nghe events tá»« cÃ¡c service khÃ¡c, tá»•ng há»£p view Ä‘á»ƒ query nhanh.

### Aggregate Root: `StudentLearningProfile`

> Thá»‘ng kÃª tá»•ng há»£p há»c táº­p cá»§a student â€” cáº­p nháº­t dáº§n theo events.

```
student_learning_profiles
â”œâ”€â”€ id                UUID PK  â† báº±ng studentId
â”œâ”€â”€ studentId         UUID NOT NULL UNIQUE
â”œâ”€â”€ totalStudyMinutes INT DEFAULT 0
â”œâ”€â”€ totalExamAttempts INT DEFAULT 0
â”œâ”€â”€ passedExams       INT DEFAULT 0
â”œâ”€â”€ avgExamScore      FLOAT DEFAULT 0
â”œâ”€â”€ coursesEnrolled   INT DEFAULT 0
â”œâ”€â”€ coursesCompleted  INT DEFAULT 0
â”œâ”€â”€ lastActivityAt    TIMESTAMPTZ
â”œâ”€â”€ resetAt           TIMESTAMPTZ NULLABLE
â”œâ”€â”€ createdAt         TIMESTAMPTZ
â””â”€â”€ updatedAt         TIMESTAMPTZ
```

### Entity (thuá»™c StudentLearningProfile): `DailyActivity`

```
daily_activities
â”œâ”€â”€ id                UUID PK
â”œâ”€â”€ studentId         UUID NOT NULL
â”œâ”€â”€ date              DATE NOT NULL
â”œâ”€â”€ studyMinutes      INT DEFAULT 0
â”œâ”€â”€ questionsAnswered INT DEFAULT 0
â”œâ”€â”€ correctAnswers    INT DEFAULT 0
â”œâ”€â”€ examsAttempted    INT DEFAULT 0
â”œâ”€â”€ simSessions       INT DEFAULT 0
â””â”€â”€ UNIQUE(studentId, date)
```

### Aggregate Root: `QuestionAccuracyTracker`

> Track tá»· lá»‡ Ä‘Ãºng/sai theo tá»«ng cÃ¢u há»i â€” dÃ¹ng Ä‘á»ƒ gá»£i Ã½ Ã´n cÃ¢u yáº¿u.

```
question_accuracy_trackers
â”œâ”€â”€ id              UUID PK
â”œâ”€â”€ studentId       UUID NOT NULL
â”œâ”€â”€ questionId      UUID NOT NULL  â† ref â†’ question_db (UUID only)
â”œâ”€â”€ totalAttempts   INT DEFAULT 0
â”œâ”€â”€ correctAttempts INT DEFAULT 0
â”œâ”€â”€ lastAttemptAt   TIMESTAMPTZ
â””â”€â”€ UNIQUE(studentId, questionId)
```

### Aggregate Root: `WeakAreaReport`

> Chá»§ Ä‘á» yáº¿u cá»§a student â€” computed tá»« QuestionAccuracy, grouped by topic.

```
weak_area_reports
â”œâ”€â”€ id            UUID PK
â”œâ”€â”€ studentId     UUID NOT NULL
â”œâ”€â”€ topicId       UUID NOT NULL  â† ref â†’ question_db.question_topics (UUID only)
â”œâ”€â”€ topicName     TEXT NOT NULL  â† denormalized Ä‘á»ƒ trÃ¡nh cross-service call
â”œâ”€â”€ accuracyRate  FLOAT NOT NULL â† 0.0 - 1.0
â”œâ”€â”€ questionCount INT NOT NULL
â”œâ”€â”€ needsReview   BOOLEAN DEFAULT false
â”œâ”€â”€ updatedAt     TIMESTAMPTZ
â””â”€â”€ UNIQUE(studentId, topicId)
```

### Domain Events subscribe

| Event                          | HÃ nh Ä‘á»™ng                                                 |
| ------------------------------ | --------------------------------------------------------- |
| `identity.user.created`        | Táº¡o StudentLearningProfile                                |
| `exam.session.completed`       | Update LearningProfile + DailyActivity + QuestionAccuracy |
| `simulation.session.completed` | Update LearningProfile + DailyActivity                    |
| `course.lesson.completed`      | Update studyMinutes trong DailyActivity                   |
| `course.enrollment.completed`  | Increment coursesCompleted                                |

---

## Cross-Service Event Flow

```
[Keycloak â†’ RabbitMQ via Event Listener]
    â”œâ”€â”€ identity.user.created â”€â”€â–º user-service        (táº¡o UserProfile + StudentDetail)
    â”‚                         â”€â”€â–º analytics-service   (táº¡o StudentLearningProfile)
    â”‚                         â”€â”€â–º notification-service (gá»­i welcome notification)
    â””â”€â”€ identity.user.locked  â”€â”€â–º notification-service (cáº£nh bÃ¡o tÃ i khoáº£n bá»‹ khÃ³a)

[user-service]
    â””â”€â”€ user.student.license-assigned â”€â”€â–º analytics-service   (reset scope theo háº¡ng báº±ng má»›i)
                                      â”€â”€â–º notification-service (thÃ´ng bÃ¡o Ä‘á»•i háº¡ng báº±ng)

[exam-service]
    â”œâ”€â”€ exam.session.completed â”€â”€â–º analytics-service   (cáº­p nháº­t stats + question accuracy)
    â”œâ”€â”€ exam.session.passed    â”€â”€â–º notification-service (thÃ´ng bÃ¡o Ä‘áº­u)
    â””â”€â”€ exam.session.failed    â”€â”€â–º notification-service (thÃ´ng bÃ¡o rá»›t)

[simulation-service]
    â””â”€â”€ simulation.session.completed â”€â”€â–º analytics-service   (cáº­p nháº­t sim stats)
                                     â”€â”€â–º notification-service (thÃ´ng bÃ¡o káº¿t quáº£)

[course-service]
    â”œâ”€â”€ course.lesson.completed     â”€â”€â–º analytics-service   (cáº­p nháº­t study time)
    â””â”€â”€ course.enrollment.completed â”€â”€â–º notification-service (chÃºc má»«ng hoÃ n thÃ nh)
                                    â”€â”€â–º analytics-service   (increment coursesCompleted)
```

---

## TÃ³m táº¯t

| Service | Database | Aggregate Roots | Ghi chÃº |
| --- | --- | --- | --- |
| identity-service | identity_db + **Keycloak** | IdentityUser | Keycloak lÃ  source of truth auth; identity_db giá»¯ audit/read model demo |
| user-service | user_db | UserProfile | âœ… CÃ³ StudentDetail + LicenseAssignmentAudit |
| media-service | media_db | FileObject | âœ… Azure Blob metadata, UNLINKED/LINKED status |
| question-service | question_db | Question, QuestionTopic, QuestionVersion | âœ… CÃ³ soft delete/versioning |
| exam-service | exam_db | ExamTemplate, ExamSession, ExamSchedule | âœ… CÃ³ immutable snapshot cÃ¢u há»i/template |
| course-service | course_db | Course, CourseEnrollment | âœ… CÃ³ CourseInstructor, CourseRequirement, CourseMaterial |
| simulation-service | simulation_db | Maneuver, SimulationSession | âœ… Maneuver/checkpoint/error + state machine MVP |
| notification-service | notification_db | Notification, AcademicWarning | âœ… In-app notification + academic warning |
| analytics-service | analytics_db | StudentLearningProfile, DailyActivity, QuestionAccuracyTracker | âœ… CQRS read model + Redis cache |

---

## Event Contracts (packages/common)

NÃªn táº¡o shared event types Ä‘á»ƒ táº¥t cáº£ services dÃ¹ng chung, trÃ¡nh drift:

```
packages/common/src/events/
â”œâ”€â”€ identity/
â”‚   â”œâ”€â”€ user-created.event.ts
â”‚   â””â”€â”€ user-locked.event.ts
â”œâ”€â”€ exam/
â”‚   â”œâ”€â”€ session-completed.event.ts
â”‚   â””â”€â”€ session-passed.event.ts
â”œâ”€â”€ course/
â”‚   â”œâ”€â”€ enrollment-completed.event.ts
â”‚   â””â”€â”€ lesson-completed.event.ts
â””â”€â”€ simulation/
    â””â”€â”€ session-completed.event.ts
```

---

## Thá»© tá»± implement Ä‘á» xuáº¥t

1. **question-service** â€” foundation, cÃ¡c service khÃ¡c tham chiáº¿u questionId
2. **exam-service** â€” call question-service (sync HTTP) Ä‘á»ƒ láº¥y cÃ¢u há»i khi táº¡o session
3. **course-service** â€” Ä‘á»™c láº­p, cÃ³ thá»ƒ implement song song vá»›i exam
4. **simulation-service** â€” Ä‘á»™c láº­p
5. **user-service** â€” subscribe `identity.user.created`
6. **analytics-service** â€” subscribe nhiá»u events nháº¥t, nÃªn implement sau
7. **notification-service** â€” implement sau khi cÃ³ Ä‘á»§ events Ä‘á»ƒ test



<!-- Merged from docs/architecture/clean-ddd-conventions.md -->
# Clean Architecture

![image.png](image.png)

![image.png](image%201.png)

## 1. Entities

- CÃ³ thá»ƒ gá»i lÃ  **domain layer**, thuá»™c vá» **core business logic**
- LÃ  cÃ¡c object (model) chá»©a cÃ¡c business logic
- Trong Clean Architecture, 1 entity cÃ³ thá»ƒ lÃ  1 object hoáº·c 1 cá»¥m object.
- Mapping qua DDD, entities cÃ³ thá»ƒ bao gá»“m aggregate, entity, value object

## 2. Use case

- CÃ³ thá»ƒ gá»i lÃ  **application layer**, chá»©a application business logic, thuá»™c vá» core business logic
- Logic bao gá»“m: flow chÆ°Æ¡ng trÃ¬nh, tÆ°Æ¡ng tÃ¡c vá»›i entities (layer trong) nhÆ° load entities, save entities, â€¦ â‡’ nhÆ° 1 `orchestrator` Ä‘iá»u phá»‘i request
- Entities (domain layer) vÃ  use case (application layer) lÃ  2 thÃ nh pháº§n quan trá»ng vÃ  Ä‘Æ°á»£c cÃ´ láº­p á»Ÿ **core business logic â‡’** khÃ´ng phá»¥ thuá»™c cÃ¡c thÃ nh pháº§n ngoÃ i: framework, UI, database, â€¦

## 3. Interface Adapters

- CÃ³ thá»ƒ gá»i lÃ  Presentation
- Chá»©a cÃ¡c adapter Ä‘á»ƒ convert data tá»« bÃªn ngoÃ i (web, database) vÃ o bÃªn trong (application, domain) vÃ  ngÆ°á»£c láº¡i.

## 4. Frameworks and Drivers

- CÃ³ thá»ƒ gá»i lÃ  **infrastructure layer**
- Chá»©a cÃ¡c detail implement cá»§a database, external service hay cÃ¡c driver, framework

VÃ­ dá»¥: á»ž use case chá»‰ thao tÃ¡c vá»›i cÃ¡c interface cá»§a database thÃ´ng qua repository pattern thÃ´i, hoáº·c muá»‘n giao tiáº¿p vá»›i external service cÅ©ng pháº£i thÃ´ng qua interface. á»ž layer Ä‘Ã³ hoÃ n toÃ n khÃ´ng tháº¥y Ä‘Æ°á»£c implement chi tiáº¿t cá»§a chÃºng. VÃ  nhá»¯ng implement chi tiáº¿t Ä‘Ã³ sáº½ náº±m á»Ÿ infrastructure layer nÃ y.

## 5. Dependency rule

- Chiá»u cá»§a dependency tá»« ngoÃ i vÃ o trong, hÆ°á»›ng dáº«n cÃ¡c thÃ nh pháº§n tÆ°Æ¡ng tÃ¡c, phá»¥ thuá»™c láº«n nhau.
- CÃ¡c thÃ nh pháº§n bÃªn trong khÃ´ng Ä‘Æ°á»£c phÃ©p **phá»¥ thuá»™c trá»±c tiáº¿p** vÃ o cÃ¡c thÃ nh pháº§n á»Ÿ lá»›p bÃªn ngoÃ i.
- Sá»± tÆ°Æ¡ng tÃ¡c diá»…n ra thÃ´ng qua cÃ¡c abstraction vÃ  dependency inversion

VÃ­ dá»¥: Trong cÃ¡c use case, khÃ´ng Ä‘Æ°á»£c import cÃ¡c dependency á»Ÿ ngoÃ i nhÆ° database (thuá»™c layer ngoÃ i cÃ¹ng).

```java

// VÃ­ dá»¥ á»Ÿ Ä‘Ã¢y lÃ  má»™t file Use case.
// CÃ¡c implementation cá»§a cÃ¡c repositories trong nÃ y thuá»™c vá» infra layer.
// NhÆ°ng á»Ÿ Ä‘Ã¢y náº¿u import trá»±c tiáº¿p implementation chi tiáº¿t cá»§a cÃ¡c repo
// thÃ¬ sáº½ vi pháº¡m dependency rule.
// Cho nÃªn á»Ÿ Ä‘Ã¢y UserRepository pháº£i lÃ  má»™t interface
// (abstraction vá»›i layer bÃªn ngoÃ i) má»›i thá»a mÃ£n dependency rule
public class CreateUserUseCaseImpl implements CreateUserUseCase {
    private UserRepository userRepository;
    private RoleRepository roleRepository;
    private UserDomainService userDomainService;
    private UserEventPublisher publisher;
  // ...

```

LÆ°u Ã½:

- Dependency rule khÃ´ng cáº¥m hoÃ n toÃ n sá»± phá»¥ thuá»™c giá»¯a cÃ¡c thÃ nh pháº§n.
- Má»¥c tiÃªu lÃ  giáº£m thiá»ƒu phá»¥ thuá»™c trá»±c tiáº¿p vÃ  khuyáº¿n khÃ­ch sá»­ dá»¥ng abstraction.

## 6. Usecase thá»±c táº¿

- **Use case**: use case sáº½ lÃ  táº¡o má»™t author user. author user chÃ­nh lÃ  ngÆ°á»i cÃ³ thá»ƒ táº¡o vÃ  quáº£n lÃ½ bÃ i post cá»§a há». Sau khi táº¡o user xong, sáº½ cÃ³ má»™t event UserCreatedEvent báº¯n vÃ  sync user qua má»™t Redis server khÃ¡c. Event nÃ y sáº½ Ä‘Æ°á»£c báº¯n lÃªn Kafka cluster
- Folder structure
  - `domain folder`: lÃ  domain layer, application chÃ­nh lÃ  application layer. Hai Ã´ng nÃ y chÃ­nh lÃ  core cá»§a software
  - `controller folder`: thuá»™c vá» presentation layer
  - `infra layer`: thuá»™c vá» infrastructure layer
  - `dto folder` â‡’ cÃ³ 2 cÃ¡ch Ä‘áº·t
    - gom háº¿t vÃ o folder dto
    - `dto`Â phá»¥c vá»¥ cho layer nÃ o thÃ¬ Ä‘áº·t táº¡i layer Ä‘Ã³.

```
application/
â”œâ”€â”€ eventpublisher/
â”œâ”€â”€ exception/
â”œâ”€â”€ service/
â”œâ”€â”€ repository/
â”‚   â”œâ”€â”€ UserRepository.java
â”‚   â””â”€â”€ ...
â””â”€â”€ usecase/
domain/
â”œâ”€â”€ exception/
â”‚   â”œâ”€â”€ UserNotFoundExeption.java
â”‚   â””â”€â”€ ...
â”œâ”€â”€ valueobject/
â”‚   â”œâ”€â”€ UserName.java
â”‚   â””â”€â”€ ...
â”œâ”€â”€ entity/
â”‚   â”œâ”€â”€ User.java
â”‚   â””â”€â”€ ...
â””â”€â”€ service/
dto/
infra/
â”œâ”€â”€ persistence/
â”‚   â”œâ”€â”€ UserRepositoryImpl.java
â”‚   â””â”€â”€ ...
â””â”€â”€ messaging/
controller/
â”œâ”€â”€ UserController.java
â””â”€â”€ ...
```

Flow cá»§a request

- Request Ä‘i tá»›i controllerÂ `UserController`Â - interface adapters layer hay presentation layer â‡’ data sáº½ Ä‘Æ°á»£c transform sang dáº¡ng thÃ­ch há»£p nháº¥t vá»›i cÃ¡c layer á»Ÿ trong - domain layer vÃ  application layer â‡’ dÃ¹ngÂ `UserDto`Â Ä‘á»ƒ chá»©a dá»¯ liá»‡u tá»« request nha.
- Request Ä‘i tiáº¿p vÃ o application layer thÃ´ng qua use caseÂ `CreateUserUseCase`Â interface, chá»‹u trÃ¡ch nhiá»‡m
  - Äiá»u phá»‘i flow cá»§a chÆ°Æ¡ng trÃ¬nh - business flow nhÆ° thao tÃ¡c vá»›iÂ `UserRepository`Â Ä‘á»ƒ kiá»ƒm tra xem email cÃ³ tá»“n táº¡i chÆ°a. Thao tÃ¡c vá»›iÂ `RoleRepository`Â Ä‘á»ƒ kiá»ƒm tra role cÃ³ tá»“n táº¡i hay khÃ´ng.
  - Sau Ä‘Ã³ sáº½ tÆ°Æ¡ng tÃ¡c vá»›i domain layer Ä‘á»ƒ táº¡oÂ `User`Â entity (hayÂ `User`Â aggregate).
  - Sau Ä‘Ã³ sáº½ dÃ¹ng Repository Ä‘á»ƒ saveÂ `User`Â xuá»‘ng database vÃ  báº¯n event lÃªn Kafka.
- Khi use case thao tÃ¡c vá»›i domain layer thÃ¬ cÃ¡c business logics cá»§a use case nÃ y sáº½ Ä‘Æ°á»£c Ä‘áº£m báº£o trong domain layer (trong cÃ¡c model vÃ  service).
- VÃ  khi thao tÃ¡c vá»›i cÃ¡c thÃ nh pháº§n nhÆ° repository, event publisher (nhá»¯ng thÃ nh pháº§n bÃªn ngoÃ i) thÃ¬ use case chá»‰ thao tÃ¡c vá»›i interface (khÃ´ng bao giá» use case nhÃ¬n tháº¥y Ä‘Æ°á»£c implement chi tiáº¿t cá»§a infra).
- VÃ  cuá»‘i cÃ¹ng cÃ¡c implement chi tiáº¿t cá»§a database hay event publisher sáº½ náº±m á»Ÿ infrastructure layer.

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

`User` entity â‡’ entity chÃ­nh, trong DDD Ä‘Æ°á»£c xem lÃ  `aggregate root` cá»§a `User aggregate`

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

- `User` entity chá»©a cÃ¡c public method Ä‘á»ƒ thao tÃ¡c + cÃ¡c business logic
- CÃ¡c business logic cÃ³ thá»ƒ ká»ƒ Ä‘áº¿n:
  - XÃ³a user (markAsDeleted)
  - Active hay deactive user
  - Grant má»™t role nÃ o Ä‘Ã³ vÃ o user
  - â€¦

`UserName` lÃ  value object

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

Äá»ƒ Ä‘Äƒng kÃ½ UserCreatedEvent trong domain layer â‡’ táº¡o má»™t domain service Ä‘á»ƒ táº¡o User entity, handle business logic vÃ  register domain event

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

NgoÃ i ra, cÃ³ thá»ƒ dÃ¹ng factory method bÃªn trong domain object

```java

// User.java
@Getter
@Builder
public class User extends AggregateRoot<Id> {
    // ...

    // CÃ³ thá»ƒ dÃ¹ng Factory method á»Ÿ Ä‘Ã¢y Ä‘á»ƒ táº¡o User instance
    public static User createUser() {
         User user = User.builder()
                .name(new UserName(userDto.getName()))
                // ...

         user.registerEvent(new UserCreatedEvent(user));
         return user;
    }
}
```

**LÆ°u Ã½:**

- Äáº£m báº£o business logics: nghiá»‡p vá»¥ cáº§n design cáº©n tháº­n, táº­p trung táº¡i layer domain (vÃ  layer application)
- Nghiá»‡p vá»¥ liÃªn quan Ä‘áº¿n model nÃ o thÃ¬ nÃªn náº±m trÃªn model áº¥y. Nghiá»‡p vá»¥ káº¿t há»£p nhiá»u model (entity) thÃ¬ nÃªn táº¡o domain service, khÃ´ng thÃ¬ chuyá»ƒn vá» cÃ¡c service á»Ÿ layer application

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

    // ÄÃ¢y lÃ  flow chÃ­nh cá»§a request.
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

- Use case Ä‘iá»u khiá»ƒn flow cá»§a chÆ°Æ¡ng trÃ¬nh
- Use case dÃ¹ng cÃ¡c libs bÃªn ngoÃ i Ä‘á»ƒ tÆ°Æ¡ng tÃ¡c domain objects nhÆ°: database, 3rd services, message brokers, â€¦ â‡’ tuÃ¢n thá»§ dependency rule
- Äá»ƒ thao tÃ¡c database, náº¿u gá»i tháº³ng MySqlUserRepository â‡’ vi pháº¡m

â‡’ Sá»­ dá»¥ng **Dependency inversion principle,** thay vÃ¬ layer application phá»¥ thuá»™c layer ngoÃ i thÃ¬ cÃ¡c layer ngoÃ i pháº£i **phá»¥ thuá»™c qui Ä‘á»‹nh** á»Ÿ layer application

```java

// Táº§ng application sáº½ quy Ä‘á»‹nh nhá»¯ng interface trong UserRepositry
// Nhá»¯ng layer á»Ÿ ngoÃ i pháº£i implement interface nÃ y
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

Táº§ng nÃ y chÃ­nh lÃ  táº§ng bÃªn ngoÃ i, sáº½ lÃ  cÃ¡c implement chi tiáº¿t mÃ  cÃ¡c táº§ng bÃªn trong quy Ä‘á»‹nh báº±ng interface.

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

## 1. KhÃ¡i niá»‡m

**- Domain-Driven Design (DDD)** lÃ  phÆ°Æ¡ng phÃ¡p thiáº¿t káº¿ pháº§n má»m táº­p trung vÃ o:

> Hiá»ƒu nghiá»‡p vá»¥ tháº­t sÃ¢u â†’ rá»“i má»›i thiáº¿t káº¿ code theo nghiá»‡p vá»¥ Ä‘Ã³.

- DDD giÃºp trÃ¡nh tÃ¬nh tráº¡ng: Code **cháº¡y Ä‘Æ°á»£c** nhÆ°ng khÃ´ng pháº£n Ã¡nh **nghiá»‡p vá»¥**
- DDD hÆ°á»›ng tá»›i: **Code** == **nghiá»‡p vá»¥**

- DDD cÃ³ 2 thÃ nh pháº§n chÃ­nh:

- **Strategic Design**
  - TÃ¬m hiá»ƒu, phÃ¢n tÃ­ch, design `high level - view` cá»§a domain doanh nghiá»‡p
  - KhÃ´ng cÃ³ dÃ²ng code nÃ o
  - Dá»±a trÃªn cÃ¡c cÃ´ng cá»¥, thuáº­t ngá»¯: `subdomain`, `bounded context`, `event storming`, `context map`
- **Tactical Design**
  - Dá»±a trÃªn káº¿t quáº£ cá»§a Strategic Design â‡’ design cÃ¡c thá»© `low-level`
  - Design ra cÃ¡c `business logics`, `building blocks` nhÆ°: `Value object`, `Entity`, `Aggregate`, `Service`, â€¦

## 2. Domain

- Domain = lÄ©nh vá»±c nghiá»‡p vá»¥ há»‡ thá»‘ng giáº£i quyáº¿t

| System          | Domain             |
| --------------- | ------------------ |
| Shopee          | thÆ°Æ¡ng máº¡i Ä‘iá»‡n tá»­ |
| Galaxy Cinema   | Ä‘áº·t vÃ©             |
| Restaurant app  | Ä‘áº·t mÃ³n            |
| Hospital system | y táº¿               |

- Má»™t domain lá»›n â‡’ cÃ³ thá»ƒ thÃ nh cÃ¡c subdomain
- Subdomain cÃ³ thá»ƒ chia lÃ m 3 loáº¡i:
  - Core subdomains
  - Generic subdomains
  - Supporting subdomains

## 3. Business logic

VÃ­ dá»¥!

Team báº¡n nháº­n má»™t dá»± Ã¡n tá»« khÃ¡ch hÃ ng (má»™t cÃ´ng ty truyá»n thÃ´ng á»Ÿ ÄÃ´ng LÃ o).

VÃ  yÃªu cáº§u cá»§a há» lÃ  táº¡oÂ `má»™t trang bÃ¡o Ä‘iá»‡n tá»­`Â (giá»‘ng 24h hay vnexpress áº¥y cÃ¡c báº¡n). VÃ  khi khÃ¡ch hÃ ng truyá»n táº£iÂ `requirement`Â vá» cho cÃ¡c báº¡n. Há» sáº½ cÃ³ má»™t sá»‘ lá»i nÃ³i khÃ¡ quen thuá»™c nhÆ° sau (mÃ¬nh nÃ³i vá» context User):

- Má»—i user chá»‰ cÃ³ 1 email duy nháº¥t vÃ  khÃ´ng trÃ¹ng vá»›i user khÃ¡c
- Khi táº¡o user thÃ¬ máº·c Ä‘á»‹nh sáº½ cÃ³ role lÃ  Subscriber.
- CÃ³ 3 system roles: Admin, Author, Subscriber.
- User admin cÃ³ thá»ƒ táº¡o Ä‘Æ°á»£c Role.
- User admin cÃ³ quyá»n táº¡o thÃªm roles.
- Role thÃ¬ khÃ´ng Ä‘Æ°á»£c trÃ¹ng tÃªn (unique) vá»›i nhau.
- KhÃ´ng Ä‘Æ°á»£c chá»‰nh sá»­a system role.
- Role name chá»‰ Ä‘Æ°á»£c chá»©a kÃ½ tá»± a-z, A-Z, 0-9 vÃ  \_.
- Role name chá»‰ cÃ³ Ä‘á»™ dÃ i tá»‘i thiá»ƒu lÃ  3 kÃ½ tá»±, tá»‘i Ä‘a 100 kÃ½ tá»±.
- â€¦

Hoáº·c trong má»™t á»©ng dá»¥ngÂ `Food Ordering`:

- Khi má»›i táº¡o má»™t Ä‘Æ¡n hÃ ng (order) thÃ¬ tráº¡ng thÃ¡i (status) cá»§a nÃ³ sáº½ lÃ Â `pending`.
- Total price cá»§a má»™t Ä‘Æ¡n hÃ ng khÃ´ng Ä‘Æ°á»£c nhá» hÆ¡n 0.
- Khi payment (thanh toÃ¡n) tháº¥t báº¡i, tráº¡ng thÃ¡i cuá»‘i cÃ¹ng cá»§a Ä‘Æ¡n hÃ ng sáº½ lÃ Â `canceled`.
- Khi payment thÃ nh cÃ´ng vÃ  hÃ ng trong kho cÃ²n Ä‘á»§ sá»‘ lÆ°á»£ng cho Ä‘Æ¡n hÃ ng thÃ¬ tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng sáº½ lÃ Â `approved`.

Äáº¥y, táº¥t cáº£ cÃ¡c gáº¡ch Ä‘áº§u dÃ²ng trÃªn, lÃ Â `business logics`! Dá»… hiá»ƒu pháº£i khÃ´ng cÃ¡c báº¡n.

VÃ  cÃ³ má»™t Ä‘iá»u cÃ¡c báº¡n pháº£i lÆ°u Ã½:

- Business logics lÃ  cÃ¡i thá»­ ráº¥tÂ `dá»… thay Ä‘á»•i vÃ  má»Ÿ rá»™ng`. VÃ¬ sáº£n pháº©m cá»§a cÃ¡c báº¡n pháº£i Ä‘Ã¡p á»©ng Ä‘Æ°á»£c nhu cáº§u cá»§a khÃ¡ch hÃ ng (khÃ¡ch hÃ ng lÃ  thÆ°á»£ng Ä‘áº¿ láº¡i cÃ²n khÃ³ tÃ­nh). CÃ ng phÃ¡t triá»ƒn thÃ¬ nhu cáº§u cá»§a khÃ¡ch hÃ ng cÃ ng thay Ä‘á»•i vÃ  má»Ÿ rá»™ng nhiá»u hÆ¡n.

â‡’ **Trong DDD, cÃ¡c business logic sáº½ Ä‘Æ°á»£c Ä‘áº·t trongÂ `core domain layer`. Cá»¥ thá»ƒ lÃ  trong cÃ¡c value object, entity, aggregate, domain service**.

- Táº¥t cáº£ business logic Ä‘á»u táº­p trung vÃ o core domain cá»§a nÃ³. Hiá»ƒu Ä‘Æ¡n giáº£n lÃ  cÃ³ má»™t layer lÃ  domain, táº¥t cáº£ logic nghiá»‡p vá»¥ sáº½ Ä‘Æ°á»£c viáº¿t trong layer nÃ y. Khi káº¿t há»£p vá»›i hexagonal, onion hay clean architecture, nÃ³ thÆ°á»ng náº±m á»Ÿ layerÂ `domain`. TÃ¡ch biá»‡t hoÃ n toÃ n so vá»›i cÃ¡c layer khÃ¡c vÃ  khÃ´ng phá»¥ thuá»™c vÃ o báº¥t cá»© layer hay cÃ´ng nghá»‡ nÃ o vÃ­ dá»¥ database, message queue, UI, API, ... MÃ  cÃ¡c layer khÃ¡c pháº£iÂ `implement`Â layerÂ `domain`Â nÃ y. ÄÃ¢y lÃ  Ä‘áº£o ngÆ°á»£c sá»± phá»¥ thuá»™c.

## 4. Ubiquitous Language

- NgÃ´n ngá»¯ chung giá»¯a **domain expert team**, **devs team** vÃ  cÃ¡c team liÃªn quan

VÃ­ dá»¥:

KhÃ´ng dÃ¹ng:

`createOrder()`

DÃ¹ng:

`placeOrder()`

## 5. Bounded Context

PhÃ¢n chia cÃ¡c domain logics, ubiquitous language thÃ nh cÃ¡c `context` nhá» hÆ¡n

VÃ­ dá»¥: Trang bÃ¡o Ä‘iá»‡n tá»­

- `User bounded context`: NÆ¡i chá»©a logic nghiá»‡p vá»¥ liÃªn quan tá»›i users, cÃ¡c tá»« ngá»¯ liÃªn quan tá»›i users, roles.
- `Post bounded context`: Chá»©a logic nghiá»‡p vá»¥ liÃªn quan tá»›i cÃ¡c bÃ i post, â€¦
- Sá»‘ lÆ°á»£ngÂ `user`Â xem bÃ i post abc nÃ y trong má»™t thÃ¡ng 100 users. ThÃ¬ Ã½ nghÄ©a cá»§aÂ `user trong post context`Â sáº½ khÃ¡c vá»›iÂ `user trong user context`. RÃµ rÃ ng user trong user context thÃ¬ nÃ³ Ä‘ang Ä‘á» cáº­p tá»›i, user admin, author, subscriber, hay cÃ³ role lÃ  gÃ¬, ... CÃ²n user trong post context Ä‘Æ¡n giáº£n lÃ  user Ä‘Ã£ xem bÃ i post á»Ÿ ngoÃ i thÃ´i.

â‡’ ÄÃ³ chÃ­nh lÃ  **`bounded context`**

![image.png](image.png)

## 6. Layer architecture

- SÆ¡ khai: 1 Ä‘á»‘ng code vÃ o 1 hoáº·c 1 vÃ i file (1 file lÃ m táº¥t cáº£ tá»« controller, business logic, persist data, view, â€¦) â‡’ Ã”ng cha phÃ¡t minh ra layer architecture báº±ng cÃ¡ch chia nhá» nhiá»u layer nhá» hÆ¡n. Má»—i layer lÃ m má»™t viá»‡c duy nháº¥t nhÆ°: UI layer, application layer, domain layer, infrastructure layer, â€¦

â‡’ Sá»± ra Ä‘á»i cá»§a cÃ¡c architecture: hexagonal, onion hay clean architecture

- DDD táº­p trung háº¿t core business logic vÃ o 1 â€œnÆ¡iâ€ duy nháº¥t â‡’ DDD sáº½ káº¿t há»£p vá»›i cÃ¡c layer architecture Ä‘á»ƒ triá»ƒn khai

## 7. Event sourcing

## 8. Modeling skill

**Modeling skill = kháº£ nÄƒng biáº¿n nghiá»‡p vá»¥ ngoÃ i Ä‘á»i thÃ nh object trong code Ä‘Ãºng cÃ¡ch.**

VÃ­ dá»¥:

âŒ Primitive style

```
String email
String phone
int money
```

âœ… DDD style

```
Email
PhoneNumber
Money
```

Model Ä‘Ãºng giÃºp:

- code dá»… Ä‘á»c
- logic rÃµ rÃ ng
- validation náº±m Ä‘Ãºng chá»—
- domain express rÃµ business meaning

## 9. Data transfer object (DTO)

- Object dÃ¹ng Ä‘á»ƒ chuyá»ƒn data Ä‘i qua cÃ¡c layer trong vÃ²ng Ä‘á»i cá»§a 1 business flow

```java

// UserDto.java
// Object Ä‘Æ¡n giáº£n thÃ´i chá»© thá»±c táº¿ nhiá»u fields hÆ¡n nha.
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

- **`Value object`** lÃ  1 object, dÃ¹ng Ä‘á»ƒ chá»©a dá»¯ liá»‡u
- **`Immutable` -** báº¥t biáº¿n â‡’ khá»Ÿi táº¡o value obj thÃ¬ khÃ´ng thá»ƒ thay Ä‘á»•i data bÃªn trong â‡’ dá»¯ liá»‡u toÃ n váº¹n - khÃ´ng thay Ä‘á»•i trong vÃ²ng Ä‘á»i 1 business flow
- KhÃ´ng cÃ³ cÃ¡c public **setter**, cÃ¡c **properties** lÃ  read-only
- 2 value obj cÃ³ dá»¯ liá»‡u giá»‘ng nhau â‡’ báº±ng nhau
- CÃ¡c business logic liÃªn quan â‡’ Ä‘áº·t bÃªn trong cÃ¡c value obj

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

        // NgoÃ i ra cÃ²n cÃ¡c business logic khÃ¡c nhÆ°:
        // username khÃ´ng Ä‘Æ°á»£c chá»©a cÃ¡c kÃ½ tá»± Ä‘áº·c biá»‡t
        // ...

        this.value = value;
    }
}
```

Khi muá»‘n dÃ¹ng value obj UserName

```java

// Khá»Ÿi táº¡o má»™t value object
UserName userName = new UserName("lenhatthanh20");

// Báº¡n khÃ´ng thá»ƒ thay Ä‘á»•i data bÃªn trong nÃ³ ná»¯a
userName.setValue("admin"); // Äiá»u nÃ y khÃ´ng cho phÃ©p
```

â‡’ Khi 1 value obj Ä‘Æ°á»£c táº¡o thÃ nh cÃ´ng â‡’ táº¥t cáº£ business logic liÃªn quan tá»›i obj Ä‘Ã³ Ä‘Ã£ Ä‘Æ°á»£c thá»a mÃ£n â‡’ dá»¯ liá»‡u trong value obj khÃ´ng Ä‘Æ°á»£c thay Ä‘á»•i Ä‘Æ°á»£c ná»¯a â‡’ **`data consistency`**

## 11. Entity

- CÅ©ng lÃ  object y nhÆ° value object
- CÃ³ **Ä‘á»‹nh danh** (ID)
- CÃ³ setter
- ThÆ°á»ng dÃ¹ng Ä‘á»ƒ chá»©a dá»¯ liá»‡u vÃ  lÆ°u xuá»‘ng DB
- Business logic liÃªn quan â‡’ Ä‘áº·t bÃªn trong entity

```java

// MÃ¬nh cÃ³ má»™t file Entity.java Ä‘á»ƒ dÃ¹ng chung cho táº¥t cáº£ cÃ¡c entity
// Base class Entity.java
@Getter
@AllArgsConstructor
public class Entity<Type> {
    private Type id;
}

// VÃ  Ä‘Ã¢y lÃ  má»™t entity trong DDD
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
        // Má»™t sá»‘ business logic cÃ³ thá»ƒ náº±m á»Ÿ Ä‘Ã¢y
        this.name = name;
    }

    public void updateRoleDescription(RoleDescription name) {
        // Má»™t sá»‘ business logic cÃ³ thá»ƒ náº±m á»Ÿ Ä‘Ã¢y
        this.description = description;
    }

    public static Role create(
            Id id,
            RoleName name,
            RoleDescription description
    ) {
        // Má»™t sá»‘ business logic cÃ³ thá»ƒ náº±m á»Ÿ Ä‘Ã¢y
        Role role = new Role(id, name, description);

        return role;
    }
}
```

- Khi táº¡o thÃ nh cÃ´ng 1 entity â‡’ táº¥t cáº£ **business logic** liÃªn quan Ä‘Æ°á»£c thá»a máº¡n â‡’ **`data consistency`**

## 12. Domain service

- CÃ¡c business logic táº­p trung vÃ o `domain layer` , cá»¥ thá»ƒ: `value object`, `entity`, `aggregate`, `domain service`
- Trong layer architecture, má»—i layer sáº½ cÃ³ cÃ¡c service cá»§a layer Ä‘Ã³ â‡’ `domain service` chá»©a cÃ¡c logic phá»¥c vá»¥ `layer domain` â‡’ **Logic á»Ÿ Ä‘Ã¢y lÃ  business logic**
- Khi cÃ¡c business logic khÃ´ng biáº¿t Ä‘áº·t á»Ÿ Ä‘Ã¢u (value object, entity, aggregate) â‡’ Ä‘áº·t á»Ÿ domain service

VÃ­ dá»¥: Use case táº¡o má»™t role cÃ³ 1 business logic sau: Khi táº¡o má»›i má»™t role, tÃªn cá»§a role má»›i nÃ y báº¯t buá»™c khÃ´ng Ä‘Æ°á»£c trÃ¹ng tÃªn vá»›i báº¥t kÃ¬ role nÃ o trong há»‡ thá»‘ng.

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

    // ÄÃ¢y lÃ  business logic mÃ¬nh vá»«a Ä‘á» cáº­p
    // VÃ  mÃ¬nh Ä‘áº·t logic nÃ y trong domain service.
    private void roleNameDoesNotExistOrError(String name) {
        Optional<Role> role = roleRepository.findByName(name);
        if (role.isPresent()) {
            throw new RoleAlreadyExistException();
        }
    }
}
```

## 13. Aggregate

XÃ©t usecase: **Táº¡o comment cá»§a 1 bÃ i bÃ¡o (post)**

Má»™t sá»‘ business logic:

- Khi táº¡o comment, náº¿u user khÃ´ng tá»“n táº¡i thÃ¬ sáº½ bÃ¡o lá»—i cho ngÆ°á»i dÃ¹ng.
- Khi xÃ³a bÃ i bÃ¡o thÃ¬ táº¥t cáº£ comment sáº½ bá»‹ xÃ³a theo.
- Tá»•ng sá»‘ lÆ°á»£ng comment trong 1 bÃ i bÃ¡o lÃ  100 (lÆ°u Ã½ Ä‘Ã¢y chá»‰ lÃ  logic vÃ­ dá»¥ - khÃ´ng pháº£i logic trong production application). Náº¿u quÃ¡ 100 thÃ¬ sáº½ bÃ¡o lá»—i cho ngÆ°á»i dÃ¹ng

```java

// CHÆ¯A ÃP Dá»¤NG DDD
// á»ž TRONG Má»˜T FILE SERVICE NÃ€O ÄÃ“ Cá»¦A Báº N
// commentDto: userId, postId, content

// DÆ°á»›i Ä‘Ã¢y sáº½ lÃ  cÃ¡c step cÃ¡c báº¡n hay lÃ m:

// STEP 1. Kiá»ƒm tra xem user cÃ³ táº¡i hay khÃ´ng.
this.checkingUserExistOrError(userId);

// CÃ²n nhiá»u business logic khÃ¡c á»Ÿ Ä‘Ã¢y: quyá»n, ...

// STEP 2. Kiá»ƒm tra POST cÃ³ tá»“n táº¡i hay khÃ´ng.
Post post = getPostOrError(postId);

// STEP 3. Kiá»ƒm tra sá»‘ lÆ°á»£ng comments cá»§a POST
// Hoáº·c á»Ÿ Ä‘Ã¢y báº¡n hay Ä‘áº¿m sá»‘ lÆ°á»£ng comments tá»« database
if (post.getComments().size() >= 100) {
    throw new PostCommentLimitException();
}
// Check má»™t sá»‘ business logic khÃ¡c ná»¯a.

// STEP 4. Save comment xuá»‘ng:
Comment comment = new CommentEntity(...);
commentRepository.save(comment); // LÆ°u xuá»‘ng DB
```

Khi cÃ³ 1 usecase khÃ¡c `add comment` khÃ¡c usecase á»Ÿ trÃªn â‡’ dev thao tÃ¡c vá»›i `Post model` vÃ  quÃªn logic á»Ÿ step 3 (lÃ m sai), `add comment` trá»±c tiáº¿p, lÆ°u láº¡i á»Ÿ step 5 â‡’ vi pháº¡m business logic 101 comment â‡’ **`data inconsistency`**

- Aggregate giÃºp cho data nháº¥t quÃ¡n. Khi 1 aggregate táº¡o thÃ nh cÃ´ng â‡’ thá»a mÃ£n táº¥t cáº£ business logic liÃªn quan tá»›i nÃ³ â‡’ consistency
- Aggregate ra Ä‘á»i â‡’ handle inconsistency data trong business flow cá»§a app

```java
// Post.java
// `Post` chÃ­nh lÃ  aggregate root.
// Äá»ƒ thao tÃ¡c vá»›i cÃ¡c thÃ nh pháº§n bÃªn trong nhÆ° entity `Comment`
// thÃ¬ táº¥t cáº£ pháº£i thÃ´ng qua aggregate root.
// VÃ­ dá»¥ thao tÃ¡c `add comment`
public class Post extends AggregateRoot<Id> {

    // ÄÃ¢y lÃ  property `comments` Ä‘á»ƒ chá»©a comment trong aggregate.
    // NÃ³ thá»ƒ hiá»‡n má»‘i quan há»‡ - object relationship.
    // Má»—i post sáº½ cÃ³ nhiá»u comments á»Ÿ bÃªn trong nÃ³.
    // VÃ  `Comment` chÃ­nh lÃ  má»™t entity
    private List<Comment> comments = new ArrayList<>();

    // Method nÃ y náº±m bÃªn trong aggregate root
    public void addComment(String content, String userId) {
        // True invariants here (Ä‘Ã¢y lÃ  logic buá»™c pháº£i thÃµa mÃ£n)
        // Táº¥t cáº£ comment pháº£i nhá» hÆ¡n hoáº·c báº±ng 100.
        if (this.comments.size() > MAX_COMMENT) {
            throw new CommentLimitExceededException();
        }

        // VÃ­ dá»¥ cÃ²n má»™t sá»‘ business logic khÃ¡c pháº£i thá»a nhÆ°:
        // Khi bÃ i post á»Ÿ tráº¡ng thÃ¡i DRAFT, khÃ´ng thá»ƒ add comment
        // VÃ­ dá»¥:
        if (this.status != 'DRAFT') {
            throw new CommentPermissionException();
        }

        // ... vÃ  nhiá»u logic á»Ÿ Ä‘Ã¢y ná»¯a

        Comment comment = new Comment(
            newId(UniqueIdGenerator.create()),
            content,
            new Id(userId)
        );
        this.comments.add(comment);
}

// Domain service AddCommentService.java (hoáº·c application service)
// VÃ  á»Ÿ ngoÃ i domain service chÃºng ta sáº½ lÃ m nhÆ° sau:
// 1. Kiá»ƒm tra xem user cÃ³ táº¡i hay khÃ´ng.
this.checkingUserExistOrError(userId);

// 2. Kiá»ƒm tra post cÃ³ tá»“n táº¡i hay khÃ´ng.
Post post = getPostOrError(postId); // Load aggregate

// 3. ThÃªm comment vÃ o post:
post.addComment(
    commentDto.getContent(),
    user.get().getId().toString()
);

// Sau khi trÃ£i qua step 3, toÃ n bá»™ business logic sáº½ Ä‘Æ°á»£c thá»a mÃ£n.

// 4. LÆ°u post:
postRepository.save(post); // LÆ°u xuá»‘ng DB
```

CÃ¡c **tÃ­nh cháº¥t** vÃ  **rule** cá»§a Aggregate:

- Aggregate lÃ  táº­p há»£p nhiá»u entity, value object cÃ³ liÃªn quan tá»›i nhau.
- Trong aggregate sáº½ cÃ³ má»™tÂ `aggregate root`. (Aggregate root cÅ©ng lÃ  má»™t entity).
- Aggregate sáº½ cÃ³ má»™t ID (gá»i lÃ Â `global ID`).
- CÃ¡c aggregate giao tiáº¿p vá»›i bÃªn ngoÃ i chá»‰ thÃ´ng qua global ID.
- CÃ¡c object bÃªn trong aggregate tuyá»‡t Ä‘Æ°á»£c khÃ´ng Ä‘Æ°á»£c giao tiáº¿p vá»›i bÃªn ngoÃ i. Táº¥t cáº£ pháº£i thÃ´ng qua aggregate root.
- **Dá»¯ liá»‡u bÃªn trong aggregate sáº½ Ä‘Æ°á»£c toÃ n váº¹n vÃ  nháº¥t quÃ¡n (consistency)**.
- Khi save Aggregate pháº£i theo cÆ¡ cháº¿ Atomic: Táº¥t cáº£ thÃ´ng tin trong aggregate pháº£i Ä‘Æ°á»£c save xuá»‘ng thÃ nh cÃ´ng táº¥t cáº£ hoáº·c táº¥t cáº£ tháº¥t báº¡i. VÃ  khi cÃ³ cÃ¡c request Ä‘á»“ng thá»i, pháº£i xá»­ lÃ½ cho chuáº©n -Â `concurrency requests`. Chá»• nÃ y liÃªn quan tá»›i xá»­ lÃ½Â `concurrency requests`Â theo cÃ¡c cÆ¡ cháº¿ nhÆ°Â `optimistic locks`Â hayÂ `pessimist lock`Â vÃ Â `transaction`
- Khi lÃ m viá»‡c vá»›i aggregate, Ä‘á»«ng nghÄ© tá»›i database relationship. MÃ  hÃ£y nghÄ© tá»›i object relationship.

![image.png](image%201.png)

```java

// Post.java
// ÄÃ¢y lÃ  Aggregate root
@Getter
@Setter
public class Post extends AggregateRoot<Id> {
    private Title title;
    private PostContent content;
    private Id userId;
    private Summary summary;
    private Slug slug;
    private List<Comment> comments = new ArrayList<>();
    // Tháº­t ra cÃ²n nhiá»u properties khÃ¡c á»Ÿ Ä‘Ã¢y ná»¯a

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

- Rule 1: Dá»±a trÃªn cÃ¡c business logic luÃ´n Ä‘Ãºng - `True Invariants`
- Rule 2: Aggregate nÃªn nhá» nháº¥t cÃ³ thá»ƒ
- Rule 3: Giao tiáº¿p vá»›i Aggregate khÃ¡c báº±ng global ID

![image.png](image%202.png)

- Rule 4: NÃªn dÃ¹ng `Eventual consistency`

## 14. Domain event

- LÃ  sá»± thá»ƒ hiá»‡n cá»§a má»™t viá»‡c **Ä‘Ã£ xáº£y ra** trong Domain Layer (VÃ­ dá»¥: táº¡o User thÃ nh cÃ´ng sinh ra event `UserCreatedEvent`)
- **CÆ¡ cháº¿ hoáº¡t Ä‘á»™ng:** Báº¯n event ra vÃ  khÃ´ng cáº§n quan tÃ¢m ai xá»­ lÃ½. Má»™t Aggregate hoáº·c Bounded Context khÃ¡c sáº½ Ä‘Ã³ng vai trÃ² "há»©ng" (Subscribe/Listen) event Ä‘Ã³ Ä‘á»ƒ xá»­ lÃ½ nghiá»‡p vá»¥ tiáº¿p theo.
- Eventual Consistency: sá»± Ä‘Ã¡nh Ä‘á»•i khi dÃ¹ng xá»­ lÃ½ báº¥t Ä‘á»“ng bá»™ (async), thÆ°á»ng thÃ´ng qua **Message Queue** (nhÆ° Kafka). Dá»¯ liá»‡u khÃ´ng nháº¥t quÃ¡n ngay láº­p tá»©c mÃ  sáº½ "nháº¥t quÃ¡n sau má»™t lÃºc ná»¯aâ€
  - **VÃ­ dá»¥ 1 (XÃ³a BÃ i):** Nháº¥n xÃ³a `Post` -> Tráº£ response thÃ nh cÃ´ng ngay láº­p tá»©c -> Báº¯n `PostDeletedEvent` -> `Comment` aggregate há»©ng event vÃ  tiáº¿n hÃ nh xÃ³a comment ngáº§m á»Ÿ background.
  - **VÃ­ dá»¥ 2 (Microservices):** `Order Service` táº¡o Ä‘Æ¡n thÃ nh cÃ´ng -> Báº¯n `OrderCreatedEvent` -> `Payment Service` (vÃ  cÃ¡c service khÃ¡c) há»©ng event Ä‘á»ƒ tiáº¿p tá»¥c quy trÃ¬nh.
- Domain Event thÆ°á»ng Ä‘Æ°á»£c Ä‘Äƒng kÃ½ (register) ngay bÃªn trong **Aggregate Root**.
- TÃ¹y thuá»™c vÃ o thiáº¿t káº¿ cá»¥ thá»ƒ, cÅ©ng cÃ³ thá»ƒ Ä‘Äƒng kÃ½ bÃªn trong **Domain Service** miá»…n sao há»£p lÃ½ vá»›i luá»“ng nghiá»‡p vá»¥.

```java

// HÃ m nÃ y bÃªn trong Post.java (aggregate root)
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

    // Khi táº¡o post thÃ¬ sáº½ Ä‘Äƒng kÃ½ má»™t event
    post.registerEvent(new PostCreatedEvent(post));

    return post;
}

// VÃ  á»Ÿ Ä‘Ã¢u Ä‘Ã³ trong layer repository
// Khi persist DB xong event sáº½ Ä‘Æ°á»£c tá»± Ä‘á»™ng báº¯n Ä‘i
// Hoáº·c báº¡n cÃ³ thá»ƒ báº¯n event trong Domain service (tÃ¹y báº¡n)
// NÃ¢ng cao hÆ¡n thÃ¬ viá»‡c commit DB
//     + publish event nÃ³ cÃ²n dÃ­nh tá»›i transaction.
// Báº¡n tá»± tÃ¬m hiá»ƒu thÃªm nha
// MÃ¬nh vÃ­ dá»¥ náº¿u save DB khÃ´ng thÃ nh cÃ´ng thÃ¬ khÃ´ng Ä‘Æ°á»£c báº¯n event Ä‘i nha.
// Khi báº¯n event Ä‘i tháº¥t báº¡i thÃ¬ pháº£i xá»­ lÃ½ nhÆ° tháº¿ nÃ o?
// vÃ¢n vÃ¢n mÃ¢y mÃ¢y
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

// VÃ  Ä‘Ã¢y lÃ  nÆ¡i nháº­n Ä‘Æ°á»£c event.
// MÃ¬nh báº¯n event vÃ o Kafka Ä‘á»ƒ sync data qua redis
// á»ž Ä‘Ã¢y sáº½ lÃ  ngoÃ i pháº¡m vi cá»§a domain layer nha.
// Domain layer chá»‰ cÃ³ nhiá»‡m vá»¥ báº¯n domain event Ä‘i thÃ´i.
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

- Khi lÃ m viá»‡c vá»›i DDD thÃ´ng thÆ°á»ng sáº½ káº¿t há»£p vá»›i cÃ¡c layer architected.
- Business logic sáº½ táº­p trung á»Ÿ duy nháº¥t má»™t nÆ¡i gá»i lÃ Â `core domain layer`.
- Unit test riÃªng biá»‡t cho domain layer luÃ´n Ä‘á»ƒ verify cÃ¡c business logic vÃ¬ domain layer khÃ´ng phá»¥ thuá»™c vÃ o cÃ¡c layer khÃ¡c.
- VÃ  cÃ¡c layer khÃ¡c pháº£i dá»±a trÃªn domain layer Ä‘á»ƒ mÃ  implement. VÃ­ dá»¥ trong hexagonal architecture, báº¡n sáº½ thiáº¿t káº¿ cÃ¡c input ports vÃ  output ports. Cá»¥ thá»ƒ nÃ³ cÃ³ thá»ƒ lÃ  cÃ¡c interface cá»§a domain layer. VÃ  cÃ¡c layer khÃ¡c muá»‘n giao tiáº¿p vá»›i domain layers sáº½ pháº£i implement cÃ¡c interfaces nÃ y. ÄÃ¢y lÃ  Ä‘áº£o ngÆ°á»£c sá»± phá»¥ thuá»™c (Inversion of control).


