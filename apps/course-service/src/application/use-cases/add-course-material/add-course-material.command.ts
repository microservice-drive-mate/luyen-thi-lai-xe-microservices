import { AuditRequestContext } from '@repo/common';

export class AddCourseMaterialCommand {
  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly fileUrl?: string | null,
    readonly mediaFileId?: string | null,
    readonly type?: string | null,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
