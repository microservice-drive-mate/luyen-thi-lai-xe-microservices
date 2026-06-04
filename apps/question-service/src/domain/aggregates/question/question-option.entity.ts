import { Entity } from '@repo/common';
import { InvalidQuestionException } from '../../exceptions/question.exceptions';
import { QuestionOptionProps } from './question.types';

export class QuestionOption extends Entity<string> {
  private _content: string;
  private _isCorrect: boolean;
  private _displayOrder: number;

  private constructor(
    id: string,
    content: string,
    isCorrect: boolean,
    displayOrder: number,
  ) {
    super(id);
    this._content = content;
    this._isCorrect = isCorrect;
    this._displayOrder = displayOrder;
  }

  static create(props: QuestionOptionProps): QuestionOption {
    QuestionOption.validate(props);
    return new QuestionOption(
      props.id,
      props.content.trim(),
      props.isCorrect,
      props.displayOrder,
    );
  }

  static reconstitute(props: QuestionOptionProps): QuestionOption {
    return new QuestionOption(
      props.id,
      props.content,
      props.isCorrect,
      props.displayOrder,
    );
  }

  private static validate(props: QuestionOptionProps): void {
    if (!props.content?.trim()) {
      throw new InvalidQuestionException('Question option content is required');
    }
    if (props.content.trim().length > 500) {
      throw new InvalidQuestionException(
        'Question option content must be at most 500 characters',
      );
    }
    if (!Number.isInteger(props.displayOrder) || props.displayOrder < 1) {
      throw new InvalidQuestionException(
        'Question option displayOrder must be a positive integer',
      );
    }
  }

  get content(): string {
    return this._content;
  }

  get isCorrect(): boolean {
    return this._isCorrect;
  }

  get displayOrder(): number {
    return this._displayOrder;
  }
}
