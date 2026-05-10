import { DomainException } from '@repo/common';

export class EnrollmentNotFoundException extends DomainException {
  readonly code = 'ENROLLMENT_NOT_FOUND';

  constructor(enrollmentId: string) {
    super(`Enrollment with ID ${enrollmentId} not found`);
  }
}
