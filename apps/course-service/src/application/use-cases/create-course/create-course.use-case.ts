import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { Course } from '../../../domain/aggregates/course/course.aggregate';
import { CourseCodeAlreadyExistsException } from '../../../domain/exceptions/course-code-already-exists.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { CourseResult } from '../shared/course.result';
import { CreateCourseCommand } from './create-course.command';

@Injectable()
export class CreateCourseUseCase
  implements IUseCase<CreateCourseCommand, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
  ) {}

  async execute(command: CreateCourseCommand): Promise<CourseResult> {
    if (
      command.courseCode &&
      (await this.courseRepository.existsByCourseCode(command.courseCode))
    ) {
      throw new CourseCodeAlreadyExistsException(command.courseCode);
    }
    const course = Course.create({
      courseCode: command.courseCode,
      title: command.title,
      description: command.description,
      licenseCategory: command.licenseCategory,
      duration: command.duration,
      tuitionFee: command.tuitionFee,
      capacity: command.capacity,
      createdById: command.createdById,
      instructorIds: command.instructorIds,
      requirement: command.requirement ?? null,
    });

    await this.courseRepository.save(
      course,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.createdById,
        action: 'COURSE_CREATED',
        resourceType: 'COURSE',
        resourceId: course.id,
        requestContext: command.auditContext,
        metadata: {
          title: course.title,
          courseCode: course.courseCode,
          licenseCategory: course.licenseCategory,
        },
      }),
    );
    await this.courseCache.invalidateLists();
    return CourseResult.fromAggregate(course);
  }
}
