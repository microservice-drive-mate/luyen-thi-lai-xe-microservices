import { ExamSessionStatus } from '../../../domain/aggregates/exam-session/exam-session.types';

export class ListSessionsQuery {
  constructor(
    readonly studentId: string,
    readonly page: number,
    readonly size: number,
    readonly status?: ExamSessionStatus,
  ) {}
}
