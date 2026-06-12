import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { createRabbitMqClientOptions } from '@repo/common';
import { EventPublisher } from './application/ports/event-publisher.port';
import { AssignLicenseTierUseCase } from './application/use-cases/assign-license-tier/assign-license-tier.use-case';
import { CreateUserProfileUseCase } from './application/use-cases/create-user-profile/create-user-profile.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile/get-user-profile.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users/list-users.use-case';
import { LockUserUseCase } from './application/use-cases/lock-user/lock-user.use-case';
import { SyncUserIdentityUseCase } from './application/use-cases/sync-user-identity/sync-user-identity.use-case';
import { SyncUserRoleUseCase } from './application/use-cases/sync-user-role/sync-user-role.use-case';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile/update-user-profile.use-case';
import { UserProfileRepository } from './domain/repositories/user-profile.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import {
  ANALYTICS_SERVICE_CLIENT,
  COURSE_SERVICE_CLIENT,
  MEDIA_SERVICE_CLIENT,
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import {
  AUDIT_SERVICE_CLIENT,
  AuditOutboxRelayService,
} from './infrastructure/outbox/audit-outbox-relay.service';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma/prisma-user-profile.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { AdminUserController } from './presentation/http/admin-user.controller';
import { UserController } from './presentation/http/user.controller';
import { MessagingController } from './presentation/messaging/messaging.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'user_service_publish'),
      },
      {
        name: MEDIA_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'media_service_events'),
      },
      {
        name: COURSE_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'course_service_events'),
      },
      {
        name: AUDIT_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'audit_service_events'),
      },
      {
        name: ANALYTICS_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'analytics_service_events'),
      },
    ]),
  ],
  controllers: [UserController, AdminUserController, MessagingController],
  providers: [
    PrismaService,
    DomainExceptionFilter,

    { provide: UserProfileRepository, useClass: PrismaUserProfileRepository },
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },
    AuditOutboxRelayService,

    CreateUserProfileUseCase,
    UpdateUserProfileUseCase,
    GetUserProfileUseCase,
    ListUsersUseCase,
    LockUserUseCase,
    AssignLicenseTierUseCase,
    SyncUserIdentityUseCase,
    SyncUserRoleUseCase,
  ],
})
export class UserModule {}
