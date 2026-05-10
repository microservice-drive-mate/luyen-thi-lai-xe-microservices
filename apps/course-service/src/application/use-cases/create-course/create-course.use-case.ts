import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { Course } from '../../../domain/aggregates/course/course.aggregate';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CreateCourseCommand } from './create-course.command';
import { CourseResult } from '../shared/course.result';

@Injectable()
export class CreateCourseUseCase
  implements IUseCase<CreateCourseCommand, CourseResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(command: CreateCourseCommand): Promise<CourseResult> {
    const course = Course.create({
      title: command.title,
      description: command.description,
      licenseCategory: command.licenseCategory,
      thumbnailUrl: command.thumbnailUrl,
      duration: command.duration,
      tuitionFee: command.tuitionFee,
      capacity: command.capacity,
      createdById: command.createdById,
      instructorIds: command.instructorIds,
      requirement: command.requirement ?? null,
    });

    await this.courseRepository.save(course);
    return CourseResult.fromAggregate(course);
  }
}
