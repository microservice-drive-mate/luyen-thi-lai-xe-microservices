import {
  Gender,
  LicenseTier,
  UserRole,
} from '../../../domain/aggregates/user-profile/user-profile.types';

export class CreateUserProfileCommand {
  constructor(
    readonly id: string,
    readonly fullName: string,
    readonly email: string,
    readonly role: UserRole,
    readonly phoneNumber?: string,
    readonly dateOfBirth?: Date,
    readonly gender?: Gender,
    readonly address?: string,
    readonly avatarUrl?: string,
    readonly licenseTier?: LicenseTier,
    readonly enrolledAt?: Date,
  ) {}
}
