import { DomainEvent } from '@repo/common';
import { LicenseCategory } from '../aggregates/exam-template/exam-template.types';

export class ExamSessionPassedEvent extends DomainEvent {
  get eventName(): string {
    return 'exam.session.passed';
  }

  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly licenseCategory: LicenseCategory,
  ) {
    super();
  }
}
