import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { CourseResult } from '../shared/course.result';
import { GetCourseQuery } from './get-course.query';

@Injectable()
export class GetCourseUseCase
  implements IUseCase<GetCourseQuery, CourseResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
  ) {}

  async execute(query: GetCourseQuery): Promise<CourseResult> {
    const cached = await this.courseCache.getCourse(query.courseId);
    if (cached) return cached;

    const course = await this.courseRepository.findById(query.courseId);
    if (!course) throw new CourseNotFoundException(query.courseId);
    const result = CourseResult.fromAggregate(course);
    await this.courseCache.setCourse(result);
    return result;
  }
}
