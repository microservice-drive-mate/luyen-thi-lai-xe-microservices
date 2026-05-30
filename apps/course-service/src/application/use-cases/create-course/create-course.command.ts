import { AuditRequestContext } from '@repo/common';
import { LicenseCategory } from '../../../domain/aggregates/course/course.types';

export interface CreateCourseRequirementFields {
  minAge?: number | null;
  prerequisites?: string | null;
  attendanceRate?: number;
  minPassScore?: number;
  requiredExams?: number;
}

export class CreateCourseCommand {
  constructor(
    readonly createdById: string,
    readonly courseCode: string | null | undefined,
    readonly title: string,
    readonly licenseCategory: LicenseCategory,
    readonly description?: string | null,
    readonly duration?: string | null,
    readonly tuitionFee?: number,
    readonly capacity?: number | null,
    readonly instructorIds?: string[],
    readonly requirement?: CreateCourseRequirementFields | null,
    readonly auditContext?: AuditRequestContext,
  ) {}
}
