import { AuditRequestContext } from '@repo/common';

export class RemoveLessonCommand {
  constructor(
    readonly courseId: string,
    readonly lessonId: string,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
