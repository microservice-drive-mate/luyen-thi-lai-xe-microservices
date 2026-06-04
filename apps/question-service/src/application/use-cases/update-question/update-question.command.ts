import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionOptionInputProps,
  QuestionType,
} from '../../../domain/aggregates/question/question.types';

export class UpdateQuestionCommand {
  constructor(
    readonly questionId: string,
    readonly expectedVersion: number,
    readonly content?: string,
    readonly type?: QuestionType,
    readonly licenseCategories?: LicenseCategory[],
    readonly difficulty?: QuestionDifficulty,
    readonly explanation?: string,
    readonly imageUrl?: string | null,
    readonly mediaFileId?: string | null,
    readonly isCritical?: boolean,
    readonly isActive?: boolean,
    readonly topicId?: string,
    readonly options?: QuestionOptionInputProps[],
  ) {}
}
