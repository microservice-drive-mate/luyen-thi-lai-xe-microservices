import { AuditRequestContext } from '@repo/common';

export class UpdateLessonCommand {
  constructor(
    readonly courseId: string,
    readonly lessonId: string,
    readonly title?: string,
    readonly order?: number,
    readonly content?: string | null,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
