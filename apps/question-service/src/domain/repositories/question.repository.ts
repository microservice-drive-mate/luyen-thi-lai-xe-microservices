import { Question } from '../aggregates/question/question.aggregate';
import {
  LicenseCategory,
  QuestionDifficulty,
  QuestionType,
} from '../aggregates/question/question.types';

export interface ListQuestionsFilter {
  keyword?: string;
  licenseCategory?: LicenseCategory;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topicId?: string;
  isCritical?: boolean;
  isActive?: boolean;
  includeDeleted?: boolean;
  page: number;
  size: number;
}

export interface ListQuestionsPage {
  items: Question[];
  total: number;
}

export interface QuestionPoolFilter {
  licenseCategory: LicenseCategory;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  topicId?: string;
  isCritical?: boolean;
  size: number;
  excludeQuestionIds?: string[];
}

export abstract class QuestionRepository {
  abstract findById(id: string): Promise<Question | null>;
  abstract findAll(filter: ListQuestionsFilter): Promise<ListQuestionsPage>;
  abstract getPool(filter: QuestionPoolFilter): Promise<Question[]>;
  abstract existsBySignature(
    normalizedContent: string,
    topicId: string,
    excludeQuestionId?: string,
  ): Promise<boolean>;
  abstract save(question: Question): Promise<void>;
}
