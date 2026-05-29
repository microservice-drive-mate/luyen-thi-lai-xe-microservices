import { DomainException } from '@repo/common';

export class InstructorAlreadyAssignedException extends DomainException {
  readonly code = 'INSTRUCTOR_ALREADY_ASSIGNED';

  constructor(instructorId: string, courseId: string) {
    super(
      `Instructor ${instructorId} is already assigned to course ${courseId}`,
    );
  }
}
