import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { ExamSessionResult } from '../shared/exam-session.result';
import { GetSessionResultQuery } from './get-session-result.query';

@Injectable()
export class GetSessionResultUseCase
  implements IUseCase<GetSessionResultQuery, ExamSessionResult>
{
  constructor(private readonly sessionRepository: ExamSessionRepository) {}

  async execute(query: GetSessionResultQuery): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (!session) throw new ExamSessionNotFoundException(query.sessionId);
    session.assertOwner(query.studentId);
    session.ensureFinished();
    return ExamSessionResult.fromAggregate(session, true);
  }
}
