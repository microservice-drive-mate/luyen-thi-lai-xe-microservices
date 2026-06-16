import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';

export class ListAdminStudentEnrollmentsQuery {
  constructor(
    readonly studentId: string,
    readonly page: number,
    readonly size: number,
    readonly status?: EnrollmentStatus,
  ) {}
}
