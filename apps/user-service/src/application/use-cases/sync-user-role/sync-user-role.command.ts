import { UserRole } from '../../../domain/aggregates/user-profile/user-profile.types';

export class SyncUserRoleCommand {
  constructor(
    readonly userId: string,
    readonly newRole: UserRole,
  ) {}
}
