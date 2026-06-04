import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import {
  createRabbitMqClientOptions,
  TokenBlacklistService,
} from '@repo/common';
import { AuditPublisherPort } from './application/ports/audit-publisher.port';
import { IdentityEventPublisherPort } from './application/ports/identity-event-publisher.port';
import { IdentityProviderPort } from './application/ports/identity-provider.port';
import { TokenBlacklistPort } from './application/ports/token-blacklist.port';
import { ChangeUserRoleUseCase } from './application/use-cases/change-user-role/change-user-role.use-case';
import { CreateIdentityUserUseCase } from './application/use-cases/create-identity-user/create-identity-user.use-case';
import { DeleteIdentityUserUseCase } from './application/use-cases/delete-identity-user/delete-identity-user.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password/forgot-password.use-case';
import { GetIdentityUserUseCase } from './application/use-cases/get-identity-user/get-identity-user.use-case';
import { ListIdentityUsersUseCase } from './application/use-cases/list-identity-users/list-identity-users.use-case';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { LockUserUseCase } from './application/use-cases/lock-user/lock-user.use-case';
import { LogoutUseCase } from './application/use-cases/logout/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';
import { UpdateIdentityUserUseCase } from './application/use-cases/update-identity-user/update-identity-user.use-case';
import { IdentityUserRepository } from './domain/repositories/identity-user.repository';
import { KeycloakAdminService } from './infrastructure/keycloak-admin/keycloak-admin.service';
import {
  IdentityEventPublisher,
  NOTI_SERVICE_CLIENT,
  USER_SERVICE_CLIENT,
} from './infrastructure/messaging/identity-event-publisher.service';
import {
  AUDIT_SERVICE_CLIENT,
  RabbitMqAuditPublisher,
} from './infrastructure/messaging/rabbitmq-audit-publisher.service';
import { PrismaIdentityUserRepository } from './infrastructure/persistence/prisma/prisma-identity-user.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { AdminController } from './presentation/http/admin.controller';
import { AuthController } from './presentation/http/auth.controller';

@Module({
  imports: [
    HttpModule,
    ClientsModule.registerAsync([
      {
        name: USER_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          createRabbitMqClientOptions(configService, 'user_service_events'),
      },
      {
        name: NOTI_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          createRabbitMqClientOptions(
            configService,
            'notification_service_events',
          ),
      },
      {
        name: AUDIT_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          createRabbitMqClientOptions(configService, 'audit_service_events'),
      },
    ]),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    PrismaService,
    KeycloakAdminService,
    IdentityEventPublisher,
    RabbitMqAuditPublisher,
    { provide: IdentityProviderPort, useExisting: KeycloakAdminService },
    { provide: TokenBlacklistPort, useExisting: TokenBlacklistService },
    {
      provide: IdentityEventPublisherPort,
      useExisting: IdentityEventPublisher,
    },
    { provide: AuditPublisherPort, useExisting: RabbitMqAuditPublisher },
    { provide: IdentityUserRepository, useClass: PrismaIdentityUserRepository },
    LoginUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
    ForgotPasswordUseCase,
    CreateIdentityUserUseCase,
    ListIdentityUsersUseCase,
    GetIdentityUserUseCase,
    UpdateIdentityUserUseCase,
    ChangeUserRoleUseCase,
    LockUserUseCase,
    DeleteIdentityUserUseCase,
  ],
})
export class IdentityModule {}
