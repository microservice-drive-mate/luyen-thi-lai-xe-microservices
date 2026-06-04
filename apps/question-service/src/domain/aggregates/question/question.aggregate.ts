import { AggregateRoot } from '@repo/common';
import { QuestionCreatedEvent } from '../../events/question-created.event';
import { QuestionDeactivatedEvent } from '../../events/question-deactivated.event';
import { QuestionImageLinkedEvent } from '../../events/question-image-linked.event';
import {
  InvalidQuestionException,
  QuestionAlreadyDeletedException,
  QuestionVersionConflictException,
} from '../../exceptions/question.exceptions';
import { QuestionOption } from './question-option.entity';
import {
  CreateQuestionProps,
  LicenseCategory,
  QuestionDifficulty,
  QuestionOptionProps,
  QuestionType,
  ReconstituteQuestionProps,
  UpdateQuestionProps,
} from './question.types';

export class Question extends AggregateRoot<string> {
  private _content: string;
  private _type: QuestionType;
  private _licenseCategories: LicenseCategory[];
  private _difficulty: QuestionDifficulty;
  private _explanation: string;
  private _imageUrl: string | null;
  private _mediaFileId: string | null;
  private _isCritical: boolean;
  private _isActive: boolean;
  private _isDeleted: boolean;
  private _topicId: string;
  private _createdById: string;
  private _version: number;
  private _deletedById: string | null;
  private _deletedAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _options: QuestionOption[];

  private constructor(props: ReconstituteQuestionProps) {
    super(props.id);
    this._content = props.content;
    this._type = props.type;
    this._licenseCategories = props.licenseCategories;
    this._difficulty = props.difficulty;
    this._explanation = props.explanation;
    this._imageUrl = props.imageUrl;
    this._mediaFileId = props.mediaFileId;
    this._isCritical = props.isCritical;
    this._isActive = props.isActive;
    this._isDeleted = props.isDeleted;
    this._topicId = props.topicId;
    this._createdById = props.createdById;
    this._version = props.version;
    this._deletedById = props.deletedById;
    this._deletedAt = props.deletedAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._options = props.options.map(QuestionOption.reconstitute);
  }

  static create(props: CreateQuestionProps): Question {
    Question.validateQuestionProps(props);
    Question.validateOptions(props.options);

    const now = new Date();
    const question = new Question({
      id: props.id,
      content: props.content.trim(),
      type: props.type,
      licenseCategories: [...props.licenseCategories],
      difficulty: props.difficulty,
      explanation: props.explanation.trim(),
      imageUrl: props.imageUrl ?? null,
      mediaFileId: props.mediaFileId ?? null,
      isCritical: props.isCritical ?? false,
      isActive: props.isActive ?? true,
      isDeleted: false,
      topicId: props.topicId,
      createdById: props.createdById,
      version: 1,
      deletedById: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      options: props.options.map((option) => ({
        id: option.id,
        content: option.content.trim(),
        isCorrect: option.isCorrect,
        displayOrder: option.displayOrder,
      })),
    });

    question.addDomainEvent(
      new QuestionCreatedEvent(
        question.id,
        question.licenseCategories,
        question.isCritical,
      ),
    );
    if (question.mediaFileId) {
      question.addDomainEvent(
        new QuestionImageLinkedEvent(question.id, question.mediaFileId),
      );
    }

    return question;
  }

  static reconstitute(props: ReconstituteQuestionProps): Question {
    return new Question(props);
  }

  update(props: UpdateQuestionProps): void {
    this.assertNotDeleted();
    this.assertVersion(props.expectedVersion);

    const nextContent = props.content ?? this._content;
    const nextExplanation = props.explanation ?? this._explanation;
    const nextLicenseCategories =
      props.licenseCategories ?? this._licenseCategories;

    Question.validateQuestionProps({
      content: nextContent,
      type: props.type ?? this._type,
      licenseCategories: nextLicenseCategories,
      difficulty: props.difficulty ?? this._difficulty,
      explanation: nextExplanation,
      imageUrl: props.imageUrl ?? this._imageUrl,
      mediaFileId: props.mediaFileId ?? this._mediaFileId,
      isCritical: props.isCritical ?? this._isCritical,
      isActive: props.isActive ?? this._isActive,
      topicId: props.topicId ?? this._topicId,
      createdById: this._createdById,
      options: props.options ?? this.optionProps,
    });

    if (props.options) {
      Question.validateOptions(props.options);
      this._options = props.options.map(QuestionOption.create);
    }

    this._content = nextContent.trim();
    if (props.type !== undefined) this._type = props.type;
    this._licenseCategories = [...nextLicenseCategories];
    if (props.difficulty !== undefined) this._difficulty = props.difficulty;
    this._explanation = nextExplanation.trim();
    if (props.imageUrl !== undefined) this._imageUrl = props.imageUrl;
    if (props.mediaFileId !== undefined) {
      const previousMediaFileId = this._mediaFileId;
      this._mediaFileId = props.mediaFileId;
      if (props.mediaFileId && props.mediaFileId !== previousMediaFileId) {
        this.addDomainEvent(
          new QuestionImageLinkedEvent(this.id, props.mediaFileId),
        );
      }
    }
    if (props.isCritical !== undefined) this._isCritical = props.isCritical;
    if (props.isActive !== undefined) {
      const wasActive = this._isActive;
      this._isActive = props.isActive;
      if (wasActive && !props.isActive) {
        this.addDomainEvent(new QuestionDeactivatedEvent(this.id));
      }
    }
    if (props.topicId !== undefined) this._topicId = props.topicId;
    this.touch();
  }

