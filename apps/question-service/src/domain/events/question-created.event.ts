import { DomainEvent } from '@repo/common';
import { LicenseCategory } from '../aggregates/question/question.types';

export class QuestionCreatedEvent extends DomainEvent {
  get eventName(): string {
    return 'question.created';
  }

  constructor(
    readonly questionId: string,
    readonly licenseCategories: LicenseCategory[],
    readonly isCritical: boolean,
  ) {
    super();
  }
}
