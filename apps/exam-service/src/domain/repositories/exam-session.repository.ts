import { ExamSession } from '../aggregates/exam-session/exam-session.aggregate';
import { ExamSessionStatus } from '../aggregates/exam-session/exam-session.types';

export interface ListExamSessionsFilter {
  studentId: string;
  page: number;
  size: number;
  status?: ExamSessionStatus;
}

export interface ListExamSessionsPage {
  items: ExamSession[];
  total: number;
}

export abstract class ExamSessionRepository {
  abstract findById(id: string): Promise<ExamSession | null>;
  abstract findAll(
    filter: ListExamSessionsFilter,
  ): Promise<ListExamSessionsPage>;
  abstract save(session: ExamSession): Promise<void>;
}
