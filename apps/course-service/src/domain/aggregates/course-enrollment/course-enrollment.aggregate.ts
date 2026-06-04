import { AggregateRoot } from '@repo/common';
import { CourseEnrollmentCompletedEvent } from '../../events/course-enrollment-completed.event';
import { CourseEnrollmentProgressResetEvent } from '../../events/course-enrollment-progress-reset.event';
import { CourseLessonCompletedEvent } from '../../events/course-lesson-completed.event';
import { EnrollmentAlreadyCompletedException } from '../../exceptions/enrollment-already-completed.exception';
import {
  CreateEnrollmentProps,
  EnrollmentStatus,
  ReconstituteEnrollmentProps,
} from './course-enrollment.types';

export class CourseEnrollment extends AggregateRoot<string> {
  private _courseId: string;
  private _studentId: string;
  private _status: EnrollmentStatus;
  private _progress: number;
  private _enrolledAt: Date;
  private _completedAt: Date | null;
  private _lastResetAt: Date | null;

  private constructor(
    id: string,
    courseId: string,
    studentId: string,
    status: EnrollmentStatus,
    progress: number,
    enrolledAt: Date,
    completedAt: Date | null,
    lastResetAt: Date | null,
  ) {
    super(id);
    this._courseId = courseId;
    this._studentId = studentId;
    this._status = status;
    this._progress = progress;
    this._enrolledAt = enrolledAt;
    this._completedAt = completedAt;
    this._lastResetAt = lastResetAt;
  }

  static create(props: CreateEnrollmentProps): CourseEnrollment {
    return new CourseEnrollment(
      props.id,
      props.courseId,
      props.studentId,
      EnrollmentStatus.ACTIVE,
      0,
      new Date(),
      null,
      null,
    );
  }

  static reconstitute(props: ReconstituteEnrollmentProps): CourseEnrollment {
    return new CourseEnrollment(
      props.id,
      props.courseId,
      props.studentId,
      props.status,
      props.progress,
      props.enrolledAt,
      props.completedAt,
      props.lastResetAt,
    );
  }

  completeLesson(lessonId: string, totalLessons: number): void {
    if (this._status === EnrollmentStatus.COMPLETED) {
      throw new EnrollmentAlreadyCompletedException(this._id);
    }

    if (totalLessons > 0) {
      this._progress = Math.min(
        this._progress + Math.round(100 / totalLessons),
        100,
      );
    }

    this.addDomainEvent(
      new CourseLessonCompletedEvent(lessonId, this._studentId, this._courseId),
    );

    if (this._progress >= 100) {
      this._status = EnrollmentStatus.COMPLETED;
      this._completedAt = new Date();
      this.addDomainEvent(
        new CourseEnrollmentCompletedEvent(
          this._id,
          this._studentId,
          this._courseId,
        ),
      );
    }
  }

  drop(): void {
    this._status = EnrollmentStatus.DROPPED;
  }

  resetProgress(): void {
    this._status = EnrollmentStatus.ACTIVE;
    this._progress = 0;
    this._completedAt = null;
    this._lastResetAt = new Date();
    this.addDomainEvent(
      new CourseEnrollmentProgressResetEvent(
        this._id,
        this._studentId,
        this._courseId,
      ),
    );
  }

  get courseId(): string {
    return this._courseId;
  }
  get studentId(): string {
    return this._studentId;
  }
  get status(): EnrollmentStatus {
    return this._status;
  }
  get progress(): number {
    return this._progress;
  }
  get enrolledAt(): Date {
    return this._enrolledAt;
  }
  get completedAt(): Date | null {
    return this._completedAt;
  }
  get lastResetAt(): Date | null {
    return this._lastResetAt;
  }
}
