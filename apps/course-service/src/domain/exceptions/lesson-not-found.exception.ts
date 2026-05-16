import { DomainException } from '@repo/common';

export class LessonNotFoundException extends DomainException {
  readonly code = 'LESSON_NOT_FOUND';

  constructor(lessonId: string) {
    super(`Không tìm thấy bài học với ID ${lessonId}`);
  }
}
