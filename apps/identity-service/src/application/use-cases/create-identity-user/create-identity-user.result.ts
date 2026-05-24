import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class CreateIdentityUserResult {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly fullName: string,
    readonly role: UserRole,
  ) {}
}
