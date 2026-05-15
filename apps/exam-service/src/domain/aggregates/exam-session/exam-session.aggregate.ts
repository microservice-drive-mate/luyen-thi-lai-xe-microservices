import { AggregateRoot } from '@repo/common';
import { ExamSessionCompletedEvent } from '../../events/exam-session-completed.event';
import { ExamSessionFailedEvent } from '../../events/exam-session-failed.event';
import { ExamSessionPassedEvent } from '../../events/exam-session-passed.event';
import {
  ExamSessionAlreadyFinishedException,
  ExamSessionExpiredException,
  ExamSessionNotFinishedException,
  ExamSessionQuestionNotFoundException,
  ExamSessionUnauthorizedException,
  InvalidExamSessionException,
} from '../../exceptions/exam.exceptions';
import { LicenseCategory } from '../exam-template/exam-template.types';
import { ExamSessionQuestion } from './exam-session-question.entity';
import {
  CreateExamSessionProps,
  ExamSessionStatus,
  ReconstituteExamSessionProps,
} from './exam-session.types';

export class ExamSession extends AggregateRoot<string> {
  private _status: ExamSessionStatus;
  private _score: number | null;
  private _isPassed: boolean | null;
  private _failedByCritical: boolean;
  private _startedAt: Date;
  private _finishedAt: Date | null;
  private _expiresAt: Date;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _questions: ExamSessionQuestion[];

  private constructor(
    id: string,
    readonly studentId: string,
    readonly templateId: string,
    readonly licenseCategory: LicenseCategory,
    readonly passingScore: number,
    readonly durationMinutes: number,
    props: Omit<
      ReconstituteExamSessionProps,
      | 'id'
      | 'studentId'
      | 'templateId'
      | 'licenseCategory'
      | 'passingScore'
      | 'durationMinutes'
    >,
  ) {
    super(id);
    this._status = props.status;
    this._score = props.score;
    this._isPassed = props.isPassed;
    this._failedByCritical = props.failedByCritical;
    this._startedAt = props.startedAt;
    this._finishedAt = props.finishedAt;
    this._expiresAt = props.expiresAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._questions = props.questions.map(ExamSessionQuestion.create);
  }

  static create(props: CreateExamSessionProps): ExamSession {
    if (!props.studentId?.trim())
      throw new InvalidExamSessionException('studentId is required');
    if (!props.templateId?.trim())
      throw new InvalidExamSessionException('templateId is required');
    if (props.questions.length < 1)
      throw new InvalidExamSessionException('questions are required');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + props.durationMinutes * 60_000);
    return new ExamSession(
      crypto.randomUUID(),
      props.studentId,
      props.templateId,
      props.licenseCategory,
      props.passingScore,
      props.durationMinutes,
      {
        status: ExamSessionStatus.IN_PROGRESS,
        score: null,
        isPassed: null,
        failedByCritical: false,
        startedAt: now,
        finishedAt: null,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        questions: props.questions,
      },
    );
  }

  static reconstitute(props: ReconstituteExamSessionProps): ExamSession {
    return new ExamSession(
      props.id,
      props.studentId,
      props.templateId,
      props.licenseCategory,
      props.passingScore,
      props.durationMinutes,
      props,
    );
  }

  assertOwner(studentId: string): void {
    if (this.studentId !== studentId)
      throw new ExamSessionUnauthorizedException(this.id);
  }

  saveAnswer(
    questionId: string,
    selectedOptionId?: string | null,
    isBookmarked?: boolean,
  ): void {
    this.assertInProgress();
    this.assertNotExpired();
    const question = this.findQuestion(questionId);
    if (selectedOptionId !== undefined) question.answer(selectedOptionId);
    if (isBookmarked !== undefined) question.setBookmarked(isBookmarked);
    this.touch();
  }

  submit(now = new Date()): void {
    this.assertInProgress();
    if (now > this._expiresAt) {
      this.grade(ExamSessionStatus.TIMED_OUT, now);
      return;
    }
    this.grade(ExamSessionStatus.COMPLETED, now);
  }

  ensureFinished(): void {
    if (this._status === ExamSessionStatus.IN_PROGRESS) {
      throw new ExamSessionNotFinishedException(this.id);
    }
  }

  private assertInProgress(): void {
    if (this._status !== ExamSessionStatus.IN_PROGRESS) {
      throw new ExamSessionAlreadyFinishedException(this.id);
    }
  }

  private assertNotExpired(): void {
    if (new Date() > this._expiresAt)
      throw new ExamSessionExpiredException(this.id);
  }

  private findQuestion(questionId: string): ExamSessionQuestion {
    const question = this._questions.find(
      (item) => item.questionId === questionId,
    );
    if (!question) throw new ExamSessionQuestionNotFoundException(questionId);
    return question;
  }

  private grade(status: ExamSessionStatus, finishedAt: Date): void {
    let score = 0;
    let failedByCritical = false;
    for (const question of this._questions) {
      const correct = question.grade();
      if (correct) score += 1;
      if (question.isCritical && !correct) failedByCritical = true;
    }
    this._score = score;
    this._failedByCritical = failedByCritical;
    this._isPassed = !failedByCritical && score >= this.passingScore;
    this._status = status;
    this._finishedAt = finishedAt;
    this.touch();
    this.addDomainEvent(
      new ExamSessionCompletedEvent(
        this.id,
        this.studentId,
        score,
        this._isPassed,
        this.licenseCategory,
      ),
    );
    if (this._isPassed) {
      this.addDomainEvent(
        new ExamSessionPassedEvent(
          this.id,
          this.studentId,
          this.licenseCategory,
        ),
      );
    } else {
      this.addDomainEvent(
        new ExamSessionFailedEvent(
          this.id,
          this.studentId,
          failedByCritical,
          this.licenseCategory,
        ),
      );
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  get status(): ExamSessionStatus {
    return this._status;
  }
  get score(): number | null {
    return this._score;
  }
  get isPassed(): boolean | null {
    return this._isPassed;
  }
  get failedByCritical(): boolean {
    return this._failedByCritical;
  }
  get startedAt(): Date {
    return this._startedAt;
  }
  get finishedAt(): Date | null {
    return this._finishedAt;
  }
  get expiresAt(): Date {
    return this._expiresAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get questions(): ExamSessionQuestion[] {
    return [...this._questions].sort((a, b) => a.displayOrder - b.displayOrder);
  }
}
