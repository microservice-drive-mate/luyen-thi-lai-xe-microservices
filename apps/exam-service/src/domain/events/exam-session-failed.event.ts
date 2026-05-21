import { DomainEvent } from '@repo/common';
import { LicenseCategory } from '../aggregates/exam-template/exam-template.types';

export class ExamSessionFailedEvent extends DomainEvent {
  get eventName(): string {
    return 'exam.session.failed';
  }

  constructor(
    readonly sessionId: string,
    readonly studentId: string,
    readonly failedByCritical: boolean,
    readonly licenseCategory: LicenseCategory,
  ) {
    super();
  }
}
