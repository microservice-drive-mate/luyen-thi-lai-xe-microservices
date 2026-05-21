import { DomainException } from '@repo/common';

export class EnrollmentAlreadyExistsException extends DomainException {
  readonly code = 'ENROLLMENT_ALREADY_EXISTS';

  constructor(studentId: string, courseId: string) {
    super(`Học viên ${studentId} đã đăng ký khóa học ${courseId}`);
  }
}
