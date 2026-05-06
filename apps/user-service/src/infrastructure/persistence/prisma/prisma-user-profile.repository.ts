/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import {
  Gender as PrismaGender,
  LicenseTier as PrismaLicenseTier,
  Prisma,
  Role as PrismaRole,
} from '@prisma/user-client';
import { UserProfile } from '../../../domain/aggregates/user-profile/user-profile.aggregate';
import {
  Gender,
  LicenseTier,
  UserRole,
} from '../../../domain/aggregates/user-profile/user-profile.types';
import {
  ListUsersFilter,
  ListUsersPage,
  UserProfileRepository,
} from '../../../domain/repositories/user-profile.repository';
import { UserProfileMapper } from '../mappers/user-profile.mapper';
import { PrismaService } from './prisma.service';

function toRole(r: UserRole): PrismaRole {
  return r as unknown as PrismaRole;
}

function toGender(g: Gender | null): PrismaGender | null {
  return g as unknown as PrismaGender | null;
}

function toLicenseTier(t: LicenseTier | null): PrismaLicenseTier | null {
  return t as unknown as PrismaLicenseTier | null;
}

@Injectable()
export class PrismaUserProfileRepository extends UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<UserProfile | null> {
    const raw = await this.prisma.userProfile.findUnique({
      where: { id },
      include: { studentDetail: true },
    });
    return raw ? UserProfileMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const raw = await this.prisma.userProfile.findUnique({
      where: { email },
      include: { studentDetail: true },
    });
    return raw ? UserProfileMapper.toDomain(raw) : null;
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.prisma.userProfile.count({ where: { id } });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.userProfile.count({ where: { email } });
    return count > 0;
  }

  async save(profile: UserProfile): Promise<void> {
    const auditEntry = profile.pendingAuditEntry;

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.upsert({
        where: { id: profile.id },
        create: {
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
          avatarUrl: profile.avatarUrl,
          gender: toGender(profile.gender),
          address: profile.address,
          role: toRole(profile.role),
          isActive: profile.isActive,
          createdAt: profile.createdAt,
        },
        update: {
          fullName: profile.fullName,
          phoneNumber: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
          avatarUrl: profile.avatarUrl,
          gender: toGender(profile.gender),
          address: profile.address,
          role: toRole(profile.role),
          isActive: profile.isActive,
        },
      });

      if (profile.role === UserRole.STUDENT && profile.studentDetail) {
        await tx.studentDetail.upsert({
          where: { studentId: profile.id },
          create: {
            id: profile.studentDetail.id,
            studentId: profile.id,
            licenseTier: toLicenseTier(profile.studentDetail.licenseTier),
            enrolledAt: profile.studentDetail.enrolledAt,
            notes: profile.studentDetail.notes,
          },
          update: {
            licenseTier: toLicenseTier(profile.studentDetail.licenseTier),
            enrolledAt: profile.studentDetail.enrolledAt,
            notes: profile.studentDetail.notes,
          },
        });
      } else if (profile.role !== UserRole.STUDENT) {
        await tx.studentDetail.deleteMany({ where: { studentId: profile.id } });
      }

      if (auditEntry) {
        await tx.licenseAssignmentAudit.create({
          data: {
            studentId: profile.id,
            oldLicenseTier: toLicenseTier(auditEntry.oldLicenseTier),
            newLicenseTier: toLicenseTier(auditEntry.newLicenseTier)!,
            changedById: auditEntry.changedById,
            changedAt: auditEntry.changedAt,
          },
        });
        profile.clearPendingAuditEntry();
      }
    });
  }

  async list(filter: ListUsersFilter): Promise<ListUsersPage> {
    const where: Prisma.UserProfileWhereInput = {};

    if (filter.role) {
      where.role = toRole(filter.role);
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.search) {
      where.OR = [
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phoneNumber: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filter.page - 1) * filter.size;

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.userProfile.findMany({
        where,
        include: { studentDetail: true },
        skip,
        take: filter.size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userProfile.count({ where }),
    ]);

    return {
      items: rawItems.map((r) => UserProfileMapper.toDomain(r)),
      total,
    };
  }
}
