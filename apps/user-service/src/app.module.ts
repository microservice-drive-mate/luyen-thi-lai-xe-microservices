import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  AppLoggerModule,
  ConsulConfigFactory,
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
import { UserModule } from './user.module';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'user-service',
      dependencies: [
        { name: 'database', configKey: 'database.url' },
        { name: 'rabbitmq', configKey: 'rabbitmq.url' },
        {
          name: 'keycloak',
          configKey: 'keycloak.healthUrl',
          kind: 'http',
        },
      ],
    }),
    MetricsModule.register({ serviceName: 'user-service' }),
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
            database: Joi.object({
              url: Joi.string().required(),
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
              authServerUrl: Joi.string().required(),
              healthUrl: Joi.string().optional(),
              realm: Joi.string().required(),
              clientId: Joi.string().required(),
              clientSecret: Joi.string().optional(),
              timeoutMs: Joi.number().default(10000),
            }).required(),
          }).unknown(true),
          'user-service',
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
    UserModule,
    TokenBlacklistModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TokenBlacklistGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: ResourceGuard },
  ],
})
export class AppModule {}
