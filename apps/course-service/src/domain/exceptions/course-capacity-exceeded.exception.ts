import { DomainException } from '@repo/common';

export class CourseCapacityExceededException extends DomainException {
  readonly code = 'COURSE_CAPACITY_EXCEEDED';

  constructor(courseId: string, capacity: number) {
    super(`Khóa học ${courseId} đã đạt số lượng tối đa ${capacity} học viên`);
  }
}
