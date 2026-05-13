import { DomainEvent } from '@repo/common';

export class UserLockedEvent extends DomainEvent {
  get eventName(): string {
    return 'identity.user.locked';
  }

  constructor(
    readonly userId: string,
    readonly locked: boolean,
  ) {
    super();
  }
}
