import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import { ExamSessionStatus } from '../../../domain/aggregates/exam-session/exam-session.types';
import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export interface ExamQuestionOptionResult {
  id: string;
  content: string;
  displayOrder: number;
}

export interface ExamSessionQuestionResult {
  questionId: string;
  content: string;
  options: ExamQuestionOptionResult[];
  displayOrder: number;
  isCritical: boolean;
  isBookmarked: boolean;
  selectedOptionId: string | null;
  isCorrect?: boolean | null;
}

export class ExamSessionResult {
  constructor(
    readonly id: string,
    readonly studentId: string,
    readonly templateId: string,
    readonly licenseCategory: LicenseCategory,
    readonly status: ExamSessionStatus,
    readonly score: number | null,
    readonly isPassed: boolean | null,
    readonly failedByCritical: boolean,
    readonly startedAt: Date,
    readonly finishedAt: Date | null,
    readonly expiresAt: Date,
    readonly questions: ExamSessionQuestionResult[],
  ) {}

  static fromAggregate(
    session: ExamSession,
    includeFeedback = false,
  ): ExamSessionResult {
    return new ExamSessionResult(
      session.id,
      session.studentId,
      session.templateId,
      session.licenseCategory,
      session.status,
      session.score,
      session.isPassed,
      session.failedByCritical,
      session.startedAt,
      session.finishedAt,
      session.expiresAt,
      session.questions.map((question) => ({
        questionId: question.questionId,
        content: question.questionContent,
        options: question.optionsSnapshot.map((option) => ({
          id: option.id,
          content: option.content,
          displayOrder: option.displayOrder,
        })),
        displayOrder: question.displayOrder,
        isCritical: question.isCritical,
        isBookmarked: question.isBookmarked,
        selectedOptionId: question.selectedOptionId,
        ...(includeFeedback ? { isCorrect: question.isCorrect } : {}),
      })),
    );
  }
}

export class ListExamSessionsResult {
  constructor(
    readonly items: ExamSessionResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
