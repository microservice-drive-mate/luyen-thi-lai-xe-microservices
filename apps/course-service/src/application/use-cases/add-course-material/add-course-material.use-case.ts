import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
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
    private readonly courseCache: CourseCachePort,
  ) {}

  async execute(command: AddCourseMaterialCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.addMaterial({
      id: crypto.randomUUID(),
      title: command.title,
      fileUrl: command.fileUrl,
      mediaFileId: command.mediaFileId,
      type: command.type,
    });

    await this.courseRepository.save(
      course,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.actorId ?? course.createdById,
        action: 'COURSE_MATERIAL_ADDED',
        resourceType: 'COURSE',
        resourceId: course.id,
        requestContext: command.auditContext,
        metadata: { title: command.title, mediaFileId: command.mediaFileId },
      }),
    );
    await this.courseCache.invalidateCourse(course.id);

    await this.eventPublisher.publishAll(course.getDomainEvents());
    course.clearDomainEvents();

    return CourseResult.fromAggregate(course);
  }
}
