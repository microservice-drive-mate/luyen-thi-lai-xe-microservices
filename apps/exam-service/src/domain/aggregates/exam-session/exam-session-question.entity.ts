import { Entity } from '@repo/common';
import { InvalidExamSessionException } from '../../exceptions/exam.exceptions';
import {
  ExamQuestionOptionSnapshot,
  ExamQuestionSnapshot,
} from './exam-session.types';

export class ExamSessionQuestion extends Entity<string> {
  private _selectedOptionId: string | null;
  private _isCorrect: boolean | null;
  private _isBookmarked: boolean;
  private _answeredAt: Date | null;

  private constructor(
    id: string,
    readonly questionId: string,
    readonly questionContent: string,
    readonly optionsSnapshot: ExamQuestionOptionSnapshot[],
    readonly correctOptionId: string,
    readonly isCritical: boolean,
    readonly displayOrder: number,
    selectedOptionId: string | null,
    isCorrect: boolean | null,
    isBookmarked: boolean,
    answeredAt: Date | null,
  ) {
    super(id);
    this._selectedOptionId = selectedOptionId;
    this._isCorrect = isCorrect;
    this._isBookmarked = isBookmarked;
    this._answeredAt = answeredAt;
  }

  static create(props: ExamQuestionSnapshot): ExamSessionQuestion {
    ExamSessionQuestion.validate(props);
    return new ExamSessionQuestion(
      props.id ?? crypto.randomUUID(),
      props.questionId,
      props.questionContent.trim(),
      [...props.optionsSnapshot].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      ),
      props.correctOptionId,
      props.isCritical,
      props.displayOrder,
      props.selectedOptionId ?? null,
      props.isCorrect ?? null,
      props.isBookmarked ?? false,
      props.answeredAt ?? null,
    );
  }

  answer(selectedOptionId: string | null): void {
    this._selectedOptionId = selectedOptionId;
    this._answeredAt = selectedOptionId ? new Date() : null;
  }

  setBookmarked(isBookmarked: boolean): void {
    this._isBookmarked = isBookmarked;
  }

  grade(): boolean {
    const correct = this._selectedOptionId === this.correctOptionId;
    this._isCorrect = correct;
    return correct;
  }

  private static validate(props: ExamQuestionSnapshot): void {
    if (!props.questionId?.trim())
      throw new InvalidExamSessionException('questionId is required');
    if (!props.questionContent?.trim())
      throw new InvalidExamSessionException('questionContent is required');
    if (!props.correctOptionId?.trim())
      throw new InvalidExamSessionException('correctOptionId is required');
    if (!Number.isInteger(props.displayOrder) || props.displayOrder < 1) {
      throw new InvalidExamSessionException(
        'displayOrder must be a positive integer',
      );
    }
    if (
      !Array.isArray(props.optionsSnapshot) ||
      props.optionsSnapshot.length < 2
    ) {
      throw new InvalidExamSessionException(
        'optionsSnapshot must contain at least two options',
      );
    }
    if (
      !props.optionsSnapshot.some(
        (option) => option.id === props.correctOptionId,
      )
    ) {
      throw new InvalidExamSessionException(
        'correctOptionId must exist in optionsSnapshot',
      );
    }
  }

  get selectedOptionId(): string | null {
    return this._selectedOptionId;
  }
  get isCorrect(): boolean | null {
    return this._isCorrect;
  }
  get isBookmarked(): boolean {
    return this._isBookmarked;
  }
  get answeredAt(): Date | null {
    return this._answeredAt;
  }
}
