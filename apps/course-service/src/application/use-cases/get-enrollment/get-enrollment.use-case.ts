import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { EnrollmentNotFoundException } from '../../../domain/exceptions/enrollment-not-found.exception';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { EnrollmentResult } from '../shared/enrollment.result';
import { GetEnrollmentQuery } from './get-enrollment.query';

@Injectable()
export class GetEnrollmentUseCase
  implements IUseCase<GetEnrollmentQuery, EnrollmentResult>
{
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
  ) {}

  async execute(query: GetEnrollmentQuery): Promise<EnrollmentResult> {
    const enrollment = await this.enrollmentRepository.findById(
      query.enrollmentId,
    );
    if (!enrollment) throw new EnrollmentNotFoundException(query.enrollmentId);
    return EnrollmentResult.fromAggregate(enrollment);
  }
}
