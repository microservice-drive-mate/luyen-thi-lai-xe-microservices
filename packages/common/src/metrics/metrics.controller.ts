import { Controller, Get, Header, SetMetadata } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@SetMetadata('unprotected', true)
@SetMetadata('skip-auth', true)
@SetMetadata('skip-api-response', true)
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
