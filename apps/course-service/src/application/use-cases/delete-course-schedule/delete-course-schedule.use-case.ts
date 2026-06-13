import { Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseScheduleDeletedEvent } from '../../../domain/events/course-schedule-deleted.event';
import { CourseScheduleRepository } from '../../../domain/repositories/course-schedule.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { DeleteCourseScheduleCommand } from './delete-course-schedule.command';

@Injectable()
export class DeleteCourseScheduleUseCase
  implements IUseCase<DeleteCourseScheduleCommand, void>
{
  constructor(
    private readonly scheduleRepository: CourseScheduleRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: DeleteCourseScheduleCommand): Promise<void> {
    const existing = await this.scheduleRepository.findById(command.scheduleId);
    if (!existing || existing.courseId !== command.courseId) {
      throw new NotFoundException('Course schedule not found');
    }

    const schedule = await this.scheduleRepository.deactivate(
      command.scheduleId,
    );
    await this.eventPublisher.publish(
      new CourseScheduleDeletedEvent(
        schedule.id,
        schedule.courseId,
        schedule.instructorId,
      ),
    );
  }
}
