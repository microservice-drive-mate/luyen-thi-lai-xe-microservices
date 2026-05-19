import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import {
  ExamQuestionOptionSnapshot,
  ExamSessionStatus,
} from '../../../domain/aggregates/exam-session/exam-session.types';
import { LicenseCategory } from '../../../domain/aggregates/exam-template/exam-template.types';

interface RawTemplateForSession {
  licenseCategory: string;
  passingScore: number;
  durationMinutes: number;
  maxCriticalMistakes: number;
}

interface RawSessionQuestion {
  id: string;
  questionId: string;
  questionContent: string;
  imageUrl: string | null;
  mediaFileId: string | null;
  optionsSnapshot: unknown;
  correctOptionId: string;
  isCritical: boolean;
  displayOrder: number;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  isBookmarked: boolean;
  answeredAt: Date | null;
}

export interface RawExamSession {
  id: string;
  studentId: string;
  templateId: string;
  status: string;
  score: number | null;
  isPassed: boolean | null;
  failedByCritical: boolean;
  criticalMistakes: number;
  maxCriticalMistakes: number;
  startedAt: Date;
  finishedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  template: RawTemplateForSession;
  questions: RawSessionQuestion[];
}

export class ExamSessionMapper {
  static toDomain(raw: RawExamSession): ExamSession {
    return ExamSession.reconstitute({
      id: raw.id,
      studentId: raw.studentId,
      templateId: raw.templateId,
      licenseCategory: raw.template.licenseCategory as LicenseCategory,
      passingScore: raw.template.passingScore,
      durationMinutes: raw.template.durationMinutes,
      maxCriticalMistakes: raw.maxCriticalMistakes,
      status: raw.status as ExamSessionStatus,
      score: raw.score,
      isPassed: raw.isPassed,
      failedByCritical: raw.failedByCritical,
      criticalMistakes: raw.criticalMistakes,
      startedAt: raw.startedAt,
      finishedAt: raw.finishedAt,
      expiresAt: raw.expiresAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      questions: raw.questions.map((question) => ({
        id: question.id,
        questionId: question.questionId,
        questionContent: question.questionContent,
        imageUrl: question.imageUrl,
        mediaFileId: question.mediaFileId,
        optionsSnapshot:
          question.optionsSnapshot as ExamQuestionOptionSnapshot[],
        correctOptionId: question.correctOptionId,
        isCritical: question.isCritical,
        displayOrder: question.displayOrder,
        selectedOptionId: question.selectedOptionId,
        isCorrect: question.isCorrect,
        isBookmarked: question.isBookmarked,
        answeredAt: question.answeredAt,
      })),
    });
  }
}
