import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { CourseResult } from '../shared/course.result';
import { RemoveLessonCommand } from './remove-lesson.command';

@Injectable()
export class RemoveLessonUseCase
  implements IUseCase<RemoveLessonCommand, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
  ) {}

  async execute(command: RemoveLessonCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.removeLesson(command.lessonId);

    await this.courseRepository.save(
      course,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.actorId ?? course.createdById,
        action: 'COURSE_LESSON_REMOVED',
        resourceType: 'COURSE',
        resourceId: course.id,
        requestContext: command.auditContext,
        metadata: { lessonId: command.lessonId },
      }),
    );
    await this.courseCache.invalidateCourse(course.id);
    return CourseResult.fromAggregate(course);
  }
}
