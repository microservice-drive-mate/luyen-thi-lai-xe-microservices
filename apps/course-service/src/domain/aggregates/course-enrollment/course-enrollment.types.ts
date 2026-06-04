export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export interface CreateEnrollmentProps {
  id: string;
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
  lastResetAt: Date | null;
}
