import { Course } from '../../../domain/aggregates/course/course.aggregate';
import {
  CourseStatus,
  LicenseCategory,
} from '../../../domain/aggregates/course/course.types';
import { Decimal } from '@prisma/course-client/runtime/library';

export interface RawLessonRow {
  id: string;
  courseId: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationMinutes: number;
  order: number;
  createdAt: Date;
}

export interface RawCourseInstructorRow {
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
  type: string | null;
  createdAt: Date;
}

export interface RawCourseRow {
  id: string;
  title: string;
  description: string | null;
  licenseCategory: string;
  thumbnailUrl: string | null;
  totalLessons: number;
  duration: string | null;
  tuitionFee: Decimal;
  capacity: number | null;
  status: string;
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
      title: raw.title,
      description: raw.description,
      licenseCategory: raw.licenseCategory as LicenseCategory,
      thumbnailUrl: raw.thumbnailUrl,
      totalLessons: raw.totalLessons,
      duration: raw.duration,
      tuitionFee: Number(raw.tuitionFee),
      capacity: raw.capacity,
      status: raw.status as CourseStatus,
      createdById: raw.createdById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      lessons: raw.lessons.map((l) => ({
        id: l.id,
        courseId: l.courseId,
        title: l.title,
        content: l.content,
        videoUrl: l.videoUrl,
        durationMinutes: l.durationMinutes,
        order: l.order,
        createdAt: l.createdAt,
      })),
      instructorIds: raw.instructors.map((i) => i.instructorId),
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
        type: m.type,
        createdAt: m.createdAt,
      })),
    });
  },
};
