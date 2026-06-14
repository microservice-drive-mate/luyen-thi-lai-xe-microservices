import { DomainEvent } from '@repo/common';
import {
  CourseStatus,
  LicenseCategory,
} from '../aggregates/course/course.types';

export class CourseArchivedEvent extends DomainEvent {
  get eventName(): string {
    return 'course.archived';
  }

  constructor(
    readonly courseId: string,
    readonly title: string,
    readonly licenseCategory: LicenseCategory,
    readonly status: CourseStatus,
    readonly isDeleted: boolean,
    readonly instructorIds: string[] = [],
    readonly capacity: number | null = null,
    readonly totalLessons = 0,
  ) {
    super();
  }
}
