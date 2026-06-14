import { AuditRequestContext } from '@repo/common';

export class AssignCourseInstructorCommand {
  constructor(
    readonly courseId: string,
    readonly instructorId: string,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
