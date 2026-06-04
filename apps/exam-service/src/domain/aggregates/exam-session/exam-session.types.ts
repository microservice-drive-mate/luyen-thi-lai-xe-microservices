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
  id: string;
  questionId: string;
  questionContent: string;
  imageUrl?: string | null;
  mediaFileId?: string | null;
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
  id: string;
  studentId: string;
  templateId: string;
  templateNameSnapshot?: string;
  templateVersionSnapshot?: number;
  licenseCategory: LicenseCategory;
  totalQuestionsSnapshot?: number;
  passingScore: number;
  durationMinutes: number;
  criticalQuestionsSnapshot?: number;
  topicDistributionSnapshot?: unknown;
  maxCriticalMistakes: number;
  questions: ExamQuestionSnapshot[];
}

export interface ReconstituteExamSessionProps extends CreateExamSessionProps {
  id: string;
  status: ExamSessionStatus;
  score: number | null;
  isPassed: boolean | null;
  failedByCritical: boolean;
  criticalMistakes: number;
  startedAt: Date;
  finishedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
