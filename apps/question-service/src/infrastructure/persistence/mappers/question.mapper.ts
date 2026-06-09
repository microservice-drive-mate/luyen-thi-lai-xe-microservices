import { Question } from '../../../domain/aggregates/question/question.aggregate';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../../../domain/aggregates/question/question.types';

interface RawQuestionOption {
  id: string;
  content: string;
  isCorrect: boolean;
  displayOrder: number;
}

interface RawQuestion {
  id: string;
  content: string;
  type: string;
  licenseCategories: string[];
  difficulty: string;
  explanation: string;
  imageUrl: string | null;
  mediaFileId: string | null;
  isCritical: boolean;
  isActive: boolean;
  isDeleted: boolean;
  topicId: string;
  createdById: string;
  version: number;
  deletedById: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: RawQuestionOption[];
}

export const QuestionMapper = {
  toDomain(raw: RawQuestion): Question {
    return Question.reconstitute({
      id: raw.id,
      content: raw.content,
      type: raw.type as QuestionType,
      licenseCategories: raw.licenseCategories as LicenseCategory[],
      difficulty: raw.difficulty as QuestionDifficulty,
      explanation: raw.explanation,
      imageUrl: raw.imageUrl,
      mediaFileId: raw.mediaFileId,
      isCritical: raw.isCritical,
      isActive: raw.isActive,
      isDeleted: raw.isDeleted,
      topicId: raw.topicId,
      createdById: raw.createdById,
      version: raw.version,
      deletedById: raw.deletedById,
      deletedAt: raw.deletedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      options: raw.options.map((option) => ({
        id: option.id,
        content: option.content,
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
    });
  },
};
