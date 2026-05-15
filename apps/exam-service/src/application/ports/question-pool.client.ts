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
  isCritical: boolean;
  options: QuestionPoolOption[];
}

export abstract class QuestionPoolClient {
  abstract getPool(
    licenseCategory: LicenseCategory,
    size: number,
  ): Promise<QuestionPoolItem[]>;
}
