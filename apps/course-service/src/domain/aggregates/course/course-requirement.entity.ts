import { Entity } from '@repo/common';
import {
  CreateRequirementProps,
  ReconstituteRequirementProps,
} from './course.types';

export class CourseRequirement extends Entity<string> {
  private _courseId: string;
  private _minAge: number | null;
  private _prerequisites: string | null;
  private _attendanceRate: number;
  private _minPassScore: number;
  private _requiredExams: number;

  constructor(
    id: string,
    courseId: string,
    minAge: number | null,
    prerequisites: string | null,
    attendanceRate: number,
    minPassScore: number,
    requiredExams: number,
  ) {
    super(id);
    this._courseId = courseId;
    this._minAge = minAge;
    this._prerequisites = prerequisites;
    this._attendanceRate = attendanceRate;
    this._minPassScore = minPassScore;
    this._requiredExams = requiredExams;
  }

  static create(
    courseId: string,
    props: CreateRequirementProps,
  ): CourseRequirement {
    if (!props.id?.trim()) {
      throw new Error('Course requirement id is required');
    }

    return new CourseRequirement(
      props.id,
      courseId,
      props.minAge ?? null,
      props.prerequisites ?? null,
      props.attendanceRate ?? 80,
      props.minPassScore ?? 80,
      props.requiredExams ?? 0,
    );
  }

  static reconstitute(props: ReconstituteRequirementProps): CourseRequirement {
    return new CourseRequirement(
      props.id,
      props.courseId,
      props.minAge,
      props.prerequisites,
      props.attendanceRate,
      props.minPassScore,
      props.requiredExams,
    );
  }

  update(props: CreateRequirementProps): void {
    if (props.minAge !== undefined) this._minAge = props.minAge ?? null;
    if (props.prerequisites !== undefined)
      this._prerequisites = props.prerequisites ?? null;
    if (props.attendanceRate !== undefined)
      this._attendanceRate = props.attendanceRate;
    if (props.minPassScore !== undefined)
      this._minPassScore = props.minPassScore;
    if (props.requiredExams !== undefined)
      this._requiredExams = props.requiredExams;
  }

  get courseId(): string {
    return this._courseId;
  }
  get minAge(): number | null {
    return this._minAge;
  }
  get prerequisites(): string | null {
    return this._prerequisites;
  }
  get attendanceRate(): number {
    return this._attendanceRate;
  }
  get minPassScore(): number {
    return this._minPassScore;
  }
  get requiredExams(): number {
    return this._requiredExams;
  }
}
