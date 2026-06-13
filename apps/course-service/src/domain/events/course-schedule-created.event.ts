import { DomainEvent } from '@repo/common';

export class CourseScheduleCreatedEvent extends DomainEvent {
  get eventName(): string {
    return 'course.schedule.created';
  }

  constructor(
    readonly scheduleId: string,
    readonly courseId: string,
    readonly instructorId: string,
    readonly dayOfWeek: number,
    readonly startTime: string,
    readonly endTime: string,
    readonly room: string | null,
    readonly effectiveFrom: string,
    readonly effectiveTo: string | null,
    readonly isActive: boolean,
  ) {
    super();
  }
}
