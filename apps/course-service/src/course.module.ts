import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { createRabbitMqClientOptions } from '@repo/common';
import Redis from 'ioredis';
import { CourseCachePort } from './application/ports/course-cache.port';
import { EventPublisher } from './application/ports/event-publisher.port';
import { ActivateCourseUseCase } from './application/use-cases/activate-course/activate-course.use-case';
import { AddCourseMaterialUseCase } from './application/use-cases/add-course-material/add-course-material.use-case';
import { AddLessonUseCase } from './application/use-cases/add-lesson/add-lesson.use-case';
import { CompleteLessonUseCase } from './application/use-cases/complete-lesson/complete-lesson.use-case';
import { CreateCourseScheduleUseCase } from './application/use-cases/create-course-schedule/create-course-schedule.use-case';
import { CreateCourseUseCase } from './application/use-cases/create-course/create-course.use-case';
import { DeleteCourseScheduleUseCase } from './application/use-cases/delete-course-schedule/delete-course-schedule.use-case';
import { DeleteCourseUseCase } from './application/use-cases/delete-course/delete-course.use-case';
import { EnrollStudentUseCase } from './application/use-cases/enroll-student/enroll-student.use-case';
import { GetCourseUseCase } from './application/use-cases/get-course/get-course.use-case';
import { GetEnrollmentUseCase } from './application/use-cases/get-enrollment/get-enrollment.use-case';
import { ListCoursesUseCase } from './application/use-cases/list-courses/list-courses.use-case';
import { ListCourseSchedulesUseCase } from './application/use-cases/list-course-schedules/list-course-schedules.use-case';
import { ListStudentEnrollmentsUseCase } from './application/use-cases/list-student-enrollments/list-student-enrollments.use-case';
import { RemoveLessonUseCase } from './application/use-cases/remove-lesson/remove-lesson.use-case';
import { ResetEnrollmentProgressUseCase } from './application/use-cases/reset-enrollment-progress/reset-enrollment-progress.use-case';
import { SyncStudentLicenseUseCase } from './application/use-cases/sync-student-license/sync-student-license.use-case';
import { UpdateCourseScheduleUseCase } from './application/use-cases/update-course-schedule/update-course-schedule.use-case';
import { UpdateCourseUseCase } from './application/use-cases/update-course/update-course.use-case';
import { CourseEnrollmentRepository } from './domain/repositories/course-enrollment.repository';
import { CourseRepository } from './domain/repositories/course.repository';
import { CourseScheduleRepository } from './domain/repositories/course-schedule.repository';
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
import { PrismaCourseScheduleRepository } from './infrastructure/persistence/prisma/prisma-course-schedule.repository';
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
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'course_service_publish'),
      },
      {
        name: MEDIA_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'media_service_events'),
      },
      {
        name: ANALYTICS_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'analytics_service_events'),
      },
      {
        name: AUDIT_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'audit_service_events'),
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
      provide: CourseScheduleRepository,
      useClass: PrismaCourseScheduleRepository,
    },
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
    CreateCourseScheduleUseCase,
    UpdateCourseScheduleUseCase,
    DeleteCourseScheduleUseCase,
    ListCourseSchedulesUseCase,
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
