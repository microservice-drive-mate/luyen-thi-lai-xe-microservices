import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { IdentityUserResult } from './identity-user.result';

export function toIdentityUserResult(user: IdentityUser): IdentityUserResult {
  return new IdentityUserResult(
    user.id,
    user.email,
    user.fullName,
    user.role,
    user.isActive,
    user.isDeleted,
    user.deletedAt,
    user.createdAt,
    user.updatedAt,
  );
}
