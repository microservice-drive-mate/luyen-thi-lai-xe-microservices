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
  TokenBlacklistModule,
  TokenBlacklistGuard,
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
import { GetAuditLogUseCase } from './application/use-cases/get-audit-log.use-case';
import { ListAuditLogsUseCase } from './application/use-cases/list-audit-logs.use-case';
import { RecordAuditLogUseCase } from './application/use-cases/record-audit-log.use-case';
import { AuditLogRepository } from './domain/repositories/audit-log.repository';
import { PrismaAuditLogRepository } from './infrastructure/persistence/prisma/prisma-audit-log.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { AuditLogController } from './presentation/http/audit-log.controller';
import {
  ANALYTICS_SERVICE_CLIENT,
  MessagingController,
} from './presentation/messaging/messaging.controller';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'audit-service',
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
    MetricsModule.register({ serviceName: 'audit-service' }),
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
            database: Joi.object({ url: Joi.string().required() }).optional(),
            rabbitmq: Joi.object({ url: Joi.string().required() }).optional(),
            keycloak: Joi.object({
              authServerUrl: Joi.string().required(),
              realm: Joi.string().required(),
              clientId: Joi.string().required(),
              clientSecret: Joi.string().optional(),
              timeoutMs: Joi.number().default(10000),
            }).required(),
          }).unknown(true),
          'audit-service',
        ),
      ],
      isGlobal: true,
    }),
    ClientsModule.registerAsync([
      {
        name: ANALYTICS_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) =>
          createRabbitMqClientOptions(
            configService,
            'analytics_service_events',
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
  controllers: [AuditLogController, MessagingController],
  providers: [
    PrismaService,
    { provide: AuditLogRepository, useClass: PrismaAuditLogRepository },
    RecordAuditLogUseCase,
    ListAuditLogsUseCase,
    GetAuditLogUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TokenBlacklistGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
