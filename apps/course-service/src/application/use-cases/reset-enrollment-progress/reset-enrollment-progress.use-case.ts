import { Injectable } from '@nestjs/common';
import { createAuditEvent, IUseCase } from '@repo/common';
import { EnrollmentNotFoundException } from '../../../domain/exceptions/enrollment-not-found.exception';
import { EnrollmentResetCooldownException } from '../../../domain/exceptions/enrollment-reset-cooldown.exception';
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

    const actorRole = command.auditContext?.actorRole ?? '';
    const isStaff =
      actorRole === 'ADMIN' ||
      actorRole === 'CENTER_MANAGER' ||
      actorRole === 'realm:ADMIN' ||
      actorRole === 'realm:CENTER_MANAGER';

    if (!isStaff && enrollment.studentId !== command.studentId) {
      throw new EnrollmentUnauthorizedException(command.enrollmentId);
    }

    if (!isStaff && enrollment.lastResetAt) {
      const cooldownMs = 24 * 60 * 60 * 1000;
      const timeSinceLastReset = Date.now() - enrollment.lastResetAt.getTime();
      if (timeSinceLastReset < cooldownMs) {
        const hoursRemaining =
          (cooldownMs - timeSinceLastReset) / (60 * 60 * 1000);
        throw new EnrollmentResetCooldownException(
          enrollment.id,
          hoursRemaining,
        );
      }
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
