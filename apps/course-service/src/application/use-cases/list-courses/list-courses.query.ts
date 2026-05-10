import {
  CourseStatus,
  LicenseCategory,
} from '../../../domain/aggregates/course/course.types';

export class ListCoursesQuery {
  constructor(
    readonly page: number,
    readonly size: number,
    readonly licenseCategory?: LicenseCategory,
    readonly status?: CourseStatus,
    readonly createdById?: string,
  ) {}
}
