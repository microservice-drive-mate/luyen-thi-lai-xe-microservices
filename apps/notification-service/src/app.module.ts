import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  AuthGuard,
  KeycloakConnectModule,
  KeycloakConnectOptions,
  PolicyEnforcementMode,
  ResourceGuard,
  RoleGuard,
  TokenValidation,
} from 'nest-keycloak-connect';
import {
  AppLoggerModule,
  ConsulConfigFactory,
  HealthModule,
  MetricsModule,
} from '@repo/common';
import Joi from 'joi';
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
  RetryAcademicWarningsUseCase,
  SendAcademicWarningUseCase,
} from './application/use-cases/notification.use-cases';
import { NotificationRepository } from './domain/repositories/notification.repository';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma/prisma-notification.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { AcademicWarningRetryService } from './infrastructure/retry/academic-warning-retry.service';
import { NotificationController } from './presentation/http/notification.controller';
import { MessagingController } from './presentation/messaging/messaging.controller';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'notification-service',
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
    MetricsModule.register({ serviceName: 'notification-service' }),
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
            keycloak: Joi.object({
              authServerUrl: Joi.string().default('http://localhost:8080'),
              realm: Joi.string().default('luyen-thi-lai-xe-realm'),
              clientId: Joi.string().default('nestjs-backend'),
              clientSecret: Joi.string().optional(),
              timeoutMs: Joi.number().default(10000),
            }).default(),
            notification: Joi.object({
              warningRetryIntervalMs: Joi.number().default(300000),
            }).default(),
          }).unknown(true),
          'notification-service',
        ),
      ],
      isGlobal: true,
    }),
    KeycloakConnectModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): KeycloakConnectOptions => ({
        authServerUrl: configService.getOrThrow<string>(
          'keycloak.authServerUrl',
        ),
        realm: configService.getOrThrow<string>('keycloak.realm'),
        clientId: configService.getOrThrow<string>('keycloak.clientId'),
        secret: configService.get<string>('keycloak.clientSecret') ?? '',
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        tokenValidation: TokenValidation.OFFLINE,
      }),
    }),
  ],
  controllers: [NotificationController, MessagingController],
  providers: [
    PrismaService,
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    SendAcademicWarningUseCase,
    RetryAcademicWarningsUseCase,
    AcademicWarningRetryService,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
