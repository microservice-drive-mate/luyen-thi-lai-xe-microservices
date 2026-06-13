import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { CourseScheduleRepository } from '../../../domain/repositories/course-schedule.repository';
import { CourseScheduleResult } from '../shared/course-schedule.result';
import { ListCourseSchedulesQuery } from './list-course-schedules.query';

@Injectable()
export class ListCourseSchedulesUseCase
  implements IUseCase<ListCourseSchedulesQuery, CourseScheduleResult[]>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly scheduleRepository: CourseScheduleRepository,
  ) {}

  async execute(
    query: ListCourseSchedulesQuery,
  ): Promise<CourseScheduleResult[]> {
    if (!(await this.courseRepository.existsById(query.courseId))) {
      throw new CourseNotFoundException(query.courseId);
    }
    const schedules = await this.scheduleRepository.listByCourse(
      query.courseId,
    );
    return schedules.map(CourseScheduleResult.fromRecord);
  }
}
