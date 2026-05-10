import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import {
  EnrollmentResult,
  ListEnrollmentsResult,
} from '../shared/enrollment.result';
import { ListStudentEnrollmentsQuery } from './list-student-enrollments.query';

@Injectable()
export class ListStudentEnrollmentsUseCase
  implements IUseCase<ListStudentEnrollmentsQuery, ListEnrollmentsResult>
{
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
  ) {}

  async execute(
    query: ListStudentEnrollmentsQuery,
  ): Promise<ListEnrollmentsResult> {
    const { items, total } = await this.enrollmentRepository.findByStudentId({
      studentId: query.studentId,
      status: query.status,
      page: query.page,
      size: query.size,
    });

    return new ListEnrollmentsResult(
      items.map(EnrollmentResult.fromAggregate),
      total,
      query.page,
      query.size,
    );
  }
}
