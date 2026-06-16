import { DomainEvent } from '@repo/common';

export class CourseLessonCompletedEvent extends DomainEvent {
  constructor(
    readonly enrollmentId: string,
    readonly lessonId: string,
    readonly studentId: string,
    readonly courseId: string,
    readonly status: string,
    readonly progress: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'course.lesson.completed';
  }
}
