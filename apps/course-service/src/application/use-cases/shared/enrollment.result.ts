import { CourseEnrollment } from '../../../domain/aggregates/course-enrollment/course-enrollment.aggregate';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';

export class EnrollmentResult {
  constructor(
    readonly id: string,
    readonly courseId: string,
    readonly studentId: string,
    readonly status: EnrollmentStatus,
    readonly progress: number,
    readonly enrolledAt: Date,
    readonly completedAt: Date | null,
  ) {}

  static fromAggregate(enrollment: CourseEnrollment): EnrollmentResult {
    return new EnrollmentResult(
      enrollment.id,
      enrollment.courseId,
      enrollment.studentId,
      enrollment.status,
      enrollment.progress,
      enrollment.enrolledAt,
      enrollment.completedAt,
    );
  }
}

export class ListEnrollmentsResult {
  constructor(
    readonly items: EnrollmentResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
