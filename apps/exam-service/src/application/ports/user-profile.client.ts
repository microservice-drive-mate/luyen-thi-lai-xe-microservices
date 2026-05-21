import { LicenseCategory } from '../../domain/aggregates/exam-template/exam-template.types';

export interface StudentProfile {
  id: string;
  role: string;
  isActive: boolean;
  studentDetail: {
    licenseTier: LicenseCategory | null;
  } | null;
}

export abstract class UserProfileClient {
  abstract getCurrentStudentProfile(
    accessToken: string,
  ): Promise<StudentProfile>;
}
