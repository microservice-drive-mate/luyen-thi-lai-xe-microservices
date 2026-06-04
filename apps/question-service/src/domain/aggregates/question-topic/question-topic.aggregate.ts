import { AggregateRoot } from '@repo/common';
import { InvalidQuestionException } from '../../exceptions/question.exceptions';
import {
  CreateQuestionTopicProps,
  ReconstituteQuestionTopicProps,
  UpdateQuestionTopicProps,
} from './question-topic.types';

export class QuestionTopic extends AggregateRoot<string> {
  private _name: string;
  private _description: string | null;
  private _parentId: string | null;
  private _createdAt: Date;

  private constructor(props: ReconstituteQuestionTopicProps) {
    super(props.id);
    this._name = props.name;
    this._description = props.description;
    this._parentId = props.parentId;
    this._createdAt = props.createdAt;
  }

  static create(props: CreateQuestionTopicProps): QuestionTopic {
    QuestionTopic.validateName(props.name);
    return new QuestionTopic({
      id: props.id,
      name: props.name.trim(),
      description: props.description ?? null,
      parentId: props.parentId ?? null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ReconstituteQuestionTopicProps): QuestionTopic {
    return new QuestionTopic(props);
  }

  update(props: UpdateQuestionTopicProps): void {
    if (props.name !== undefined) {
      QuestionTopic.validateName(props.name);
      this._name = props.name.trim();
    }
    if (props.description !== undefined) {
      this._description = props.description;
    }
    if (props.parentId !== undefined) {
      if (props.parentId === this.id) {
        throw new InvalidQuestionException('Topic cannot be its own parent');
      }
      this._parentId = props.parentId;
    }
  }

  private static validateName(name: string): void {
    if (!name?.trim()) {
      throw new InvalidQuestionException('Question topic name is required');
    }
  }

  get name(): string {
    return this._name;
  }

  get description(): string | null {
    return this._description;
  }

  get parentId(): string | null {
    return this._parentId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
