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
  KeycloakConnectModule,
  KeycloakConnectOptions,
  PolicyEnforcementMode,
  TokenValidation,
} from 'nest-keycloak-connect';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { JwtRoleGuard } from './infrastructure/guards/jwt-role.guard';
import { IdentityModule } from './identity.module';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'identity-service',
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
    MetricsModule.register({ serviceName: 'identity-service' }),
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
              timeoutMs: Joi.number().default(10000),
            }).required(),
          }).unknown(true),
          'identity-service',
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
        secret: configService.getOrThrow<string>('keycloak.clientSecret'),
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        tokenValidation: TokenValidation.OFFLINE,
      }),
    }),
    TokenBlacklistModule,
    IdentityModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TokenBlacklistGuard },
    { provide: APP_GUARD, useClass: JwtRoleGuard },
  ],
})
export class AppModule {}
