import { UserProfile } from '../../../domain/aggregates/user-profile/user-profile.aggregate';
import {
  Gender,
  LicenseTier,
  UserRole,
} from '../../../domain/aggregates/user-profile/user-profile.types';

export interface RawStudentDetailRow {
  id: string;
  studentId: string;
  licenseTier: string | null;
  enrolledAt: Date | null;
  notes: string | null;
}

export interface RawUserProfileRow {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  avatarUrl: string | null;
  gender: string | null;
  address: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  studentDetail: RawStudentDetailRow | null;
}

export const UserProfileMapper = {
  toDomain(raw: RawUserProfileRow): UserProfile {
    return UserProfile.reconstitute({
      id: raw.id,
      fullName: raw.fullName,
      email: raw.email,
      phoneNumber: raw.phoneNumber,
      dateOfBirth: raw.dateOfBirth,
      avatarUrl: raw.avatarUrl,
      gender: raw.gender as Gender | null,
      address: raw.address,
      role: raw.role as UserRole,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      studentDetail: raw.studentDetail
        ? {
            id: raw.studentDetail.id,
            licenseTier: raw.studentDetail.licenseTier as LicenseTier | null,
            enrolledAt: raw.studentDetail.enrolledAt,
            notes: raw.studentDetail.notes,
          }
        : null,
    });
  },
};
