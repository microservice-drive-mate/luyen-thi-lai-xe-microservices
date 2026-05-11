import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseResult } from '../shared/course.result';
import { UpdateCourseCommand } from './update-course.command';

@Injectable()
export class UpdateCourseUseCase
  implements IUseCase<UpdateCourseCommand, CourseResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(command: UpdateCourseCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.update({
      title: command.title,
      description: command.description,
      duration: command.duration,
      tuitionFee: command.tuitionFee,
      capacity: command.capacity,
    });

    if (command.requirement !== undefined && command.requirement !== null) {
      course.setRequirements(command.requirement);
    }

    await this.courseRepository.save(course);
    return CourseResult.fromAggregate(course);
  }
}
