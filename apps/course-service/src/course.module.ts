import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { CourseCachePort } from './application/ports/course-cache.port';
import { EventPublisher } from './application/ports/event-publisher.port';
import { ActivateCourseUseCase } from './application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialUseCase } from './application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonUseCase } from './application/use-cases/add-lesson/add-lesson.use-case';
import { CompleteLessonUseCase } from './application/use-cases/complete-lesson/complete-lesson.use-case';
import { CreateCourseUseCase } from './application/use-cases/create-course/create-course.use-case';
import { DeleteCourseUseCase } from './application/use-cases/delete-course/delete-course.use-case';
import { EnrollStudentUseCase } from './application/use-cases/enroll-student/enroll-student.use-case';
import { GetCourseUseCase } from './application/use-cases/get-course/get-course.use-case';
import { GetEnrollmentUseCase } from './application/use-cases/get-enrollment/get-enrollment.use-case';
import { ListCoursesUseCase } from './application/use-cases/list-courses/list-courses.use-case';
import { ListStudentEnrollmentsUseCase } from './application/use-cases/list-student-enrollments/list-student-enrollments.use-case';
import { RemoveLessonUseCase } from './application/use-cases/remove-lesson/remove-lesson.use-case';
import { ResetEnrollmentProgressUseCase } from './application/use-cases/reset-enrollment-progress/reset-enrollment-progress.use-case';
import { SyncStudentLicenseUseCase } from './application/use-cases/sync-student-license/sync-student-license.use-case';
import { UpdateCourseUseCase } from './application/use-cases/update-course/update-course.use-case';
import { CourseEnrollmentRepository } from './domain/repositories/course-enrollment.repository';
import { CourseRepository } from './domain/repositories/course.repository';
import { StudentLicenseProfileRepository } from './domain/repositories/student-license-profile.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import {
  REDIS_CLIENT,
  RedisCourseCacheService,
} from './infrastructure/cache/redis-course-cache.service';
import {
  ANALYTICS_SERVICE_CLIENT,
  MEDIA_SERVICE_CLIENT,
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import {
  AUDIT_SERVICE_CLIENT,
  AuditOutboxRelayService,
} from './infrastructure/outbox/audit-outbox-relay.service';
import { PrismaCourseEnrollmentRepository } from './infrastructure/persistence/prisma/prisma-course-enrollment.repository';
import { PrismaCourseRepository } from './infrastructure/persistence/prisma/prisma-course.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PrismaStudentLicenseProfileRepository } from './infrastructure/persistence/prisma/prisma-student-license-profile.repository';
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
      {
        name: ANALYTICS_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'analytics_service_events',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: AUDIT_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'audit_service_events',
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
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = new Redis(
          configService.get<string>('redis.url') ?? 'redis://127.0.0.1:6379',
          {
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
          },
        );
        redis.on('error', () => undefined);
        return redis;
      },
    },

    // Repository bindings
    { provide: CourseRepository, useClass: PrismaCourseRepository },
    {
      provide: CourseEnrollmentRepository,
      useClass: PrismaCourseEnrollmentRepository,
    },
    {
      provide: StudentLicenseProfileRepository,
      useClass: PrismaStudentLicenseProfileRepository,
    },

    // EventPublisher binding
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },
    AuditOutboxRelayService,
    { provide: CourseCachePort, useClass: RedisCourseCacheService },

    // Course use cases
    CreateCourseUseCase,
    UpdateCourseUseCase,
    ActivateCourseUseCase,
    AddLessonUseCase,
    RemoveLessonUseCase,
    AddCourseMaterialUseCase,
    GetCourseUseCase,
    ListCoursesUseCase,
    DeleteCourseUseCase,

    // Enrollment use cases
    EnrollStudentUseCase,
    CompleteLessonUseCase,
    GetEnrollmentUseCase,
    ListStudentEnrollmentsUseCase,
    ResetEnrollmentProgressUseCase,
    SyncStudentLicenseUseCase,
  ],
})
export class CourseModule {}
