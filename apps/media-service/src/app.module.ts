import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  AppLoggerModule,
  ConsulConfigFactory,
  HealthModule,
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
import { MediaModule } from './media.module';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'media-service',
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
            port: Joi.number().default(3010),
            database: Joi.object({
              url: Joi.string().required(),
            }).optional(),
            rabbitmq: Joi.object({
              url: Joi.string().required(),
            }).optional(),
            keycloak: Joi.object({
              authServerUrl: Joi.string().required(),
              realm: Joi.string().required(),
              clientId: Joi.string().required(),
              clientSecret: Joi.string().optional(),
            }).required(),
            storage: Joi.object({
              accountName: Joi.string().required(),
              accountKey: Joi.string().required(),
              containerName: Joi.string().default('media'),
              presignedUrlExpiry: Joi.number().default(3600),
            }).optional(),
          }).unknown(true),
          'media-service',
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
    MediaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
