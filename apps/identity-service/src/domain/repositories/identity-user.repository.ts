import { IdentityUser } from '../aggregates/identity-user/identity-user.aggregate';
import { UserRole } from '../aggregates/identity-user/identity-user.types';

export interface ListIdentityUsersFilter {
  page: number;
  size: number;
  role?: UserRole;
  isActive?: boolean;
  includeDeleted?: boolean;
  search?: string;
}

export interface ListIdentityUsersPage {
  items: IdentityUser[];
  total: number;
}

export abstract class IdentityUserRepository {
  abstract findById(id: string): Promise<IdentityUser | null>;
  abstract save(user: IdentityUser): Promise<void>;
  abstract list(
    filter: ListIdentityUsersFilter,
  ): Promise<ListIdentityUsersPage>;
}
