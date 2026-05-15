import { AggregateRoot } from '@repo/common';
import {
  ExamTemplateAlreadyDeletedException,
  ExamTemplateVersionConflictException,
  InvalidExamTemplateException,
} from '../../exceptions/exam.exceptions';
import {
  CreateExamTemplateProps,
  LicenseCategory,
  ReconstituteExamTemplateProps,
  UpdateExamTemplateProps,
} from './exam-template.types';

export class ExamTemplate extends AggregateRoot<string> {
  private _name: string;
  private _licenseCategory: LicenseCategory;
  private _totalQuestions: number;
  private _passingScore: number;
  private _durationMinutes: number;
  private _isActive: boolean;
  private _isDeleted: boolean;
  private _version: number;
  private _createdById: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ReconstituteExamTemplateProps) {
    super(props.id);
    this._name = props.name;
    this._licenseCategory = props.licenseCategory;
    this._totalQuestions = props.totalQuestions;
    this._passingScore = props.passingScore;
    this._durationMinutes = props.durationMinutes;
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
      createdById: props.createdById,
    });
    const now = new Date();
    return new ExamTemplate({
      id: crypto.randomUUID(),
      name: props.name.trim(),
      licenseCategory: props.licenseCategory,
      totalQuestions: props.totalQuestions,
      passingScore: props.passingScore,
      durationMinutes: props.durationMinutes,
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
    const nextTotalQuestions = props.totalQuestions ?? this._totalQuestions;
    const nextPassingScore = props.passingScore ?? this._passingScore;
    const nextDurationMinutes = props.durationMinutes ?? this._durationMinutes;
    ExamTemplate.validate({
      name: nextName,
      totalQuestions: nextTotalQuestions,
      passingScore: nextPassingScore,
      durationMinutes: nextDurationMinutes,
      createdById: this._createdById,
    });

    this._name = nextName.trim();
    this._totalQuestions = nextTotalQuestions;
    this._passingScore = nextPassingScore;
    this._durationMinutes = nextDurationMinutes;
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
  }

  get name(): string {
    return this._name;
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
