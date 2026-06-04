import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionOptionInputProps,
  QuestionType,
} from '../../../domain/aggregates/question/question.types';

export class CreateQuestionCommand {
  constructor(
    readonly content: string,
    readonly type: QuestionType,
    readonly licenseCategories: LicenseCategory[],
    readonly difficulty: QuestionDifficulty,
    readonly explanation: string,
    readonly topicId: string,
    readonly createdById: string,
    readonly options: QuestionOptionInputProps[],
    readonly imageUrl?: string | null,
    readonly mediaFileId?: string | null,
    readonly isCritical?: boolean,
    readonly isActive?: boolean,
  ) {}
}
