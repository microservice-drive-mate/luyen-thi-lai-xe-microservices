import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { EnrollmentNotFoundException } from '../../../domain/exceptions/enrollment-not-found.exception';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { EnrollmentResult } from '../shared/enrollment.result';
import { UnenrollStudentCommand } from './unenroll-student.command';

@Injectable()
export class UnenrollStudentUseCase
  implements IUseCase<UnenrollStudentCommand, EnrollmentResult>
{
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
  ) {}

  async execute(command: UnenrollStudentCommand): Promise<EnrollmentResult> {
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      command.studentId,
      command.courseId,
    );
    if (!enrollment) throw new EnrollmentNotFoundException(command.courseId);

    enrollment.drop();
    await this.enrollmentRepository.save(
      enrollment,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.studentId,
        action: 'COURSE_UNENROLLED',
        resourceType: 'COURSE_ENROLLMENT',
        resourceId: enrollment.id,
        requestContext: command.auditContext,
        metadata: { courseId: enrollment.courseId },
      }),
    );
    return EnrollmentResult.fromAggregate(enrollment);
  }
}
