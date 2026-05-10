import { DomainException } from '@repo/common';

export class LessonAlreadyCompletedException extends DomainException {
  readonly code = 'LESSON_ALREADY_COMPLETED';

  constructor(lessonId: string) {
    super(`Lesson ${lessonId} has already been completed`);
  }
}
