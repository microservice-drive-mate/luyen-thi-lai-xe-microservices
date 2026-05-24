import { IdentityUser as PrismaIdentityUser } from '@prisma/identity-client';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import { UserRole } from '../../../domain/aggregates/identity-user/identity-user.types';

export class IdentityUserMapper {
  static toDomain(raw: PrismaIdentityUser): IdentityUser {
    return IdentityUser.reconstitute({
      id: raw.id,
      email: raw.email,
      fullName: raw.name,
      role: raw.role as UserRole,
      isActive: raw.isActive,
      isDeleted: raw.isDeleted,
      deletedAt: raw.deletedAt,
      deletedById: raw.deletedById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
