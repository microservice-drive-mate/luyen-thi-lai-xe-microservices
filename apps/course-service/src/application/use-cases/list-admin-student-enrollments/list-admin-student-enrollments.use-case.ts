import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { ListAdminStudentEnrollmentsQuery } from './list-admin-student-enrollments.query';
import {
  AdminStudentEnrollmentResult,
  ListAdminStudentEnrollmentsResult,
} from './list-admin-student-enrollments.result';

@Injectable()
export class ListAdminStudentEnrollmentsUseCase
  implements
    IUseCase<
      ListAdminStudentEnrollmentsQuery,
      ListAdminStudentEnrollmentsResult
    >
{
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
  ) {}

  async execute(
    query: ListAdminStudentEnrollmentsQuery,
  ): Promise<ListAdminStudentEnrollmentsResult> {
    const page = Math.max(query.page, 1);
    const size = Math.min(Math.max(query.size, 1), 100);
    const { items, total } =
      await this.enrollmentRepository.findByStudentIdWithCourse({
        studentId: query.studentId,
        status: query.status,
        page,
        size,
      });

    return new ListAdminStudentEnrollmentsResult(
      items.map(AdminStudentEnrollmentResult.fromProjection),
      total,
      page,
      size,
    );
  }
}
