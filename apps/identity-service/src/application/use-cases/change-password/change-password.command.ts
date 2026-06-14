import { AuditRequestContext } from '@repo/common';

export class ChangePasswordCommand {
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
