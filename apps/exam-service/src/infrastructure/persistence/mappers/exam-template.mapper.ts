import { ExamTemplate } from '../../../domain/aggregates/exam-template/exam-template.aggregate';
import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export interface RawExamTemplate {
  id: string;
  name: string;
  licenseCategory: string;
  totalQuestions: number;
  passingScore: number;
  durationMinutes: number;
  isActive: boolean;
  isDeleted: boolean;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ExamTemplateMapper {
  static toDomain(raw: RawExamTemplate): ExamTemplate {
    return ExamTemplate.reconstitute({
      id: raw.id,
      name: raw.name,
      licenseCategory: raw.licenseCategory as LicenseCategory,
      totalQuestions: raw.totalQuestions,
      passingScore: raw.passingScore,
      durationMinutes: raw.durationMinutes,
      isActive: raw.isActive,
      isDeleted: raw.isDeleted,
      version: raw.version,
      createdById: raw.createdById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
