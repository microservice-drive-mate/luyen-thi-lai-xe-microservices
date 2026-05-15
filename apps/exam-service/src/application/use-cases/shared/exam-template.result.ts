import { ExamTemplate } from '../../../domain/aggregates/exam-template/exam-template.aggregate';
import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

export class ExamTemplateResult {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly licenseCategory: LicenseCategory,
    readonly totalQuestions: number,
    readonly passingScore: number,
    readonly durationMinutes: number,
    readonly isActive: boolean,
    readonly isDeleted: boolean,
    readonly version: number,
    readonly createdById: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static fromAggregate(template: ExamTemplate): ExamTemplateResult {
    return new ExamTemplateResult(
      template.id,
      template.name,
      template.licenseCategory,
      template.totalQuestions,
      template.passingScore,
      template.durationMinutes,
      template.isActive,
      template.isDeleted,
      template.version,
      template.createdById,
      template.createdAt,
      template.updatedAt,
    );
  }
}

export class ListExamTemplatesResult {
  constructor(
    readonly items: ExamTemplateResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
