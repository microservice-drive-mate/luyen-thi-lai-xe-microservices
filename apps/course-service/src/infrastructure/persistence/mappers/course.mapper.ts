import { Course } from '../../../domain/aggregates/course/course.aggregate';
import {
  CourseStatus,
  LicenseCategory,
} from '../../../domain/aggregates/course/course.types';
import { Prisma } from '@prisma/course-client';

export interface RawLessonRow {
  id: string;
  courseId: string;
  title: string;
  content: string | null;
  order: number;
  createdAt: Date;
}

export interface RawCourseInstructorRow {
  id: string;
  courseId: string;
  instructorId: string;
}

export interface RawCourseRequirementRow {
  id: string;
  courseId: string;
  minAge: number | null;
  prerequisites: string | null;
  attendanceRate: number;
  minPassScore: number;
  requiredExams: number;
}

export interface RawCourseMaterialRow {
  id: string;
  courseId: string;
  title: string;
  fileUrl: string | null;
  mediaFileId: string | null;
  type: string | null;
  createdAt: Date;
}

export interface RawCourseRow {
  id: string;
  courseCode: string | null;
  title: string;
  description: string | null;
  licenseCategory: string;
  totalLessons: number;
  duration: string | null;
  tuitionFee: Prisma.Decimal;
  capacity: number | null;
  status: string;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lessons: RawLessonRow[];
  instructors: RawCourseInstructorRow[];
  requirement: RawCourseRequirementRow | null;
  materials: RawCourseMaterialRow[];
}

export const CourseMapper = {
  toDomain(raw: RawCourseRow): Course {
    return Course.reconstitute({
      id: raw.id,
      courseCode: raw.courseCode,
      title: raw.title,
      description: raw.description,
      licenseCategory: raw.licenseCategory as LicenseCategory,
      totalLessons: raw.totalLessons,
      duration: raw.duration,
      tuitionFee: Number(raw.tuitionFee),
      capacity: raw.capacity,
      status: raw.status as CourseStatus,
      version: raw.version,
      isDeleted: raw.isDeleted,
      deletedAt: raw.deletedAt,
      deletedBy: raw.deletedBy,
      createdById: raw.createdById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      lessons: raw.lessons.map((l) => ({
        id: l.id,
        courseId: l.courseId,
        title: l.title,
        content: l.content,
        order: l.order,
        createdAt: l.createdAt,
      })),
      instructors: raw.instructors.map((i) => ({
        id: i.id,
        courseId: i.courseId,
        instructorId: i.instructorId,
      })),
      requirement: raw.requirement
        ? {
            id: raw.requirement.id,
            courseId: raw.requirement.courseId,
            minAge: raw.requirement.minAge,
            prerequisites: raw.requirement.prerequisites,
            attendanceRate: raw.requirement.attendanceRate,
            minPassScore: raw.requirement.minPassScore,
            requiredExams: raw.requirement.requiredExams,
          }
        : null,
      materials: raw.materials.map((m) => ({
        id: m.id,
        courseId: m.courseId,
        title: m.title,
        fileUrl: m.fileUrl,
        mediaFileId: m.mediaFileId,
        type: m.type,
        createdAt: m.createdAt,
      })),
    });
  },
};
