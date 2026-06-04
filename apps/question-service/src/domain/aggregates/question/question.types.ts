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

export enum QuestionType {
  THEORY = 'THEORY',
  TRAFFIC_SIGN = 'TRAFFIC_SIGN',
  SCENARIO_RELATED = 'SCENARIO_RELATED',
}

export enum QuestionDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export interface QuestionOptionProps {
  id: string;
  content: string;
  isCorrect: boolean;
  displayOrder: number;
}

export type QuestionOptionInputProps = Omit<QuestionOptionProps, 'id'> & {
  id?: string;
};

export interface CreateQuestionProps {
  id: string;
  content: string;
  type: QuestionType;
  licenseCategories: LicenseCategory[];
  difficulty: QuestionDifficulty;
  explanation: string;
  imageUrl?: string | null;
  mediaFileId?: string | null;
  isCritical?: boolean;
  isActive?: boolean;
  topicId: string;
  createdById: string;
  options: QuestionOptionProps[];
}

export interface UpdateQuestionProps {
  content?: string;
  type?: QuestionType;
  licenseCategories?: LicenseCategory[];
  difficulty?: QuestionDifficulty;
  explanation?: string;
  imageUrl?: string | null;
  mediaFileId?: string | null;
  isCritical?: boolean;
  isActive?: boolean;
  topicId?: string;
  options?: QuestionOptionProps[];
  expectedVersion: number;
}

export interface ReconstituteQuestionProps {
  id: string;
  content: string;
  type: QuestionType;
  licenseCategories: LicenseCategory[];
  difficulty: QuestionDifficulty;
  explanation: string;
  imageUrl: string | null;
  mediaFileId: string | null;
  isCritical: boolean;
  isActive: boolean;
  isDeleted: boolean;
  topicId: string;
  createdById: string;
  version: number;
  deletedById: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: QuestionOptionProps[];
}
