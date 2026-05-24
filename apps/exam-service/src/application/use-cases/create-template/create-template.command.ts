import { AuditRequestContext } from '@repo/common';
import {
  ExamTopicDistributionItem,
  LicenseCategory,
} from '../../../domain/aggregates/exam-template/exam-template.types';

export class CreateTemplateCommand {
  constructor(
    readonly name: string,
    readonly description: string | null | undefined,
    readonly licenseCategory: LicenseCategory,
    readonly totalQuestions: number,
    readonly passingScore: number,
    readonly durationMinutes: number,
    readonly criticalQuestions: number,
    readonly maxCriticalMistakes: number,
    readonly shuffleQuestions: boolean,
    readonly topicDistribution: ExamTopicDistributionItem[],
    readonly createdById: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
