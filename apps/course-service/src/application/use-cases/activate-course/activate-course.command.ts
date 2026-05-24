import { AuditRequestContext } from '@repo/common';

export class ActivateCourseCommand {
  constructor(
    readonly courseId: string,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
