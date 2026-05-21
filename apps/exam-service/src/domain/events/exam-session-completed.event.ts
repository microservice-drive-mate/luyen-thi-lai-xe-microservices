import { DomainEvent } from '@repo/common';
import { LicenseCategory } from '../aggregates/exam-template/exam-template.types';

export class ExamSessionCompletedEvent extends DomainEvent {
  get eventName(): string {
    return 'exam.session.completed';
  }

  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly score: number,
    readonly isPassed: boolean,
    readonly licenseCategory: LicenseCategory,
  ) {
    super();
  }
}
