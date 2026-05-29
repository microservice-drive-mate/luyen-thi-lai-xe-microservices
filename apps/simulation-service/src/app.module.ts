import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
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
} from '@repo/common';
import Joi from 'joi';
import {
  GetManeuverUseCase,
  ListManeuverErrorsUseCase,
  ListManeuversUseCase,
  SaveSimulationAnswerUseCase,
  StartSimulationSessionUseCase,
  SubmitSimulationSessionUseCase,
} from './application/use-cases/simulation.use-cases';
import {
  EndPractice2dSessionUseCase,
  GetPractice2dSessionUseCase,
  IngestPractice2dTelemetryUseCase,
  StartPractice2dSessionUseCase,
} from './application/use-cases/practice2d/practice2d.use-cases';
import { EventPublisher } from './application/ports/event-publisher.port';
import { Practice2dSessionRepository } from './domain/repositories/practice2d-session.repository';
import { SimulationRepository } from './domain/repositories/simulation.repository';
import {
  ManeuverErrorCacheService,
  REDIS_CLIENT,
} from './infrastructure/cache/maneuver-error-cache.service';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PrismaPractice2dSessionRepository } from './infrastructure/persistence/prisma/prisma-practice2d-session.repository';
import { PrismaSimulationRepository } from './infrastructure/persistence/prisma/prisma-simulation.repository';
import {
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import { SimulationController } from './presentation/http/simulation.controller';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'simulation-service',
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
    MetricsModule.register({ serviceName: 'simulation-service' }),
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('rabbitmq.url') ??
                'amqp://localhost:5672',
            ],
            queue: 'simulation_service_publish',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
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
          'simulation-service',
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
  controllers: [SimulationController],
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
    ManeuverErrorCacheService,
    { provide: SimulationRepository, useClass: PrismaSimulationRepository },
    {
      provide: Practice2dSessionRepository,
      useClass: PrismaPractice2dSessionRepository,
    },
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },
    ListManeuversUseCase,
    GetManeuverUseCase,
    ListManeuverErrorsUseCase,
    StartSimulationSessionUseCase,
    SaveSimulationAnswerUseCase,
    SubmitSimulationSessionUseCase,
    StartPractice2dSessionUseCase,
    IngestPractice2dTelemetryUseCase,
    EndPractice2dSessionUseCase,
    GetPractice2dSessionUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
