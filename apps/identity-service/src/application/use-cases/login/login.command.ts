import { AuditRequestContext } from '@repo/common';

export class LoginCommand {
  constructor(
    readonly username: string,
    readonly password: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
