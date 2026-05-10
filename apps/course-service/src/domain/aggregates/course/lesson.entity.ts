import { Entity } from '@repo/common';
import { ReconstituteLessonProps, UpdateLessonProps } from './course.types';

export class Lesson extends Entity<string> {
  private _courseId: string;
  private _title: string;
  private _content: string | null;
  private _videoUrl: string | null;
  private _durationMinutes: number;
  private _order: number;
  private _createdAt: Date;

  constructor(
    id: string,
    courseId: string,
    title: string,
    content: string | null,
    videoUrl: string | null,
    durationMinutes: number,
    order: number,
    createdAt: Date,
  ) {
    super(id);
    this._courseId = courseId;
    this._title = title;
    this._content = content;
    this._videoUrl = videoUrl;
    this._durationMinutes = durationMinutes;
    this._order = order;
    this._createdAt = createdAt;
  }

  static reconstitute(props: ReconstituteLessonProps): Lesson {
    return new Lesson(
      props.id,
      props.courseId,
      props.title,
      props.content,
      props.videoUrl,
      props.durationMinutes,
      props.order,
      props.createdAt,
    );
  }

  update(props: UpdateLessonProps): void {
    if (props.title !== undefined) this._title = props.title;
    if (props.content !== undefined) this._content = props.content;
    if (props.videoUrl !== undefined) this._videoUrl = props.videoUrl;
    if (props.durationMinutes !== undefined)
      this._durationMinutes = props.durationMinutes;
    if (props.order !== undefined) this._order = props.order;
  }

  get courseId(): string {
    return this._courseId;
  }
  get title(): string {
    return this._title;
  }
  get content(): string | null {
    return this._content;
  }
  get videoUrl(): string | null {
    return this._videoUrl;
  }
  get durationMinutes(): number {
    return this._durationMinutes;
  }
  get order(): number {
    return this._order;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
