import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';
import {
  AppLoggerModule,
  ConsulConfigFactory,
  createRabbitMqClientOptions,
  HealthModule,
  MetricsModule,
  TokenBlacklistGuard,
  TokenBlacklistModule,
} from '@repo/common';
import Joi from 'joi';
import {
  AuthGuard,
  KeycloakConnectModule,
  KeycloakConnectOptions,
  PolicyEnforcementMode,
  ResourceGuard,
  RoleGuard,
  TokenValidation,
} from 'nest-keycloak-connect';
import { NotificationEventPublisher } from './application/ports/event-publisher.port';
import { MailProvider } from './application/ports/mail.provider';
import { PushProvider } from './application/ports/push.provider';
import { SocketAuthPort } from './application/ports/socket-auth.port';
import {
  WsEmitterPort,
  WsServerBinderPort,
} from './application/ports/ws-emitter.port';
import { NotificationDispatcher } from './application/services/notification-dispatcher.service';
import { GetNotificationPreferencesUseCase } from './application/use-cases/get-notification-preferences/get-notification-preferences.use-case';
import { ListNotificationsUseCase } from './application/use-cases/list-notifications/list-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from './application/use-cases/mark-all-notifications-read/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/mark-notification-read/mark-notification-read.use-case';
import { QueueAcademicWarningsUseCase } from './application/use-cases/queue-academic-warnings/queue-academic-warnings.use-case';
import { RegisterDeviceTokenUseCase } from './application/use-cases/register-device-token/register-device-token.use-case';
import { RetryAcademicWarningsUseCase } from './application/use-cases/retry-academic-warnings/retry-academic-warnings.use-case';
import { SendAcademicWarningUseCase } from './application/use-cases/send-academic-warning/send-academic-warning.use-case';
import { SendCourseUpdateUseCase } from './application/use-cases/send-course-update/send-course-update.use-case';
import { SendExamResultUseCase } from './application/use-cases/send-exam-result/send-exam-result.use-case';
import { SendPasswordResetUseCase } from './application/use-cases/send-password-reset/send-password-reset.use-case';
import { SendWelcomeEmailUseCase } from './application/use-cases/send-welcome-email/send-welcome-email.use-case';
import { UnregisterDeviceTokenUseCase } from './application/use-cases/unregister-device-token/unregister-device-token.use-case';
import { UpdateNotificationPreferencesUseCase } from './application/use-cases/update-notification-preferences/update-notification-preferences.use-case';
import { DeviceTokenRepository } from './domain/repositories/device-token.repository';
import { NotificationRepository } from './domain/repositories/notification.repository';
import { KeycloakJwtVerifierService } from './infrastructure/auth/keycloak-jwt-verifier.service';
import {
  NOTIFICATION_EVENT_CLIENT,
  RabbitMqNotificationEventPublisher,
} from './infrastructure/messaging/notification-event.publisher';
import { NotificationMetrics } from './infrastructure/metrics/notification.metrics';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PrismaDeviceTokenRepository } from './infrastructure/persistence/prisma/prisma-device-token.repository';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma/prisma-notification.repository';
import { FcmPushProvider } from './infrastructure/providers/fcm-push.provider';
import { SmtpMailProvider } from './infrastructure/providers/smtp.provider';
import { SocketIoNotificationEmitter } from './infrastructure/websockets/socket-io-notification-emitter.adapter';
import { NotificationGateway } from './presentation/gateways/notification.gateway';
import { DeviceTokenController } from './presentation/http/device-token.controller';
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
        { name: 'redis', configKey: 'redis.url' },
        {
          name: 'keycloak',
          configKey: 'keycloak.healthUrl',
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
            redis: Joi.object({
              url: Joi.string().default('redis://localhost:6379'),
            }).default(),
            keycloak: Joi.object({
              authServerUrl: Joi.string().default('http://localhost:8080'),
              healthUrl: Joi.string().optional(),
              realm: Joi.string().default('luyen-thi-lai-xe-realm'),
              clientId: Joi.string().default('nestjs-backend'),
              clientSecret: Joi.string().optional(),
              timeoutMs: Joi.number().default(10000),
            }).default(),
            smtp: Joi.object({
              host: Joi.string().default('localhost'),
              port: Joi.number().default(1025),
              user: Joi.string().allow('').default(''),
              pass: Joi.string().allow('').default(''),
              from: Joi.string().default('no-reply@luyen-thi-lai-xe.local'),
              secure: Joi.boolean().optional(),
              starttls: Joi.boolean().optional(),
            }).default(),
            push: Joi.object({
              fcmCredentials: Joi.string().allow('').default(''),
            }).default(),
            retry: Joi.object({
              maxAttempts: Joi.number().optional(),
              intervalMs: Joi.number().optional(),
              delaysMs: Joi.array().items(Joi.number().min(1000)).optional(),
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
    ClientsModule.registerAsync([
      {
        name: NOTIFICATION_EVENT_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          createRabbitMqClientOptions(
            configService,
            'notification_service_events',
          ),
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
        secret: configService.get<string>('keycloak.clientSecret') ?? '',
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        tokenValidation: TokenValidation.OFFLINE,
      }),
    }),
    TokenBlacklistModule,
  ],
  controllers: [
    NotificationController,
    DeviceTokenController,
    MessagingController,
  ],
  providers: [
    PrismaService,
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    { provide: DeviceTokenRepository, useClass: PrismaDeviceTokenRepository },
    { provide: MailProvider, useClass: SmtpMailProvider },
    { provide: PushProvider, useClass: FcmPushProvider },
    SocketIoNotificationEmitter,
    { provide: WsEmitterPort, useExisting: SocketIoNotificationEmitter },
    { provide: WsServerBinderPort, useExisting: SocketIoNotificationEmitter },
    { provide: SocketAuthPort, useClass: KeycloakJwtVerifierService },
    {
      provide: NotificationEventPublisher,
      useClass: RabbitMqNotificationEventPublisher,
    },
    NotificationDispatcher,
    NotificationMetrics,
    NotificationGateway,
    SendWelcomeEmailUseCase,
    SendExamResultUseCase,
    SendAcademicWarningUseCase,
    SendPasswordResetUseCase,
    SendCourseUpdateUseCase,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetNotificationPreferencesUseCase,
    UpdateNotificationPreferencesUseCase,
    RetryAcademicWarningsUseCase,
    QueueAcademicWarningsUseCase,
    RegisterDeviceTokenUseCase,
    UnregisterDeviceTokenUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TokenBlacklistGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
