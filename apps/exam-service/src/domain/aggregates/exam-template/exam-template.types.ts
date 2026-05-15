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
  name: string;
  licenseCategory: LicenseCategory;
  totalQuestions: number;
  passingScore: number;
  durationMinutes: number;
  createdById: string;
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
  totalQuestions?: number;
  passingScore?: number;
  durationMinutes?: number;
  isActive?: boolean;
}
