import { DomainException } from '@repo/common';

export class CourseCodeAlreadyExistsException extends DomainException {
  readonly code = 'COURSE_CODE_ALREADY_EXISTS';

  constructor(courseCode: string) {
    super(`Course code already exists: ${courseCode}`);
  }
}
