import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseResult, ListCoursesResult } from '../shared/course.result';
import { ListCoursesQuery } from './list-courses.query';

@Injectable()
export class ListCoursesUseCase
  implements IUseCase<ListCoursesQuery, ListCoursesResult>
{
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(query: ListCoursesQuery): Promise<ListCoursesResult> {
    const { items, total } = await this.courseRepository.findAll({
      licenseCategory: query.licenseCategory,
      status: query.status,
      createdById: query.createdById,
      page: query.page,
      size: query.size,
    });

    return new ListCoursesResult(
      items.map(CourseResult.fromAggregate),
      total,
      query.page,
      query.size,
    );
  }
}
