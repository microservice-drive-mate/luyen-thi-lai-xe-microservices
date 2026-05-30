import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { APP_GUARD } from '@nestjs/core';
import {
  KeycloakConnectModule,
  KeycloakConnectOptions,
  PolicyEnforcementMode,
  TokenValidation,
} from 'nest-keycloak-connect';

import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { JwtRoleGuard } from './infrastructure/guards/jwt-role.guard';
import Redis from 'ioredis';
import Joi from 'joi';
import {
  AppLoggerModule,
  ConsulConfigFactory,
  createRabbitMqClientOptions,
  HealthModule,
  MetricsModule,
} from '@repo/common';

import { AuthController } from './presentation/http/auth.controller';
import { AdminController } from './presentation/http/admin.controller';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import {
  TokenBlacklistService,
  REDIS_CLIENT,
} from './infrastructure/token-blacklist/token-blacklist.service';
import { TokenBlacklistGuard } from './infrastructure/guards/token-blacklist.guard';
import { KeycloakAdminService } from './infrastructure/keycloak-admin/keycloak-admin.service';
import {
  IdentityEventPublisher,
  USER_SERVICE_CLIENT,
  NOTI_SERVICE_CLIENT,
} from './infrastructure/messaging/identity-event-publisher.service';
import {
  RabbitMqAuditPublisher,
  AUDIT_SERVICE_CLIENT,
} from './infrastructure/messaging/rabbitmq-audit-publisher.service';
import { IdentityProviderPort } from './application/ports/identity-provider.port';
import { TokenBlacklistPort } from './application/ports/token-blacklist.port';
import { IdentityEventPublisherPort } from './application/ports/identity-event-publisher.port';
import { AuditPublisherPort } from './application/ports/audit-publisher.port';
import { IdentityUserRepository } from './domain/repositories/identity-user.repository';
import { PrismaIdentityUserRepository } from './infrastructure/persistence/prisma/prisma-identity-user.repository';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password/forgot-password.use-case';
import { CreateIdentityUserUseCase } from './application/use-cases/create-identity-user/create-identity-user.use-case';
import { ListIdentityUsersUseCase } from './application/use-cases/list-identity-users/list-identity-users.use-case';
import { GetIdentityUserUseCase } from './application/use-cases/get-identity-user/get-identity-user.use-case';
import { UpdateIdentityUserUseCase } from './application/use-cases/update-identity-user/update-identity-user.use-case';
import { ChangeUserRoleUseCase } from './application/use-cases/change-user-role/change-user-role.use-case';
import { LockUserUseCase } from './application/use-cases/lock-user/lock-user.use-case';
import { DeleteIdentityUserUseCase } from './application/use-cases/delete-identity-user/delete-identity-user.use-case';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'identity-service',
      dependencies: [
        { name: 'database', configKey: 'database.url' },
        { name: 'rabbitmq', configKey: 'rabbitmq.url' },
        {
          name: 'keycloak',
          configKey: 'keycloak.authServerUrl',
          kind: 'http',
        },
      ],
    }),
    MetricsModule.register({ serviceName: 'identity-service' }),
    HttpModule,
    ConfigModule.forRoot({
      envFilePath: ConsulConfigFactory.envFilePaths(),
      load: [
        ConsulConfigFactory.create(
          Joi.object({
            nodeEnv: Joi.string()
              .valid(
                'development',
                'development-local',
                'staging',
                'production',
                'test',
              )
              .default('development'),
            port: Joi.number().default(3000),
            database: Joi.object({
              url: Joi.string().required(),
              poolSize: Joi.number().default(10),
              connectionTimeout: Joi.number().default(5000),
            }).optional(),
            rabbitmq: Joi.object({
              url: Joi.string().required(),
              username: Joi.string().default('guest'),
              password: Joi.string().default('guest'),
              vhost: Joi.string().default('/'),
              connectionTimeout: Joi.number().default(10000),
              heartbeat: Joi.number().default(60),
            }).optional(),
            redis: Joi.object({
              url: Joi.string().default('redis://localhost:6379'),
            }).optional(),
            keycloak: Joi.object({
              authServerUrl: Joi.string().uri().required(),
              realm: Joi.string().required(),
              clientId: Joi.string().required(),
              clientSecret: Joi.string().required(),
              timeoutMs: Joi.number().default(10000),
            }).required(),
          }).unknown(true),
          'identity-service',
        ),
      ],
      isGlobal: true,
    }),
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
    KeycloakConnectModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): KeycloakConnectOptions => ({
        authServerUrl: configService.getOrThrow<string>(
          'keycloak.authServerUrl',
        ),
        realm: configService.getOrThrow<string>('keycloak.realm'),
        clientId: configService.getOrThrow<string>('keycloak.clientId'),
        secret: configService.getOrThrow<string>('keycloak.clientSecret'),
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        tokenValidation: TokenValidation.OFFLINE,
      }),
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    PrismaService,
    KeycloakAdminService,
    IdentityEventPublisher,
    RabbitMqAuditPublisher,
    TokenBlacklistService,
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
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('redis.url') ?? 'redis://localhost:6379';
        return new Redis(redisUrl);
      },
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TokenBlacklistGuard },
    { provide: APP_GUARD, useClass: JwtRoleGuard },
  ],
})
export class AppModule {}
