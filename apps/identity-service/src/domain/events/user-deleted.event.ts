import { DomainEvent } from '@repo/common';

export class UserDeletedEvent extends DomainEvent {
  get eventName(): string {
    return 'identity.user.deleted';
  }

  constructor(
    readonly userId: string,
    readonly deletedById: string | null,
  ) {
    super();
  }
}