  deactivate(expectedVersion: number): void {
    this.assertNotDeleted();
    this.assertVersion(expectedVersion);
    if (this._isActive) {
      this._isActive = false;
      this.addDomainEvent(new QuestionDeactivatedEvent(this.id));
      this.touch();
    }
  }

  softDelete(deletedById: string, expectedVersion: number): void {
    this.assertNotDeleted();
    this.assertVersion(expectedVersion);
    this._isDeleted = true;
    this._isActive = false;
    this._deletedById = deletedById;
    this._deletedAt = new Date();
    this.addDomainEvent(new QuestionDeactivatedEvent(this.id));
    this.touch();
  }

  private touch(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }

  private assertNotDeleted(): void {
    if (this._isDeleted) {
      throw new QuestionAlreadyDeletedException(this.id);
    }
  }

  private assertVersion(expectedVersion: number): void {
    if (this._version !== expectedVersion) {
      throw new QuestionVersionConflictException(this.id);
    }
  }

  private static validateQuestionProps(
    props: Omit<CreateQuestionProps, 'id'>,
  ): void {
    if (!props.content?.trim()) {
      throw new InvalidQuestionException('Question content is required');
    }
    if (props.content.trim().length > 2000) {
      throw new InvalidQuestionException(
        'Question content must be at most 2000 characters',
      );
    }
    if (!props.explanation?.trim()) {
      throw new InvalidQuestionException('Question explanation is required');
    }
    if (!props.topicId?.trim()) {
      throw new InvalidQuestionException('Question topicId is required');
    }
    if (!props.createdById?.trim()) {
      throw new InvalidQuestionException('Question createdById is required');
    }
    if (!props.licenseCategories?.length) {
      throw new InvalidQuestionException(
        'Question must have at least one license category',
      );
    }
  }

  private static validateOptions(options: QuestionOptionProps[]): void {
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw new InvalidQuestionException(
        'Question must have between 2 and 6 options',
      );
    }
    const correctCount = options.filter((option) => option.isCorrect).length;
    if (correctCount !== 1) {
      throw new InvalidQuestionException(
        'Question must have exactly one correct option',
      );
    }
    const displayOrders = new Set(options.map((option) => option.displayOrder));
    if (displayOrders.size !== options.length) {
      throw new InvalidQuestionException(
        'Question option displayOrder values must be unique',
      );
    }
    options.forEach(QuestionOption.create);
  }

  private get optionProps(): QuestionOptionProps[] {
    return this._options.map((option) => ({
      id: option.id,
      content: option.content,
      isCorrect: option.isCorrect,
      displayOrder: option.displayOrder,
    }));
  }

  get content(): string {
    return this._content;
  }

  get type(): QuestionType {
    return this._type;
  }

  get licenseCategories(): LicenseCategory[] {
    return [...this._licenseCategories];
  }

  get difficulty(): QuestionDifficulty {
    return this._difficulty;
  }

  get explanation(): string {
    return this._explanation;
  }

  get imageUrl(): string | null {
    return this._imageUrl;
  }

  get mediaFileId(): string | null {
    return this._mediaFileId;
  }

  get isCritical(): boolean {
    return this._isCritical;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isDeleted(): boolean {
    return this._isDeleted;
  }

  get topicId(): string {
    return this._topicId;
  }

  get createdById(): string {
    return this._createdById;
  }

  get version(): number {
    return this._version;
  }

  get deletedById(): string | null {
    return this._deletedById;
  }

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get options(): QuestionOption[] {
    return [...this._options].sort((a, b) => a.displayOrder - b.displayOrder);
  }
}
