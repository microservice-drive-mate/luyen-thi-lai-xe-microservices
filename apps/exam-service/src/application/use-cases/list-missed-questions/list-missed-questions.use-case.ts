import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import {
  ExamSessionRepository,
  MissedQuestionItem,
} from '../../../domain/repositories/exam-session.repository';
import { ListMissedQuestionsQuery } from './list-missed-questions.query';

@Injectable()
export class ListMissedQuestionsUseCase
  implements IUseCase<ListMissedQuestionsQuery, MissedQuestionItem[]>
{
  constructor(private readonly sessionRepository: ExamSessionRepository) {}

  execute(query: ListMissedQuestionsQuery): Promise<MissedQuestionItem[]> {
    return this.sessionRepository.findMissedQuestions({
      studentId: query.studentId,
      limit: Math.min(Math.max(query.limit, 1), 50),
      periodDays: query.periodDays,
      mode: query.mode,
    });
  }
}
