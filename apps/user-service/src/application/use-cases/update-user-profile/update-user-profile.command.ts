import { Gender } from '../../../domain/aggregates/user-profile/user-profile.types';

export interface UpdateUserProfileFields {
  fullName?: string;
  phoneNumber?: string | null;
  dateOfBirth?: Date | null;
  avatarUrl?: string | null;
  gender?: Gender | null;
  address?: string | null;
  notes?: string | null;
}

export class UpdateUserProfileCommand {
  readonly fullName?: string;
  readonly phoneNumber?: string | null;
  readonly dateOfBirth?: Date | null;
  readonly avatarUrl?: string | null;
  readonly gender?: Gender | null;
  readonly address?: string | null;
  readonly notes?: string | null;

  constructor(
    readonly targetUserId: string,
    fields: UpdateUserProfileFields,
  ) {
    this.fullName = fields.fullName;
    this.phoneNumber = fields.phoneNumber;
    this.dateOfBirth = fields.dateOfBirth;
    this.avatarUrl = fields.avatarUrl;
    this.gender = fields.gender;
    this.address = fields.address;
    this.notes = fields.notes;
  }
}
