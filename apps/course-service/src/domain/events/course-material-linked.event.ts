import { DomainEvent } from '@repo/common';

export class CourseMaterialLinkedEvent extends DomainEvent {
  get eventName(): string {
    return 'course.material.linked';
  }

  constructor(
    readonly courseId: string,
    readonly materialId: string,
    readonly mediaFileId: string,
  ) {
    super();
  }
}
