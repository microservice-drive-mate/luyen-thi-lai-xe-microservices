import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import {
  ExamSessionResult,
  ListExamSessionsResult,
} from '../shared/exam-session.result';
import { ListSessionsQuery } from './list-sessions.query';

@Injectable()
export class ListSessionsUseCase
  implements IUseCase<ListSessionsQuery, ListExamSessionsResult>
{
  constructor(private readonly sessionRepository: ExamSessionRepository) {}

  async execute(query: ListSessionsQuery): Promise<ListExamSessionsResult> {
    const page = Math.max(query.page, 1);
    const size = Math.min(Math.max(query.size, 1), 100);
    const result = await this.sessionRepository.findAll({
      studentId: query.studentId,
      page,
      size,
      status: query.status,
    });
    return new ListExamSessionsResult(
      result.items.map((session) =>
        ExamSessionResult.fromAggregate(
          session,
          session.status !== 'IN_PROGRESS',
        ),
      ),
      result.total,
      page,
      size,
    );
  }
}
