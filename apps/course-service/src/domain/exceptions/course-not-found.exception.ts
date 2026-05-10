import { DomainException } from '@repo/common';

export class CourseNotFoundException extends DomainException {
  readonly code = 'COURSE_NOT_FOUND';

  constructor(courseId: string) {
    super(`Course with ID ${courseId} not found`);
  }
}
