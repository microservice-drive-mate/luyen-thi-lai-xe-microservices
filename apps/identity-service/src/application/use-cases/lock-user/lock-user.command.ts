import { AuditRequestContext } from '@repo/common';

export class LockUserCommand {
  constructor(
    readonly userId: string,
    readonly locked: boolean,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
