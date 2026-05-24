import { AuditRequestContext } from '@repo/common';
import { ExamTopicDistributionItem } from '../../../domain/aggregates/exam-template/exam-template.types';

export class UpdateTemplateCommand {
  constructor(
    readonly id: string,
    readonly expectedVersion: number,
    readonly name?: string,
    readonly description?: string | null,
    readonly totalQuestions?: number,
    readonly passingScore?: number,
    readonly durationMinutes?: number,
    readonly criticalQuestions?: number,
    readonly maxCriticalMistakes?: number,
    readonly shuffleQuestions?: boolean,
    readonly topicDistribution?: ExamTopicDistributionItem[],
    readonly isActive?: boolean,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
