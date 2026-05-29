import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { ExamSessionResult } from '../shared/exam-session.result';
import { finalizeExpiredSessionIfNeeded } from '../shared/finalize-expired-session';
import { GetSessionResultQuery } from './get-session-result.query';

@Injectable()
export class GetSessionResultUseCase
  implements IUseCase<GetSessionResultQuery, ExamSessionResult>
{
  constructor(
    private readonly sessionRepository: ExamSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(query: GetSessionResultQuery): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (!session) {
      throw new ExamSessionNotFoundException('Exam result not found. (MSG54)');
    }
    session.assertOwner(query.studentId);
    await finalizeExpiredSessionIfNeeded(
      session,
      this.sessionRepository,
      this.eventPublisher,
    );
    session.ensureFinished();
    return ExamSessionResult.fromAggregate(session, true);
  }
}
