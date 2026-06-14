import { AuditRequestContext } from '@repo/common';

export class UnenrollStudentCommand {
  constructor(
    readonly courseId: string,
    readonly studentId: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
