import { DomainEvent } from '@repo/common';

export class CourseEnrollmentCreatedEvent extends DomainEvent {
  constructor(
    readonly enrollmentId: string,
    readonly studentId: string,
    readonly courseId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'course.enrollment.created';
  }
}
