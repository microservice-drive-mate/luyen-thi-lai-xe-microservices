import {
  Gender,
  LicenseTier,
  UserRole,
} from '../../../domain/aggregates/user-profile/user-profile.types';

export class GetUserProfileResult {
  constructor(
    readonly id: string,
    readonly fullName: string,
    readonly email: string,
    readonly phoneNumber: string | null,
    readonly dateOfBirth: Date | null,
    readonly avatarUrl: string | null,
    readonly gender: Gender | null,
    readonly address: string | null,
    readonly role: UserRole,
    readonly isActive: boolean,
    readonly createdAt: Date,
    readonly studentDetail: {
      licenseTier: LicenseTier | null;
      enrolledAt: Date | null;
      notes: string | null;
    } | null,
  ) {}
}
