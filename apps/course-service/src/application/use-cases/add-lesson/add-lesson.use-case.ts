import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseResult } from '../shared/course.result';
import { AddLessonCommand } from './add-lesson.command';

@Injectable()
export class AddLessonUseCase
  implements IUseCase<AddLessonCommand, CourseResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(command: AddLessonCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.addLesson({
      title: command.title,
      content: command.content,
      order: command.order,
    });

    await this.courseRepository.save(course);
    return CourseResult.fromAggregate(course);
  }
}
