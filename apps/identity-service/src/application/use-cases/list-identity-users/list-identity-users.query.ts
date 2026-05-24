import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class ListIdentityUsersQuery {
  constructor(
    readonly page: number = 1,
    readonly size: number = 20,
    readonly role?: UserRole,
    readonly isActive?: boolean,
    readonly includeDeleted: boolean = false,
    readonly search?: string,
  ) {}
}
