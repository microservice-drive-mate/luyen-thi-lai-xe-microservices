import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { CourseResult } from '../shared/course.result';
import { AddCourseMaterialCommand } from './add-course-material.command';

@Injectable()
export class AddCourseMaterialUseCase
  implements IUseCase<AddCourseMaterialCommand, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: AddCourseMaterialCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.addMaterial({
      title: command.title,
      fileUrl: command.fileUrl,
      mediaFileId: command.mediaFileId,
      type: command.type,
    });

    await this.courseRepository.save(course);

    await this.eventPublisher.publishAll(course.getDomainEvents());
    course.clearDomainEvents();

    return CourseResult.fromAggregate(course);
  }
}
