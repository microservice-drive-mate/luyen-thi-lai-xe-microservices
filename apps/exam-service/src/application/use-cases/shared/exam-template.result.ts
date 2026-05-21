import { ExamTemplate } from '../../../domain/aggregates/exam-template/exam-template.aggregate';
import {
  ExamTopicDistributionItem,
  LicenseCategory,
} from '../../../domain/aggregates/exam-template/exam-template.types';

export class ExamTemplateResult {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string | null,
    readonly licenseCategory: LicenseCategory,
    readonly totalQuestions: number,
    readonly passingScore: number,
    readonly durationMinutes: number,
    readonly criticalQuestions: number,
    readonly maxCriticalMistakes: number,
    readonly shuffleQuestions: boolean,
    readonly topicDistribution: ExamTopicDistributionItem[],
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
      template.description,
      template.licenseCategory,
      template.totalQuestions,
      template.passingScore,
      template.durationMinutes,
      template.criticalQuestions,
      template.maxCriticalMistakes,
      template.shuffleQuestions,
      template.topicDistribution,
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
