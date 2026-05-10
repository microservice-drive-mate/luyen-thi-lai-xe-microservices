import { DomainException } from '@repo/common';

export class EnrollmentAlreadyCompletedException extends DomainException {
  readonly code = 'ENROLLMENT_ALREADY_COMPLETED';

  constructor(enrollmentId: string) {
    super(`Enrollment ${enrollmentId} has already been completed`);
  }
}
