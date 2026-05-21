import { DomainEvent } from '@repo/common';

export class UserUpdatedEvent extends DomainEvent {
  get eventName(): string {
    return 'identity.user.updated';
  }

  constructor(
    readonly userId: string,
    readonly email: string,
    readonly fullName: string,
  ) {
    super();
  }
}
