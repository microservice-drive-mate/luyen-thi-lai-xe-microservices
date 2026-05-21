import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisher } from './application/ports/event-publisher.port';
import { ActivateCourseUseCase } from './application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialUseCase } from './application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonUseCase } from './application/use-cases/add-lesson/add-lesson.use-case';
import { CompleteLessonUseCase } from './application/use-cases/complete-lesson/complete-lesson.use-case';
import { CreateCourseUseCase } from './application/use-cases/create-course/create-course.use-case';
import { EnrollStudentUseCase } from './application/use-cases/enroll-student/enroll-student.use-case';
import { GetCourseUseCase } from './application/use-cases/get-course/get-course.use-case';
import { GetEnrollmentUseCase } from './application/use-cases/get-enrollment/get-enrollment.use-case';
import { ListCoursesUseCase } from './application/use-cases/list-courses/list-courses.use-case';
import { ListStudentEnrollmentsUseCase } from './application/use-cases/list-student-enrollments/list-student-enrollments.use-case';
import { RemoveLessonUseCase } from './application/use-cases/remove-lesson/remove-lesson.use-case';
import { UpdateCourseUseCase } from './application/use-cases/update-course/update-course.use-case';
import { CourseEnrollmentRepository } from './domain/repositories/course-enrollment.repository';
import { CourseRepository } from './domain/repositories/course.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import {
  MEDIA_SERVICE_CLIENT,
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import { PrismaCourseEnrollmentRepository } from './infrastructure/persistence/prisma/prisma-course-enrollment.repository';
import { PrismaCourseRepository } from './infrastructure/persistence/prisma/prisma-course.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { AdminCourseController } from './presentation/http/admin-course.controller';
import { CourseController } from './presentation/http/course.controller';
import { EnrollmentController } from './presentation/http/enrollment.controller';
import { MessagingController } from './presentation/messaging/messaging.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'course_service_publish',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: MEDIA_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'media_service_events',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [
    CourseController,
    AdminCourseController,
    EnrollmentController,
    MessagingController,
  ],
  providers: [
    // Infrastructure
    PrismaService,
    DomainExceptionFilter,

    // Repository bindings
    { provide: CourseRepository, useClass: PrismaCourseRepository },
    {
      provide: CourseEnrollmentRepository,
      useClass: PrismaCourseEnrollmentRepository,
    },

    // EventPublisher binding
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },

    // Course use cases
    CreateCourseUseCase,
    UpdateCourseUseCase,
    ActivateCourseUseCase,
    AddLessonUseCase,
    RemoveLessonUseCase,
    AddCourseMaterialUseCase,
    GetCourseUseCase,
    ListCoursesUseCase,

    // Enrollment use cases
    EnrollStudentUseCase,
    CompleteLessonUseCase,
    GetEnrollmentUseCase,
    ListStudentEnrollmentsUseCase,
  ],
})
export class CourseModule {}
