import { Injectable } from '@nestjs/common';
import { LicenseCategory as PrismaLicenseCategory } from '@prisma/course-client';
import { LicenseCategory } from '../../../domain/aggregates/course/course.types';
import {
  StudentLicenseProfile,
  StudentLicenseProfileRepository,
} from '../../../domain/repositories/student-license-profile.repository';
import { PrismaService } from './prisma.service';

function toPrismaLicenseCategory(
  licenseTier: LicenseCategory,
): PrismaLicenseCategory {
  return licenseTier;
}

@Injectable()
export class PrismaStudentLicenseProfileRepository extends StudentLicenseProfileRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByStudentId(
    studentId: string,
  ): Promise<StudentLicenseProfile | null> {
    const raw = await this.prisma.studentLicenseProfile.findUnique({
      where: { studentId },
    });

    return raw
      ? {
          studentId: raw.studentId,
          licenseTier: raw.licenseTier as LicenseCategory,
          syncedAt: raw.syncedAt,
        }
      : null;
  }

  async save(profile: StudentLicenseProfile): Promise<void> {
    await this.prisma.studentLicenseProfile.upsert({
      where: { studentId: profile.studentId },
      create: {
        studentId: profile.studentId,
        licenseTier: toPrismaLicenseCategory(profile.licenseTier),
        syncedAt: profile.syncedAt,
      },
      update: {
        licenseTier: toPrismaLicenseCategory(profile.licenseTier),
        syncedAt: profile.syncedAt,
      },
    });
  }
}
