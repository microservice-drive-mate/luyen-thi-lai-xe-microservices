import { AggregateRoot } from '@repo/common';
import { CourseInstructor } from './course-instructor.entity';
import { CourseMaterial } from './course-material.entity';
import { CourseRequirement } from './course-requirement.entity';
import { Lesson } from './lesson.entity';
import {
  CourseStatus,
  CreateCourseProps,
  CreateLessonProps,
  CreateMaterialProps,
  CreateRequirementProps,
  LicenseCategory,
  ReconstituteCourseProps,
  UpdateCourseProps,
  UpdateLessonProps,
} from './course.types';
import { CourseHasNoLessonException } from '../../exceptions/course-has-no-lesson.exception';
import { InstructorAlreadyAssignedException } from '../../exceptions/instructor-already-assigned.exception';
import { LessonNotFoundException } from '../../exceptions/lesson-not-found.exception';

export class Course extends AggregateRoot<string> {
  private _title: string;
  private _description: string | null;
  private _licenseCategory: LicenseCategory;
  private _thumbnailUrl: string | null;
  private _totalLessons: number;
  private _duration: string | null;
  private _tuitionFee: number;
  private _capacity: number | null;
  private _status: CourseStatus;
  private _createdById: string;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _lessons: Lesson[];
  private _instructors: CourseInstructor[];
  private _requirement: CourseRequirement | null;
  private _materials: CourseMaterial[];

  private constructor(
    id: string,
    title: string,
    description: string | null,
    licenseCategory: LicenseCategory,
    thumbnailUrl: string | null,
    totalLessons: number,
    duration: string | null,
    tuitionFee: number,
    capacity: number | null,
    status: CourseStatus,
    createdById: string,
    createdAt: Date,
    updatedAt: Date,
    lessons: Lesson[],
    instructors: CourseInstructor[],
    requirement: CourseRequirement | null,
    materials: CourseMaterial[],
  ) {
    super(id);
    this._title = title;
    this._description = description;
    this._licenseCategory = licenseCategory;
    this._thumbnailUrl = thumbnailUrl;
    this._totalLessons = totalLessons;
    this._duration = duration;
    this._tuitionFee = tuitionFee;
    this._capacity = capacity;
    this._status = status;
    this._createdById = createdById;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._lessons = lessons;
    this._instructors = instructors;
    this._requirement = requirement;
    this._materials = materials;
  }

  static create(props: CreateCourseProps): Course {
    const id = crypto.randomUUID();
    const now = new Date();

    const instructors = (props.instructorIds ?? []).map(
      (iid) => new CourseInstructor(crypto.randomUUID(), id, iid),
    );

    const requirement = props.requirement
      ? CourseRequirement.create(id, props.requirement)
      : null;

    return new Course(
      id,
      props.title,
      props.description ?? null,
      props.licenseCategory,
      props.thumbnailUrl ?? null,
      0,
      props.duration ?? null,
      props.tuitionFee ?? 0,
      props.capacity ?? null,
      CourseStatus.DRAFT,
      props.createdById,
      now,
      now,
      [],
      instructors,
      requirement,
      [],
    );
  }

  static reconstitute(props: ReconstituteCourseProps): Course {
    const lessons = props.lessons.map((l) => Lesson.reconstitute(l));
    const instructors = props.instructorIds.map(
      (iid) => new CourseInstructor(crypto.randomUUID(), props.id, iid),
    );
    const requirement = props.requirement
      ? CourseRequirement.reconstitute(props.requirement)
      : null;
    const materials = props.materials.map((m) =>
      CourseMaterial.reconstitute(m),
    );

    return new Course(
      props.id,
      props.title,
      props.description,
      props.licenseCategory,
      props.thumbnailUrl,
      props.totalLessons,
      props.duration,
      props.tuitionFee,
      props.capacity,
      props.status,
      props.createdById,
      props.createdAt,
      props.updatedAt,
      lessons,
      instructors,
      requirement,
      materials,
    );
  }

