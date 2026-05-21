import { ExamTemplate } from '../aggregates/exam-template/exam-template.aggregate';
import { LicenseCategory } from '../aggregates/exam-template/exam-template.types';

export interface ListExamTemplatesFilter {
  page: number;
  size: number;
  licenseCategory?: LicenseCategory;
  isActive?: boolean;
  includeDeleted?: boolean;
}

export interface ListExamTemplatesPage {
  items: ExamTemplate[];
  total: number;
}

export abstract class ExamTemplateRepository {
  abstract findById(id: string): Promise<ExamTemplate | null>;
  abstract findAll(
    filter: ListExamTemplatesFilter,
  ): Promise<ListExamTemplatesPage>;
  abstract hasSessions(templateId: string): Promise<boolean>;
  abstract save(template: ExamTemplate): Promise<void>;
}
