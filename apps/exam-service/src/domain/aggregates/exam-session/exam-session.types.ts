import { LicenseCategory } from '../exam-template/exam-template.types';

export enum ExamSessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  TIMED_OUT = 'TIMED_OUT',
  CANCELLED = 'CANCELLED',
}

export interface ExamQuestionOptionSnapshot {
  id: string;
  content: string;
  displayOrder: number;
}

export interface ExamQuestionSnapshot {
  id?: string;
  questionId: string;
  questionContent: string;
  optionsSnapshot: ExamQuestionOptionSnapshot[];
  correctOptionId: string;
  isCritical: boolean;
  displayOrder: number;
  selectedOptionId?: string | null;
  isCorrect?: boolean | null;
  isBookmarked?: boolean;
  answeredAt?: Date | null;
}

export interface CreateExamSessionProps {
  studentId: string;
  templateId: string;
  licenseCategory: LicenseCategory;
  passingScore: number;
  durationMinutes: number;
  questions: ExamQuestionSnapshot[];
}

export interface ReconstituteExamSessionProps extends CreateExamSessionProps {
  id: string;
  status: ExamSessionStatus;
  score: number | null;
  isPassed: boolean | null;
  failedByCritical: boolean;
  startedAt: Date;
  finishedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
