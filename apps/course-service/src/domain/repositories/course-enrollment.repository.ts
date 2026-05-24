import { AuditEventEnvelope } from '@repo/common';
import { CourseEnrollment } from '../aggregates/course-enrollment/course-enrollment.aggregate';
import { EnrollmentStatus } from '../aggregates/course-enrollment/course-enrollment.types';

export interface ListEnrollmentsFilter {
  studentId: string;
  status?: EnrollmentStatus;
  page: number;
  size: number;
}

export interface ListEnrollmentsPage {
  items: CourseEnrollment[];
  total: number;
}

export abstract class CourseEnrollmentRepository {
  abstract findById(id: string): Promise<CourseEnrollment | null>;
  abstract findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<CourseEnrollment | null>;
  abstract findByStudentId(
    filter: ListEnrollmentsFilter,
  ): Promise<ListEnrollmentsPage>;
  abstract save(
    enrollment: CourseEnrollment,
    auditEvent?: AuditEventEnvelope,
  ): Promise<void>;
}
