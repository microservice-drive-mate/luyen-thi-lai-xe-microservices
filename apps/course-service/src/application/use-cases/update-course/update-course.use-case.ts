import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { CourseResult } from '../shared/course.result';
import { UpdateCourseCommand } from './update-course.command';

@Injectable()
export class UpdateCourseUseCase
  implements IUseCase<UpdateCourseCommand, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
  ) {}

  async execute(command: UpdateCourseCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.update({
      expectedVersion: command.expectedVersion,
      title: command.title,
      description: command.description,
      duration: command.duration,
      tuitionFee: command.tuitionFee,
      capacity: command.capacity,
    });

    if (command.requirement !== undefined && command.requirement !== null) {
      course.setRequirements(command.requirement);
    }

    await this.courseRepository.save(
      course,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.actorId ?? course.createdById,
        action: 'COURSE_UPDATED',
        resourceType: 'COURSE',
        resourceId: course.id,
        requestContext: command.auditContext,
        metadata: { title: course.title, version: course.version },
      }),
    );
    await this.courseCache.invalidateCourse(course.id);
    return CourseResult.fromAggregate(course);
  }
}
