import { DomainException } from '@repo/common';

export class LessonNotFoundException extends DomainException {
  readonly code = 'LESSON_NOT_FOUND';

  constructor(lessonId: string) {
    super(`Lesson with ID ${lessonId} not found`);
  }
}
