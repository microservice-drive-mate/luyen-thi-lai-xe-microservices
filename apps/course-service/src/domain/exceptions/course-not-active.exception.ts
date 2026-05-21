import { DomainException } from '@repo/common';

export class CourseNotActiveException extends DomainException {
  readonly code = 'COURSE_NOT_ACTIVE';

  constructor(courseId: string) {
    super(
      `Khóa học ${courseId} không hoạt động và không thể nhận thêm học viên`,
    );
  }
}
