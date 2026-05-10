import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseResult } from '../shared/course.result';
import { AddCourseMaterialCommand } from './add-course-material.command';

@Injectable()
export class AddCourseMaterialUseCase
  implements IUseCase<AddCourseMaterialCommand, CourseResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(command: AddCourseMaterialCommand): Promise<CourseResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    course.addMaterial({
      title: command.title,
      fileUrl: command.fileUrl,
      type: command.type,
    });

    await this.courseRepository.save(course);
    return CourseResult.fromAggregate(course);
  }
}
