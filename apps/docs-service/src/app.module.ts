import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScalarLandingController } from './scalar-landing.controller';
import {
  AppLoggerModule,
  ConsulConfigFactory,
  HealthModule,
  MetricsModule,
} from '@repo/common';
import Joi from 'joi';

@Module({
  imports: [
    AppLoggerModule,
    HealthModule.register({
      serviceName: 'docs-service',
    }),
    MetricsModule.register({ serviceName: 'docs-service' }),
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
            port: Joi.number().default(3009),
            swagger: Joi.object({
              services: Joi.string().optional(),
            }).optional(),
          }).unknown(true),
          'docs-service',
        ),
      ],
      isGlobal: true,
    }),
  ],
  controllers: [AppController, ScalarLandingController],
  providers: [AppService],
})
export class AppModule {}
