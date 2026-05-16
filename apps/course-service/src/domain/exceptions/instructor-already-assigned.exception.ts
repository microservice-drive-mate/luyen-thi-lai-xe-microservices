import { DomainException } from '@repo/common';

export class InstructorAlreadyAssignedException extends DomainException {
  readonly code = 'INSTRUCTOR_ALREADY_ASSIGNED';

  constructor(instructorId: string, courseId: string) {
    super(
      `Giảng viên ${instructorId} đã được phân công cho khóa học ${courseId}`,
    );
  }
}
