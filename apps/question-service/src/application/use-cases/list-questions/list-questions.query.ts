import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../../domain/aggregates/question/question.types';

export class ListQuestionsQuery {
  constructor(
    readonly page: number,
    readonly size: number,
    readonly keyword?: string,
    readonly licenseCategory?: LicenseCategory,
    readonly type?: QuestionType,
    readonly difficulty?: QuestionDifficulty,
    readonly topicId?: string,
    readonly isCritical?: boolean,
    readonly isActive?: boolean,
    readonly includeDeleted?: boolean,
  ) {}
}