  update(props: UpdateCourseProps): void {
    if (props.title !== undefined) this._title = props.title;
    if (props.description !== undefined) this._description = props.description;
    if (props.thumbnailUrl !== undefined)
      this._thumbnailUrl = props.thumbnailUrl;
    if (props.duration !== undefined) this._duration = props.duration;
    if (props.tuitionFee !== undefined) this._tuitionFee = props.tuitionFee;
    if (props.capacity !== undefined) this._capacity = props.capacity;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._lessons.length === 0) {
      throw new CourseHasNoLessonException(this._id);
    }
    this._status = CourseStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._status = CourseStatus.DRAFT;
    this._updatedAt = new Date();
  }

  addLesson(props: CreateLessonProps): Lesson {
    const lesson = new Lesson(
      crypto.randomUUID(),
      this._id,
      props.title,
      props.content ?? null,
      props.videoUrl ?? null,
      props.durationMinutes ?? 0,
      props.order,
      new Date(),
    );
    this._lessons.push(lesson);
    this._totalLessons = this._lessons.length;
    this._updatedAt = new Date();
    return lesson;
  }

  updateLesson(lessonId: string, props: UpdateLessonProps): void {
    const lesson = this._lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new LessonNotFoundException(lessonId);
    lesson.update(props);
    this._updatedAt = new Date();
  }

  removeLesson(lessonId: string): void {
    const index = this._lessons.findIndex((l) => l.id === lessonId);
    if (index === -1) throw new LessonNotFoundException(lessonId);
    this._lessons.splice(index, 1);
    this._totalLessons = this._lessons.length;
    this._updatedAt = new Date();
  }

  addInstructor(instructorId: string): void {
    const exists = this._instructors.some(
      (i) => i.instructorId === instructorId,
    );
    if (exists)
      throw new InstructorAlreadyAssignedException(instructorId, this._id);
    this._instructors.push(
      new CourseInstructor(crypto.randomUUID(), this._id, instructorId),
    );
    this._updatedAt = new Date();
  }

  removeInstructor(instructorId: string): void {
    this._instructors = this._instructors.filter(
      (i) => i.instructorId !== instructorId,
    );
    this._updatedAt = new Date();
  }

  setRequirements(props: CreateRequirementProps): void {
    if (this._requirement) {
      this._requirement.update(props);
    } else {
      this._requirement = CourseRequirement.create(this._id, props);
    }
    this._updatedAt = new Date();
  }

  addMaterial(props: CreateMaterialProps): CourseMaterial {
    const material = new CourseMaterial(
      crypto.randomUUID(),
      this._id,
      props.title,
      props.fileUrl ?? null,
      props.type ?? null,
      new Date(),
    );
    this._materials.push(material);
    this._updatedAt = new Date();
    return material;
  }

  removeMaterial(materialId: string): void {
    this._materials = this._materials.filter((m) => m.id !== materialId);
    this._updatedAt = new Date();
  }

  get title(): string {
    return this._title;
  }
  get description(): string | null {
    return this._description;
  }
  get licenseCategory(): LicenseCategory {
    return this._licenseCategory;
  }
  get thumbnailUrl(): string | null {
    return this._thumbnailUrl;
  }
  get totalLessons(): number {
    return this._totalLessons;
  }
  get duration(): string | null {
    return this._duration;
  }
  get tuitionFee(): number {
    return this._tuitionFee;
  }
  get capacity(): number | null {
    return this._capacity;
  }
  get status(): CourseStatus {
    return this._status;
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
  get lessons(): Lesson[] {
    return [...this._lessons];
  }
  get instructors(): CourseInstructor[] {
    return [...this._instructors];
  }
  get instructorIds(): string[] {
    return this._instructors.map((i) => i.instructorId);
  }
  get requirement(): CourseRequirement | null {
    return this._requirement;
  }
  get materials(): CourseMaterial[] {
    return [...this._materials];
  }
}
