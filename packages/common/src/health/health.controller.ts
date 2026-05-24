import {
  Controller,
  Get,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import {
  HealthLivenessReport,
  HealthReadinessReport,
  HealthService,
} from './health.service';

@SetMetadata('unprotected', true)
@SetMetadata('skip-auth', true)
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth(): Promise<HealthReadinessReport> {
    const report = await this.healthService.getReadinessReport();
    this.assertReady(report);
    return report;
  }

  @Get('health/live')
  getLiveness(): HealthLivenessReport {
    return this.healthService.getLivenessReport();
  }

  @Get('health/ready')
  async getReadiness(): Promise<HealthReadinessReport> {
    const report = await this.healthService.getReadinessReport();
    this.assertReady(report);
    return report;
  }

  private assertReady(report: HealthReadinessReport): void {
    if (report.status === 'ok') {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service is not ready',
      errors: report,
    });
  }
}
