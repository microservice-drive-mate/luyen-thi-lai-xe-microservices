import { DomainException } from '@repo/common';

export class CourseHasActiveEnrollmentsException extends DomainException {
  readonly code = 'COURSE_HAS_ACTIVE_ENROLLMENTS';

  constructor(courseId: string) {
    super(`Course has active enrollments and cannot be archived: ${courseId}`);
  }
}
