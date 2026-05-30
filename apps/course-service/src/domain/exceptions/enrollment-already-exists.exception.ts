import { DomainException } from '@repo/common';

export class EnrollmentAlreadyExistsException extends DomainException {
  readonly code = 'ENROLLMENT_ALREADY_EXISTS';

  constructor(studentId: string, courseId: string) {
    super(`Student ${studentId} is already enrolled in course ${courseId}`);
  }
}
