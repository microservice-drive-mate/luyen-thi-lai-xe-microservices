import { Injectable } from '@nestjs/common';
import { AuditEventEnvelope } from '@repo/common';
import { Prisma } from '@prisma/course-client';
import { Course } from '../../../domain/aggregates/course/course.aggregate';
import {
  CourseRepository,
  ListCoursesFilter,
  ListCoursesPage,
} from '../../../domain/repositories/course.repository';
import { CourseMapper } from '../mappers/course.mapper';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaCourseRepository extends CourseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<Course | null> {
    const raw = await this.prisma.course.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { order: 'asc' } },
        instructors: true,
        requirement: true,
        materials: { orderBy: { createdAt: 'asc' } },
      },
    });
    return raw ? CourseMapper.toDomain(raw) : null;
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.prisma.course.count({
      where: { id, isDeleted: false },
    });
    return count > 0;
  }

  async existsByCourseCode(
    courseCode: string,
    excludeCourseId?: string,
  ): Promise<boolean> {
    const count = await this.prisma.course.count({
      where: {
        courseCode,
        ...(excludeCourseId && { id: { not: excludeCourseId } }),
      },
    });
    return count > 0;
  }

  async findAll(filter: ListCoursesFilter): Promise<ListCoursesPage> {
    const where = {
      ...(filter.licenseCategory && {
        licenseCategory: filter.licenseCategory,
      }),
      ...(filter.status && { status: filter.status }),
      ...(!filter.status && { status: { not: 'ARCHIVED' as const } }),
      isDeleted: false,
      ...(filter.createdById && { createdById: filter.createdById }),
    };

    const skip = (filter.page - 1) * filter.size;

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip,
        take: filter.size,
        orderBy: { createdAt: 'desc' },
        include: {
          lessons: { orderBy: { order: 'asc' } },
          instructors: true,
          requirement: true,
          materials: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      items: rawItems.map(CourseMapper.toDomain),
      total,
    };
  }

  async countEnrollments(courseId: string): Promise<number> {
    return this.prisma.courseEnrollment.count({
      where: { courseId, status: { not: 'DROPPED' } },
    });
  }

  async save(course: Course, auditEvent?: AuditEventEnvelope): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.course.upsert({
        where: { id: course.id },
        create: {
          id: course.id,
          courseCode: course.courseCode,
          title: course.title,
          description: course.description,
          licenseCategory: course.licenseCategory,
          totalLessons: course.totalLessons,
          duration: course.duration,
          tuitionFee: course.tuitionFee,
          capacity: course.capacity,
          status: course.status,
          version: course.version,
          isDeleted: course.isDeleted,
          deletedAt: course.deletedAt,
          deletedBy: course.deletedBy,
          createdById: course.createdById,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
        },
        update: {
          title: course.title,
          courseCode: course.courseCode,
          description: course.description,
          licenseCategory: course.licenseCategory,
          totalLessons: course.totalLessons,
          duration: course.duration,
          tuitionFee: course.tuitionFee,
          capacity: course.capacity,
          status: course.status,
          version: course.version,
          isDeleted: course.isDeleted,
          deletedAt: course.deletedAt,
          deletedBy: course.deletedBy,
          updatedAt: course.updatedAt,
        },
      });

      await tx.lesson.deleteMany({ where: { courseId: course.id } });
      if (course.lessons.length > 0) {
        await tx.lesson.createMany({
          data: course.lessons.map((l) => ({
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            content: l.content,
            order: l.order,
            createdAt: l.createdAt,
          })),
        });
      }

      await tx.courseInstructor.deleteMany({ where: { courseId: course.id } });
      if (course.instructors.length > 0) {
        await tx.courseInstructor.createMany({
          data: course.instructors.map((i) => ({
            id: i.id,
            courseId: i.courseId,
            instructorId: i.instructorId,
          })),
        });
      }

      if (course.requirement) {
        const req = course.requirement;
        await tx.courseRequirement.upsert({
          where: { courseId: course.id },
          create: {
            id: req.id,
            courseId: req.courseId,
            minAge: req.minAge,
            prerequisites: req.prerequisites,
            attendanceRate: req.attendanceRate,
            minPassScore: req.minPassScore,
            requiredExams: req.requiredExams,
          },
          update: {
            minAge: req.minAge,
            prerequisites: req.prerequisites,
            attendanceRate: req.attendanceRate,
            minPassScore: req.minPassScore,
            requiredExams: req.requiredExams,
          },
        });
      }

      await tx.courseMaterial.deleteMany({ where: { courseId: course.id } });
      if (course.materials.length > 0) {
        await tx.courseMaterial.createMany({
          data: course.materials.map((m) => ({
            id: m.id,
            courseId: m.courseId,
            title: m.title,
            fileUrl: m.fileUrl,
            mediaFileId: m.mediaFileId,
            type: m.type,
            createdAt: m.createdAt,
          })),
        });
      }

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
