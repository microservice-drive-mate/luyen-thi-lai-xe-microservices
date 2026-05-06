import { UserProfile } from '../aggregates/user-profile/user-profile.aggregate';
import { UserRole } from '../aggregates/user-profile/user-profile.types';

export interface ListUsersFilter {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page: number;
  size: number;
}

export interface ListUsersPage {
  items: UserProfile[];
  total: number;
}

export abstract class UserProfileRepository {
  abstract findById(id: string): Promise<UserProfile | null>;
  abstract findByEmail(email: string): Promise<UserProfile | null>;
  abstract existsById(id: string): Promise<boolean>;
  abstract existsByEmail(email: string): Promise<boolean>;
  abstract save(profile: UserProfile): Promise<void>;
  abstract list(filter: ListUsersFilter): Promise<ListUsersPage>;
}
