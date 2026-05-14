import { Question } from '../../../domain/aggregates/question/question.aggregate';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../../domain/aggregates/question/question.types';

export interface QuestionOptionResult {
  id: string;
  content: string;
  isCorrect: boolean;
  displayOrder: number;
}

export class QuestionResult {
  constructor(
    readonly id: string,
    readonly content: string,
    readonly type: QuestionType,
    readonly licenseCategories: LicenseCategory[],
    readonly difficulty: QuestionDifficulty,
    readonly explanation: string,
    readonly imageUrl: string | null,
    readonly mediaFileId: string | null,
    readonly isCritical: boolean,
    readonly isActive: boolean,
    readonly isDeleted: boolean,
    readonly topicId: string,
    readonly createdById: string,
    readonly version: number,
    readonly deletedById: string | null,
    readonly deletedAt: Date | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly options: QuestionOptionResult[],
  ) {}

  static fromAggregate(question: Question): QuestionResult {
    return new QuestionResult(
      question.id,
      question.content,
      question.type,
      question.licenseCategories,
      question.difficulty,
      question.explanation,
      question.imageUrl,
      question.mediaFileId,
      question.isCritical,
      question.isActive,
      question.isDeleted,
      question.topicId,
      question.createdById,
      question.version,
      question.deletedById,
      question.deletedAt,
      question.createdAt,
      question.updatedAt,
      question.options.map((option) => ({
        id: option.id,
        content: option.content,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
    );
  }
}

export class ListQuestionsResult {
  constructor(
    readonly items: QuestionResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}

export class QuestionPoolResult {
  constructor(readonly items: QuestionResult[]) {}
}
