import { DomainException } from '@repo/common';

export class CourseVersionConflictException extends DomainException {
  readonly code = 'COURSE_VERSION_CONFLICT';

  constructor(courseId: string) {
    super(`Course version conflict: ${courseId}`);
  }
}
