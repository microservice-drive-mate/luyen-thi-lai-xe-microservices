import { DomainException } from '@repo/common';

export class EnrollmentAlreadyCompletedException extends DomainException {
  readonly code = 'ENROLLMENT_ALREADY_COMPLETED';

  constructor(enrollmentId: string) {
    super(`Đăng ký ${enrollmentId} đã được hoàn thành`);
  }
}
