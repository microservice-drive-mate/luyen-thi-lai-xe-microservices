import { Injectable } from '@nestjs/common';
import { IUseCase, MetricsService } from '@repo/common';
import { EnrollmentStatus } from '../../../domain/aggregates/course-enrollment/course-enrollment.types';
import { CourseNotFoundException } from '../../../domain/exceptions/course-not-found.exception';
import { EnrollmentNotFoundException } from '../../../domain/exceptions/enrollment-not-found.exception';
import { CourseEnrollmentRepository } from '../../../domain/repositories/course-enrollment.repository';
import { CourseRepository } from '../../../domain/repositories/course.repository';
import { EventPublisher } from '../../ports/event-publisher.port';
import { EnrollmentResult } from '../shared/enrollment.result';
import { CompleteLessonCommand } from './complete-lesson.command';

@Injectable()
export class CompleteLessonUseCase
  implements IUseCase<CompleteLessonCommand, EnrollmentResult>
{
  constructor(
    private readonly enrollmentRepository: CourseEnrollmentRepository,
    private readonly courseRepository: CourseRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly metricsService: MetricsService,
  ) {}

  async execute(command: CompleteLessonCommand): Promise<EnrollmentResult> {
    const enrollment = await this.enrollmentRepository.findById(
      command.enrollmentId,
    );
    if (!enrollment)
      throw new EnrollmentNotFoundException(command.enrollmentId);

    const course = await this.courseRepository.findById(enrollment.courseId);
    if (!course) throw new CourseNotFoundException(enrollment.courseId);

    const previousStatus: EnrollmentStatus = enrollment.status;
    enrollment.completeLesson(command.lessonId, course.totalLessons);

    await this.enrollmentRepository.save(enrollment);

    const events = enrollment.getDomainEvents();
    await this.eventPublisher.publishAll(events);
    enrollment.clearDomainEvents();

    const currentStatus: EnrollmentStatus = enrollment.status;
    this.metricsService.recordCourseLessonCompleted({
      courseId: enrollment.courseId,
      enrollmentStatus: currentStatus,
    });

    if (
      previousStatus !== EnrollmentStatus.COMPLETED &&
      currentStatus === EnrollmentStatus.COMPLETED
    ) {
      this.metricsService.recordCourseEnrollmentCompleted({
        courseId: enrollment.courseId,
      });
    }

    return EnrollmentResult.fromAggregate(enrollment);
  }
}
