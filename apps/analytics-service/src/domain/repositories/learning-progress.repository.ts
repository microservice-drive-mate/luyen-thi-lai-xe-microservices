import type {
  ExamCompletedPayload,
  ProgressDashboard,
} from '../aggregates/learning-progress/learning-progress.aggregate';

export type {
  ExamCompletedPayload,
  ProgressDashboard,
} from '../aggregates/learning-progress/learning-progress.aggregate';

export abstract class LearningProgressRepository {
  abstract ensureStudent(studentId: string): Promise<void>;
  abstract recordExamCompleted(payload: ExamCompletedPayload): Promise<void>;
  abstract recordEnrollmentCreated(studentId: string): Promise<void>;
  abstract recordEnrollmentCompleted(studentId: string): Promise<void>;
  abstract recordLessonCompleted(
    studentId: string,
    minutes: number,
  ): Promise<void>;
  abstract resetProgress(studentId: string): Promise<void>;
  abstract deleteStudent(studentId: string): Promise<void>;
  abstract getDashboard(studentId: string): Promise<ProgressDashboard>;
}
