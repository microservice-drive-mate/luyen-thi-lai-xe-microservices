import { DomainException } from '@repo/common';

export class CourseNotFoundException extends DomainException {
  readonly code = 'COURSE_NOT_FOUND';

  constructor(courseId: string) {
    super(`Không tìm thấy khóa học với ID ${courseId}`);
  }
}
