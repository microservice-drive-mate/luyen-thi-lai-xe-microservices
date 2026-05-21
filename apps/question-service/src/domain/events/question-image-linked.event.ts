import { DomainEvent } from '@repo/common';

export class QuestionImageLinkedEvent extends DomainEvent {
  get eventName(): string {
    return 'question.image.linked';
  }

  constructor(
    readonly questionId: string,
    readonly mediaFileId: string,
  ) {
    super();
  }
}
