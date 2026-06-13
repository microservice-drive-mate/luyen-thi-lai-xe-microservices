import { DomainEvent } from '@repo/common';

export class CourseEnrollmentCompletedEvent extends DomainEvent {
  constructor(
    readonly enrollmentId: string,
    readonly studentId: string,
    readonly courseId: string,
    readonly status = 'COMPLETED',
    readonly progress = 100,
  ) {
    super();
  }

  get eventName(): string {
    return 'course.enrollment.completed';
  }
}
