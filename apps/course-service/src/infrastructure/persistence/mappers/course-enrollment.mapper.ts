import { CourseEnrollment } from '../../../domain/aggregates/course-enrollment/course-enrollment.aggregate';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';

export interface RawLessonProgressRow {
  id: string;
  enrollmentId: string;
  lessonId: string;
  completedAt: Date | null;
  watchedSeconds: number;
}

export interface RawCourseEnrollmentRow {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  progress: number;
  enrolledAt: Date;
  completedAt: Date | null;
  lessonProgress: RawLessonProgressRow[];
}

export const CourseEnrollmentMapper = {
  toDomain(raw: RawCourseEnrollmentRow): CourseEnrollment {
    return CourseEnrollment.reconstitute({
      id: raw.id,
      courseId: raw.courseId,
      studentId: raw.studentId,
      status: raw.status as EnrollmentStatus,
      progress: raw.progress,
      enrolledAt: raw.enrolledAt,
      completedAt: raw.completedAt,
      lessonProgress: raw.lessonProgress.map((lp) => ({
        id: lp.id,
        enrollmentId: lp.enrollmentId,
        lessonId: lp.lessonId,
        completedAt: lp.completedAt,
        watchedSeconds: lp.watchedSeconds,
      })),
    });
  },
};
