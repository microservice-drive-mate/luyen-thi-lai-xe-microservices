import { Injectable } from '@nestjs/common';
import { CourseEnrollment } from '../../../domain/aggregates/course-enrollment/course-enrollment.aggregate';
import {
  CourseEnrollmentRepository,
  ListEnrollmentsFilter,
  ListEnrollmentsPage,
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
      include: { lessonProgress: true },
    });
    return raw ? CourseEnrollmentMapper.toDomain(raw) : null;
  }

  async findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<CourseEnrollment | null> {
    const raw = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
      include: { lessonProgress: true },
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
        include: { lessonProgress: true },
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);

    return {
      items: rawItems.map(CourseEnrollmentMapper.toDomain),
      total,
    };
  }

  async save(enrollment: CourseEnrollment): Promise<void> {
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
        },
        update: {
          status: enrollment.status,
          progress: enrollment.progress,
          completedAt: enrollment.completedAt,
        },
      });

      for (const lp of enrollment.lessonProgress) {
        await tx.lessonProgress.upsert({
          where: {
            enrollmentId_lessonId: {
              enrollmentId: lp.enrollmentId,
              lessonId: lp.lessonId,
            },
          },
          create: {
            id: lp.id,
            enrollmentId: lp.enrollmentId,
            lessonId: lp.lessonId,
            completedAt: lp.completedAt,
            watchedSeconds: lp.watchedSeconds,
          },
          update: {
            completedAt: lp.completedAt,
            watchedSeconds: lp.watchedSeconds,
          },
        });
      }
    });
  }
}
