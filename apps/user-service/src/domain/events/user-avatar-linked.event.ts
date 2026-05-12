import { DomainEvent } from '@repo/common';

export class UserAvatarLinkedEvent extends DomainEvent {
  get eventName(): string {
    return 'user.avatar.linked';
  }

  constructor(
    readonly userId: string,
    readonly mediaFileId: string,
  ) {
    super();
  }
}
