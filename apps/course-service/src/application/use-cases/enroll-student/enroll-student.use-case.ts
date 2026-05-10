import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { CourseEnrollment } from '../../../domain/aggregates/course-enrollment/course-enrollment.aggregate';
import { CourseStatus } from '../../../domain/aggregates/course/course.types';
import { CourseCapacityExceededException } from '../../../domain/exceptions/course-capacity-exceeded.exception';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { CourseNotActiveException } from '../../../domain/exceptions/course-not-active.exception';
import { EnrollmentAlreadyExistsException } from '../../../domain/exceptions/enrollment-already-exists.exception';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { CourseEnrollmentCreatedEvent } from '../../../domain/events/course-enrollment-created.event';
import { EnrollmentResult } from '../shared/enrollment.result';
import { EnrollStudentCommand } from './enroll-student.command';

@Injectable()
export class EnrollStudentUseCase
  implements IUseCase<EnrollStudentCommand, EnrollmentResult>
{
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly enrollmentRepository: CourseEnrollmentRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: EnrollStudentCommand): Promise<EnrollmentResult> {
    const course = await this.courseRepository.findById(command.courseId);
    if (!course) throw new CourseNotFoundException(command.courseId);

    if (course.status !== CourseStatus.ACTIVE) {
      throw new CourseNotActiveException(command.courseId);
    }

    const existing = await this.enrollmentRepository.findByStudentAndCourse(
      command.studentId,
      command.courseId,
    );
    if (existing)
      throw new EnrollmentAlreadyExistsException(
        command.studentId,
        command.courseId,
      );

    if (course.capacity !== null) {
      const currentCount = await this.courseRepository.countEnrollments(
        command.courseId,
      );
      if (currentCount >= course.capacity) {
        throw new CourseCapacityExceededException(
          command.courseId,
          course.capacity,
        );
      }
    }

    const enrollment = CourseEnrollment.create({
      courseId: command.courseId,
      studentId: command.studentId,
    });

    await this.enrollmentRepository.save(enrollment);

    await this.eventPublisher.publish(
      new CourseEnrollmentCreatedEvent(
        enrollment.id,
        command.studentId,
        command.courseId,
      ),
    );

    return EnrollmentResult.fromAggregate(enrollment);
  }
}
