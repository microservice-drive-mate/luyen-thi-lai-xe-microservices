import { AuditRequestContext } from '@repo/common';

export class ResetEnrollmentProgressCommand {
  constructor(
    readonly enrollmentId: string,
    readonly studentId: string,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
