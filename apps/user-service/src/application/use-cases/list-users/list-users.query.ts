import { UserRole } from '../../../domain/aggregates/user-profile/user-profile.types';

export class ListUsersQuery {
  constructor(
    readonly page: number,
    readonly size: number,
    readonly role?: UserRole,
    readonly isActive?: boolean,
    readonly search?: string,
  ) {}
}
