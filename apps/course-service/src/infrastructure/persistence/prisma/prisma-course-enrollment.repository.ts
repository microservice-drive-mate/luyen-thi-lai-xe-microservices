import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/course-client';
import { AuditEventEnvelope } from '@repo/common';
import { LicenseCategory } from '../../../domain/aggregates/course/course.types';
import { CourseEnrollment } from '../../../domain/aggregates/course-enrollment/course-enrollment.aggregate';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';
import {
  CourseEnrollmentRepository,
  CourseEnrollmentWithCourse,
  ListEnrollmentsFilter,
  ListEnrollmentsPage,
  ListEnrollmentsWithCoursePage,
} from '../../../domain/repositories/course-enrollment.repository';
import { CourseEnrollmentMapper } from '../mappers/course-enrollment.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaCourseEnrollmentRepository extends CourseEnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<CourseEnrollment | null> {
    const raw = await this.prisma.courseEnrollment.findUnique({
      where: { id },
    });
    return raw ? CourseEnrollmentMapper.toDomain(raw) : null;
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<CourseEnrollment | null> {
    const raw = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
    });
    return raw ? CourseEnrollmentMapper.toDomain(raw) : null;
  }

  async findByStudentId(
    filter: ListEnrollmentsFilter,
  ): Promise<ListEnrollmentsPage> {
    const where = {
      studentId: filter.studentId,
      ...(filter.status && { status: filter.status }),
    };

    const skip = (filter.page - 1) * filter.size;

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.courseEnrollment.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);

    return {
      items: rawItems.map(CourseEnrollmentMapper.toDomain),
      total,
    };
  }

  async findByStudentIdWithCourse(
    filter: ListEnrollmentsFilter,
  ): Promise<ListEnrollmentsWithCoursePage> {
    const where = {
      studentId: filter.studentId,
      ...(filter.status && { status: filter.status }),
    };

    const skip = (filter.page - 1) * filter.size;

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.courseEnrollment.findMany({
        where,
        include: {
          course: {
            select: {
              id: true,
              courseCode: true,
              title: true,
              licenseCategory: true,
            },
          },
        },
        skip,
        take: filter.size,
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);

    return {
      items: rawItems.map(
        (item): CourseEnrollmentWithCourse => ({
          id: item.id,
          courseId: item.courseId,
          studentId: item.studentId,
          status: item.status as unknown as EnrollmentStatus,
          progress: item.progress,
          enrolledAt: item.enrolledAt,
          completedAt: item.completedAt,
          course: {
            id: item.course.id,
            courseCode: item.course.courseCode,
            title: item.course.title,
            licenseCategory: item.course
              .licenseCategory as unknown as LicenseCategory,
          },
        }),
      ),
      total,
    };
  }

  async save(
    enrollment: CourseEnrollment,
    auditEvent?: AuditEventEnvelope,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.courseEnrollment.upsert({
        where: { id: enrollment.id },
        create: {
          id: enrollment.id,
          courseId: enrollment.courseId,
          studentId: enrollment.studentId,
          status: enrollment.status,
          progress: enrollment.progress,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt,
          lastResetAt: enrollment.lastResetAt,
        },
        update: {
          status: enrollment.status,
          progress: enrollment.progress,
          completedAt: enrollment.completedAt,
          lastResetAt: enrollment.lastResetAt,
        },
      });

      if (auditEvent) {
        await tx.outboxMessage.create({
          data: {
            eventName: auditEvent.eventName,
            payload: auditEvent as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });
  }
}
