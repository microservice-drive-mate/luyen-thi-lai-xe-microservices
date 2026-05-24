import { DomainEvent } from '@repo/common';
import { UserRole } from '../aggregates/identity-user/identity-user.types';

export class UserCreatedEvent extends DomainEvent {
  get eventName(): string {
    return 'identity.user.created';
  }

  constructor(
    readonly userId: string,
    readonly email: string,
    readonly fullName: string,
    readonly role: UserRole,
  ) {
    super();
  }
}
