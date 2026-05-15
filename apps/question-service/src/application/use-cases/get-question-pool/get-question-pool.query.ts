import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../../domain/aggregates/question/question.types';

export class GetQuestionPoolQuery {
  constructor(
    readonly licenseCategory: LicenseCategory,
    readonly size: number,
    readonly type?: QuestionType,
    readonly difficulty?: QuestionDifficulty,
    readonly topicId?: string,
    readonly isCritical?: boolean,
    readonly excludeQuestionIds?: string[],
  ) {}
}
