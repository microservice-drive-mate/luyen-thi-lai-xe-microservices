import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/identity-client';
import { IdentityUser } from '../../../domain/aggregates/identity-user/identity-user.aggregate';
import {
  IdentityUserRepository,
  ListIdentityUsersFilter,
  ListIdentityUsersPage,
} from '../../../domain/repositories/identity-user.repository';
import { IdentityUserMapper } from '../mappers/identity-user.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaIdentityUserRepository extends IdentityUserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<IdentityUser | null> {
    const raw = await this.prisma.identityUser.findUnique({ where: { id } });
    return raw ? IdentityUserMapper.toDomain(raw) : null;
  }

  async save(user: IdentityUser): Promise<void> {
    await this.prisma.identityUser.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role,
        isActive: user.isActive,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
        deletedById: user.deletedById,
      },
      update: {
        email: user.email,
        name: user.fullName,
        role: user.role,
        isActive: user.isActive,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
        deletedById: user.deletedById,
      },
    });
  }

  async list(filter: ListIdentityUsersFilter): Promise<ListIdentityUsersPage> {
    const where: Prisma.IdentityUserWhereInput = {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.includeDeleted ? {} : { isDeleted: false }),
      ...(filter.search
        ? {
            OR: [
              { email: { contains: filter.search, mode: 'insensitive' } },
              { name: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.identityUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.size,
        take: filter.size,
      }),
      this.prisma.identityUser.count({ where }),
    ]);

    return {
      items: items.map(IdentityUserMapper.toDomain),
      total,
    };
  }
}
