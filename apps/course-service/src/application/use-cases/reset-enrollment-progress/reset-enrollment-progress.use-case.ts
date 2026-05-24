import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { EnrollmentNotFoundException } from '../../../domain/exceptions/enrollment-not-found.exception';
import { EnrollmentUnauthorizedException } from '../../../domain/exceptions/enrollment-unauthorized.exception';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { EnrollmentResult } from '../shared/enrollment.result';
import { ResetEnrollmentProgressCommand } from './reset-enrollment-progress.command';

@Injectable()
export class ResetEnrollmentProgressUseCase
  implements IUseCase<ResetEnrollmentProgressCommand, EnrollmentResult>
{
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(
    command: ResetEnrollmentProgressCommand,
  ): Promise<EnrollmentResult> {
    const enrollment = await this.enrollmentRepository.findById(
      command.enrollmentId,
    );
    if (!enrollment)
      throw new EnrollmentNotFoundException(command.enrollmentId);
    if (enrollment.studentId !== command.studentId) {
      throw new EnrollmentUnauthorizedException(command.enrollmentId);
    }

    enrollment.resetProgress();
    await this.enrollmentRepository.save(
      enrollment,
      createAuditEvent({
        serviceName: 'course-service',
        actorId: command.studentId,
        action: 'ENROLLMENT_PROGRESS_RESET',
        resourceType: 'COURSE_ENROLLMENT',
        resourceId: enrollment.id,
        requestContext: command.auditContext,
        metadata: { courseId: enrollment.courseId },
      }),
    );

    const events = enrollment.getDomainEvents();
    await this.eventPublisher.publishAll(events);
    enrollment.clearDomainEvents();

    return EnrollmentResult.fromAggregate(enrollment);
  }
}
