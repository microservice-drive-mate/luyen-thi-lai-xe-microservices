import { DomainException } from '@repo/common';

export class CourseNotActiveException extends DomainException {
  readonly code = 'COURSE_NOT_ACTIVE';

  constructor(courseId: string) {
    super(`Course ${courseId} is not active and cannot accept enrollments`);
  }
}
