import { AggregateRoot } from '@repo/common';
import {
  ExamTemplateAlreadyDeletedException,
  ExamTemplateVersionConflictException,
  InvalidExamTemplateException,
} from '../../exceptions/exam.exceptions';
import {
  CreateExamTemplateProps,
  ExamTopicDistributionItem,
  LicenseCategory,
  ReconstituteExamTemplateProps,
  UpdateExamTemplateProps,
} from './exam-template.types';

export class ExamTemplate extends AggregateRoot<string> {
  private _name: string;
  private _description: string | null;
  private _licenseCategory: LicenseCategory;
  private _totalQuestions: number;
  private _passingScore: number;
  private _durationMinutes: number;
  private _criticalQuestions: number;
  private _maxCriticalMistakes: number;
  private _shuffleQuestions: boolean;
  private _topicDistribution: ExamTopicDistributionItem[];
  private _isActive: boolean;
  private _isDeleted: boolean;
  private _version: number;
  private _createdById: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ReconstituteExamTemplateProps) {
    super(props.id);
    this._name = props.name;
    this._description = props.description ?? null;
    this._licenseCategory = props.licenseCategory;
    this._totalQuestions = props.totalQuestions;
    this._passingScore = props.passingScore;
    this._durationMinutes = props.durationMinutes;
    this._criticalQuestions = props.criticalQuestions;
    this._maxCriticalMistakes = props.maxCriticalMistakes;
    this._shuffleQuestions = props.shuffleQuestions;
    this._topicDistribution = props.topicDistribution.map((item) => ({
      ...item,
    }));
    this._isActive = props.isActive;
    this._isDeleted = props.isDeleted;
    this._version = props.version;
    this._createdById = props.createdById;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateExamTemplateProps): ExamTemplate {
    ExamTemplate.validate({
      name: props.name,
      totalQuestions: props.totalQuestions,
      passingScore: props.passingScore,
      durationMinutes: props.durationMinutes,
      criticalQuestions: props.criticalQuestions,
      maxCriticalMistakes: props.maxCriticalMistakes,
      topicDistribution: props.topicDistribution,
      createdById: props.createdById,
    });
    const now = new Date();
    return new ExamTemplate({
      id: props.id,
      name: props.name.trim(),
      description: props.description?.trim() || null,
      licenseCategory: props.licenseCategory,
      totalQuestions: props.totalQuestions,
      passingScore: props.passingScore,
      durationMinutes: props.durationMinutes,
      criticalQuestions: props.criticalQuestions,
      maxCriticalMistakes: props.maxCriticalMistakes,
      shuffleQuestions: props.shuffleQuestions,
      topicDistribution: props.topicDistribution,
      createdById: props.createdById,
      isActive: true,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ReconstituteExamTemplateProps): ExamTemplate {
    return new ExamTemplate(props);
  }

  update(props: UpdateExamTemplateProps): void {
    this.assertNotDeleted();
    this.assertVersion(props.expectedVersion);
    const nextName = props.name ?? this._name;
    const nextDescription =
      props.description !== undefined ? props.description : this._description;
    const nextTotalQuestions = props.totalQuestions ?? this._totalQuestions;
    const nextPassingScore = props.passingScore ?? this._passingScore;
    const nextDurationMinutes = props.durationMinutes ?? this._durationMinutes;
    const nextCriticalQuestions =
      props.criticalQuestions ?? this._criticalQuestions;
    const nextMaxCriticalMistakes =
      props.maxCriticalMistakes ?? this._maxCriticalMistakes;
    const nextTopicDistribution =
      props.topicDistribution ?? this._topicDistribution;
    ExamTemplate.validate({
      name: nextName,
      totalQuestions: nextTotalQuestions,
      passingScore: nextPassingScore,
      durationMinutes: nextDurationMinutes,
      criticalQuestions: nextCriticalQuestions,
      maxCriticalMistakes: nextMaxCriticalMistakes,
      topicDistribution: nextTopicDistribution,
      createdById: this._createdById,
    });

    this._name = nextName.trim();
    this._description = nextDescription?.trim() || null;
    this._totalQuestions = nextTotalQuestions;
    this._passingScore = nextPassingScore;
    this._durationMinutes = nextDurationMinutes;
    this._criticalQuestions = nextCriticalQuestions;
    this._maxCriticalMistakes = nextMaxCriticalMistakes;
    if (props.shuffleQuestions !== undefined) {
      this._shuffleQuestions = props.shuffleQuestions;
    }
    this._topicDistribution = nextTopicDistribution.map((item) => ({
      ...item,
    }));
    if (props.isActive !== undefined) this._isActive = props.isActive;
    this.touch();
  }

  softDelete(expectedVersion: number): void {
    this.assertNotDeleted();
    this.assertVersion(expectedVersion);
    this._isDeleted = true;
    this._isActive = false;
    this.touch();
  }

  private touch(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }

  private assertNotDeleted(): void {
    if (this._isDeleted) throw new ExamTemplateAlreadyDeletedException(this.id);
  }

  private assertVersion(expectedVersion: number): void {
    if (this._version !== expectedVersion) {
      throw new ExamTemplateVersionConflictException(this.id);
    }
  }

  private static validate(props: {
    name: string;
    totalQuestions: number;
    passingScore: number;
    durationMinutes: number;
    criticalQuestions: number;
    maxCriticalMistakes: number;
    topicDistribution: ExamTopicDistributionItem[];
    createdById: string;
  }): void {
    if (!props.name?.trim())
      throw new InvalidExamTemplateException('Template name is required');
    if (!props.createdById?.trim())
      throw new InvalidExamTemplateException('createdById is required');
    if (!Number.isInteger(props.totalQuestions) || props.totalQuestions < 1) {
      throw new InvalidExamTemplateException(
        'totalQuestions must be a positive integer',
      );
    }
    if (!Number.isInteger(props.passingScore) || props.passingScore < 1) {
      throw new InvalidExamTemplateException(
        'passingScore must be a positive integer',
      );
    }
    if (props.passingScore > props.totalQuestions) {
      throw new InvalidExamTemplateException(
        'passingScore cannot exceed totalQuestions',
      );
    }
    if (
      !Number.isInteger(props.durationMinutes) ||
      props.durationMinutes < 1 ||
      props.durationMinutes > 180
    ) {
      throw new InvalidExamTemplateException(
        'durationMinutes must be between 1 and 180',
      );
    }
    if (
      !Number.isInteger(props.criticalQuestions) ||
      props.criticalQuestions < 0
    ) {
      throw new InvalidExamTemplateException(
        'criticalQuestions must be a non-negative integer',
      );
    }
    if (props.criticalQuestions > props.totalQuestions) {
      throw new InvalidExamTemplateException(
        'criticalQuestions cannot exceed totalQuestions',
      );
    }
    if (
      !Number.isInteger(props.maxCriticalMistakes) ||
      props.maxCriticalMistakes < 0
    ) {
      throw new InvalidExamTemplateException(
        'maxCriticalMistakes must be a non-negative integer',
      );
    }
    if (props.maxCriticalMistakes > props.criticalQuestions) {
      throw new InvalidExamTemplateException(
        'maxCriticalMistakes cannot exceed criticalQuestions',
      );
    }
    if (
      !Array.isArray(props.topicDistribution) ||
      props.topicDistribution.length < 1
    ) {
      throw new InvalidExamTemplateException(
        'topicDistribution must contain at least one topic',
      );
    }
    const topicIds = new Set<string>();
    const totalDistributedQuestions = props.topicDistribution.reduce(
      (sum, item) => {
        if (!item.topicId?.trim()) {
          throw new InvalidExamTemplateException(
            'topicDistribution topicId is required',
          );
        }
        if (topicIds.has(item.topicId)) {
          throw new InvalidExamTemplateException(
            'topicDistribution cannot contain duplicate topicId',
          );
        }
        topicIds.add(item.topicId);
        if (!Number.isInteger(item.questionCount) || item.questionCount < 1) {
          throw new InvalidExamTemplateException(
            'topicDistribution questionCount must be a positive integer',
          );
        }
        return sum + item.questionCount;
      },
      0,
    );
    if (totalDistributedQuestions !== props.totalQuestions) {
      throw new InvalidExamTemplateException(
        'topicDistribution questionCount total must equal totalQuestions',
      );
    }
  }

  get name(): string {
    return this._name;
  }
  get description(): string | null {
    return this._description;
  }
  get licenseCategory(): LicenseCategory {
    return this._licenseCategory;
  }
  get totalQuestions(): number {
    return this._totalQuestions;
  }
  get passingScore(): number {
    return this._passingScore;
  }
  get durationMinutes(): number {
    return this._durationMinutes;
  }
  get criticalQuestions(): number {
    return this._criticalQuestions;
  }
  get maxCriticalMistakes(): number {
    return this._maxCriticalMistakes;
  }
  get shuffleQuestions(): boolean {
    return this._shuffleQuestions;
  }
  get topicDistribution(): ExamTopicDistributionItem[] {
    return this._topicDistribution.map((item) => ({ ...item }));
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get isDeleted(): boolean {
    return this._isDeleted;
  }
  get version(): number {
    return this._version;
  }
  get createdById(): string {
    return this._createdById;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
