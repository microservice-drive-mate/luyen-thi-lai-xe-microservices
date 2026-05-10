import { DomainException } from '@repo/common';

export class CourseCapacityExceededException extends DomainException {
  readonly code = 'COURSE_CAPACITY_EXCEEDED';

  constructor(courseId: string, capacity: number) {
    super(
      `Course ${courseId} has reached its maximum capacity of ${capacity} students`,
    );
  }
}
