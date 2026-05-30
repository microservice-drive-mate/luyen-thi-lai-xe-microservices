import { AuditRequestContext } from '@repo/common';
import { CreateCourseRequirementFields } from '../create-course/create-course.command';

export class UpdateCourseCommand {
  constructor(
    readonly courseId: string,
    readonly title?: string,
    readonly description?: string | null,
    readonly duration?: string | null,
    readonly tuitionFee?: number,
    readonly capacity?: number | null,
    readonly requirement?: CreateCourseRequirementFields | null,
    readonly actorId?: string,
    readonly auditContext?: AuditRequestContext,
    readonly expectedVersion?: number,
  ) {}
}
