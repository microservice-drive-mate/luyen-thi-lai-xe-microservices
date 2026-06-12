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
import Redis from 'ioredis';
import {
  AppLoggerModule,
  ConsulConfigFactory,
  HealthModule,
  MetricsModule,
  TokenBlacklistModule,
  TokenBlacklistGuard,
} from '@repo/common';
import Joi from 'joi';
import { GetAdminDashboardUseCase } from './application/use-cases/get-admin-dashboard/get-admin-dashboard.use-case';
import { LearningProgressRepository } from './domain/repositories/learning-progress.repository';
import { AdminDashboardRepository } from './domain/repositories/admin-dashboard.repository';
import {
  ProgressCacheService,
  REDIS_CLIENT,
} from './infrastructure/cache/progress-cache.service';
import { PrismaAdminDashboardRepository } from './infrastructure/persistence/prisma/prisma-admin-dashboard.repository';
import { PrismaLearningProgressRepository } from './infrastructure/persistence/prisma/prisma-learning-progress.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { GetProgressUseCase } from './application/use-cases/get-progress/get-progress.use-case';
import { RecordLearningEventUseCase } from './application/use-cases/record-events/record-events.use-case';
import { RecordDashboardEventUseCase } from './application/use-cases/record-dashboard-event/record-dashboard-event.use-case';
import { BackfillAdminDashboardUseCase } from './application/use-cases/backfill-admin-dashboard/backfill-admin-dashboard.use-case';
import { AnalyticsController } from './presentation/http/analytics.controller';
import { AdminDashboardController } from './presentation/http/admin-dashboard.controller';
import { MessagingController } from './presentation/messaging/messaging.controller';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'analytics-service',
      dependencies: [
        { name: 'database', configKey: 'database.url' },
        { name: 'rabbitmq', configKey: 'rabbitmq.url' },
        { name: 'redis', configKey: 'redis.url' },
        {
          name: 'keycloak',
          configKey: 'keycloak.authServerUrl',
          kind: 'http',
        },
      ],
    }),
    MetricsModule.register({ serviceName: 'analytics-service' }),
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
            }).optional(),
            keycloak: Joi.object({
              authServerUrl: Joi.string().default('http://localhost:8080'),
              realm: Joi.string().default('luyen-thi-lai-xe-realm'),
              clientId: Joi.string().default('nestjs-backend'),
              clientSecret: Joi.string().optional(),
              timeoutMs: Joi.number().default(10000),
            }).default(),
          }).unknown(true),
          'analytics-service',
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
    TokenBlacklistModule,
  ],
  controllers: [
    AnalyticsController,
    AdminDashboardController,
    MessagingController,
  ],
  providers: [
    PrismaService,
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
    ProgressCacheService,
    {
      provide: LearningProgressRepository,
      useClass: PrismaLearningProgressRepository,
    },
    {
      provide: AdminDashboardRepository,
      useClass: PrismaAdminDashboardRepository,
    },
    GetProgressUseCase,
    GetAdminDashboardUseCase,
    RecordLearningEventUseCase,
    RecordDashboardEventUseCase,
    BackfillAdminDashboardUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TokenBlacklistGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
