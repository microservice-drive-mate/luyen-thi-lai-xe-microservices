import { DomainException } from '@repo/common';

export class CourseHasNoLessonException extends DomainException {
  readonly code = 'COURSE_HAS_NO_LESSON';

  constructor(courseId: string) {
    super(
      `Khóa học ${courseId} phải có ít nhất một bài học trước khi kích hoạt`,
    );
  }
}
