import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { Practice2dSession } from '../../../domain/aggregates/practice2d/practice2d-session.aggregate';
import { Practice2dSessionNotFoundException } from '../../../domain/exceptions/practice2d.exceptions';
import { Practice2dSessionRepository } from '../../../domain/repositories/practice2d-session.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import {
  EndPractice2dSessionCommand,
  IngestPractice2dTelemetryCommand,
  StartPractice2dSessionCommand,
} from './practice2d.commands';
import {
  Practice2dFeedbackResult,
  Practice2dSessionResult,
} from './practice2d.result';

@Injectable()
export class StartPractice2dSessionUseCase
  implements IUseCase<StartPractice2dSessionCommand, Practice2dSessionResult>
{
  constructor(private readonly repository: Practice2dSessionRepository) {}

  async execute(
    command: StartPractice2dSessionCommand,
  ): Promise<Practice2dSessionResult> {
    const session = Practice2dSession.create(command);
    await this.repository.save(session);
    return Practice2dSessionResult.fromAggregate(session);
  }
}

@Injectable()
export class IngestPractice2dTelemetryUseCase
  implements
    IUseCase<IngestPractice2dTelemetryCommand, Practice2dFeedbackResult>
{
  constructor(private readonly repository: Practice2dSessionRepository) {}

  async execute(
    command: IngestPractice2dTelemetryCommand,
  ): Promise<Practice2dFeedbackResult> {
    const session = await this.repository.findById(command.sessionId);
    if (!session)
      throw new Practice2dSessionNotFoundException(command.sessionId);
    session.assertOwner(command.studentId);
    const feedback = session.ingestTelemetry({
      type: command.type,
      speedKmh: command.speedKmh,
      laneOffset: command.laneOffset,
      collision: command.collision,
      signal: command.signal,
      payload: command.payload,
    });
    await this.repository.save(session);
    return {
      id: feedback.id,
      telemetryType: feedback.telemetryType,
      errorCode: feedback.errorCode,
      severity: feedback.severity,
      penalty: feedback.penalty,
      message: feedback.message,
      hint: feedback.hint,
      occurredAt: feedback.occurredAt,
    };
  }
}

@Injectable()
export class EndPractice2dSessionUseCase
  implements IUseCase<EndPractice2dSessionCommand, Practice2dSessionResult>
{
  constructor(
    private readonly repository: Practice2dSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(
    command: EndPractice2dSessionCommand,
  ): Promise<Practice2dSessionResult> {
    const session = await this.repository.findById(command.sessionId);
    if (!session)
      throw new Practice2dSessionNotFoundException(command.sessionId);
    session.assertOwner(command.studentId);
    session.end(command.abandoned);
    await this.repository.save(session);
    const events = session.getDomainEvents();
    session.clearDomainEvents();
    await this.eventPublisher.publishAll(events);
    return Practice2dSessionResult.fromAggregate(session);
  }
}

@Injectable()
export class GetPractice2dSessionUseCase
  implements
    IUseCase<{ sessionId: string; studentId: string }, Practice2dSessionResult>
{
  constructor(private readonly repository: Practice2dSessionRepository) {}

  async execute(query: {
    sessionId: string;
    studentId: string;
  }): Promise<Practice2dSessionResult> {
    const session = await this.repository.findById(query.sessionId);
    if (!session) throw new Practice2dSessionNotFoundException(query.sessionId);
    session.assertOwner(query.studentId);
    return Practice2dSessionResult.fromAggregate(session);
  }
}
