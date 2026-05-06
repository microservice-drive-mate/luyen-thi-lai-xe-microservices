import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisher } from './application/ports/event-publisher.port';
import { AssignLicenseTierUseCase } from './application/use-cases/assign-license-tier/assign-license-tier.use-case';
import { CreateUserProfileUseCase } from './application/use-cases/create-user-profile/create-user-profile.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile/get-user-profile.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users/list-users.use-case';
import { LockUserUseCase } from './application/use-cases/lock-user/lock-user.use-case';
import { SyncUserRoleUseCase } from './application/use-cases/sync-user-role/sync-user-role.use-case';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile/update-user-profile.use-case';
import { UserProfileRepository } from './domain/repositories/user-profile.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import {
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma/prisma-user-profile.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { UserController } from './presentation/http/user.controller';
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
              config.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672',
            ],
            queue: 'user_service_publish',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [UserController, MessagingController],
  providers: [
    // Infrastructure
    PrismaService,
    DomainExceptionFilter,

    // Repository binding
    { provide: UserProfileRepository, useClass: PrismaUserProfileRepository },

    // EventPublisher binding
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },

    // Use cases
    CreateUserProfileUseCase,
    UpdateUserProfileUseCase,
    GetUserProfileUseCase,
    ListUsersUseCase,
    LockUserUseCase,
    AssignLicenseTierUseCase,
    SyncUserRoleUseCase,
  ],
})
export class UserModule {}
