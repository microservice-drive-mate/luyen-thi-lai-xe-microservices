import { AuditRequestContext } from '@repo/common';

export class DeleteIdentityUserCommand {
  constructor(
    readonly userId: string,
    readonly deletedById: string | null,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
