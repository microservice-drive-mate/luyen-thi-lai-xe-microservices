import { DomainEvent } from '@repo/common';

export class CourseEnrollmentProgressResetEvent extends DomainEvent {
  get eventName(): string {
    return 'course.enrollment.progress-reset';
  }

  constructor(
    readonly enrollmentId: string,
    readonly studentId: string,
    readonly courseId: string,
    readonly status = 'ACTIVE',
    readonly progress = 0,
  ) {
    super();
  }
}
