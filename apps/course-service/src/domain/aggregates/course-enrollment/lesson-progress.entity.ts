import { Entity } from '@repo/common';
import { ReconstituteLessonProgressProps } from './course-enrollment.types';

export class LessonProgress extends Entity<string> {
  private _enrollmentId: string;
  private _lessonId: string;
  private _completedAt: Date | null;
  private _watchedSeconds: number;

  constructor(
    id: string,
    enrollmentId: string,
    lessonId: string,
    completedAt: Date | null,
    watchedSeconds: number,
  ) {
    super(id);
    this._enrollmentId = enrollmentId;
    this._lessonId = lessonId;
    this._completedAt = completedAt;
    this._watchedSeconds = watchedSeconds;
  }

  static reconstitute(props: ReconstituteLessonProgressProps): LessonProgress {
    return new LessonProgress(
      props.id,
      props.enrollmentId,
      props.lessonId,
      props.completedAt,
      props.watchedSeconds,
    );
  }

  markCompleted(watchedSeconds: number): void {
    this._completedAt = new Date();
    this._watchedSeconds = watchedSeconds;
  }

  get enrollmentId(): string {
    return this._enrollmentId;
  }
  get lessonId(): string {
    return this._lessonId;
  }
  get completedAt(): Date | null {
    return this._completedAt;
  }
  get watchedSeconds(): number {
    return this._watchedSeconds;
  }
  get isCompleted(): boolean {
    return this._completedAt !== null;
  }
}
