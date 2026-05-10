import { Entity } from '@repo/common';
import { ReconstituteMaterialProps } from './course.types';

export class CourseMaterial extends Entity<string> {
  private _courseId: string;
  private _title: string;
  private _fileUrl: string | null;
  private _type: string | null;
  private _createdAt: Date;

  constructor(
    id: string,
    courseId: string,
    title: string,
    fileUrl: string | null,
    type: string | null,
    createdAt: Date,
  ) {
    super(id);
    this._courseId = courseId;
    this._title = title;
    this._fileUrl = fileUrl;
    this._type = type;
    this._createdAt = createdAt;
  }

  static reconstitute(props: ReconstituteMaterialProps): CourseMaterial {
    return new CourseMaterial(
      props.id,
      props.courseId,
      props.title,
      props.fileUrl,
      props.type,
      props.createdAt,
    );
  }

  get courseId(): string {
    return this._courseId;
  }
  get title(): string {
    return this._title;
  }
  get fileUrl(): string | null {
    return this._fileUrl;
  }
  get type(): string | null {
    return this._type;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
