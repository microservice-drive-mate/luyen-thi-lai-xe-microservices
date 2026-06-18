import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseCachePort } from '../../ports/course-cache.port';
import { CourseResult, ListCoursesResult } from '../shared/course.result';
import { ListCoursesQuery } from './list-courses.query';

@Injectable()
export class ListCoursesUseCase
  implements IUseCase<ListCoursesQuery, ListCoursesResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly courseCache: CourseCachePort,
  ) {}

  async execute(query: ListCoursesQuery): Promise<ListCoursesResult> {
    const cacheKey = {
      licenseCategory: query.licenseCategory,
      status: query.status,
      createdById: query.createdById,
      page: query.page,
      size: query.size,
    };
    const cached = await this.courseCache.getCourseList(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.courseRepository.findAll({
      licenseCategory: query.licenseCategory,
      status: query.status,
      createdById: query.createdById,
      page: query.page,
      size: query.size,
    });

    const result = new ListCoursesResult(
      items.map(CourseResult.fromAggregate),
      total,
      query.page,
      query.size,
    );
    await this.courseCache.setCourseList(cacheKey, result);
    return result;
  }
}
