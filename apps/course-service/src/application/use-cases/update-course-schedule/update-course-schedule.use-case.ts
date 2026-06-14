import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseScheduleUpdatedEvent } from '../../../domain/events/course-schedule-updated.event';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseScheduleRepository } from '../../../domain/repositories/course-schedule.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { CourseScheduleResult } from '../shared/course-schedule.result';
import { validateCourseSchedule } from '../shared/course-schedule.validation';
import { UpdateCourseScheduleCommand } from './update-course-schedule.command';

@Injectable()
export class UpdateCourseScheduleUseCase
  implements IUseCase<UpdateCourseScheduleCommand, CourseScheduleResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly scheduleRepository: CourseScheduleRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(
    command: UpdateCourseScheduleCommand,
  ): Promise<CourseScheduleResult> {
    const existing = await this.scheduleRepository.findById(command.scheduleId);
    if (!existing || existing.courseId !== command.courseId) {
      throw new NotFoundException('Course schedule not found');
    }

    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);
    const instructorId = command.instructorId ?? existing.instructorId;
    if (!course.instructorIds.includes(instructorId)) {
      throw new BadRequestException('instructorId must be assigned to course');
    }

    validateCourseSchedule({
      dayOfWeek: command.dayOfWeek ?? existing.dayOfWeek,
      startTime: command.startTime ?? existing.startTime,
      endTime: command.endTime ?? existing.endTime,
      effectiveFrom: command.effectiveFrom ?? existing.effectiveFrom,
      effectiveTo:
        command.effectiveTo !== undefined
          ? command.effectiveTo
          : existing.effectiveTo,
    });

    const schedule = await this.scheduleRepository.update(command.scheduleId, {
      instructorId,
      dayOfWeek: command.dayOfWeek ?? existing.dayOfWeek,
      startTime: command.startTime ?? existing.startTime,
      endTime: command.endTime ?? existing.endTime,
      room: command.room !== undefined ? command.room : existing.room,
      effectiveFrom: command.effectiveFrom ?? existing.effectiveFrom,
      effectiveTo:
        command.effectiveTo !== undefined
          ? command.effectiveTo
          : existing.effectiveTo,
      isActive: command.isActive ?? existing.isActive,
    });

    await this.eventPublisher.publish(
      new CourseScheduleUpdatedEvent(
        schedule.id,
        schedule.courseId,
        schedule.instructorId,
        schedule.dayOfWeek,
        schedule.startTime,
        schedule.endTime,
        schedule.room,
        schedule.effectiveFrom.toISOString().slice(0, 10),
        schedule.effectiveTo?.toISOString().slice(0, 10) ?? null,
        schedule.isActive,
      ),
    );

    return CourseScheduleResult.fromRecord(schedule);
  }
}
