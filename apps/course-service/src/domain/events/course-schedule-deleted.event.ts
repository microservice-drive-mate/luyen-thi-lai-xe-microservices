import { DomainEvent } from '@repo/common';

export class CourseScheduleDeletedEvent extends DomainEvent {
  get eventName(): string {
    return 'course.schedule.deleted';
  }

  constructor(
    readonly scheduleId: string,
    readonly courseId: string,
    readonly instructorId: string,
  ) {
    super();
  }
}
