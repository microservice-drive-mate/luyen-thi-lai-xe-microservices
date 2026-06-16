import { AuditRequestContext } from '@repo/common';

export class ResetPasswordCommand {
  constructor(
    readonly userId: string,
    readonly newPassword: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
