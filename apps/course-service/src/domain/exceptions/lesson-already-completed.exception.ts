import { DomainException } from '@repo/common';

export class LessonAlreadyCompletedException extends DomainException {
  readonly code = 'LESSON_ALREADY_COMPLETED';

  constructor(lessonId: string) {
    super(`Bài học ${lessonId} đã được hoàn thành`);
  }
}
