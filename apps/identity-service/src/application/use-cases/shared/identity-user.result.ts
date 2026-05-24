import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class IdentityUserResult {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly fullName: string,
    readonly role: UserRole,
    readonly isActive: boolean,
    readonly isDeleted: boolean,
    readonly deletedAt: Date | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}

export class PaginatedIdentityUsersResult {
  constructor(
    readonly items: IdentityUserResult[],
    readonly total: number,
    readonly page: number,
    readonly size: number,
  ) {}
}
