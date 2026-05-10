import { DomainEvent } from '@repo/common';

export class CourseLessonCompletedEvent extends DomainEvent {
  constructor(
    readonly lessonId: string,
    readonly studentId: string,
    readonly courseId: string,
    readonly watchedSeconds: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'course.lesson.completed';
  }
}
