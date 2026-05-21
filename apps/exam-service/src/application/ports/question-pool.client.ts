import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export interface QuestionPoolOption {
  id: string;
  content: string;
  isCorrect: boolean;
  displayOrder: number;
}

export interface QuestionPoolItem {
  id: string;
  content: string;
  imageUrl: string | null;
  mediaFileId: string | null;
  isCritical: boolean;
  topicId: string;
  options: QuestionPoolOption[];
}

export interface QuestionPoolRequest {
  licenseCategory: LicenseCategory;
  size: number;
  topicId?: string;
  isCritical?: boolean;
  excludeQuestionIds?: string[];
}

export abstract class QuestionPoolClient {
  abstract getPool(request: QuestionPoolRequest): Promise<QuestionPoolItem[]>;
}
