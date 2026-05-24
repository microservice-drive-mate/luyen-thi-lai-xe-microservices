import { AuditRequestContext } from '@repo/common';

export class DeleteTemplateCommand {
  constructor(
    readonly id: string,
    readonly expectedVersion: number,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
