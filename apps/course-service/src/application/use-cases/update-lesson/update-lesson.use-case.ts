import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { EventPublisher } from '../../ports/event-publisher.port';
import { CourseResult } from '../shared/course.result';
import { UpdateLessonCommand } from './update-lesson.command';

@Injectable()
export class UpdateLessonUseCase
  implements IUseCase<UpdateLessonCommand, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: UpdateLessonCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.updateLesson(command.lessonId, {
      title: command.title,
      order: command.order,
      content: command.content,
    });

    await this.courseRepository.save(
      course,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.actorId ?? course.createdById,
        action: 'COURSE_LESSON_UPDATED',
        resourceType: 'COURSE',
        resourceId: course.id,
        requestContext: command.auditContext,
        metadata: { lessonId: command.lessonId },
      }),
    );
    await this.courseCache.invalidateCourse(course.id);
    await this.eventPublisher.publishAll(course.getDomainEvents());
    course.clearDomainEvents();
    return CourseResult.fromAggregate(course);
  }
}
