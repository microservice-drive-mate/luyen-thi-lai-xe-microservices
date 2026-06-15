import { AuditEventEnvelope } from '@repo/common';
import { CourseEnrollment } from '../aggregates/course-enrollment/course-enrollment.aggregate';
import { EnrollmentStatus } from '../aggregates/course-enrollment/course-enrollment.types';
import { LicenseCategory } from '../aggregates/course/course.types';

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

export interface CourseEnrollmentWithCourse {
  id: string;
  courseId: string;
  studentId: string;
  status: EnrollmentStatus;
  progress: number;
  enrolledAt: Date;
  completedAt: Date | null;
  course: {
    id: string;
    courseCode: string | null;
    title: string;
    licenseCategory: LicenseCategory;
  };
}

export interface ListEnrollmentsWithCoursePage {
  items: CourseEnrollmentWithCourse[];
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
  abstract findByStudentIdWithCourse(
    filter: ListEnrollmentsFilter,
  ): Promise<ListEnrollmentsWithCoursePage>;
  abstract save(
    enrollment: CourseEnrollment,
    auditEvent?: AuditEventEnvelope,
  ): Promise<void>;
}
