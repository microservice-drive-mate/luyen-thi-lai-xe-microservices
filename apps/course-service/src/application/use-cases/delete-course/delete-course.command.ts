import { AuditRequestContext } from '@repo/common';

export class DeleteCourseCommand {
  constructor(
    readonly courseId: string,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
