import { DomainEvent } from '@repo/common';
import { UserRole } from '../../types/user-role.enum';

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
