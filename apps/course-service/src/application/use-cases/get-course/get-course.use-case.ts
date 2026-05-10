import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseResult } from '../shared/course.result';
import { GetCourseQuery } from './get-course.query';

@Injectable()
export class GetCourseUseCase
  implements IUseCase<GetCourseQuery, CourseResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(query: GetCourseQuery): Promise<CourseResult> {
    const course = await this.courseRepository.findById(query.courseId);
    if (!course) throw new CourseNotFoundException(query.courseId);
    return CourseResult.fromAggregate(course);
  }
}
