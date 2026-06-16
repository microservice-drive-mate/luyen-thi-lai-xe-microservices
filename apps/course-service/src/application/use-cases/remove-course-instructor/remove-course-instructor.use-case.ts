import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { EventPublisher } from '../../ports/event-publisher.port';
import { CourseResult } from '../shared/course.result';
import { RemoveCourseInstructorCommand } from './remove-course-instructor.command';

@Injectable()
export class RemoveCourseInstructorUseCase
  implements IUseCase<RemoveCourseInstructorCommand, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: RemoveCourseInstructorCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.removeInstructor(command.instructorId);
    await this.courseRepository.save(
      course,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.actorId ?? course.createdById,
        action: 'COURSE_INSTRUCTOR_REMOVED',
        resourceType: 'COURSE',
        resourceId: course.id,
        requestContext: command.auditContext,
        metadata: { instructorId: command.instructorId },
      }),
    );
    await this.courseCache.invalidateCourse(course.id);
    await this.eventPublisher.publishAll(course.getDomainEvents());
    course.clearDomainEvents();
    return CourseResult.fromAggregate(course);
  }
}
