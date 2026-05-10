export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export interface CreateEnrollmentProps {
  courseId: string;
  studentId: string;
}

export interface ReconstituteEnrollmentProps {
  id: string;
  courseId: string;
  studentId: string;
  status: EnrollmentStatus;
  progress: number;
  enrolledAt: Date;
  completedAt: Date | null;
  lessonProgress: ReconstituteLessonProgressProps[];
}

export interface ReconstituteLessonProgressProps {
  id: string;
  enrollmentId: string;
  lessonId: string;
  completedAt: Date | null;
  watchedSeconds: number;
}
