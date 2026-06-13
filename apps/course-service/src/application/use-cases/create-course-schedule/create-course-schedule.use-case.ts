import { BadRequestException, Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseScheduleCreatedEvent } from '../../../domain/events/course-schedule-created.event';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseScheduleRepository } from '../../../domain/repositories/course-schedule.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { CourseScheduleResult } from '../shared/course-schedule.result';
import { validateCourseSchedule } from '../shared/course-schedule.validation';
import { CreateCourseScheduleCommand } from './create-course-schedule.command';

@Injectable()
export class CreateCourseScheduleUseCase
  implements IUseCase<CreateCourseScheduleCommand, CourseScheduleResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly scheduleRepository: CourseScheduleRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(
    command: CreateCourseScheduleCommand,
  ): Promise<CourseScheduleResult> {
    validateCourseSchedule(command);
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);
    if (!course.instructorIds.includes(command.instructorId)) {
      throw new BadRequestException('instructorId must be assigned to course');
    }

    const schedule = await this.scheduleRepository.create({
      courseId: command.courseId,
      instructorId: command.instructorId,
      dayOfWeek: command.dayOfWeek,
      startTime: command.startTime,
      endTime: command.endTime,
      room: command.room,
      effectiveFrom: command.effectiveFrom,
      effectiveTo: command.effectiveTo,
    });

    await this.eventPublisher.publish(
      new CourseScheduleCreatedEvent(
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
