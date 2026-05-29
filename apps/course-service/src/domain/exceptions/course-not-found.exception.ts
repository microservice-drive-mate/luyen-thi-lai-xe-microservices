import { DomainException } from '@repo/common';

export class CourseNotFoundException extends DomainException {
  readonly code = 'COURSE_NOT_FOUND';

  constructor(courseId: string) {
    super('Course not found. (MSG23)');
  }
}
