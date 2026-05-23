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
import { SimulationRepository } from './domain/repositories/simulation.repository';
import {
  ManeuverErrorCacheService,
  REDIS_CLIENT,
} from './infrastructure/cache/maneuver-error-cache.service';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PrismaSimulationRepository } from './infrastructure/persistence/prisma/prisma-simulation.repository';
import { SimulationController } from './presentation/http/simulation.controller';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'simulation-service',
      dependencies: [{ name: 'rabbitmq', configKey: 'rabbitmq.url' }],
    }),
    ConfigModule.forRoot({
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
    ListManeuversUseCase,
    GetManeuverUseCase,
    ListManeuverErrorsUseCase,
    StartSimulationSessionUseCase,
    SaveSimulationAnswerUseCase,
    SubmitSimulationSessionUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
