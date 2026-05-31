import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { METRICS_MODULE_OPTIONS } from './metrics.constants';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsModuleOptions, MetricsService } from './metrics.service';

@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules conventionally expose a static register method.
export class MetricsModule {
  static register(options: MetricsModuleOptions): DynamicModule {
    return {
      module: MetricsModule,
      controllers: [MetricsController],
      providers: [
        MetricsService,
        {
          provide: METRICS_MODULE_OPTIONS,
          useValue: options,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: MetricsInterceptor,
        },
      ],
      exports: [MetricsService],
    };
  }
}
