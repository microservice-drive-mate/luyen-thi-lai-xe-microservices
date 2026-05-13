import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
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
import { AppLoggerModule, ConsulConfigFactory } from '@repo/common';

import { AuthController } from './presentation/http/auth.controller';
import { AdminController } from './presentation/http/admin.controller';
import { AppService } from './app.service';
import { AdminService } from './admin.service';
import { PrismaService } from './prisma/prisma.service';
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

@Module({
  imports: [
    AppLoggerModule,
    HttpModule,
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
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('rabbitmq.url') ??
                'amqp://localhost:5672',
            ],
            queue: 'user_service_events',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: NOTI_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('rabbitmq.url') ??
                'amqp://localhost:5672',
            ],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
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
    AppService,
    AdminService,
    PrismaService,
    KeycloakAdminService,
    IdentityEventPublisher,
    TokenBlacklistService,
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
