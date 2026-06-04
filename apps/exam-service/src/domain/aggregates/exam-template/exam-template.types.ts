export enum LicenseCategory {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

export interface CreateExamTemplateProps {
  id: string;
  name: string;
  description?: string | null;
  licenseCategory: LicenseCategory;
  totalQuestions: number;
  passingScore: number;
  durationMinutes: number;
  criticalQuestions: number;
  maxCriticalMistakes: number;
  shuffleQuestions: boolean;
  topicDistribution: ExamTopicDistributionItem[];
  createdById: string;
}

export interface ExamTopicDistributionItem {
  topicId: string;
  questionCount: number;
}

export interface ReconstituteExamTemplateProps extends CreateExamTemplateProps {
  id: string;
  isActive: boolean;
  isDeleted: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateExamTemplateProps {
  expectedVersion: number;
  name?: string;
  description?: string | null;
  totalQuestions?: number;
  passingScore?: number;
  durationMinutes?: number;
  criticalQuestions?: number;
  maxCriticalMistakes?: number;
  shuffleQuestions?: boolean;
  topicDistribution?: ExamTopicDistributionItem[];
  isActive?: boolean;
}
