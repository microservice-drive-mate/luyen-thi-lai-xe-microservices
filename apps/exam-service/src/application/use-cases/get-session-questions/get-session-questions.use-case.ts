import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionNotFoundException } from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { ExamSessionResult } from '../shared/exam-session.result';
import { GetSessionQuestionsQuery } from './get-session-questions.query';

@Injectable()
export class GetSessionQuestionsUseCase
  implements IUseCase<GetSessionQuestionsQuery, ExamSessionResult>
{
  constructor(private readonly sessionRepository: ExamSessionRepository) {}

  async execute(query: GetSessionQuestionsQuery): Promise<ExamSessionResult> {
    const session = await this.sessionRepository.findById(query.sessionId);
    if (!session) throw new ExamSessionNotFoundException(query.sessionId);
    session.assertOwner(query.studentId);
    return ExamSessionResult.fromAggregate(session);
  }
}
