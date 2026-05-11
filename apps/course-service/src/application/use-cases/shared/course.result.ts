import { Course } from '../../../domain/aggregates/course/course.aggregate';
import {
  CourseStatus,
  LicenseCategory,
} from '../../../domain/aggregates/course/course.types';

export interface LessonResult {
  id: string;
  courseId: string;
  title: string;
  content: string | null;
  order: number;
  createdAt: Date;
}

export interface CourseRequirementResult {
  id: string;
  minAge: number | null;
  prerequisites: string | null;
  attendanceRate: number;
  minPassScore: number;
  requiredExams: number;
}

export interface CourseMaterialResult {
  id: string;
  title: string;
  fileUrl: string | null;
  type: string | null;
  createdAt: Date;
}

export class CourseResult {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly description: string | null,
    readonly licenseCategory: LicenseCategory,
    readonly totalLessons: number,
    readonly duration: string | null,
    readonly tuitionFee: number,
    readonly capacity: number | null,
    readonly status: CourseStatus,
    readonly createdById: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly lessons: LessonResult[],
    readonly instructorIds: string[],
    readonly requirement: CourseRequirementResult | null,
    readonly materials: CourseMaterialResult[],
  ) {}

  static fromAggregate(course: Course): CourseResult {
    return new CourseResult(
      course.id,
      course.title,
      course.description,
      course.licenseCategory,
      course.totalLessons,
      course.duration,
      course.tuitionFee,
      course.capacity,
      course.status,
      course.createdById,
      course.createdAt,
      course.updatedAt,
      course.lessons.map((l) => ({
        id: l.id,
        courseId: l.courseId,
        title: l.title,
        content: l.content,
        order: l.order,
        createdAt: l.createdAt,
      })),
      course.instructorIds,
      course.requirement
        ? {
            id: course.requirement.id,
            minAge: course.requirement.minAge,
            prerequisites: course.requirement.prerequisites,
            attendanceRate: course.requirement.attendanceRate,
            minPassScore: course.requirement.minPassScore,
            requiredExams: course.requirement.requiredExams,
          }
        : null,
      course.materials.map((m) => ({
        id: m.id,
        title: m.title,
        fileUrl: m.fileUrl,
        type: m.type,
        createdAt: m.createdAt,
      })),
    );
  }
}

export class ListCoursesResult {
  constructor(
    readonly items: CourseResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
