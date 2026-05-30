import { AuditEventEnvelope } from '@repo/common';
import { Course } from '../aggregates/course/course.aggregate';
import {
  CourseStatus,
  LicenseCategory,
} from '../aggregates/course/course.types';

export interface ListCoursesFilter {
  licenseCategory?: LicenseCategory;
  status?: CourseStatus;
  createdById?: string;
  page: number;
  size: number;
}

export interface ListCoursesPage {
  items: Course[];
  total: number;
}

export abstract class CourseRepository {
  abstract findById(id: string): Promise<Course | null>;
  abstract existsById(id: string): Promise<boolean>;
  abstract existsByCourseCode(
    courseCode: string,
    excludeCourseId?: string,
  ): Promise<boolean>;
  abstract save(course: Course, auditEvent?: AuditEventEnvelope): Promise<void>;
  abstract findAll(filter: ListCoursesFilter): Promise<ListCoursesPage>;
  abstract countEnrollments(courseId: string): Promise<number>;
}
