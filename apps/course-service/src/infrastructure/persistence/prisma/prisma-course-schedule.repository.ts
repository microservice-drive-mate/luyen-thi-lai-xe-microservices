import { Injectable } from '@nestjs/common';
import {
  CourseScheduleInput,
  CourseScheduleRecord,
  CourseScheduleRepository,
} from '../../../domain/repositories/course-schedule.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaCourseScheduleRepository extends CourseScheduleRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<CourseScheduleRecord | null> {
    return this.prisma.courseSchedule.findUnique({ where: { id } });
  }

  async listByCourse(courseId: string): Promise<CourseScheduleRecord[]> {
    return this.prisma.courseSchedule.findMany({
      where: { courseId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(input: CourseScheduleInput): Promise<CourseScheduleRecord> {
    return this.prisma.courseSchedule.create({
      data: {
        courseId: input.courseId,
        instructorId: input.instructorId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(
    id: string,
    input: Partial<CourseScheduleInput>,
  ): Promise<CourseScheduleRecord> {
    return this.prisma.courseSchedule.update({
      where: { id },
      data: {
        instructorId: input.instructorId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        isActive: input.isActive,
      },
    });
  }

  async deactivate(id: string): Promise<CourseScheduleRecord> {
    return this.prisma.courseSchedule.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
