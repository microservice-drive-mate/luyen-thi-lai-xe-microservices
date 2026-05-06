export enum UserRole {
  ADMIN = 'ADMIN',
  CENTER_MANAGER = 'CENTER_MANAGER',
  INSTRUCTOR = 'INSTRUCTOR',
  STUDENT = 'STUDENT',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum LicenseTier {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

export interface CreateUserProfileProps {
  id: string; // Keycloak userId — do bên ngoài cung cấp
  fullName: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  dateOfBirth?: Date;
  avatarUrl?: string;
  gender?: Gender;
  address?: string;
  enrolledAt?: Date;
}

export interface ReconstituteUserProfileProps {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  avatarUrl: string | null;
  gender: Gender | null;
  address: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  studentDetail: {
    id: string;
    licenseTier: LicenseTier | null;
    enrolledAt: Date | null;
    notes: string | null;
  } | null;
}

export interface UpdateUserProfileProps {
  fullName?: string;
  phoneNumber?: string | null;
  dateOfBirth?: Date | null;
  avatarUrl?: string | null;
  gender?: Gender | null;
  address?: string | null;
  notes?: string | null;
}

export interface LicenseAuditEntry {
  oldLicenseTier: LicenseTier | null;
  newLicenseTier: LicenseTier;
  changedById: string;
  changedAt: Date;
}
