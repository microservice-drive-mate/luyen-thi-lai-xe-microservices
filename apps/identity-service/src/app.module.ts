import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrismaService } from './prisma/prisma.service';
import { AppLoggerModule, ConsulConfigFactory } from '@repo/common';
import Joi from 'joi';
import {
  KeycloakConnectModule,
  RoleGuard,
  AuthGuard,
} from 'nest-keycloak-connect';
import { APP_GUARD } from '@nestjs/core';
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
          }).unknown(true),
          'identity-service',
        ),
      ],
      isGlobal: true,
    }),
    ClientsModule.registerAsync([
      {
        name: 'NOTI_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('rabbitmq.url') ??
                'amqp://localhost:5672',
            ],
            queue: 'notification_queue',
          },
        }),
      },
    ]),
    KeycloakConnectModule.register({
      authServerUrl: 'http://keycloak:8080', // URL nội bộ trong docker
      realm: 'luyen-thi-lai-xe-realm',
      clientId: 'nestjs-backend',
      secret: 'FkUamLTRQOOAcRyLN4qaiPceoM5g8dwJ', // Lấy trong tab Credentials của client
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    // Guard kiểm tra xem có Token hợp lệ không
    { provide: APP_GUARD, useClass: AuthGuard },
    // Guard kiểm tra Role của User
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule {}
