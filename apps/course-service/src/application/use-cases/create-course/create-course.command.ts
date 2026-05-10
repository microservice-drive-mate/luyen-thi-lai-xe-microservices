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
    readonly title: string,
    readonly licenseCategory: LicenseCategory,
    readonly description?: string | null,
    readonly thumbnailUrl?: string | null,
    readonly duration?: string | null,
    readonly tuitionFee?: number,
    readonly capacity?: number | null,
    readonly instructorIds?: string[],
    readonly requirement?: CreateCourseRequirementFields | null,
  ) {}
}
