import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { ExamSessionResult } from '../shared/exam-session.result';
import { finalizeExpiredSessionIfNeeded } from '../shared/finalize-expired-session';
import { GetSessionQuestionsQuery } from './get-session-questions.query';

@Injectable()
export class GetSessionQuestionsUseCase
  implements IUseCase<GetSessionQuestionsQuery, ExamSessionResult>
{
  constructor(
    private readonly sessionRepository: ExamSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(query: GetSessionQuestionsQuery): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (!session) throw new ExamSessionNotFoundException();
    session.assertOwner(query.studentId);
    await finalizeExpiredSessionIfNeeded(
      session,
      this.sessionRepository,
      this.eventPublisher,
    );
    return ExamSessionResult.fromAggregate(session);
  }
}
