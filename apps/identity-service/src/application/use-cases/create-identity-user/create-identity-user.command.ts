import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class CreateIdentityUserCommand {
  constructor(
    readonly email: string,
    readonly fullName: string,
    readonly role: UserRole,
    readonly temporaryPassword: string,
  ) {}
}
