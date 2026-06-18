import { LicenseCategory } from '../../../domain/aggregates/course/course.types';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';
import { CourseEnrollmentWithCourse } from '../../../domain/repositories/course-enrollment.repository';

export class AdminStudentEnrollmentResult {
  constructor(
    readonly enrollmentId: string,
    readonly courseId: string,
    readonly courseCode: string | null,
    readonly title: string,
    readonly licenseCategory: LicenseCategory,
    readonly status: EnrollmentStatus,
    readonly progress: number,
    readonly enrolledAt: Date,
    readonly completedAt: Date | null,
  ) {}

  static fromProjection(
    enrollment: CourseEnrollmentWithCourse,
  ): AdminStudentEnrollmentResult {
    return new AdminStudentEnrollmentResult(
      enrollment.id,
      enrollment.course.id,
      enrollment.course.courseCode,
      enrollment.course.title,
      enrollment.course.licenseCategory,
      enrollment.status,
      enrollment.progress,
      enrollment.enrolledAt,
      enrollment.completedAt,
    );
  }
}

export class ListAdminStudentEnrollmentsResult {
  constructor(
    readonly items: AdminStudentEnrollmentResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
