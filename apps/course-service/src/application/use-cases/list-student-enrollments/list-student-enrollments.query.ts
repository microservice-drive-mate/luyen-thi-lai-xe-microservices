import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';

export class ListStudentEnrollmentsQuery {
  constructor(
    readonly studentId: string,
    readonly page: number,
    readonly size: number,
    readonly status?: EnrollmentStatus,
  ) {}
}
