import { DomainEvent } from '@repo/common';

export class QuestionDeactivatedEvent extends DomainEvent {
  get eventName(): string {
    return 'question.deactivated';
  }

  constructor(readonly questionId: string) {
    super();
  }
}
