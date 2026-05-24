import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class ChangeUserRoleResult {
  constructor(
    readonly userId: string,
    readonly role: UserRole,
  ) {}
}
