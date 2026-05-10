import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseResult } from '../shared/course.result';
import { ActivateCourseCommand } from './activate-course.command';

@Injectable()
export class ActivateCourseUseCase
  implements IUseCase<ActivateCourseCommand, CourseResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(command: ActivateCourseCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.activate();

    await this.courseRepository.save(course);
    return CourseResult.fromAggregate(course);
  }
}
