import { AuditRequestContext } from '@repo/common';

export class AddLessonCommand {
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly order: number,
    readonly content?: string | null,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
