import { AuditRequestContext } from '@repo/common';
import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class ChangeUserRoleCommand {
  constructor(
    readonly userId: string,
    readonly role: UserRole,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
