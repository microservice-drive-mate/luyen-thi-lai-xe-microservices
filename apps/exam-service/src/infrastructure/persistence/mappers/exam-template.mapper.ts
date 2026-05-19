import { ExamTemplate } from '../../../domain/aggregates/exam-template/exam-template.aggregate';
import {
  ExamTopicDistributionItem,
  LicenseCategory,
} from '../../../domain/aggregates/exam-template/exam-template.types';

export interface RawExamTemplate {
  id: string;
  name: string;
  description: string | null;
  licenseCategory: string;
  totalQuestions: number;
  passingScore: number;
  durationMinutes: number;
  criticalQuestions: number;
  maxCriticalMistakes: number;
  shuffleQuestions: boolean;
  topicDistribution: unknown;
  isActive: boolean;
  isDeleted: boolean;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ExamTemplateMapper {
  static toDomain(raw: RawExamTemplate): ExamTemplate {
    return ExamTemplate.reconstitute({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      licenseCategory: raw.licenseCategory as LicenseCategory,
      totalQuestions: raw.totalQuestions,
      passingScore: raw.passingScore,
      durationMinutes: raw.durationMinutes,
      criticalQuestions: raw.criticalQuestions,
      maxCriticalMistakes: raw.maxCriticalMistakes,
      shuffleQuestions: raw.shuffleQuestions,
      topicDistribution: raw.topicDistribution as ExamTopicDistributionItem[],
      isActive: raw.isActive,
      isDeleted: raw.isDeleted,
      version: raw.version,
      createdById: raw.createdById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
