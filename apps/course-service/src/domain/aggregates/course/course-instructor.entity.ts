import { Entity } from '@repo/common';

export class CourseInstructor extends Entity<string> {
  private _courseId: string;
  private _instructorId: string;

  constructor(id: string, courseId: string, instructorId: string) {
    super(id);
    this._courseId = courseId;
    this._instructorId = instructorId;
  }

  get courseId(): string {
    return this._courseId;
  }
  get instructorId(): string {
    return this._instructorId;
  }
}
