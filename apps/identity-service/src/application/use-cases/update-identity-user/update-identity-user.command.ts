import { AuditRequestContext } from '@repo/common';

export class UpdateIdentityUserCommand {
  constructor(
    readonly userId: string,
    readonly email?: string,
    readonly fullName?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
