import { DomainEvent } from '@repo/common';
import { UserRole } from '../aggregates/identity-user/identity-user.types';

export class UserRoleChangedEvent extends DomainEvent {
  get eventName(): string {
    return 'identity.user.role-changed';
  }

  constructor(
    readonly userId: string,
    readonly newRole: UserRole,
  ) {
    super();
  }
}
