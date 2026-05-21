import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { ExamSessionResult } from '../shared/exam-session.result';
import { SubmitSessionCommand } from './submit-session.command';

@Injectable()
export class SubmitSessionUseCase
  implements IUseCase<SubmitSessionCommand, ExamSessionResult>
{
  constructor(
    private readonly sessionRepository: ExamSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: SubmitSessionCommand): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) throw new ExamSessionNotFoundException(command.sessionId);
    session.assertOwner(command.studentId);
    session.submit();
    await this.sessionRepository.save(session);
    const events = session.getDomainEvents();
    session.clearDomainEvents();
    await this.eventPublisher.publishAll(events);
    return ExamSessionResult.fromAggregate(session, true);
  }
}
