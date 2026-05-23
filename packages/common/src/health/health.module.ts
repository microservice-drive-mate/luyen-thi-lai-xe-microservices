import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HEALTH_MODULE_OPTIONS } from './health.constants';
import { HealthModuleOptions, HealthService } from './health.service';

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules conventionally expose a static register method.
export class HealthModule {
  static register(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [ConfigModule],
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: HEALTH_MODULE_OPTIONS,
          useValue: options,
        },
      ],
      exports: [HealthService],
    };
  }
}
