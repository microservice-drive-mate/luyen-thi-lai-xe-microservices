import { AggregateRoot } from '@repo/common';
import { CourseEnrollmentCompletedEvent } from '../../events/course-enrollment-completed.event';
import { CourseLessonCompletedEvent } from '../../events/course-lesson-completed.event';
import { EnrollmentAlreadyCompletedException } from '../../exceptions/enrollment-already-completed.exception';
import { LessonAlreadyCompletedException } from '../../exceptions/lesson-already-completed.exception';
import { LessonProgress } from './lesson-progress.entity';
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
  private _lessonProgress: LessonProgress[];

  private constructor(
    id: string,
    courseId: string,
    studentId: string,
    status: EnrollmentStatus,
    progress: number,
    enrolledAt: Date,
    completedAt: Date | null,
    lessonProgress: LessonProgress[],
  ) {
    super(id);
    this._courseId = courseId;
    this._studentId = studentId;
    this._status = status;
    this._progress = progress;
    this._enrolledAt = enrolledAt;
    this._completedAt = completedAt;
    this._lessonProgress = lessonProgress;
  }

  static create(props: CreateEnrollmentProps): CourseEnrollment {
    return new CourseEnrollment(
      crypto.randomUUID(),
      props.courseId,
      props.studentId,
      EnrollmentStatus.ACTIVE,
      0,
      new Date(),
      null,
      [],
    );
  }

  static reconstitute(props: ReconstituteEnrollmentProps): CourseEnrollment {
    const lessonProgress = props.lessonProgress.map((lp) =>
      LessonProgress.reconstitute(lp),
    );
    return new CourseEnrollment(
      props.id,
      props.courseId,
      props.studentId,
      props.status,
      props.progress,
      props.enrolledAt,
      props.completedAt,
      lessonProgress,
    );
  }

  completeLesson(
    lessonId: string,
    watchedSeconds: number,
    totalLessons: number,
  ): void {
    if (this._status === EnrollmentStatus.COMPLETED) {
      throw new EnrollmentAlreadyCompletedException(this._id);
    }

    const existing = this._lessonProgress.find(
      (lp) => lp.lessonId === lessonId,
    );
    if (existing) {
      if (existing.isCompleted)
        throw new LessonAlreadyCompletedException(lessonId);
      existing.markCompleted(watchedSeconds);
    } else {
      const newProgress = new LessonProgress(
        crypto.randomUUID(),
        this._id,
        lessonId,
        new Date(),
        watchedSeconds,
      );
      this._lessonProgress.push(newProgress);
    }

    const completedCount = this._lessonProgress.filter(
      (lp) => lp.isCompleted,
    ).length;
    this._progress =
      totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    this.addDomainEvent(
      new CourseLessonCompletedEvent(
        lessonId,
        this._studentId,
        this._courseId,
        watchedSeconds,
      ),
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
  get lessonProgress(): LessonProgress[] {
    return [...this._lessonProgress];
  }
}
