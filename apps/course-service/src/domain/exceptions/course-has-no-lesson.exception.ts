import { DomainException } from '@repo/common';

export class CourseHasNoLessonException extends DomainException {
  readonly code = 'COURSE_HAS_NO_LESSON';

  constructor(courseId: string) {
    super(`Course ${courseId} must have at least one lesson before activation`);
  }
}
