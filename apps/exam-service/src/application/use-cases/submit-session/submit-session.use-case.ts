import { Injectable } from '@nestjs/common';
import { IUseCase, MetricsService } from '@repo/common';
import { ExamSessionStatus } from '../../../domain/aggregates/exam-session/exam-session.types';
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
    private readonly metricsService: MetricsService,
  ) {}

  async execute(command: SubmitSessionCommand): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      throw new ExamSessionNotFoundException('Exam attempt not found. (MSG46)');
    }
    session.assertOwner(command.studentId);
    if (session.status !== ExamSessionStatus.IN_PROGRESS) {
      return ExamSessionResult.fromAggregate(session, true);
    }

    session.submit();
    await this.sessionRepository.save(session);
    const events = session.getDomainEvents();
    session.clearDomainEvents();
    await this.eventPublisher.publishAll(events);
    this.metricsService.recordExamSessionCompleted({
      licenseCategory: session.licenseCategory,
      status: session.status,
      result:
        session.isPassed === null
          ? 'unknown'
          : session.isPassed
            ? 'pass'
            : 'fail',
      failedByCritical: session.failedByCritical,
    });
    return ExamSessionResult.fromAggregate(session, true);
  }
}
